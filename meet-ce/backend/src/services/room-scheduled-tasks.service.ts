import { inject, injectable } from 'inversify';
import type { Room } from 'livekit-server-sdk';
import { INTERNAL_CONFIG } from '../config/internal-config.js';
import type { IScheduledTask } from '../models/task-scheduler.model.js';
import { RoomRepository } from '../repositories/room.repository.js';
import { runConcurrently } from '../utils/concurrency.utils.js';
import { LivekitWebhookService } from './livekit-webhook.service.js';
import { LiveKitService } from './livekit.service.js';
import { LoggerService } from './logger.service.js';
import { RoomService } from './room.service.js';
import { TaskSchedulerService } from './task-scheduler.service.js';
import { MeetingSessionModel } from '../models/mongoose-schemas/meeting-session.schema.js';
import { MeetingHostService } from './meeting-host.service.js';

/**
 * Service responsible for managing scheduled tasks related to rooms.
 *
 * This service handles periodic cleanup operations for rooms, such as:
 * - Deleting expired rooms based on their auto-deletion date
 */
@injectable()
export class RoomScheduledTasksService {
	constructor(
		@inject(LoggerService) protected logger: LoggerService,
		@inject(RoomRepository) protected roomRepository: RoomRepository,
		@inject(RoomService) protected roomService: RoomService,
		@inject(TaskSchedulerService) protected taskSchedulerService: TaskSchedulerService,
		@inject(LiveKitService) protected livekitService: LiveKitService,
		@inject(LivekitWebhookService) protected livekitWebhookService: LivekitWebhookService
		,@inject(MeetingHostService) protected meetingHostService: MeetingHostService
	) {
		this.registerScheduledTasks();
	}

	/**
	 * Registers all scheduled tasks related to rooms.
	 */
	protected registerScheduledTasks(): void {
		const expiredRoomsGCTask: IScheduledTask = {
			name: 'expiredRoomsGC',
			type: 'cron',
			scheduleOrDelay: INTERNAL_CONFIG.ROOM_EXPIRED_GC_INTERVAL,
			callback: this.deleteExpiredRooms.bind(this)
		};
		this.taskSchedulerService.registerTask(expiredRoomsGCTask);

		const validateRoomsStatusGCTask: IScheduledTask = {
			name: 'validateRoomsStatusGC',
			type: 'cron',
			scheduleOrDelay: INTERNAL_CONFIG.ROOM_ACTIVE_VERIFICATION_GC_INTERVAL,
			callback: this.validateRoomsStatusGC.bind(this)
		};
		this.taskSchedulerService.registerTask(validateRoomsStatusGCTask);
		this.taskSchedulerService.registerTask({ name: 'staleMeetingSessionsGC', type: 'cron', scheduleOrDelay: '15m', callback: this.reconcileStaleMeetingSessions.bind(this) });
	}

	protected async reconcileStaleMeetingSessions(): Promise<void> {
		const staleBefore = Date.now() - 30 * 60_000;
		const sessions = await MeetingSessionModel.find({ status: { $in: ['active', 'ending'] }, updatedAt: { $lt: staleBefore } }, { roomId: 1, livekitRoomSid: 1 }).limit(200).lean().exec();
		for (const session of sessions) {
			try {
				if (await this.livekitService.roomExists(session.roomId)) continue;
				// 房间记录已被删除时 handleRoomFinished 会在 getMeetRoom 处抛错，场次将永远停滞；
				// 孤儿场次直接按 cancelMeeting 的语义收尾（cancelled）
				const meetRoom = await this.roomRepository.findByRoomId(session.roomId);
				if (!meetRoom) {
					const now = Date.now();
					await MeetingSessionModel.updateMany({ roomId: session.roomId, status: { $in: ['starting', 'active', 'ending'] } }, { $set: { status: 'cancelled', endedAt: now, updatedAt: now } }).exec();
					continue;
				}
				await this.livekitWebhookService.handleRoomFinished({ name: session.roomId, sid: session.livekitRoomSid } as unknown as Room);
			} catch (error) { this.logger.error(`Failed to reconcile stale meeting session '${session.meetingSessionId}':`, error); }
		}
	}

	/**
	 * Performs garbage collection for expired rooms.
	 *
	 * This method checks for rooms that have an auto-deletion date in the past and
	 * tries to delete them based on their auto-deletion policy.
	 */
	protected async deleteExpiredRooms(): Promise<void> {
		this.logger.verbose(`Checking expired rooms at ${new Date(Date.now()).toISOString()}`);

		try {
			const BATCH_SIZE = INTERNAL_CONFIG.BATCH_SIZE_ROOMS_EXPIRED_GC;
			let nextPageToken: string | undefined;
			let hasMore = true;
			let totalDeletedCandidates = 0;
			let hasAnyExpiredRoom = false;

			while (hasMore) {
				const expiredRoomsPage = await this.roomRepository.findExpiredRooms(BATCH_SIZE, nextPageToken);

				if (expiredRoomsPage.rooms.length === 0) {
					break;
				}

				hasAnyExpiredRoom = true;
				totalDeletedCandidates += expiredRoomsPage.rooms.length;
				this.logger.verbose(
					`Trying to delete batch of ${expiredRoomsPage.rooms.length} expired Meet rooms: ${expiredRoomsPage.rooms.map((room) => room.roomId).join(', ')}`
				);

				await this.roomService.bulkDeleteMeetRooms(expiredRoomsPage.rooms);

				hasMore = expiredRoomsPage.isTruncated;
				nextPageToken = expiredRoomsPage.nextPageToken;
			}

			if (!hasAnyExpiredRoom) {
				this.logger.verbose(`No expired rooms found.`);
				return;
			}

			this.logger.verbose(`Expired rooms cleanup finished. Total rooms processed: ${totalDeletedCandidates}`);
		} catch (error) {
			this.logger.error('Error deleting expired rooms:', error);
		}
	}

	/**
	 * Checks for inconsistent rooms.
	 *
	 * This method checks for rooms that are marked as active in the database but do not exist in LiveKit.
	 * If such a room is found, it triggers the room finished logic to clean up the room.
	 */
	protected async validateRoomsStatusGC(): Promise<void> {
		this.logger.verbose(`Checking inconsistent rooms at ${new Date(Date.now()).toISOString()}`);

		try {
			const BATCH_SIZE = INTERNAL_CONFIG.BATCH_SIZE_ROOMS_STATUS_VALIDATION_GC;
			let nextPageToken: string | undefined;
			let hasMore = true;
			let hasAnyActiveRoom = false;
			let totalInconsistentRooms = 0;

			while (hasMore) {
				const activeRoomsPage = await this.roomRepository.findActiveRooms(BATCH_SIZE, nextPageToken);

				if (activeRoomsPage.rooms.length === 0) {
					break;
				}

				hasAnyActiveRoom = true;

				const roomIds: string[] = activeRoomsPage.rooms.map((room) => room.roomId);
				const roomExistenceMap = await this.livekitService.roomsExist(roomIds);

				const roomsToCleanup = activeRoomsPage.rooms.filter((room) => {
					const exists = roomExistenceMap.get(room.roomId);
					return !exists;
				});

				totalInconsistentRooms += roomsToCleanup.length;

				if (roomsToCleanup.length > 0) {
					this.logger.warn(
						`Found ${roomsToCleanup.length} rooms active in DB but not in LiveKit in current batch. Cleaning up...`
					);

					await runConcurrently(
						roomsToCleanup,
						async (room) => {
							try {
								await this.livekitWebhookService.handleRoomFinished({ name: room.roomId } as unknown as Room);
							} catch (error) {
								this.logger.error(`Error cleaning up room '${room.roomId}':`, error);
								// Continue with other rooms even if one fails
							}
						},
						{ concurrency: INTERNAL_CONFIG.CONCURRENCY_VALIDATE_ROOMS_STATUS, failFast: true }
					);
				}

				hasMore = activeRoomsPage.isTruncated;
				nextPageToken = activeRoomsPage.nextPageToken;
			}

			if (!hasAnyActiveRoom) {
				this.logger.verbose(`No active rooms found. Skipping room consistency check.`);
				return;
			}

			if (totalInconsistentRooms === 0) {
				this.logger.verbose(`All active rooms are consistent with LiveKit. No cleanup needed.`);
				return;
			}

			this.logger.warn(`Room consistency check finished. Total inconsistent rooms processed: ${totalInconsistentRooms}`);
		} catch (error) {
			this.logger.error('Error checking inconsistent rooms:', error);
		}
	}
}

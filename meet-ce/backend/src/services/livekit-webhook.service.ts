import { MeetingEndAction, MeetRoomStatus } from '@openvidu-meet/typings';
import { inject, injectable } from 'inversify';
import type { ParticipantInfo, Room, WebhookEvent } from 'livekit-server-sdk';
import { WebhookReceiver } from 'livekit-server-sdk';
import { MEET_ENV } from '../environment.js';
import { MeetRoomHelper } from '../helpers/room.helper.js';
import { RoomMemberRepository } from '../repositories/room-member.repository.js';
import { RoomRepository } from '../repositories/room.repository.js';
import { LiveKitService } from './livekit.service.js';
import { LoggerService } from './logger.service.js';
import { MeetingPresenceService } from './meeting-presence.service.js';
import { MeetingHostService } from './meeting-host.service.js';
import { RoomMemberService } from './room-member.service.js';
import { RoomService } from './room.service.js';
import { TokenService } from './token.service.js';
import { MeetingSessionModel } from '../models/mongoose-schemas/meeting-session.schema.js';

@injectable()
export class LivekitWebhookService {
	protected webhookReceiver: WebhookReceiver;
	constructor(
		@inject(LiveKitService) protected livekitService: LiveKitService,
		@inject(RoomService) protected roomService: RoomService,
		@inject(RoomRepository) protected roomRepository: RoomRepository,
		@inject(RoomMemberService) protected roomMemberService: RoomMemberService,
		@inject(MeetingPresenceService) protected meetingPresenceService: MeetingPresenceService,
		@inject(MeetingHostService) protected meetingHostService: MeetingHostService,
		@inject(RoomMemberRepository) protected roomMemberRepository: RoomMemberRepository,
		@inject(TokenService) protected tokenService: TokenService,
		@inject(LoggerService) protected logger: LoggerService
	) {
		this.webhookReceiver = new WebhookReceiver(MEET_ENV.LIVEKIT_API_KEY, MEET_ENV.LIVEKIT_API_SECRET);
	}

	/**
	 * Retrieves a WebhookEvent from the provided request body and authentication token.
	 * @param body - The request body containing the webhook data.
	 * @param auth - The authentication token for verifying the webhook request.
	 * @returns The WebhookEvent extracted from the request body.
	 */
	async getEventFromWebhook(body: string, auth?: string): Promise<WebhookEvent> {
		try {
			return await this.webhookReceiver.receive(body, auth);
		} catch (error) {
			this.logger.error('Error receiving webhook event', error);
			throw error;
		}
	}

	/**
	 * Checks if the webhook event belongs to JMeet.
	 * Uses a systematic approach to verify through different sources.
	 * !KNOWN ISSUE: Room metadata may be empty when track_publish and track_unpublish events are received.
	 */
	async webhookEventBelongsToOpenViduMeet(webhookEvent: WebhookEvent): Promise<boolean> {
		// Extract relevant properties from the webhook event
		const { room, egressInfo, ingressInfo } = webhookEvent;
		this.logger.debug(`[webhookEventBelongsToOpenViduMeet] Checking webhook event: ${webhookEvent.event}`);

		// Case 1: Check using room object from the event
		if (room) {
			this.logger.debug(`[webhookEventBelongsToOpenViduMeet] Checking room metadata for room: ${room.name}`);

			if (!room.metadata) {
				this.logger.debug(`[webhookEventBelongsToOpenViduMeet] Room metadata is empty for room: ${room.name}`);

				const updatedMetadata = await this.livekitService.getRoomMetadata(room.name);

				if (!updatedMetadata) {
					this.logger.debug(`[webhookEventBelongsToOpenViduMeet] No metadata found for room: ${room.name}`);
				}

				if (MeetRoomHelper.checkIfMeetingBelogsToOpenViduMeet(updatedMetadata)) return true;

				const roomExists = await this.roomService.meetRoomExists(room.name);
				this.logger.debug(
					`[webhookEventBelongsToOpenViduMeet] Room '${room.name}' ${roomExists ? 'exists' : 'does not exist'} in JMeet`
				);
				return roomExists;
			}

			this.logger.debug(`[webhookEventBelongsToOpenViduMeet] Room metadata found for room: ${room.name}`);

			const belongToOpenViduMeet = MeetRoomHelper.checkIfMeetingBelogsToOpenViduMeet(room.metadata);

			if (!belongToOpenViduMeet) {
				this.logger.debug(
					`[webhookEventBelongsToOpenViduMeet] Room metadata does not indicate JMeet for room: ${room.name}`
				);
				return false;
			}

			const roomExists = await this.roomService.meetRoomExists(room.name);

			if (!roomExists) {
				this.logger.debug(
					`[webhookEventBelongsToOpenViduMeet] Room '${room.name}' does not exist in JMeet`
				);
				return false;
			}

			return true;
		}

		// Case 2: No room in event - use roomName from egress/ingress info
		const roomName = egressInfo?.roomName ?? ingressInfo?.roomName;

		if (!roomName) {
			this.logger.debug('[webhookEventBelongsToOpenViduMeet] Room name not found in webhook event');
			return false;
		}

		const updatedMetadata = await this.livekitService.getRoomMetadata(roomName);

		if (MeetRoomHelper.checkIfMeetingBelogsToOpenViduMeet(updatedMetadata)) return true;

		return await this.roomService.meetRoomExists(roomName);
	}

	/**
	 * Handles the 'participant_joined' event by updating presence and meeting session records.
	 * @param room - Information about the room where the participant joined.
	 * @param participant - Information about the newly joined participant.
	 */
	async handleParticipantJoined(room: Room, participant: ParticipantInfo) {
		// Agents and recorders are ignored
		if (!this.livekitService.isStandardParticipant(participant)) return;

		try {
			await MeetingSessionModel.updateOne(
				{ roomId: room.name, status: 'active' },
				{ $addToSet: { participantIdentities: participant.identity }, $set: { updatedAt: Date.now() } }
			).exec();
			const userId = this.getUserIdFromParticipant(participant);

			if (userId) {
				await this.meetingPresenceService.upsertUserInRoom(userId, room.name, participant.identity);
			}
		} catch (error) {
			this.logger.error('Error updating presence on participant join:', error);
		}
	}

	/**
	 * Handles the 'participant_left' event by gathering relevant room and participant information,
	 * and releasing any reserved participant names.
	 * @param room - Information about the room where the participant left.
	 * @param participant - Information about the participant who left.
	 */
	async handleParticipantLeft(room: Room, participant: ParticipantInfo) {
		if (!this.livekitService.isStandardParticipant(participant)) return;

		try {
			const userId = this.getUserIdFromParticipant(participant);

			if (userId) {
				await this.meetingPresenceService.removeUserFromRoom(userId, room.name);
			}

			await Promise.all([
				this.roomMemberService.releaseParticipantName(room.name, participant.name),
				this.meetingHostService.handleParticipantLeft(room.name, participant.identity)
			]);
			this.logger.verbose(`Released name for participant '${participant.name}' in room '${room.name}'`);
		} catch (error) {
			this.logger.error('Error releasing participant name on participant left:', error);
		}
	}

	/**
	 * Handles a room started event from LiveKit.
	 *
	 * This method retrieves the corresponding meet room from the room service using the LiveKit room name.
	 * If the meet room is found, it updates the room status to ACTIVE_MEETING.
	 *
	 * @param {Room} room - The room object that has started.
	 */
	async handleRoomStarted(room: Room) {
		try {
			const roomId = room.name;
			this.logger.info(`Processing room_started event for room: ${roomId}`);
			const now = Date.now();
			const meetingSessionId = `ms_${room.sid}`;
			await MeetingSessionModel.updateOne(
				{ livekitRoomSid: room.sid },
				{ $setOnInsert: { meetingSessionId, roomId, livekitRoomSid: room.sid, status: 'active', startedAt: Number(room.creationTime ?? 0) * 1000 || now, participantIdentities: [], createdAt: now, updatedAt: now } },
				{ upsert: true }
			).exec();

			await this.roomRepository.updatePartial(roomId, {
				status: MeetRoomStatus.ACTIVE_MEETING
			});
		} catch (error) {
			this.logger.error('Error handling room started event:', error);
		}
	}

	/**
	 * Handles a room finished event from LiveKit.
	 *
	 * This method retrieves the corresponding meet room from the room service using the LiveKit room name.
	 * If the meet room is found, it processes the room based on its meeting end action:
	 *
	 * - If the action is DELETE, it deletes the room and all associated members.
	 * - If the action is CLOSE, it closes the room without deleting it.
	 * - If the action is NONE, it simply updates the room status to OPEN.
	 *
	 * @param {Room} room - The room object that has finished.
	 */
	async handleRoomFinished(room: Room): Promise<void> {
		try {
			const roomId = room.name;
			const meetRoom = await this.roomService.getMeetRoom(roomId);

			this.logger.info(`Processing room_finished event for room: ${roomId}`);
			const now = Date.now();
			const sessionQuery = room.sid ? { livekitRoomSid: room.sid } : { roomId, status: { $in: ['starting', 'active', 'ending'] } };
			const session = await MeetingSessionModel.findOneAndUpdate(sessionQuery, { $set: { status: 'ending', endedAt: now, updatedAt: now } }, { new: true, sort: { startedAt: -1 } }).lean().exec();
			if (!session && meetRoom.status !== MeetRoomStatus.ACTIVE_MEETING) {
				this.logger.debug(`Ignoring duplicate room_finished event for room '${roomId}'`);
				return;
			}
			const tasks = [];

			switch (meetRoom.meetingEndAction) {
				case MeetingEndAction.DELETE:
					this.logger.info(
						`Deleting room '${roomId}' after meeting finished because it was scheduled to be deleted`
					);
					tasks.push(
						this.roomMemberRepository.deleteAllByRoomId(roomId),
						this.roomRepository.deleteByRoomId(roomId)
					);
					break;
				case MeetingEndAction.CLOSE:
					this.logger.info(
						`Closing room '${roomId}' after meeting finished because it was scheduled to be closed`
					);
					meetRoom.status = MeetRoomStatus.CLOSED;
					meetRoom.meetingEndAction = MeetingEndAction.NONE;
					tasks.push(
						this.roomRepository.updatePartial(roomId, {
							status: MeetRoomStatus.CLOSED,
							meetingEndAction: MeetingEndAction.NONE
						})
					);
					break;
				default:
					// Update Meet room status to OPEN
					meetRoom.status = MeetRoomStatus.OPEN;
					tasks.push(this.roomRepository.updatePartial(roomId, { status: MeetRoomStatus.OPEN }));
			}

			tasks.push(
				this.meetingPresenceService.removeRoomFromAllUsers(roomId),
				this.roomMemberService.cleanupParticipantNames(roomId)
			);
			try {
				await Promise.all(tasks);
			} catch (error) {
				this.logger.warn(`Error running cleanup tasks after meeting finished for room '${roomId}': ${error}`);
			}
			if (session) {
				await MeetingSessionModel.updateOne({ meetingSessionId: session.meetingSessionId }, { $set: { status: 'completed', updatedAt: Date.now() } }).exec();
			}
		} catch (error) {
			this.logger.error(`Error handling room finished event: ${error}`);
		}
	}

	/**
	 * Extracts the user ID from a LiveKit participant's metadata.
	 *
	 * @param participant - The LiveKit participant from which to extract the user ID.
	 * @returns The user ID if it can be extracted, or undefined if it cannot be determined.
	 */
	protected getUserIdFromParticipant(participant: ParticipantInfo): string | undefined {
		if (!participant.metadata) {
			return undefined;
		}

		try {
			const tokenMetadata = this.tokenService.parseRoomMemberTokenMetadata(participant.metadata);
			return tokenMetadata.userId;
		} catch {
			return undefined;
		}
	}
}

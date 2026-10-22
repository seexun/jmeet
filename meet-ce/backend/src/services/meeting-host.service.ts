import { MeetRoomMemberTokenMetadata, MeetRoomMemberUIBadge, MeetParticipantModerationAction } from '@openvidu-meet/typings';
import { inject, injectable } from 'inversify';
import ms from 'ms';
import { OpenViduMeetError } from '../models/error.model.js';
import { FrontendEventService } from './frontend-event.service.js';
import { LiveKitService } from './livekit.service.js';
import { LoggerService } from './logger.service.js';
import { MutexService } from './mutex.service.js';
import { RedisService } from './redis.service.js';
import { RoomMemberService } from './room-member.service.js';
import { electEligibleMeetingHost, getMeetingHostRank } from '../utils/meeting-host-governance.utils.js';

@injectable()
export class MeetingHostService {
	private readonly stateTtlMs = ms('24h');

	constructor(
		@inject(RedisService) private readonly redisService: RedisService,
		@inject(MutexService) private readonly mutexService: MutexService,
		@inject(LiveKitService) private readonly livekitService: LiveKitService,
		@inject(RoomMemberService) private readonly roomMemberService: RoomMemberService,
		@inject(FrontendEventService) private readonly frontendEventService: FrontendEventService,
		@inject(LoggerService) private readonly logger: LoggerService
	) {}

	async getOrElectHost(roomId: string): Promise<string> {
		const participants = await this.livekitService.listRoomParticipants(roomId);
		if (participants.length === 0) {
			throw new OpenViduMeetError('Host Governance Error', 'The meeting has no active participants', 409);
		}

		const key = this.hostKey(roomId);
		const storedIdentity = await this.redisService.get(key);
		if (storedIdentity && participants.some((participant) => participant.identity === storedIdentity)) {
			return storedIdentity;
		}

		const elected = electEligibleMeetingHost(participants);
		if (!elected) {
			await this.redisService.delete(key);
			throw new OpenViduMeetError('Host Governance Error', 'The meeting has no eligible host', 409);
		}
		await this.redisService.set(key, elected.identity, this.stateTtlMs);
		this.logger.info(`Elected '${elected.identity}' as primary host in room '${roomId}'`);
		await this.frontendEventService.sendHostChangedSignal(roomId, elected.identity);
		return elected.identity;
	}

	async transferHost(roomId: string, actorIdentity: string, targetIdentity: string): Promise<string> {
		if (actorIdentity === targetIdentity) {
			throw new OpenViduMeetError('Host Governance Error', 'The target is already the primary host', 409);
		}

		const result = await this.mutexService.withLock(this.lockKey(roomId), ms('8s'), async () => {
			const currentHost = await this.getOrElectHost(roomId);
			if (currentHost !== actorIdentity) {
				throw new OpenViduMeetError(
					'Host Governance Error',
					'Only the current primary host can transfer host authority',
					403
				);
			}

			const target = await this.livekitService.getParticipant(roomId, targetIdentity);
			const metadata = this.parseMetadata(target.metadata);
			if (metadata?.badge === MeetRoomMemberUIBadge.OTHER) {
				await this.roomMemberService.updateParticipantRole(
					roomId,
					targetIdentity,
					MeetParticipantModerationAction.UPGRADE
				);
			}

			await this.redisService.set(this.hostKey(roomId), targetIdentity, this.stateTtlMs);
			await this.frontendEventService.sendHostChangedSignal(roomId, targetIdentity);
			this.logger.info(`Primary host transferred from '${actorIdentity}' to '${targetIdentity}' in room '${roomId}'`);
			return targetIdentity;
		});

		if (!result) {
			throw new OpenViduMeetError(
				'Host Governance Error',
				'Another host operation is in progress. Please retry shortly',
				409
			);
		}
		return result;
	}

	async claimHost(roomId: string, participantIdentity: string): Promise<string> {
		const result = await this.mutexService.withLock(this.lockKey(roomId), ms('8s'), async () => {
			const participant = await this.livekitService.getParticipant(roomId, participantIdentity);
			if (getMeetingHostRank(participant.metadata) <= 0) {
				throw new OpenViduMeetError('Host Governance Error', 'Only an eligible moderator can take over the meeting', 403);
			}
			const current = await this.redisService.get(this.hostKey(roomId));
			if (current && (await this.livekitService.listRoomParticipants(roomId)).some((item) => item.identity === current)) {
				throw new OpenViduMeetError('Host Governance Error', 'The meeting already has an active host', 409);
			}
			await this.redisService.set(this.hostKey(roomId), participantIdentity, this.stateTtlMs);
			await this.frontendEventService.sendHostChangedSignal(roomId, participantIdentity);
			return participantIdentity;
		});
		if (!result) throw new OpenViduMeetError('Host Governance Error', 'Another host operation is in progress', 409);
		return result;
	}

	async assertPrimaryHost(roomId: string, participantIdentity: string): Promise<void> {
		const hostIdentity = await this.getOrElectHost(roomId);
		if (hostIdentity !== participantIdentity) {
			throw new OpenViduMeetError(
				'Host Governance Error',
				'Only the primary host can perform this operation',
				403
			);
		}
	}

	async assertNotPrimaryHost(roomId: string, participantIdentity: string): Promise<void> {
		const hostIdentity = await this.getOrElectHost(roomId);
		if (hostIdentity === participantIdentity) {
			throw new OpenViduMeetError(
				'Host Governance Error',
				'The primary host must transfer host authority before being removed or demoted',
				409
			);
		}
	}

	async handleParticipantLeft(roomId: string, participantIdentity: string): Promise<string | undefined> {
		const result = await this.mutexService.withLock(this.lockKey(roomId), ms('8s'), async () => {
			const storedHost = await this.redisService.get(this.hostKey(roomId));
			if (storedHost !== participantIdentity) return storedHost ?? undefined;

			const participants = (await this.livekitService.listRoomParticipants(roomId)).filter(
				(participant) => participant.identity !== participantIdentity
			);
			if (participants.length === 0) {
				await this.redisService.delete(this.hostKey(roomId));
				return undefined;
			}

			const nextHost = electEligibleMeetingHost(participants)?.identity;
			if (!nextHost) {
				await this.redisService.delete(this.hostKey(roomId));
				this.logger.warn(`Primary host '${participantIdentity}' left room '${roomId}' without an eligible successor`);
				return undefined;
			}
			await this.redisService.set(this.hostKey(roomId), nextHost, this.stateTtlMs);
			await this.frontendEventService.sendHostChangedSignal(roomId, nextHost);
			this.logger.warn(`Primary host '${participantIdentity}' left room '${roomId}'. Failover host: '${nextHost}'`);
			return nextHost;
		});

		return result ?? undefined;
	}

	async prepareHostDeparture(roomId: string, participantIdentity: string): Promise<string | undefined> {
		await this.assertPrimaryHost(roomId, participantIdentity);
		return this.handleParticipantLeft(roomId, participantIdentity);
	}

	private hostKey(roomId: string): string {
		return `ov_meet:meeting_host:${roomId}`;
	}

	private lockKey(roomId: string): string {
		return `ov_meet:lock:meeting_host:${roomId}`;
	}

	private parseMetadata(rawMetadata?: string): MeetRoomMemberTokenMetadata | undefined {
		if (!rawMetadata) return undefined;
		try {
			return JSON.parse(rawMetadata) as MeetRoomMemberTokenMetadata;
		} catch {
			return undefined;
		}
	}

}

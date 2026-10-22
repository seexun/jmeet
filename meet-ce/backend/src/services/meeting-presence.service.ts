import { inject, injectable } from 'inversify';
import ms from 'ms';
import { INTERNAL_CONFIG } from '../config/internal-config.js';
import { RedisKeyName } from '../models/redis.model.js';
import { LoggerService } from './logger.service.js';
import { RedisService } from './redis.service.js';

export interface ActiveMeetingPresence {
	roomId: string;
	participantIdentity: string;
}

@injectable()
export class MeetingPresenceService {
	private readonly PRESENCE_TTL_MS = ms(INTERNAL_CONFIG.MEETING_PRESENCE_TTL);

	constructor(
		@inject(RedisService) protected redisService: RedisService,
		@inject(LoggerService) protected logger: LoggerService
	) {}

	/**
	 * Stores or refreshes the mapping between a user and an active room, along with
	 * the participant identity currently used in that room.
	 *
	 * The mapping is written in both directions (user->room and room->user)
	 * to enable efficient cleanup by either key.
	 *
	 * @param userId User identifier.
	 * @param roomId Room identifier.
	 * @param participantIdentity LiveKit participant identity for this user in the room.
	 */
	async upsertUserInRoom(userId: string, roomId: string, participantIdentity: string): Promise<void> {
		const userKey = this.getUserRoomKey(userId, roomId);
		const roomKey = this.getRoomUserKey(roomId, userId);

		await Promise.all([
			this.redisService.set(userKey, participantIdentity, this.PRESENCE_TTL_MS),
			this.redisService.set(roomKey, participantIdentity, this.PRESENCE_TTL_MS)
		]);
	}

	/**
	 * Removes the presence mapping for a specific user-room pair in both directions.
	 *
	 * @param userId User identifier.
	 * @param roomId Room identifier.
	 */
	async removeUserFromRoom(userId: string, roomId: string): Promise<void> {
		const userKey = this.getUserRoomKey(userId, roomId);
		const roomKey = this.getRoomUserKey(roomId, userId);
		await this.redisService.delete([userKey, roomKey]);
	}

	/**
	 * Retrieves all active room mappings for a user.
	 *
	 * @param userId User identifier.
	 * @returns List of active room-presence entries for the user.
	 */
	async getUserMeetings(userId: string): Promise<ActiveMeetingPresence[]> {
		const userPattern = `${RedisKeyName.USER_ACTIVE_MEETING}${userId}:*`;
		const userKeys = await this.redisService.getKeys(userPattern);

		if (userKeys.length === 0) {
			return [];
		}

		const identities = await this.redisService.getMany(userKeys);

		return userKeys
			.map((key, index) => {
				const roomId = this.extractRoomIdFromUserKey(key, userId);
				const participantIdentity = identities[index];

				if (!roomId || !participantIdentity) {
					return undefined;
				}

				return { roomId, participantIdentity };
			})
			.filter((presence): presence is ActiveMeetingPresence => !!presence);
	}

	/**
	 * Removes all user-presence entries associated with a room.
	 *
	 * This is typically called when a meeting/room ends to prevent stale user-room
	 * links from remaining in Redis.
	 *
	 * @param roomId Room identifier.
	 */
	async removeRoomFromAllUsers(roomId: string): Promise<void> {
		const roomPattern = `${RedisKeyName.ROOM_ACTIVE_MEETING}${roomId}:*`;
		const roomKeys = await this.redisService.getKeys(roomPattern);

		if (roomKeys.length === 0) {
			return;
		}

		const userKeys = roomKeys
			.map((roomKey) => this.extractUserIdFromRoomKey(roomKey, roomId))
			.filter((userId): userId is string => !!userId)
			.map((userId) => this.getUserRoomKey(userId, roomId));

		await this.redisService.delete([...roomKeys, ...userKeys]);
	}

	/**
	 * Removes all room-presence entries associated with a user.
	 *
	 * This is typically called during account cleanup/deletion.
	 *
	 * @param userId User identifier.
	 */
	async removeUserFromAllRooms(userId: string): Promise<void> {
		const userPattern = `${RedisKeyName.USER_ACTIVE_MEETING}${userId}:*`;
		const userKeys = await this.redisService.getKeys(userPattern);

		if (userKeys.length === 0) {
			return;
		}

		const roomKeys = userKeys
			.map((userKey) => this.extractRoomIdFromUserKey(userKey, userId))
			.filter((roomId): roomId is string => !!roomId)
			.map((roomId) => this.getRoomUserKey(roomId, userId));

		await this.redisService.delete([...userKeys, ...roomKeys]);
	}

	/**
	 * Builds the user-to-room presence key.
	 *
	 * @param userId User identifier.
	 * @param roomId Room identifier.
	 * @returns Redis key for user->room presence.
	 */
	private getUserRoomKey(userId: string, roomId: string): string {
		return `${RedisKeyName.USER_ACTIVE_MEETING}${userId}:${roomId}`;
	}

	/**
	 * Builds the room-to-user presence key.
	 *
	 * @param roomId Room identifier.
	 * @param userId User identifier.
	 * @returns Redis key for room->user presence.
	 */
	private getRoomUserKey(roomId: string, userId: string): string {
		return `${RedisKeyName.ROOM_ACTIVE_MEETING}${roomId}:${userId}`;
	}

	/**
	 * Extracts roomId from a user->room key.
	 *
	 * @param key Redis key in user->room format.
	 * @param userId User identifier expected in the key.
	 * @returns Extracted roomId or undefined when key format is invalid.
	 */
	private extractRoomIdFromUserKey(key: string, userId: string): string | undefined {
		const prefix = `${RedisKeyName.USER_ACTIVE_MEETING}${userId}:`;

		if (!key.startsWith(prefix)) {
			this.logger.warn(`Unexpected user presence key format: '${key}'`);
			return undefined;
		}

		return key.slice(prefix.length) || undefined;
	}

	/**
	 * Extracts userId from a room->user key.
	 *
	 * @param key Redis key in room->user format.
	 * @param roomId Room identifier expected in the key.
	 * @returns Extracted userId or undefined when key format is invalid.
	 */
	private extractUserIdFromRoomKey(key: string, roomId: string): string | undefined {
		const prefix = `${RedisKeyName.ROOM_ACTIVE_MEETING}${roomId}:`;

		if (!key.startsWith(prefix)) {
			this.logger.warn(`Unexpected room presence key format: '${key}'`);
			return undefined;
		}

		return key.slice(prefix.length) || undefined;
	}
}

import type { WebhookEvent } from 'livekit-server-sdk';
import { RedisLockName, RedisLockPrefix } from '../models/redis.model.js';

export class MeetLock {
	private constructor() {
		// Prevent instantiation of this utility class
	}

	static getRecordingActiveLock(roomId: string): string {
		if (!roomId) {
			throw new Error('roomId must be a non-empty string');
		}

		return `${RedisLockPrefix.BASE}${RedisLockName.RECORDING_ACTIVE}_${roomId}`;
	}

	static getRegistryLock(lockName: string): string {
		if (!lockName) {
			throw new Error('lockName must be a non-empty string');
		}

		return `${RedisLockPrefix.REGISTRY}${lockName}`;
	}

	static getScheduledTaskLock(taskName: string): string {
		if (!taskName) {
			throw new Error('taskName must be a non-empty string');
		}

		return `${RedisLockPrefix.BASE}${RedisLockName.SCHEDULED_TASK}_${taskName}`;
	}

	static getStorageInitializationLock(): string {
		return `${RedisLockPrefix.BASE}${RedisLockName.STORAGE_INITIALIZATION}`;
	}

	static getMigrationLock(): string {
		return `${RedisLockPrefix.BASE}${RedisLockName.MIGRATION}`;
	}

	static getWebhookLock(webhookEvent: WebhookEvent) {
		if (!webhookEvent || !webhookEvent.event) {
			throw new Error('event must be a non-empty string');
		}

		return `${RedisLockPrefix.BASE}${RedisLockName.WEBHOOK}_${webhookEvent.event}_${webhookEvent.id}`;
	}

	static getAiAssistantLock(roomId: string, capabilityName: string): string {
		if (!roomId) {
			throw new Error('roomId must be a non-empty string');
		}

		if (!capabilityName) {
			throw new Error('capabilityName must be a non-empty string');
		}

		return `${RedisLockPrefix.BASE}${RedisLockName.AI_ASSISTANT}_${roomId}_${capabilityName}`;
	}

	static getMinutesGenerationLock(meetingSessionId: string): string {
		if (!meetingSessionId) throw new Error('meetingSessionId must be a non-empty string');
		return `${RedisLockPrefix.BASE}minutes_generation_${meetingSessionId}`;
	}
}

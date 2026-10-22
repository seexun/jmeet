import { EventEmitter } from 'events';
import { inject, injectable } from 'inversify';
import type { DistributedEventPayload, DistributedEventType } from '../models/distributed-event.model.js';
import { LoggerService } from './logger.service.js';
import { RedisService } from './redis.service.js';

/**
 * Service for managing distributed events using Redis pub/sub pattern.
 * Handles internal communication between services and microservices.
 */
@injectable()
export class DistributedEventService {
	protected emitter: EventEmitter = new EventEmitter();
	protected readonly OPENVIDU_MEET_CHANNEL = 'ov_meet_channel';
	constructor(
		@inject(LoggerService) protected logger: LoggerService,
		@inject(RedisService) protected redisService: RedisService
	) {
		this.emitter.setMaxListeners(Infinity);
		this.redisService.subscribe(this.OPENVIDU_MEET_CHANNEL, this.handleRedisMessage.bind(this));
	}

	/**
	 * Subscribes to a specific system event.
	 *
	 * @param event The event type to subscribe to.
	 * @param listener The callback to invoke when the event is emitted.
	 */
	on(event: DistributedEventType, listener: (payload: Record<string, unknown>) => void): void {
		this.emitter.on(event, listener);
	}

	/**
	 * Subscribes to a specific system event once.
	 *
	 * @param event The event type to subscribe to.
	 * @param listener The callback to invoke when the event is emitted.
	 */
	once(event: DistributedEventType, listener: (payload: Record<string, unknown>) => void): void {
		this.emitter.once(event, listener);
	}

	/**
	 * Unsubscribes from a specific system event.
	 *
	 * @param event The event type to unsubscribe from.
	 * @param listener Optional: the specific listener to remove. If not provided, all listeners for that event are removed.
	 */
	off(event: DistributedEventType, listener?: (payload: Record<string, unknown>) => void): void {
		if (listener) {
			this.emitter.off(event, listener);
		} else {
			this.emitter.removeAllListeners(event);
		}
	}

	/**
	 * Publishes a system event to the central Redis channel.
	 * This method can be used by any part of the application to send a system-wide event.
	 *
	 * @param type The event type.
	 * @param payload The event payload.
	 */
	async publishEvent(eventType: DistributedEventType, payload: Record<string, unknown>): Promise<void> {
		const message = JSON.stringify({ eventType, payload });
		this.logger.verbose(`Publishing system event: ${eventType}`, payload);
		await this.redisService.publishEvent(this.OPENVIDU_MEET_CHANNEL, message);
	}

	/**
	 * Registers a callback function to be executed when the Redis connection is ready.
	 *
	 * @param callback - A function to be called when the Redis connection is ready.
	 */
	onRedisReady(callback: () => void) {
		this.redisService.onReady(callback);
	}

	onceRedisError(callback: () => void) {
		this.redisService.onceError(callback);
	}

	/**
	 * Handles incoming messages from Redis, parses them as system events,
	 * and emits the corresponding event to all registered listeners.
	 *
	 * @param message - The raw message string received from Redis.
	 * @throws Will log an error if the message cannot be parsed as JSON.
	 */
	protected handleRedisMessage(message: string): void {
		try {
			const eventData: DistributedEventPayload = JSON.parse(message);
			const { eventType, payload } = eventData;

			if (!eventType) {
				this.logger.warn('Received an event without type from Redis:', message);
				return;
			}

			this.logger.verbose(`Emitting system event: ${eventType}`, payload);

			// Forward the event to all listeners
			this.emitter.emit(eventType, payload);
		} catch (error) {
			this.logger.error('Error parsing redis message in DistributedEventService:', error);
		}
	}
}

import { Redlock } from '@sesamecare-oss/redlock';
import { EventEmitter } from 'events';
import { inject, injectable } from 'inversify';
import type { RedisOptions, SentinelAddress } from 'ioredis';
import { Redis } from 'ioredis';
import ms from 'ms';
import { checkModuleEnabled, MEET_ENV } from '../environment.js';
import type { DistributedEventPayload } from '../models/distributed-event.model.js';
import { internalError } from '../models/error.model.js';
import { LoggerService } from './logger.service.js';

@injectable()
export class RedisService extends EventEmitter {
	protected readonly DEFAULT_TTL: number = ms('32 days');
	protected EVENT_CHANNEL = 'ov_meet_channel';
	protected redisPublisher: Redis;
	protected redisSubscriber: Redis;
	protected isConnected = false;
	protected eventHandler?: (event: DistributedEventPayload) => void;

	constructor(@inject(LoggerService) protected logger: LoggerService) {
		super();

		const redisOptions = this.loadRedisConfig();
		this.redisPublisher = new Redis(redisOptions);
		this.redisSubscriber = new Redis(redisOptions);

		this.setupEventHandlers();
	}

	protected setupEventHandlers(): void {
		const onConnect = () => {
			if (!this.isConnected) {
				this.logger.verbose('Connected to Redis');
			} else {
				this.logger.verbose('Reconnected to Redis');
			}

			this.isConnected = true;
			this.emit('redisConnected');
		};

		const onError = (error: Error) => {
			this.logger.error('Redis Error', error);
			this.emit('redisError', error);

			// If Redis connection fails during startup, terminate the process
			if (!this.isConnected) {
				this.logger.error('Failed to connect to Redis during startup. Terminating process...');
				process.exit(1);
			}
		};

		const onDisconnect = () => {
			this.isConnected = false;
			this.logger.warn('Redis disconnected');
			this.emit('redisDisconnected');
		};

		this.redisPublisher.on('connect', onConnect);
		this.redisSubscriber.on('connect', () => this.logger.verbose('Connected to Redis subscriber'));
		this.redisPublisher.on('error', onError);
		this.redisSubscriber.on('error', (error) => this.logger.error('Redis Subscriber Error', error));
		this.redisPublisher.on('end', onDisconnect);
		this.redisSubscriber.on('end', () => this.logger.warn('Redis subscriber disconnected'));
	}

	createRedlock(retryCount = -1, retryDelay = 200) {
		return new Redlock([this.redisPublisher], {
			driftFactor: 0.01,
			retryCount,
			retryDelay,
			retryJitter: 200 // Random variation in the time between retries.
		});
	}

	public onReady(callback: () => void) {
		if (this.isConnected) {
			callback();
		}

		this.on('redisConnected', callback);
	}

	public onceError(callback: () => void) {
		this.once('redisError', callback);
	}

	async probeHealth(): Promise<boolean> {
		return this.isConnected && (await this.redisPublisher.ping()) === 'PONG';
	}

	/**
	 * Publishes a message to a specified Redis channel.
	 *
	 * @param channel - The name of the Redis channel to publish the message to.
	 * @param message - The message to be published to the channel.
	 * @returns A promise that resolves when the message has been successfully published.
	 */
	async publishEvent(channel: string, message: string) {
		try {
			await this.redisPublisher.publish(channel, message);
		} catch (error) {
			this.logger.error('Error publishing message to Redis', error);
		}
	}

	/**
	 * Subscribes to a Redis channel.
	 *
	 * @param channel - The channel to subscribe to.
	 * @param callback - The callback function to execute when a message is received on the channel.
	 */
	subscribe(channel: string, callback: (message: string) => void) {
		this.logger.verbose(`Subscribing to Redis channel: ${channel}`);
		this.redisSubscriber.subscribe(channel, (err, count) => {
			if (err) {
				this.logger.error('Error subscribing to Redis channel', err);
				return;
			}

			this.logger.verbose(`Subscribed to ${channel}. Now subscribed to ${count} channel(s).`);
		});

		this.redisSubscriber.on('message', (receivedChannel, message) => {
			if (receivedChannel === channel) {
				callback(message);
			}
		});
	}

	/**
	 * Unsubscribes from a Redis channel.
	 *
	 * @param channel - The channel to unsubscribe from.
	 */
	unsubscribe(channel: string) {
		this.redisSubscriber.unsubscribe(channel, (err, count) => {
			if (err) {
				this.logger.error('Error unsubscribing from Redis channel', err);
				return;
			}

			this.logger.verbose(`Unsubscribed from channel ${channel}. Now subscribed to ${count} channel(s).`);
		});
	}

	/**
	 * Retrieves all keys from Redis that match the specified pattern.
	 *
	 * @param pattern - The pattern to match against Redis keys.
	 * @returns A promise that resolves to an array of matching keys.
	 * @throws {internalRecordingError} If there is an error retrieving keys from Redis.
	 */
	async getKeys(pattern: string): Promise<string[]> {
		let cursor = '0';
		const keys: string[] = [];

		do {
			const [nextCursor, partialKeys] = await this.redisPublisher.scan(cursor, 'MATCH', pattern);
			keys.push(...partialKeys);
			cursor = nextCursor;
		} while (cursor !== '0');

		return keys;
	}

	/**
	 * Checks existence for multiple keys using a pipeline to reduce Redis roundtrips.
	 *
	 * @param keys - Keys to verify
	 * @returns Boolean existence flags ordered as input keys
	 */
	async existsMany(keys: string[]): Promise<boolean[]> {
		if (keys.length === 0) {
			return [];
		}

		try {
			const pipeline = this.redisPublisher.pipeline();

			for (const key of keys) {
				pipeline.exists(key);
			}

			const pipelineResults = await pipeline.exec();

			if (!pipelineResults) {
				return keys.map(() => false);
			}

			return pipelineResults.map(([error, result], index) => {
				if (error) {
					this.logger.warn(`Error checking existence for Redis key '${keys[index]}': ${error}`);
					return false;
				}

				return Number(result) === 1;
			});
		} catch (error) {
			this.logger.error('Error checking multiple key existence in Redis', error);
			throw internalError('checking multiple key existence in Redis');
		}
	}

	/**
	 * Checks if a given key exists in the Redis store.
	 *
	 * @param {string} key - The key to check for existence.
	 * @returns {Promise<boolean>} - A promise that resolves to `true` if the key exists, otherwise `false`.
	 */
	async exists(key: string): Promise<boolean> {
		try {
			const result = await this.redisPublisher.exists(key);
			return result === 1;
		} catch (error) {
			return false;
		}
	}

	/**
	 * Retrieves multiple string values in a single Redis roundtrip.
	 *
	 * @param keys - Keys to fetch
	 * @returns Values ordered as input keys. Missing keys are returned as null.
	 */
	async getMany(keys: string[]): Promise<Array<string | null>> {
		if (keys.length === 0) {
			return [];
		}

		try {
			return await this.redisPublisher.mget(keys);
		} catch (error) {
			this.logger.error('Error getting multiple values from Redis', error);
			throw internalError('getting multiple values from Redis');
		}
	}

	/**
	 * Retrieves a value from Redis for a given key.
	 *
	 * @param key - The key to retrieve the value for.
	 */
	get(key: string): Promise<string | null> {
		try {
			return this.redisPublisher.get(key);
		} catch (error) {
			this.logger.error('Error getting value from Redis', error);
			throw internalError('getting value from Redis');
		}
	}

	/**
	 * Sets a value in Redis with a specified TTL (time-to-live) in milliseconds.
	 * @param key - The key under which the value will be stored.
	 * @param value - The value to be stored. Can be a string, number, boolean, or object.
	 * @param ttlMs TTL in milliseconds for the key. If not provided, the key will not expire.
	 * @returns A promise that resolves to 'OK' if the operation is successful.
	 * @throws Error if there is an issue setting the value in Redis.
	 */
	async set(key: string, value: string | number | boolean | object, ttlMs: number): Promise<string> {
		try {
			const valueType = typeof value;
			const hasTTL = ttlMs !== undefined;

			if (valueType === 'string' || valueType === 'number') {
				if (hasTTL) {
					await this.redisPublisher.set(key, value.toString(), 'PX', ttlMs);
				} else {
					await this.redisPublisher.set(key, value.toString());
				}
			} else if (valueType === 'boolean') {
				const stringValue = value.toString();

				if (hasTTL) {
					await this.redisPublisher.set(key, stringValue, 'PX', ttlMs);
				} else {
					await this.redisPublisher.set(key, stringValue);
				}
			} else if (valueType === 'object') {
				await this.redisPublisher.hmset(key, value as Record<string, string | number>);

				if (hasTTL) {
					await this.redisPublisher.pexpire(key, ttlMs);
				}
			} else {
				throw new Error('Invalid value type');
			}

			return 'OK';
		} catch (error) {
			this.logger.error('Error setting value in Redis with TTL', error);
			throw error;
		}
	}

	/**
	 * Deletes one or more keys from Redis.
	 *
	 * @param keys - A single key string or an array of key strings to delete from Redis
	 * @returns A Promise that resolves to the number of keys that were successfully deleted
	 * @throws {Error} Throws an internal error if the deletion operation fails
	 */
	delete(keys: string | string[]): Promise<number> {
		try {
			if (typeof keys === 'string') {
				keys = [keys];
			}

			return this.redisPublisher.del(keys);
		} catch (error) {
			throw internalError(`deleting key from Redis`);
		}
	}

	async scanValues(pattern: string): Promise<Array<{ key: string; value: string }>> {
		let cursor = '0'; const results: Array<{ key: string; value: string }> = [];
		do {
			const [next, keys] = await this.redisPublisher.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
			cursor = next;
			if (keys.length) {
				const values = await this.redisPublisher.mget(keys);
				keys.forEach((key, index) => { if (values[index]) results.push({ key, value: values[index]! }); });
			}
		} while (cursor !== '0');
		return results;
	}

	async incrementWithTtl(key: string, ttlSeconds: number): Promise<number> {
		const value = await this.redisPublisher.incr(key);
		if (value === 1) await this.redisPublisher.expire(key, ttlSeconds);
		return value;
	}

	/**
	 * Atomically sets a value only if the key doesn't exist (SET with NX option).
	 *
	 * @param {string} key - The key to set
	 * @param {string} value - The value to set
	 * @param {number} [ttlSeconds] - Optional TTL in seconds
	 * @returns {Promise<boolean>} - True if the key was set, false if it already existed
	 */
	async setIfNotExists(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
		try {
			let result: string | null;

			if (ttlSeconds) {
				result = await this.redisPublisher.set(key, value, 'EX', ttlSeconds, 'NX');
			} else {
				result = (await this.redisPublisher.setnx(key, value)) ? 'OK' : null;
			}

			return result === 'OK';
		} catch (error) {
			this.logger.error('Error setting value with NX option in Redis', error);
			throw error;
		}
	}

	/**
	 * Sets an expiration time on an existing key.
	 *
	 * @param {string} key - The key to set expiration on
	 * @param {number} ttlSeconds - TTL in seconds
	 * @returns {Promise<boolean>} - True if expiration was set successfully
	 */
	async setExpiration(key: string, ttlSeconds: number): Promise<boolean> {
		try {
			const result = await this.redisPublisher.expire(key, ttlSeconds);
			return result === 1;
		} catch (error) {
			this.logger.error('Error setting expiration in Redis', error);
			throw error;
		}
	}

	/**
	 * Removes and returns the member with the lowest score from a sorted set.
	 *
	 * @param {string} key - The key of the sorted set
	 * @param {number} count - Number of members to pop (default: 1)
	 * @returns {Promise<string[]>} - Array of popped members
	 */
	async popMinFromSortedSet(key: string, count = 1): Promise<string[]> {
		try {
			return await this.redisPublisher.zpopmin(key, count);
		} catch (error) {
			this.logger.error('Error popping min from sorted set in Redis', error);
			throw error;
		}
	}

	/**
	 * Adds one or more members to a sorted set.
	 *
	 * @param {string} key - The key of the sorted set
	 * @param {number} score - The score for the member
	 * @param {string} member - The member to add
	 * @returns {Promise<number>} - Number of elements added
	 */
	async addToSortedSet(key: string, score: number, member: string): Promise<number> {
		try {
			return await this.redisPublisher.zadd(key, score, member);
		} catch (error) {
			this.logger.error('Error adding to sorted set in Redis', error);
			throw error;
		}
	}

	/**
	 * Adds a member to a Redis Set and refreshes the key TTL atomically.
	 *
	 * @param key - The key of the set
	 * @param member - The member to add
	 * @param ttlMs - TTL in milliseconds to (re)apply to the key
	 * @returns Number of new members added (0 or 1)
	 */
	async addToSet(key: string, member: string, ttlMs?: number): Promise<number> {
		try {
			if (ttlMs !== undefined) {
				const [added] = await this.redisPublisher.multi().sadd(key, member).pexpire(key, ttlMs).exec() as [[Error | null, number], unknown];
				return added[1];
			}

			return await this.redisPublisher.sadd(key, member);
		} catch (error) {
			this.logger.error('Error adding to set in Redis', error);
			throw error;
		}
	}

	/**
	 * Removes a member from a Redis Set.
	 *
	 * @param key - The key of the set
	 * @param member - The member to remove
	 * @returns Number of members removed (0 or 1)
	 */
	async removeFromSet(key: string, member: string): Promise<number> {
		try {
			return await this.redisPublisher.srem(key, member);
		} catch (error) {
			this.logger.error('Error removing from set in Redis', error);
			throw error;
		}
	}

	/**
	 * Returns the cardinality (number of members) of a Redis Set.
	 */
	async getCardinality(key: string): Promise<number> {
		try {
			return await this.redisPublisher.scard(key);
		} catch (error) {
			this.logger.error('Error reading set cardinality from Redis', error);
			throw error;
		}
	}

	/**
	 * Returns all members of a Redis Set.
	 */
	async getSetMembers(key: string): Promise<string[]> {
		try {
			return await this.redisPublisher.smembers(key);
		} catch (error) {
			this.logger.error('Error reading set members from Redis', error);
			throw error;
		}
	}

	cleanup() {
		this.logger.verbose('Cleaning up Redis connections');
		this.redisPublisher.quit();
		this.redisSubscriber.quit();
		this.removeAllListeners();

		if (this.eventHandler) {
			this.off('systemEvent', this.eventHandler);
			this.eventHandler = undefined;
		}

		this.isConnected = false;
		this.logger.verbose('Redis connections cleaned up');
	}

	private loadRedisConfig(): RedisOptions {
		// Check if openviduCall module is enabled. If not, exit the process
		checkModuleEnabled();

		//Check if Redis Sentinel is configured
		if (MEET_ENV.REDIS_SENTINEL_HOST_LIST) {
			const sentinels: Array<SentinelAddress> = [];
			const sentinelHosts = MEET_ENV.REDIS_SENTINEL_HOST_LIST.split(',');
			sentinelHosts.forEach((host) => {
				const rawHost = host.split(':');

				if (rawHost.length !== 2) {
					throw new Error('The Redis Sentinel host list is required');
				}

				const hostName = rawHost[0];
				const port = parseInt(rawHost[1]);
				sentinels.push({ host: hostName, port });
			});

			if (!MEET_ENV.REDIS_SENTINEL_PASSWORD) throw new Error('The Redis Sentinel password is required');

			this.logger.verbose('Using Redis Sentinel');
			return {
				sentinels,
				sentinelPassword: MEET_ENV.REDIS_SENTINEL_PASSWORD,
				username: MEET_ENV.REDIS_USERNAME,
				password: MEET_ENV.REDIS_PASSWORD,
				name: MEET_ENV.REDIS_SENTINEL_MASTER_NAME,
				db: Number(MEET_ENV.REDIS_DB),
				maxRetriesPerRequest: null // Infinite retries
			};
		} else {
			this.logger.verbose('Using Redis standalone');
			return {
				port: Number(MEET_ENV.REDIS_PORT),
				host: MEET_ENV.REDIS_HOST,
				username: MEET_ENV.REDIS_USERNAME,
				password: MEET_ENV.REDIS_PASSWORD,
				db: Number(MEET_ENV.REDIS_DB),
				maxRetriesPerRequest: null // Infinite retries
			};
		}
	}
}

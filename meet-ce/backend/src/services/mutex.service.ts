import type { Redlock } from '@sesamecare-oss/redlock';
import { Lock } from '@sesamecare-oss/redlock';
import { inject, injectable } from 'inversify';
import ms from 'ms';
import { INTERNAL_CONFIG } from '../config/internal-config.js';
import { MeetLock } from '../helpers/redis.helper.js';
import { LoggerService } from './logger.service.js';
import { RedisService } from './redis.service.js';

export type RedisLock = Lock;
type RedisLockRegistryData = {
	resources: string[];
	value: string;
	expiration: number;
	createdAt: number;
};

@injectable()
export class MutexService {
	protected redlockWithoutRetry: Redlock;
	protected readonly TTL_MS = ms('1m');
	protected readonly LOCK_REGISTRY_BATCH_SIZE = INTERNAL_CONFIG.BATCH_SIZE_REGISTRY_LOCKS_RETRIEVAL;

	constructor(
		@inject(RedisService) protected redisService: RedisService,
		@inject(LoggerService) protected logger: LoggerService
	) {
		// Create a Redlock instance with no retry strategy
		this.redlockWithoutRetry = this.redisService.createRedlock(0);
	}

	/**
	 * Executes a callback while holding the specified lock.
	 * The lock is always released after the callback completes, even if the callback throws.
	 * Returns null if the lock cannot be acquired (i.e., another process holds it).
	 *
	 * Preferred pattern for ephemeral locks:
	 * ```typescript
	 * return this.mutexService.withLock(key, ms('5s'), async () => {
	 *   await doWork();
	 * });
	 * ```
	 *
	 * @param key The resource to lock.
	 * @param ttl The time-to-live (TTL) in milliseconds.
	 * @param callback The function to execute while holding the lock.
	 * @returns A Promise resolving to the callback's return value, or null if the lock could not be acquired.
	 */
	async withLock<T>(key: string, ttl: number, callback: () => Promise<T>): Promise<T | null> {
		const lock = await this.acquire(key, ttl);

		if (!lock) {
			return null;
		}

		try {
			return await callback();
		} finally {
			// If callback process took longer than TTL, the lock may have expired and been released by Redlock automatically.
			// In that case, we should not attempt to release it again to avoid errors. Instead, we check if the lock still exists before releasing.
			if (await this.lockExists(key)) {
				await this.release(lock);
			}
		}
	}

	async withRetryLock<T>(
		key: string,
		ttl: number,
		callback: () => Promise<T>,
		maxAttempts = 3,
		delayMs = 200
	): Promise<T | null> {
		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			const result = await this.withLock(key, ttl, callback);

			if (result !== null) return result;

			if (attempt < maxAttempts) {
				this.logger.warn(`Lock '${key}' attempt ${attempt}/${maxAttempts} failed. Retrying in ${delayMs}ms...`);
				await new Promise((resolve) => setTimeout(resolve, delayMs));
			}
		}

		return null;
	}

	async lockExists(key: string): Promise<boolean> {
		return await this.redisService.exists(key);
	}

	/**
	 * Acquires a lock for the specified resource.
	 * This method uses the Redlock library to acquire a distributed lock on a resource identified by the key.
	 * The request will return null if the lock cannot be acquired.
	 *
	 * @deprecated Use {@link acquire} for ephemeral locks or {@link withLock} for the try-finally pattern.
	 * This method persists a registry entry in Redis for cross-instance release, which is only needed
	 * for long-lived locks like `recording_active`. Use {@link acquire} for all other cases.
	 *
	 * @param key The resource to acquire a lock for.
	 * @param ttl The time-to-live (TTL) for the lock in milliseconds. Defaults to the TTL value of the MutexService.
	 * @returns A Promise that resolves to the acquired Lock object. If the lock cannot be acquired, it resolves to null.
	 */
	async acquireWithRegistry(key: string, ttl: number = this.TTL_MS): Promise<Lock | null> {
		const registryKey = MeetLock.getRegistryLock(key);

		try {
			this.logger.debug(`Requesting lock: ${key}`);
			const lock = await this.redlockWithoutRetry.acquire([key], ttl);

			try {
				// Store lock details in the registry for later retrieval and management in others instances
				await this.redisService.set(
					registryKey,
					JSON.stringify({
						resources: lock.resources,
						value: lock.value,
						expiration: lock.expiration,
						createdAt: Date.now()
					}),
					ttl
				);
				return lock;
			} catch (error) {
				this.logger.error(`Error storing lock registry for key ${key}:`, error);

				try {
					await lock.release();
				} catch (releaseError) {
					this.logger.error(`Error rolling back lock acquisition for key ${key}:`, releaseError);
				}

				return null;
			}
		} catch (error) {
			this.logger.warn(`Error acquiring lock ${key}:`, error);
			return null;
		}
	}

	/**
	 * Releases a lock on a resource.
	 *
	 * @deprecated Use {@link release} with the Lock instance returned by {@link acquire},
	 * or use {@link withLock} which handles release automatically.
	 * This method performs a cross-instance release by reading from the Redis registry, which is only
	 * needed for long-lived locks like `recording_active`.
	 *
	 * @param key - The resource to release the lock on.
	 * @returns A Promise that resolves when the lock is released.
	 */
	async releaseWithRegistry(key: string): Promise<void> {
		const registryKey = MeetLock.getRegistryLock(key);
		const lock = await this.buildLock(registryKey);

		if (!lock) {
			this.logger.warn(`Lock not found for resource: ${key}. May be expired or released by another process.`);
			return;
		}

		if (lock) {
			try {
				await lock.release();
				this.logger.verbose(`Lock ${key} successfully released.`);
			} catch (error) {
				this.logger.error(`Error releasing lock for key ${key}:`, error);
			} finally {
				await this.redisService.delete(registryKey);
			}
		}
	}

	/**
	 * Retrieves all locks for a given prefix.
	 *
	 * This method retrieves all keys from Redis that match the specified prefix and returns an array of `Lock` instances.
	 *
	 * @param pattern - The prefix to filter the keys in Redis.
	 * @returns A promise that resolves to an array of `Lock` instances.
	 */
	async getRegistryLocksByPrefix(pattern: string): Promise<Lock[]> {
		const registryPattern = MeetLock.getRegistryLock(pattern);
		const keys = await this.redisService.getKeys(registryPattern);
		this.logger.debug(`Found ${keys.length} registry keys for pattern "${pattern}".`);

		if (keys.length === 0) {
			return [];
		}

		const lockEntries: Array<{ registryKey: string; data: RedisLockRegistryData }> = [];

		for (let i = 0; i < keys.length; i += this.LOCK_REGISTRY_BATCH_SIZE) {
			const keyBatch = keys.slice(i, i + this.LOCK_REGISTRY_BATCH_SIZE);
			const payloadBatch = await this.redisService.getMany(keyBatch);

			for (let j = 0; j < keyBatch.length; j++) {
				const payload = payloadBatch[j];

				if (!payload) {
					continue;
				}

				const parsed = await this.parseRegistryLockData(keyBatch[j], payload);

				if (parsed) {
					lockEntries.push({ registryKey: keyBatch[j], data: parsed });
				}
			}
		}

		if (lockEntries.length === 0) {
			return [];
		}

		const uniqueResources = Array.from(new Set(lockEntries.flatMap((entry) => entry.data.resources)));
		const resourceExistenceMap = await this.getResourceExistenceMap(uniqueResources);

		const locks: Lock[] = [];

		for (const entry of lockEntries) {
			const hasMissingResource = entry.data.resources.some((resource) => !resourceExistenceMap.get(resource));

			if (hasMissingResource) {
				await this.cleanupRegistryKey(entry.registryKey, 'lock resources are missing');
				continue;
			}

			locks.push(
				new Lock(this.redlockWithoutRetry, entry.data.resources, entry.data.value, [], entry.data.expiration)
			);
		}

		return locks;
	}

	lockRegistryExists(key: string): Promise<boolean> {
		const registryKey = MeetLock.getRegistryLock(key);
		return this.hasActiveLockFromRegistry(registryKey);
	}

	/**
	 * Retrieves the creation timestamp of a lock identified by the given key.
	 *
	 * @param key - The unique identifier for the lock
	 * @returns A Promise that resolves to the creation timestamp (as a number) of the lock, or null if the lock doesn't exist or has expired
	 */
	async getLockCreatedAtFromRegistry(key: string): Promise<number | null> {
		const registryKey = MeetLock.getRegistryLock(key);
		const redisLockData = await this.getRegistryLockData(registryKey);

		if (!redisLockData) {
			this.logger.warn(
				`Lock not found for resource: ${registryKey}. May be expired or released by another process.`
			);
			return null;
		}

		const { createdAt } = redisLockData;
		return createdAt;
	}

	/**
	 * Acquires a distributed lock without registry persistence.
	 * Use this for ephemeral locks that are acquired and released in the same execution flow.
	 * The caller is responsible for releasing the returned Lock via {@link release}.
	 *
	 * @param key The resource to acquire a lock for.
	 * @param ttl The time-to-live (TTL) for the lock in milliseconds.
	 * @returns A Promise that resolves to the acquired Lock, or null if it cannot be acquired.
	 */
	protected async acquire(key: string, ttl: number = this.TTL_MS): Promise<Lock | null> {
		try {
			this.logger.debug(`Requesting local lock: ${key}`);
			return await this.redlockWithoutRetry.acquire([key], ttl);
		} catch (error) {
			this.logger.warn(`Error acquiring local lock '${key}':`, error);
			return null;
		}
	}

	/**
	 * Releases a lock acquired via {@link acquire}.
	 *
	 * @param lock The Lock instance to release.
	 */
	protected async release(lock: Lock): Promise<void> {
		try {
			await lock.release();
			this.logger.verbose(`Local lock successfully released.`);
		} catch (error) {
			this.logger.error(`Error releasing local lock :`, error);
		}
	}

	/**
	 * Builds a Lock instance from the lock data stored in the registry for the given key.
	 *
	 * @param registryKey - The resource key to retrieve the lock data for.
	 * @returns A promise that resolves to a `Lock` instance or null if not found.
	 */
	protected async buildLock(registryKey: string): Promise<Lock | null> {
		const registryLockData = await this.getRegistryLockData(registryKey);

		if (!registryLockData) {
			return null;
		}

		const { resources, value, expiration } = registryLockData;
		return new Lock(this.redlockWithoutRetry, resources, value, [], expiration);
	}

	protected async getRegistryLockData(registryKey: string): Promise<RedisLockRegistryData | null> {
		let redisLockData: string | null;

		try {
			redisLockData = await this.redisService.get(registryKey);
		} catch (error) {
			this.logger.warn(`Error reading lock registry '${registryKey}': ${error}`);
			return null;
		}

		if (!redisLockData) {
			return null;
		}

		const parsedLockData = await this.parseRegistryLockData(registryKey, redisLockData);

		if (!parsedLockData) {
			return null;
		}

		const resourcesExist = await this.redisService.existsMany(parsedLockData.resources);

		if (resourcesExist.some((exists) => !exists)) {
			await this.cleanupRegistryKey(registryKey, 'lock resources are missing');
			return null;
		}

		return parsedLockData;
	}

	protected async parseRegistryLockData(
		registryKey: string,
		redisLockData: string
	): Promise<RedisLockRegistryData | null> {
		let parsedLockData: unknown;

		try {
			parsedLockData = JSON.parse(redisLockData);
		} catch {
			await this.cleanupRegistryKey(registryKey, 'registry payload is invalid JSON');
			return null;
		}

		if (!this.isValidRegistryLockData(parsedLockData)) {
			await this.cleanupRegistryKey(registryKey, 'registry payload is incomplete');
			return null;
		}

		if (parsedLockData.expiration <= Date.now()) {
			await this.cleanupRegistryKey(registryKey, 'registry lock is expired');
			return null;
		}

		return parsedLockData;
	}

	protected async getResourceExistenceMap(resources: string[]): Promise<Map<string, boolean>> {
		const existenceMap = new Map<string, boolean>();

		for (let i = 0; i < resources.length; i += this.LOCK_REGISTRY_BATCH_SIZE) {
			const resourceBatch = resources.slice(i, i + this.LOCK_REGISTRY_BATCH_SIZE);
			const existsBatch = await this.redisService.existsMany(resourceBatch);

			for (let j = 0; j < resourceBatch.length; j++) {
				existenceMap.set(resourceBatch[j], existsBatch[j]);
			}
		}

		return existenceMap;
	}

	/**
	 * Checks if there is an active lock for the given registry key by verifying the existence and validity of the lock data in Redis.
	 * @param registryKey
	 * @returns
	 */
	protected async hasActiveLockFromRegistry(registryKey: string): Promise<boolean> {
		const lockData = await this.getRegistryLockData(registryKey);
		return !!lockData;
	}

	/**
	 * Validates the structure of the lock data retrieved from the registry to ensure it contains all necessary fields with correct types.
	 * @param lockData - The lock data object to validate.
	 * @returns A boolean indicating whether the lock data is valid.
	 */
	protected isValidRegistryLockData(lockData: unknown): lockData is RedisLockRegistryData {
		if (!lockData || typeof lockData !== 'object') {
			return false;
		}

		const candidate = lockData as Partial<RedisLockRegistryData>;
		return (
			Array.isArray(candidate.resources) &&
			candidate.resources.every((resource) => typeof resource === 'string' && resource.length > 0) &&
			typeof candidate.value === 'string' &&
			typeof candidate.expiration === 'number' &&
			typeof candidate.createdAt === 'number'
		);
	}

	protected async cleanupRegistryKey(registryKey: string, reason: string): Promise<void> {
		try {
			await this.redisService.delete(registryKey);
			this.logger.debug(`Deleted orphaned lock registry '${registryKey}': ${reason}`);
		} catch (error) {
			this.logger.warn(`Error deleting lock registry '${registryKey}': ${error}`);
		}
	}
}

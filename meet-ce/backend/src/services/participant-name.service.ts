import { inject, injectable } from 'inversify';
import ms from 'ms';
import { INTERNAL_CONFIG } from '../config/internal-config.js';
import { RedisKeyName } from '../models/redis.model.js';
import { runConcurrently } from '../utils/concurrency.utils.js';
import { LoggerService } from './logger.service.js';
import { RedisService } from './redis.service.js';

@injectable()
export class ParticipantNameService {
	private readonly MAX_CONCURRENT_NAME_REQUESTS = INTERNAL_CONFIG.PARTICIPANT_MAX_CONCURRENT_NAME_REQUESTS;
	private readonly PARTICIPANT_NAME_TTL = ms(INTERNAL_CONFIG.PARTICIPANT_NAME_RESERVATION_TTL);

	constructor(
		@inject(RedisService) protected redisService: RedisService,
		@inject(LoggerService) protected logger: LoggerService
	) {}

	/**
	 * Reserves a unique participant name for a room using atomic operations.
	 * If the requested name is taken, it generates alternatives with incremental suffixes.
	 *
	 * @param roomId - The room identifier
	 * @param requestedName - The desired participant name
	 * @returns Promise<string> - The reserved unique name
	 * @throws Error if unable to reserve a unique name after max retries
	 */
	async reserveUniqueName(roomId: string, requestedName: string): Promise<string> {
		const participantsKey = `${RedisKeyName.ROOM_PARTICIPANTS}${roomId}`;

		// Extract the base name without any numeric suffix
		// This prevents infinite concatenation of "_1" when user requests "BOB_1" and it's taken
		const { baseName: extractedBaseName, originalCaseBase } = this.extractBaseName(requestedName);
		const normalizedBaseName = extractedBaseName.toLowerCase();

		// First, try to reserve the exact requested name
		const normalizedRequestedName = requestedName.toLowerCase();
		const reservedOriginal = await this.tryReserveName(participantsKey, normalizedRequestedName);

		if (reservedOriginal) {
			this.logger.verbose(`Reserved original name '${requestedName}' for room '${roomId}'`);
			return requestedName;
		}

		// If original name is taken, generate alternatives with atomic counter
		// Use the extracted base name to avoid concatenating suffixes
		for (let attempt = 1; attempt <= this.MAX_CONCURRENT_NAME_REQUESTS; attempt++) {
			const alternativeName = await this.generateAlternativeName(roomId, normalizedBaseName, attempt);
			const reserved = await this.tryReserveName(participantsKey, alternativeName);

			if (reserved) {
				this.logger.verbose(
					`Reserved alternative name '${alternativeName}' for room '${roomId}' (attempt ${attempt})`
				);
				// Return alternative name with original case from the base name
				const suffix = alternativeName.replace(`${normalizedBaseName}_`, '');
				return `${originalCaseBase}_${suffix}`;
			}
		}

		throw new Error(
			`Unable to reserve unique name for '${requestedName}' in room '${roomId}' after ${this.MAX_CONCURRENT_NAME_REQUESTS} attempts`
		);
	}

	/**
	 * Releases a reserved participant name, making it available for others.
	 *
	 * @param roomId - The room identifier
	 * @param participantName - The name to release
	 */
	/**
	 * Releases a reserved participant name, making it available for others.
	 * Also returns the number suffix to the available pool for reuse.
	 *
	 * @param roomId - The room identifier
	 * @param participantName - The name to release
	 */
	async releaseName(roomId: string, participantName: string): Promise<void> {
		const participantsKey = `${RedisKeyName.ROOM_PARTICIPANTS}${roomId}`;
		// Normalize the name for case-insensitive checks
		const normalizedName = participantName.toLowerCase();

		try {
			await this.redisService.delete(`${participantsKey}:${normalizedName}`);

			// If this is a numbered variant (e.g., "Alice_2"), return the number to the pool
			const numberMatch = participantName.match(/^(.+)_(\d+)$/);

			if (numberMatch) {
				const baseName = numberMatch[1];
				const number = parseInt(numberMatch[2], 10);
				await this.returnNumberToPool(roomId, baseName, number);
			}

			this.logger.verbose(`Released name '${participantName}' for room '${roomId}'`);
		} catch (error) {
			this.logger.warn(`Error releasing name '${participantName}' for room '${roomId}':`, error);
		}
	}

	/**
	 * Checks if a participant name is currently reserved in a room.
	 *
	 * @param roomId - The room identifier
	 * @param participantName - The name to check
	 * @returns Promise<boolean> - True if the name is reserved
	 */
	async isNameReserved(roomId: string, participantName: string): Promise<boolean> {
		// Normalize the name for case-insensitive checks
		const normalizedName = participantName.toLowerCase();
		const participantsKey = `${RedisKeyName.ROOM_PARTICIPANTS}${roomId}`;
		return await this.redisService.exists(`${participantsKey}:${normalizedName}`);
	}

	/**
	 * Gets all currently reserved names in a room.
	 *
	 * @param roomId - The room identifier
	 * @returns Promise<string[]> - Array of reserved participant names
	 */
	async getReservedNames(roomId: string): Promise<string[]> {
		const participantsKey = `${RedisKeyName.ROOM_PARTICIPANTS}${roomId}`;
		const pattern = `${participantsKey}:*`;

		try {
			const keys = await this.redisService.getKeys(pattern);
			return keys.map((key) => key.replace(`${participantsKey}:`, ''));
		} catch (error) {
			this.logger.error(`Error getting reserved names for room '${roomId}':`, error);
			return [];
		}
	}

	/**
	 * Cleans up expired participant name reservations for a room.
	 * This should be called periodically or when a room is cleaned up.
	 *
	 * @param roomId - The room identifier
	 */
	async cleanupExpiredReservations(roomId: string): Promise<void> {
		const participantsKey = `${RedisKeyName.ROOM_PARTICIPANTS}${roomId}`;
		const participantsPoolKey = `${RedisKeyName.PARTICIPANT_NAME_POOL}${roomId}`;
		const pattern = `${participantsKey}:*`;
		const poolPattern = `${participantsPoolKey}:*`;
		const concurrency = INTERNAL_CONFIG.CONCURRENCY_BULK_CLEANUP_PARTICIPANT_NAME_RESERVATIONS;

		try {
			const [participantKeys, poolKeys] = await Promise.all([
				this.redisService.getKeys(pattern),
				this.redisService.getKeys(poolPattern)
			]);
			this.logger.verbose(
				`Found ${participantKeys.length} participant reservations to check for room '${roomId}'`
			);

			// Redis TTL will automatically clean up expired keys, but we can force cleanup if needed.
			await runConcurrently(
				participantKeys,
				async (key) => {
					await this.redisService.delete(key);
				},
				{ concurrency, failFast: true }
			);
			this.logger.verbose(
				`Cleaned up ${participantKeys.length} expired participant names reservations for room '${roomId}'`
			);

			// Clean up expired participant name numbers from the pool
			this.logger.verbose(`Found ${poolKeys.length} participant name numbers to check for room '${roomId}'`);
			await runConcurrently(
				poolKeys,
				async (key) => {
					await this.redisService.delete(key);
				},
				{ concurrency, failFast: true }
			);
			this.logger.verbose(`Cleaned up ${poolKeys.length} expired participant name numbers for room '${roomId}'`);
		} catch (error) {
			this.logger.error(`Error cleaning up reservations for room '${roomId}':`, error);
		}
	}

	/**
	 * Attempts to atomically reserve a specific name using Redis SET with NX (not exists) option.
	 *
	 * @private
	 * @param participantsKey - The Redis key prefix for participants
	 * @param name - The name to reserve
	 * @returns Promise<boolean> - True if reservation was successful
	 */
	private async tryReserveName(participantsKey: string, name: string): Promise<boolean> {
		// Normalize the name for case-insensitive checks
		const normalizedName = name.toLowerCase();
		const nameKey = `${participantsKey}:${normalizedName}`;
		const timestamp = Date.now().toString();

		try {
			return await this.redisService.setIfNotExists(nameKey, timestamp, this.PARTICIPANT_NAME_TTL);
		} catch (error) {
			this.logger.warn(`Error trying to reserve name '${name}':`, error);
			return false;
		}
	}

	/**
	 * Generates an alternative name using a pool of available numbers.
	 * First tries to get a number from the available pool, then generates the next sequential number.
	 *
	 * @private
	 * @param roomId - The room identifier
	 * @param baseName - The base name to append number to
	 * @param fallbackSuffix - Fallback suffix if Redis fails
	 * @returns Promise<string> - The generated alternative name
	 */
	private async generateAlternativeName(roomId: string, baseName: string, fallbackSuffix: number): Promise<string> {
		try {
			// Normalize the base name for case-insensitive checks
			const normalizedBaseName = baseName.toLowerCase();

			// First try to get an available number from the pool
			const availableNumber = await this.getNumberFromPool(roomId, normalizedBaseName);

			if (availableNumber !== null) {
				return `${baseName}_${availableNumber}`;
			}

			// If no number available in pool, find the next sequential number
			const nextNumber = await this.findNextAvailableNumber(roomId, baseName);
			return `${baseName}_${nextNumber}`;
		} catch (error) {
			this.logger.warn(`Error generating alternative name, using fallback:`, error);
			// Fallback to simple incremental suffix if Redis fails
			return `${baseName}_${fallbackSuffix}`;
		}
	}

	/**
	 * Gets the smallest available number from the pool for reuse.
	 *
	 * @private
	 * @param roomId - The room identifier
	 * @param baseName - The base name
	 * @returns Promise<number | null> - Available number or null if pool is empty
	 */
	private async getNumberFromPool(roomId: string, baseName: string): Promise<number | null> {
		const poolKey = `${RedisKeyName.PARTICIPANT_NAME_POOL}${roomId}:${baseName}`;

		try {
			// Get the smallest number from the sorted set and remove it atomically
			const results = await this.redisService.popMinFromSortedSet(poolKey, 1);

			if (results.length > 0) {
				const number = parseInt(results[0], 10);
				this.logger.verbose(`Reusing number ${number} from pool for '${baseName}' in room '${roomId}'`);
				return number;
			}

			return null;
		} catch (error) {
			this.logger.warn(`Error getting number from pool:`, error);
			return null;
		}
	}

	/**
	 * Finds the next available sequential number by checking existing participants.
	 *
	 * @private
	 * @param roomId - The room identifier
	 * @param baseName - The base name
	 * @returns Promise<number> - The next available number
	 */
	private async findNextAvailableNumber(roomId: string, baseName: string): Promise<number> {
		const participantsKey = `${RedisKeyName.ROOM_PARTICIPANTS}${roomId}`;
		const pattern = `${participantsKey}:${baseName}_*`;

		try {
			const existingKeys = await this.redisService.getKeys(pattern);
			const usedNumbers = new Set<number>();

			// Extract all used numbers
			for (const key of existingKeys) {
				const name = key.replace(`${participantsKey}:`, '');
				const numberMatch = name.match(/^.+_(\d+)$/);

				if (numberMatch) {
					usedNumbers.add(parseInt(numberMatch[1], 10));
				}
			}

			// Find the smallest available number starting from 1
			let nextNumber = 1;

			while (usedNumbers.has(nextNumber)) {
				nextNumber++;
			}

			this.logger.verbose(`Generated new sequential number ${nextNumber} for '${baseName}' in room '${roomId}'`);
			return nextNumber;
		} catch (error) {
			this.logger.warn(`Error finding next available number:`, error);
			// Fallback to timestamp-based number if everything fails
			return Date.now() % 10000;
		}
	}

	/**
	 * Returns a number to the available pool for reuse.
	 *
	 * @private
	 * @param roomId - The room identifier
	 * @param baseName - The base name
	 * @param number - The number to return to pool
	 */
	private async returnNumberToPool(roomId: string, baseName: string, number: number): Promise<void> {
		const poolKey = `${RedisKeyName.PARTICIPANT_NAME_POOL}${roomId}:${baseName}`;

		try {
			// Add number to sorted set (score = number for natural ordering)
			await this.redisService.addToSortedSet(poolKey, number, number.toString());

			// Set TTL on pool key to prevent memory leaks
			await this.redisService.setExpiration(poolKey, this.PARTICIPANT_NAME_TTL);

			this.logger.verbose(`Returned number ${number} to pool for '${baseName}' in room '${roomId}'`);
		} catch (error) {
			this.logger.warn(`Error returning number to pool:`, error);
		}
	}

	/**
	 * Extracts the base name from a participant name that may have a numeric suffix.
	 * This prevents infinite concatenation of suffixes (e.g., "BOB_1_1_1...").
	 *
	 * Examples:
	 * - "BOB" -> { baseName: "BOB", originalCaseBase: "BOB" }
	 * - "BOB_1" -> { baseName: "BOB", originalCaseBase: "BOB" }
	 * - "Alice_42" -> { baseName: "Alice", originalCaseBase: "Alice" }
	 * - "John_Doe_5" -> { baseName: "John_Doe", originalCaseBase: "John_Doe" }
	 *
	 * @private
	 * @param name - The participant name to extract base from
	 * @returns Object with baseName (lowercase) and originalCaseBase (original case)
	 */
	private extractBaseName(name: string): { baseName: string; originalCaseBase: string } {
		// Match pattern: anything ending with underscore followed by one or more digits
		const match = name.match(/^(.+)_(\d+)$/);

		if (match) {
			// Name has a numeric suffix, extract the base name
			const originalCaseBase = match[1];
			return {
				baseName: originalCaseBase.toLowerCase(),
				originalCaseBase: originalCaseBase
			};
		}

		// No numeric suffix, the whole name is the base
		return {
			baseName: name.toLowerCase(),
			originalCaseBase: name
		};
	}
}

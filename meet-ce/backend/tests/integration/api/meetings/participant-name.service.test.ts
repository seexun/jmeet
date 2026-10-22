import { afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import ms from 'ms';
import { container, registerDependencies } from '../../../../src/config/dependency-injector.config.js';
import { ParticipantNameService } from '../../../../src/services/participant-name.service.js';
import { RedisService } from '../../../../src/services/redis.service.js';

describe('ParticipantNameService', () => {
	let participantNameService: ParticipantNameService;
	let redisService: RedisService;
	const testRoomId = 'test-room-unique-names';

	beforeAll(async () => {
		registerDependencies();
		participantNameService = container.get(ParticipantNameService);
		redisService = container.get(RedisService);

		await cleanupTestData();
	});

	afterEach(async () => {
		// Clean up test data after each test
		await cleanupTestData();
	});

	async function cleanupTestData() {
		try {
			const pattern = `ov_meet:room_participants:${testRoomId}:*`;
			const keys = await redisService.getKeys(pattern);

			if (keys.length > 0) {
				await redisService.delete(keys);
			}

			const counterPattern = `ov_meet:participant_counter:${testRoomId}:*`;
			const counterKeys = await redisService.getKeys(counterPattern);

			if (counterKeys.length > 0) {
				await redisService.delete(counterKeys);
			}
		} catch (error) {
			// Ignore cleanup errors
		}
	}

	describe('Reserve unique participant name', () => {
		it('should reserve the original name when available', async () => {
			const requestedName = 'Participant';
			const reservedName = await participantNameService.reserveUniqueName(testRoomId, requestedName);

			expect(reservedName).toBe(requestedName);

			// Verify the name is actually reserved
			const isReserved = await participantNameService.isNameReserved(testRoomId, requestedName);
			expect(isReserved).toBe(true);
		});

		it('should treat names as case-insensitive if required', async () => {
			await participantNameService.reserveUniqueName(testRoomId, 'Participant');
			const reserved2 = await participantNameService.reserveUniqueName(testRoomId, 'participant');
			expect(reserved2).toBe('participant_1');
		});

		it('should generate alternative names when original is taken', async () => {
			const requestedName = 'Participant';

			// Reserve the original name
			const firstReservation = await participantNameService.reserveUniqueName(testRoomId, requestedName);
			expect(firstReservation).toBe(requestedName);

			// Try to reserve the same name again - should get alternative
			const secondReservation = await participantNameService.reserveUniqueName(testRoomId, requestedName);
			expect(secondReservation).toBe(`${requestedName}_1`);

			// Try again - should get next alternative
			const thirdReservation = await participantNameService.reserveUniqueName(testRoomId, requestedName);
			expect(thirdReservation).toBe(`${requestedName}_2`);
		});

		it('should not concatenate "_1" infinitely when user requests a name ending with "_number"', async () => {
			// This test detects the bug where requesting "BOB_1" when "BOB_1" is taken
			// results in "BOB_1_1" instead of finding the next available number

			const baseName = 'BOB';

			// Reserve BOB
			const name1 = await participantNameService.reserveUniqueName(testRoomId, baseName);
			expect(name1).toBe('BOB');

			// Reserve BOB again -> should get BOB_1
			const name2 = await participantNameService.reserveUniqueName(testRoomId, baseName);
			expect(name2).toBe('BOB_1');

			// Now a user explicitly requests "BOB_1" (which is already taken)
			// Should get BOB_2, NOT BOB_1_1
			const name3 = await participantNameService.reserveUniqueName(testRoomId, 'BOB_1');
			expect(name3).toBe('BOB_2');

			// Request BOB again -> should get BOB_3
			const name4 = await participantNameService.reserveUniqueName(testRoomId, baseName);
			expect(name4).toBe('BOB_3');

			// Request BOB_2 (already taken) -> should get BOB_4
			const name5 = await participantNameService.reserveUniqueName(testRoomId, 'BOB_2');
			expect(name5).toBe('BOB_4');
		});

		it('should handle complex name patterns with underscores correctly', async () => {
			// Test with names that already have underscores in them

			// Reserve "John_Doe"
			const name1 = await participantNameService.reserveUniqueName(testRoomId, 'John_Doe');
			expect(name1).toBe('John_Doe');

			// Reserve "John_Doe" again -> should get "John_Doe_1"
			const name2 = await participantNameService.reserveUniqueName(testRoomId, 'John_Doe');
			expect(name2).toBe('John_Doe_1');

			// Request "John_Doe_1" (already taken) -> should get "John_Doe_2"
			const name3 = await participantNameService.reserveUniqueName(testRoomId, 'John_Doe_1');
			expect(name3).toBe('John_Doe_2');

			// Request "John_Doe_5" (not taken yet) -> should reserve "John_Doe_5"
			const name4 = await participantNameService.reserveUniqueName(testRoomId, 'John_Doe_5');
			expect(name4).toBe('John_Doe_5');

			// Request "John_Doe" again -> should get "John_Doe_3" (next available)
			const name5 = await participantNameService.reserveUniqueName(testRoomId, 'John_Doe');
			expect(name5).toBe('John_Doe_3');
		});

		it('should handle concurrent reservations properly', async () => {
			const requestedName = 'Participant';
			const concurrentRequests = 5;

			// Simulate concurrent requests for the same name
			const reservationPromises = Array.from({ length: concurrentRequests }, () =>
				participantNameService.reserveUniqueName(testRoomId, requestedName)
			);

			const reservedNames = await Promise.all(reservationPromises);

			// All names should be unique
			const uniqueNames = new Set(reservedNames);
			expect(uniqueNames.size).toBe(concurrentRequests);

			// First name should be the original
			expect(reservedNames).toContain(requestedName);

			// Others should be alternatives
			for (let i = 1; i < concurrentRequests; i++) {
				expect(reservedNames).toContain(`${requestedName}_${i}`);
			}
		});

		it('should reuse numbers when participants disconnect', async () => {
			const requestedName = 'Participant';

			// Reserve multiple names
			const name1 = await participantNameService.reserveUniqueName(testRoomId, requestedName);
			const name2 = await participantNameService.reserveUniqueName(testRoomId, requestedName);
			const name3 = await participantNameService.reserveUniqueName(testRoomId, requestedName);

			expect(name1).toBe('Participant');
			expect(name2).toBe('Participant_1');
			expect(name3).toBe('Participant_2');

			// Release the middle one
			await participantNameService.releaseName(testRoomId, name2);

			// Next reservation should reuse the released number
			const name4 = await participantNameService.reserveUniqueName(testRoomId, requestedName);
			expect(name4).toBe('Participant_1'); // Should reuse the released number
		});

		it('should maintain optimal numbering after multiple releases', async () => {
			const requestedName = 'Optimized';

			// Create several names
			const names: string[] = [];

			for (let i = 0; i < 5; i++) {
				names.push(await participantNameService.reserveUniqueName(testRoomId, requestedName));
			}

			expect(names).toEqual(['Optimized', 'Optimized_1', 'Optimized_2', 'Optimized_3', 'Optimized_4']);

			// Release some names (simulate participants leaving)
			await participantNameService.releaseName(testRoomId, 'Optimized_1');
			await participantNameService.releaseName(testRoomId, 'Optimized_3');

			// New participants should get the lowest available numbers
			const newName1 = await participantNameService.reserveUniqueName(testRoomId, requestedName);
			const newName2 = await participantNameService.reserveUniqueName(testRoomId, requestedName);

			expect(newName1).toBe('Optimized_1'); // Lowest available
			expect(newName2).toBe('Optimized_3'); // Next lowest available
		});
	});

	describe('releaseName', () => {
		it('should release a reserved name', async () => {
			const participantName = 'Participant';

			// Reserve a name
			await participantNameService.reserveUniqueName(testRoomId, participantName);
			expect(await participantNameService.isNameReserved(testRoomId, participantName)).toBe(true);

			// Release the name
			await participantNameService.releaseName(testRoomId, participantName);
			expect(await participantNameService.isNameReserved(testRoomId, participantName)).toBe(false);
		});

		it('should allow reusing a released name', async () => {
			const participantName = 'Frank';

			// Reserve, release, and reserve again
			await participantNameService.reserveUniqueName(testRoomId, participantName);
			await participantNameService.releaseName(testRoomId, participantName);

			const newReservation = await participantNameService.reserveUniqueName(testRoomId, participantName);
			expect(newReservation).toBe(participantName);
		});
	});

	describe('getReservedNames', () => {
		it('should return all reserved names in a room in lowercase', async () => {
			const names = ['Grace', 'Henry', 'Iris'];

			// Reserve multiple names
			for (const name of names) {
				await participantNameService.reserveUniqueName(testRoomId, name);
			}

			const reservedNames = await participantNameService.getReservedNames(testRoomId);

			for (const name of names) {
				expect(reservedNames).toContain(name.toLowerCase());
			}
		});

		it('should return empty array when no names are reserved', async () => {
			const reservedNames = await participantNameService.getReservedNames(testRoomId);
			expect(reservedNames).toEqual([]);
		});
	});

	describe('Reserve unique participant name - edge cases', () => {
		it('should be able to reserve same 20 names', async () => {
			const requestedName = 'LimitTest';

			const promises: Promise<string>[] = [];
			const twentyNames = participantNameService['MAX_CONCURRENT_NAME_REQUESTS'];

			for (let i = 0; i <= twentyNames; i++) {
				promises.push(participantNameService.reserveUniqueName(testRoomId, requestedName));
			}

			// Los primeros MAX_RETRIES deben resolverse bien
			const results = await Promise.allSettled(promises);

			const fulfilled = results.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<string>[];
			const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];

			console.log(fulfilled);
			expect(fulfilled.length).toBe(twentyNames + 1); // +1 for the original name
			expect(rejected.length).toBe(0);
		});

		it('should handle race condition when reusing released numbers', async () => {
			const requestedName = 'RaceTest';

			// Try to reserve two names
			const n1 = await participantNameService.reserveUniqueName(testRoomId, requestedName);
			const n2 = await participantNameService.reserveUniqueName(testRoomId, requestedName);

			expect([n1, n2]).toEqual(['RaceTest', 'RaceTest_1']);

			// Release _1
			await participantNameService.releaseName(testRoomId, n2);

			// Try to reserve again concurrently
			const [c1, c2] = await Promise.all([
				participantNameService.reserveUniqueName(testRoomId, requestedName),
				participantNameService.reserveUniqueName(testRoomId, requestedName)
			]);

			// One of them should be _1 and the other should be _2
			expect([c1, c2].sort()).toEqual(['RaceTest_1', 'RaceTest_2']);
		});

		it('should reuse expired names after TTL', async () => {
			(participantNameService as any)['PARTICIPANT_NAME_TTL'] = ms('1ms');
			const requestedName = 'TTLTest';

			// Reserva con TTL muy corto (simulado)
			const name = await participantNameService.reserveUniqueName(testRoomId, requestedName);
			expect(name).toBe('TTLTest');

			// Wait for TTL to expire
			await new Promise((resolve) =>
				setTimeout(resolve, (participantNameService['PARTICIPANT_NAME_TTL'] + 1) * 1000)
			);

			// Try to reserve again
			const newName = await participantNameService.reserveUniqueName(testRoomId, requestedName);
			expect(newName).toBe('TTLTest'); // Reuse original name
		});

		it('should keep names isolated per room', async () => {
			const requestedName = 'Isolated';

			// Reserve in two different rooms
			const room1Name = await participantNameService.reserveUniqueName('room1', requestedName);
			const room2Name = await participantNameService.reserveUniqueName('room2', requestedName);

			// Both names should be isolated
			expect(room1Name).toBe(requestedName);
			expect(room2Name).toBe(requestedName);
		});

		it('should treat names case-insensitively if normalization is enabled', async () => {
			const requestedName = 'CaseTest';

			const n1 = await participantNameService.reserveUniqueName(testRoomId, requestedName);
			expect(n1).toBe('CaseTest');

			// Try to reserve with different casing
			const n2 = await participantNameService.reserveUniqueName(testRoomId, 'casetest');
			expect(n2).toBe('casetest_1'); // Should return alternative name with original case
		});
	});
});

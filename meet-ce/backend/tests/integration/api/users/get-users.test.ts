import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { MeetUser, MeetUserRole } from '@openvidu-meet/typings';
import { MEET_ENV } from '../../../../src/environment.js';
import { expectValidationError } from '../../../helpers/assertion-helpers.js';
import { createUser, deleteAllUsers, getUsers, startTestServer } from '../../../helpers/request-helpers.js';

describe('Users API Tests', () => {
	beforeAll(async () => {
		await startTestServer();

		// Create a timestamp to ensure unique IDs (max 6 digits to fit in 20 char limit)
		const ts = String(Date.now()).slice(-6);

		// Create users sequentially to have predictable registration order
		await createUser({
			userId: `alice_${ts}`,
			name: 'Alice Anderson',
			password: 'password123',
			role: MeetUserRole.ADMIN
		});
		await createUser({
			userId: `bob_${ts}`,
			name: 'Bob Brown',
			password: 'password123',
			role: MeetUserRole.ROOM_MANAGER
		});
		await createUser({
			userId: `charlie_${ts}`,
			name: 'Charlie Clark',
			password: 'password123',
			role: MeetUserRole.ROOM_MEMBER
		});
		await createUser({
			userId: `diana_${ts}`,
			name: 'Diana Davis',
			password: 'password123',
			role: MeetUserRole.ADMIN
		});
		await createUser({
			userId: `eve_${ts}`,
			name: 'Eve Evans',
			password: 'password123',
			role: MeetUserRole.ROOM_MANAGER
		});
	});

	afterAll(async () => {
		await deleteAllUsers();
	});

	describe('Get Users Tests', () => {
		it('should successfully get all users without filters', async () => {
			const response = await getUsers();
			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty('users');
			expect(Array.isArray(response.body.users)).toBe(true);

			// Root admin + 5 test users = 6 total
			expect(response.body.users.length).toBe(6);
			expect(response.body).toHaveProperty('pagination');
			expect(response.body.pagination).toHaveProperty('isTruncated', false);
		});

		it('should filter users by userId', async () => {
			const allUsersResponse = await getUsers();
			const aliceUser = allUsersResponse.body.users.find((u: MeetUser) => u.userId.startsWith('alice_'));
			expect(aliceUser).toBeDefined();

			const response = await getUsers({ userId: aliceUser.userId });
			expect(response.status).toBe(200);
			expect(response.body.users).toHaveLength(1);
			expect(response.body.users[0].userId).toContain('alice');
		});

		it('should filter users by name using exact match by default', async () => {
			const response = await getUsers({ name: 'Alice Anderson' });
			expect(response.status).toBe(200);
			expect(response.body.users).toHaveLength(1);
			expect(response.body.users[0].name).toContain('Anderson');
		});

		it('should filter users by name with prefix match mode', async () => {
			const response = await getUsers({ name: 'Alice', nameMatchMode: 'prefix' });
			expect(response.status).toBe(200);
			expect(response.body.users).toHaveLength(1);
			expect(response.body.users[0].name).toContain('Alice');
		});

		it('should filter users by name with partial match mode', async () => {
			const response = await getUsers({ name: 'row', nameMatchMode: 'partial' });
			expect(response.status).toBe(200);
			expect(response.body.users).toHaveLength(1);
			expect(response.body.users[0].name).toContain('Brown');
		});

		it('should filter users by name with regex match mode', async () => {
			const response = await getUsers({ name: '^Bob\\sBrown$', nameMatchMode: 'regex' });
			expect(response.status).toBe(200);
			expect(response.body.users).toHaveLength(1);
			expect(response.body.users[0].name).toContain('Bob Brown');
		});

		it('should filter users by name case-insensitive exact match', async () => {
			const response = await getUsers({ name: 'bob brown', nameCaseInsensitive: true });
			expect(response.status).toBe(200);
			expect(response.body.users).toHaveLength(1);
			expect(response.body.users[0].name).toContain('Bob Brown');
		});

		it('should filter root admin by userId', async () => {
			const response = await getUsers({ userId: MEET_ENV.INITIAL_ADMIN_USER });
			expect(response.status).toBe(200);
			expect(response.body.users).toHaveLength(1);
			expect(response.body.users[0]).toHaveProperty('userId', MEET_ENV.INITIAL_ADMIN_USER);
			expect(response.body.users[0]).toHaveProperty('role', MeetUserRole.ADMIN);
		});

		it('should filter users by role', async () => {
			const response = await getUsers({ role: MeetUserRole.ADMIN });
			expect(response.status).toBe(200);

			// We created 2 admins + 1 root admin = 3 total
			expect(response.body.users).toHaveLength(3);
			response.body.users.forEach((user: MeetUser) => {
				expect(user).toHaveProperty('role', MeetUserRole.ADMIN);
			});
		});

		it('should return empty array when no users match filter', async () => {
			const response = await getUsers({ userId: 'nonexistent123xyz' });
			expect(response.status).toBe(200);
			expect(response.body.users).toHaveLength(0);
		});

		it('should respect maxItems parameter', async () => {
			const response = await getUsers({ maxItems: 2 });
			expect(response.status).toBe(200);
			expect(response.body.users.length).toBe(2);
			expect(response.body.pagination).toHaveProperty('maxItems', 2);
		});

		it('should limit maxItems to 100', async () => {
			const response = await getUsers({ maxItems: 150 });
			expect(response.status).toBe(200);
			expect(response.body.pagination).toHaveProperty('maxItems', 100);
		});

		it('should use default maxItems of 10 when not specified', async () => {
			const response = await getUsers();
			expect(response.status).toBe(200);
			expect(response.body.pagination).toHaveProperty('maxItems', 10);
		});

		it('should handle pagination with isTruncated flag', async () => {
			// Request only 3 users when we have 6 total
			const response = await getUsers({ maxItems: 3 });
			expect(response.status).toBe(200);
			expect(response.body.users).toHaveLength(3);
			expect(response.body.pagination).toHaveProperty('isTruncated', true);
			expect(response.body.pagination).toHaveProperty('nextPageToken');
		});

		it('should support pagination with nextPageToken', async () => {
			// First page: 3 users
			const firstResponse = await getUsers({ maxItems: 3 });
			expect(firstResponse.status).toBe(200);
			expect(firstResponse.body.users).toHaveLength(3);
			expect(firstResponse.body.pagination.isTruncated).toBe(true);

			// Second page: next 3 users
			const secondResponse = await getUsers({
				maxItems: 3,
				nextPageToken: firstResponse.body.pagination.nextPageToken
			});
			expect(secondResponse.status).toBe(200);
			expect(secondResponse.body.users).toHaveLength(3);
			expect(secondResponse.body.pagination.isTruncated).toBe(false);
		});

		it('should sort users by registrationDate in descending order by default', async () => {
			const response = await getUsers();
			expect(response.status).toBe(200);
			expect(response.body.users.length).toBe(6);

			// Eve was created last, should be first (most recent)
			expect(response.body.users[0].userId).toContain('eve');
			// Root admin was created first, should be last (oldest)
			expect(response.body.users[5].userId).toBe('admin');

			// Verify all dates are in descending order
			for (let i = 0; i < response.body.users.length - 1; i++) {
				expect(response.body.users[i].registrationDate).toBeGreaterThanOrEqual(
					response.body.users[i + 1].registrationDate
				);
			}
		});

		it('should sort users by registrationDate in ascending order', async () => {
			const response = await getUsers({ sortField: 'registrationDate', sortOrder: 'asc' });
			expect(response.status).toBe(200);
			expect(response.body.users.length).toBe(6);

			// Root admin was created first, should be first (oldest)
			expect(response.body.users[0].userId).toBe('admin');
			// Eve was created last, should be last (most recent)
			expect(response.body.users[5].userId).toContain('eve');

			// Verify all dates are in ascending order
			for (let i = 0; i < response.body.users.length - 1; i++) {
				expect(response.body.users[i].registrationDate).toBeLessThanOrEqual(
					response.body.users[i + 1].registrationDate
				);
			}
		});

		it('should sort users by name in descending order', async () => {
			const response = await getUsers({ sortField: 'name', sortOrder: 'desc' });
			expect(response.status).toBe(200);
			expect(response.body.users.length).toBe(6);

			// Verify names are in reverse alphabetical order (case-insensitive)
			for (let i = 0; i < response.body.users.length - 1; i++) {
				const currentName = response.body.users[i].name.toLowerCase();
				const nextName = response.body.users[i + 1].name.toLowerCase();
				expect(currentName.localeCompare(nextName)).toBeGreaterThanOrEqual(0);
			}
		});

		it('should sort users by name in ascending order', async () => {
			const response = await getUsers({ sortField: 'name', sortOrder: 'asc' });
			expect(response.status).toBe(200);
			expect(response.body.users.length).toBe(6);

			// Verify names are in alphabetical order (case-insensitive)
			for (let i = 0; i < response.body.users.length - 1; i++) {
				const currentName = response.body.users[i].name.toLowerCase();
				const nextName = response.body.users[i + 1].name.toLowerCase();
				expect(currentName.localeCompare(nextName)).toBeLessThanOrEqual(0);
			}
		});

		it('should not expose sensitive fields in user objects', async () => {
			const response = await getUsers({ maxItems: 3 });
			expect(response.status).toBe(200);

			response.body.users.forEach((user: MeetUser) => {
				expect(user).not.toHaveProperty('passwordHash');
				expect(user).not.toHaveProperty('mustChangePassword');
				expect(user).toHaveProperty('userId');
				expect(user).toHaveProperty('name');
				expect(user).toHaveProperty('role');
				expect(user).toHaveProperty('registrationDate');
				expect(user).toHaveProperty('roleUpdatedAt');
			});
		});
	});

	describe('Get Users Validation Tests', () => {
		it('should fail when nameMatchMode is invalid', async () => {
			const response = await getUsers({ name: 'Alice', nameMatchMode: 'invalid' });
			expectValidationError(response, 'nameMatchMode', 'Invalid enum value');
		});

		it('should fail when nameCaseInsensitive is invalid', async () => {
			const response = await getUsers({ nameCaseInsensitive: 'not-a-boolean' });
			expectValidationError(response, 'nameCaseInsensitive', 'Expected boolean, received string');
		});

		it('should fail when name regex pattern is invalid', async () => {
			const response = await getUsers({ name: '[invalid-regex', nameMatchMode: 'regex' });
			expectValidationError(response, 'name', 'Invalid regular expression pattern');
		});

		it('should fail when maxItems is zero', async () => {
			const response = await getUsers({ maxItems: 0 });
			expectValidationError(response, 'maxItems', 'must be a positive number');
		});

		it('should fail when maxItems is negative', async () => {
			const response = await getUsers({ maxItems: -5 });
			expectValidationError(response, 'maxItems', 'must be a positive number');
		});

		it('should fail when sortField is invalid', async () => {
			const response = await getUsers({ sortField: 'userId' });
			expectValidationError(response, 'sortField', 'Invalid enum value');
		});

		it('should fail when sortOrder is invalid', async () => {
			const response = await getUsers({ sortOrder: 'invalid' });
			expectValidationError(response, 'sortOrder', 'Invalid enum value');
		});
	});
});

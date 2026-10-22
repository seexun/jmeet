import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { MeetUserRole } from '@openvidu-meet/typings';
import { MEET_ENV } from '../../../../src/environment.js';
import { deleteAllUsers, getUser, startTestServer } from '../../../helpers/request-helpers.js';
import { setupTestUsers } from '../../../helpers/test-scenarios.js';
import { TestUsers } from '../../../interfaces/scenarios.js';

describe('Users API Tests', () => {
	let testUsers: TestUsers;

	beforeAll(async () => {
		await startTestServer();
		testUsers = await setupTestUsers();
	});

	afterAll(async () => {
		await deleteAllUsers();
	});

	describe('Get User Tests', () => {
		it('should successfully get a user by userId', async () => {
			const response = await getUser(testUsers.admin.user.userId);
			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty('userId', testUsers.admin.user.userId);
			expect(response.body).toHaveProperty('name', testUsers.admin.user.name);
			expect(response.body).toHaveProperty('role', MeetUserRole.ADMIN);
			expect(response.body).toHaveProperty('registrationDate');
			expect(response.body).toHaveProperty('roleUpdatedAt');
		});

		it('should get root admin user', async () => {
			const response = await getUser(MEET_ENV.INITIAL_ADMIN_USER);
			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty('userId', MEET_ENV.INITIAL_ADMIN_USER);
			expect(response.body).toHaveProperty('name', 'Admin');
			expect(response.body).toHaveProperty('role', MeetUserRole.ADMIN);
		});

		it('should get user with different roles', async () => {
			const userResponse = await getUser(testUsers.roomManager.user.userId);
			expect(userResponse.status).toBe(200);
			expect(userResponse.body).toHaveProperty('role', MeetUserRole.ROOM_MANAGER);

			const roomMemberResponse = await getUser(testUsers.roomMember.user.userId);
			expect(roomMemberResponse.status).toBe(200);
			expect(roomMemberResponse.body).toHaveProperty('role', MeetUserRole.ROOM_MEMBER);
		});

		it('should not expose sensitive fields', async () => {
			const response = await getUser(testUsers.admin.user.userId);
			expect(response.status).toBe(200);
			expect(response.body).not.toHaveProperty('passwordHash');
			expect(response.body).not.toHaveProperty('mustChangePassword');
			expect(response.body).toHaveProperty('userId');
			expect(response.body).toHaveProperty('name');
			expect(response.body).toHaveProperty('role');
			expect(response.body).toHaveProperty('registrationDate');
			expect(response.body).toHaveProperty('roleUpdatedAt');
		});

		it('should return 404 when user does not exist', async () => {
			const response = await getUser('nonexistent_user_123');
			expect(response.status).toBe(404);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('not found');
		});
	});
});

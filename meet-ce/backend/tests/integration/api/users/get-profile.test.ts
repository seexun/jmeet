import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { MeetUserRole } from '@openvidu-meet/typings';
import { MEET_ENV } from '../../../../src/environment.js';
import { deleteAllUsers, getMe, loginRootAdmin, startTestServer } from '../../../helpers/request-helpers.js';
import { setupTestUsers } from '../../../helpers/test-scenarios.js';
import { TestUsers } from '../../../interfaces/scenarios.js';

describe('Users API Tests', () => {
	let rootAdminAccessToken: string;
	let testUsers: TestUsers;

	beforeAll(async () => {
		await startTestServer();
		({ accessToken: rootAdminAccessToken } = await loginRootAdmin());
		testUsers = await setupTestUsers();
	});

	afterAll(async () => {
		await deleteAllUsers();
	});

	describe('Profile Tests', () => {
		it('should return root admin profile', async () => {
			const response = await getMe(rootAdminAccessToken);
			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty('userId', MEET_ENV.INITIAL_ADMIN_USER);
			expect(response.body).toHaveProperty('name', 'Admin');
			expect(response.body).toHaveProperty('role', MeetUserRole.ADMIN);
			expect(response.body).toHaveProperty('registrationDate');
			expect(response.body).toHaveProperty('roleUpdatedAt', response.body.registrationDate);
			expect(response.body).not.toHaveProperty('passwordHash');
			expect(response.body).not.toHaveProperty('mustChangePassword');
		});

		it('should return ADMIN user profile', async () => {
			const user = testUsers.admin;
			const response = await getMe(user.accessToken);
			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty('userId', user.user.userId);
			expect(response.body).toHaveProperty('name', user.user.name);
			expect(response.body).toHaveProperty('role', user.user.role);
			expect(response.body).toHaveProperty('registrationDate', user.user.registrationDate);
			expect(response.body).toHaveProperty('roleUpdatedAt', user.user.roleUpdatedAt);
			expect(response.body).not.toHaveProperty('passwordHash');
			expect(response.body).not.toHaveProperty('mustChangePassword');
		});

		it('should return ROOM_MANAGER user profile', async () => {
			const user = testUsers.roomManager;
			const response = await getMe(user.accessToken);
			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty('userId', user.user.userId);
			expect(response.body).toHaveProperty('name', user.user.name);
			expect(response.body).toHaveProperty('role', user.user.role);
			expect(response.body).toHaveProperty('registrationDate', user.user.registrationDate);
			expect(response.body).toHaveProperty('roleUpdatedAt', user.user.roleUpdatedAt);
			expect(response.body).not.toHaveProperty('passwordHash');
			expect(response.body).not.toHaveProperty('mustChangePassword');
		});

		it('should return ROOM_MEMBER user profile', async () => {
			const user = testUsers.roomMember;
			const response = await getMe(user.accessToken);
			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty('userId', user.user.userId);
			expect(response.body).toHaveProperty('name', user.user.name);
			expect(response.body).toHaveProperty('role', user.user.role);
			expect(response.body).toHaveProperty('registrationDate', user.user.registrationDate);
			expect(response.body).toHaveProperty('roleUpdatedAt', user.user.roleUpdatedAt);
			expect(response.body).not.toHaveProperty('passwordHash');
			expect(response.body).not.toHaveProperty('mustChangePassword');
		});
	});
});

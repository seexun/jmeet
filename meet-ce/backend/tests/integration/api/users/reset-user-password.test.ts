import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { MeetUserRole } from '@openvidu-meet/typings';
import { MEET_ENV } from '../../../../src/environment.js';
import { expectValidationError } from '../../../helpers/assertion-helpers.js';
import {
	createUser,
	deleteAllUsers,
	loginReq,
	resetUserPassword,
	startTestServer
} from '../../../helpers/request-helpers.js';
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

	describe('Reset User Password Tests', () => {
		it('should successfully reset user password by admin', async () => {
			const newPassword = 'newpassword123';
			const response = await resetUserPassword(
				testUsers.roomManager.user.userId,
				newPassword,
				testUsers.admin.accessToken
			);

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('reset successfully');
			expect(response.body.message).toContain('must change password on next login');
		});

		it('should allow user to login with new password after reset', async () => {
			const userId = `user_${Date.now()}`;
			const initialPassword = 'password123';
			const newPassword = 'resetpassword456';

			// Create user
			await createUser({
				userId,
				name: 'Test User',
				password: initialPassword,
				role: MeetUserRole.ROOM_MANAGER
			});

			// Reset password
			const response = await resetUserPassword(userId, newPassword);
			expect(response.status).toBe(200);

			// Verify old password no longer works
			const loginOldResponse = await loginReq({ userId, password: initialPassword });
			expect(loginOldResponse.status).toBe(404);

			// Verify new password works
			const loginResponse = await loginReq({ userId, password: newPassword });
			expect(loginResponse.status).toBe(200);
			expect(loginResponse.body).toHaveProperty('accessToken');
			expect(loginResponse.body).toHaveProperty('mustChangePassword', true);
		});

		it('should set mustChangePassword flag to true after password reset', async () => {
			const newPassword = 'resetpassword456';
			const response = await resetUserPassword(testUsers.roomManager.user.userId, newPassword);
			expect(response.status).toBe(200);

			// Login and verify mustChangePassword is true
			const loginResponse = await loginReq({
				userId: testUsers.roomManager.user.userId,
				password: newPassword
			});
			expect(loginResponse.status).toBe(200);
			expect(loginResponse.body).toHaveProperty('mustChangePassword', true);
		});

		it('should reset password for ADMIN users', async () => {
			const userId = `admin_${Date.now()}`;
			const newPassword = 'newadminpass123';

			// Create ADMIN user
			await createUser({
				userId,
				name: 'Test User',
				password: 'password123',
				role: MeetUserRole.ADMIN
			});

			// Reset password
			const response = await resetUserPassword(userId, newPassword, testUsers.admin.accessToken);
			expect(response.status).toBe(200);

			// Verify admin can login with new password
			const loginResponse = await loginReq({
				userId,
				password: newPassword
			});
			expect(loginResponse.status).toBe(200);
			expect(loginResponse.body).toHaveProperty('mustChangePassword', true);
		});

		it('should reset password for ROOM_MEMBER users', async () => {
			const newPassword = 'newroompass123';
			const response = await resetUserPassword(testUsers.roomMember.user.userId, newPassword);
			expect(response.status).toBe(200);

			// Verify room member can login with new password
			const loginResponse = await loginReq({
				userId: testUsers.roomMember.user.userId,
				password: newPassword
			});
			expect(loginResponse.status).toBe(200);
			expect(loginResponse.body).toHaveProperty('mustChangePassword', true);
		});

		it('should fail when trying to reset own password', async () => {
			const response = await resetUserPassword(
				testUsers.admin.user.userId,
				'newpassword123',
				testUsers.admin.accessToken
			);
			expect(response.status).toBe(403);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('Cannot reset your own password');
		});

		it('should fail when root admin tries to reset own password', async () => {
			const response = await resetUserPassword(MEET_ENV.INITIAL_ADMIN_USER, 'newpassword123');
			expect(response.status).toBe(403);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('Cannot reset your own password');
		});

		it('should fail when trying to reset root admin password', async () => {
			const response = await resetUserPassword(
				MEET_ENV.INITIAL_ADMIN_USER,
				'newpassword123',
				testUsers.admin.accessToken
			);
			expect(response.status).toBe(403);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('Cannot reset password for the root admin user');
		});

		it('should fail when user does not exist', async () => {
			const response = await resetUserPassword('nonexistent_user_123', 'newpassword123');
			expect(response.status).toBe(404);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('not found');
		});
	});

	describe('Reset User Password Validation Tests', () => {
		it('should fail when newPassword is missing', async () => {
			const response = await resetUserPassword(testUsers.roomManager.user.userId, undefined as unknown as string);
			expectValidationError(response, 'newPassword', 'Required');
		});

		it('should fail when newPassword is too short', async () => {
			const response = await resetUserPassword(testUsers.roomManager.user.userId, '1234');
			expectValidationError(response, 'newPassword', 'at least 5 characters');
		});
	});
});

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { MeetUserRole } from '@openvidu-meet/typings';
import { MEET_ENV } from '../../../../src/environment.js';
import { expectValidationError } from '../../../helpers/assertion-helpers.js';
import {
	changePassword,
	changePasswordReq,
	createRoom,
	createUser,
	deleteAllRooms,
	deleteAllUsers,
	loginReq,
	loginRootAdmin,
	loginUser,
	refreshTokenReq,
	startTestServer
} from '../../../helpers/request-helpers.js';
import { setupUser } from '../../../helpers/test-scenarios.js';

describe('Users API Tests', () => {
	let rootAdminAccessToken: string;

	beforeAll(async () => {
		await startTestServer();
		({ accessToken: rootAdminAccessToken } = await loginRootAdmin());
	});

	afterAll(async () => {
		await deleteAllRooms();
		await deleteAllUsers();
	});

	describe('Change Password Tests', () => {
		it('should successfully change root admin password', async () => {
			const newPassword = 'newpassword123';
			const response = await changePasswordReq(
				{ currentPassword: MEET_ENV.INITIAL_ADMIN_PASSWORD, newPassword },
				rootAdminAccessToken
			);
			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('changed successfully');
			expect(response.body).not.toHaveProperty('accessToken');
			expect(response.body).not.toHaveProperty('refreshToken');

			// Reset password back
			await changePassword(newPassword, MEET_ENV.INITIAL_ADMIN_PASSWORD, rootAdminAccessToken);
		});

		it('should successfully login with new password after change', async () => {
			const userId = MEET_ENV.INITIAL_ADMIN_USER;
			const initialPassword = MEET_ENV.INITIAL_ADMIN_PASSWORD;
			const newPassword = 'newpassword123';

			// Change password
			const changeResponse = await changePasswordReq(
				{ currentPassword: initialPassword, newPassword },
				rootAdminAccessToken
			);
			expect(changeResponse.status).toBe(200);

			// Verify old password no longer works
			const loginOldResponse = await loginReq({
				userId,
				password: initialPassword
			});
			expect(loginOldResponse.status).toBe(404);

			// Verify new password works
			const loginResponse = await loginReq({
				userId,
				password: newPassword
			});
			expect(loginResponse.status).toBe(200);

			// Reset password back
			await changePassword(newPassword, initialPassword, rootAdminAccessToken);
		});

		it('should successfully change password and return new tokens when mustChangePassword is true', async () => {
			const userId = `user_${Date.now()}`;
			const initialPassword = 'password123';
			const newPassword = 'NewPassword123!';

			// Create user (when created, this user is set to require password change)
			const createResponse = await createUser({
				userId,
				name: 'Test User',
				password: initialPassword,
				role: MeetUserRole.ROOM_MANAGER
			});
			expect(createResponse.status).toBe(201);

			// Login to get temporary token
			const { accessToken: accessTokenTmp } = await loginUser(userId, initialPassword);

			// Change password
			const response = await changePasswordReq({ currentPassword: initialPassword, newPassword }, accessTokenTmp);
			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('changed successfully');
			expect(response.body).toHaveProperty('accessToken');
			expect(response.body).toHaveProperty('refreshToken');

			const accessToken = response.body.accessToken;
			const refreshToken = response.body.refreshToken;

			// Verify new access token work
			await createRoom({}, `Bearer ${accessToken}`);

			// Verify new refresh token work
			const refreshResponse = await refreshTokenReq(`Bearer ${refreshToken}`);
			expect(refreshResponse.status).toBe(200);
		});

		it('should successfully change password for regular user without returning tokens', async () => {
			const userData = await setupUser({
				userId: `user_${Date.now()}`,
				name: 'Regular User',
				password: 'password123',
				role: MeetUserRole.ROOM_MANAGER
			});

			// Change password
			const response = await changePasswordReq(
				{ currentPassword: userData.password, newPassword: 'newpassword123' },
				userData.accessToken
			);
			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('changed successfully');
			expect(response.body).not.toHaveProperty('accessToken');
			expect(response.body).not.toHaveProperty('refreshToken');
		});

		it('should fail when current password is incorrect', async () => {
			const response = await changePasswordReq(
				{ currentPassword: 'wrongpassword', newPassword: 'newpassword123' },
				rootAdminAccessToken
			);
			expect(response.status).toBe(400);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('Invalid current password');
		});
	});

	describe('Change Password Validation Tests', () => {
		it('should fail when new password is too short', async () => {
			const response = await changePasswordReq(
				{ currentPassword: MEET_ENV.INITIAL_ADMIN_PASSWORD, newPassword: '1234' },
				rootAdminAccessToken
			);
			expectValidationError(response, 'newPassword', 'New password must be at least 5 characters long');
		});

		it('should fail when currentPassword is missing', async () => {
			const response = await changePasswordReq(
				{ newPassword: 'newpassword123' } as { currentPassword: string; newPassword: string },
				rootAdminAccessToken
			);
			expectValidationError(response, 'currentPassword', 'Required');
		});

		it('should fail when newPassword is missing', async () => {
			const response = await changePasswordReq(
				{ currentPassword: MEET_ENV.INITIAL_ADMIN_PASSWORD } as {
					currentPassword: string;
					newPassword: string;
				},
				rootAdminAccessToken
			);
			expectValidationError(response, 'newPassword', 'Required');
		});
	});
});

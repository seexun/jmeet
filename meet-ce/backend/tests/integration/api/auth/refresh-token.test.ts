import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { MeetUserRole } from '@openvidu-meet/typings';
import { MEET_ENV } from '../../../../src/environment.js';
import {
	deleteAllRooms,
	deleteAllUsers,
	deleteUser,
	loginRootAdmin,
	refreshTokenReq,
	resetUserPassword,
	startTestServer
} from '../../../helpers/request-helpers.js';
import { setupSingleRoom, setupUser } from '../../../helpers/test-scenarios.js';

describe('Authentication API Tests', () => {
	beforeAll(async () => {
		await startTestServer();
	});

	afterAll(async () => {
		await deleteAllRooms();
		await deleteAllUsers();
	});

	describe('Refresh Token Tests', () => {
		let accessToken: string;
		let refreshToken: string;
		let initialRefreshRotationEnabled: string;

		beforeAll(async () => {
			initialRefreshRotationEnabled = MEET_ENV.REFRESH_TOKEN_ROTATION_ENABLED;
			// Login to get a valid refresh token
			({ accessToken, refreshToken } = await loginRootAdmin());
		});

		afterAll(() => {
			MEET_ENV.REFRESH_TOKEN_ROTATION_ENABLED = initialRefreshRotationEnabled;
		});

		it('should succeed when providing valid refresh token', async () => {
			MEET_ENV.REFRESH_TOKEN_ROTATION_ENABLED = 'false';
			const response = await refreshTokenReq(refreshToken);
			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('successfully refreshed');
			expect(response.body).toHaveProperty('accessToken');
			expect(response.body).not.toHaveProperty('refreshToken');
		});

		it('should return a new refresh token when refresh rotation is enabled', async () => {
			MEET_ENV.REFRESH_TOKEN_ROTATION_ENABLED = 'true';

			const response = await refreshTokenReq(refreshToken);
			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty('accessToken');
			expect(response.body).toHaveProperty('refreshToken');

			const rotatedRefreshToken = `Bearer ${response.body.refreshToken}`;
			const secondRefreshResponse = await refreshTokenReq(rotatedRefreshToken);
			expect(secondRefreshResponse.status).toBe(200);
			expect(secondRefreshResponse.body).toHaveProperty('accessToken');
			expect(secondRefreshResponse.body).toHaveProperty('refreshToken');
		});

		it('should fail when refresh token is missing', async () => {
			const response = await refreshTokenReq('');
			expect(response.status).toBe(400);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('No refresh token provided');
		});

		it('should fail when refresh token is invalid', async () => {
			const response = await refreshTokenReq('Bearer invalidtoken');
			expect(response.status).toBe(400);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('Invalid refresh token');
		});

		it('should fail when using access token instead of refresh token', async () => {
			const response = await refreshTokenReq(accessToken);
			expect(response.status).toBe(400);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('Invalid refresh token');
		});

		it('should fail when using room member token instead of refresh token', async () => {
			const { moderatorToken } = await setupSingleRoom();
			const response = await refreshTokenReq(moderatorToken);
			expect(response.status).toBe(400);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('Invalid refresh token');
		});

		it('should fail when refresh token has invalid subject', async () => {
			// Create a user and get their refresh token
			const userData = await setupUser({
				userId: 'tempuser',
				name: 'Temporary User',
				password: 'TempPassword1!',
				role: MeetUserRole.ROOM_MANAGER
			});

			// Delete the user to invalidate the refresh token subject
			await deleteUser(userData.user.userId);

			// Attempt to refresh token
			const response = await refreshTokenReq(userData.refreshToken);
			expect(response.status).toBe(403);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('Invalid token subject');
		});

		it('should fail when user must change password', async () => {
			// Create a user and get their refresh token
			const userData = await setupUser({
				userId: 'testuser',
				name: 'Test User',
				password: 'TestPassword1!',
				role: MeetUserRole.ROOM_MANAGER
			});

			// Reset user password to force password change
			await resetUserPassword(userData.user.userId, 'NewPassword1!');

			// Attempt to refresh token
			const response = await refreshTokenReq(userData.refreshToken);
			expect(response.status).toBe(403);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('Password change required');
		});
	});
});

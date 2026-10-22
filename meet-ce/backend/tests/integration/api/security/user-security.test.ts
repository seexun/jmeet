import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { MeetUserRole } from '@openvidu-meet/typings';
import { Express } from 'express';
import request from 'supertest';
import { INTERNAL_CONFIG } from '../../../../src/config/internal-config.js';
import { MEET_ENV } from '../../../../src/environment.js';
import {
	changePassword,
	createUser,
	deleteAllUsers,
	getFullPath,
	loginRootAdmin,
	startTestServer
} from '../../../helpers/request-helpers.js';
import { setupTestUsers } from '../../../helpers/test-scenarios.js';
import { TestUsers } from '../../../interfaces/scenarios.js';

const USERS_PATH = getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/users`);
const INTERNAL_USERS_PATH = getFullPath(`${INTERNAL_CONFIG.INTERNAL_API_BASE_PATH_V1}/users`);

describe('User API Security Tests', () => {
	let app: Express;
	let rootAdminAccessToken: string;
	let testUsers: TestUsers;

	beforeAll(async () => {
		app = await startTestServer();
		({ accessToken: rootAdminAccessToken } = await loginRootAdmin());
		testUsers = await setupTestUsers();
	});

	afterAll(async () => {
		await deleteAllUsers();
	});

	describe('Create User Tests', () => {
		const getNewUserData = () => {
			const timestamp = Date.now();
			return {
				userId: `usr_${timestamp}`,
				name: 'Test User',
				password: 'testpass123',
				role: MeetUserRole.ROOM_MANAGER
			};
		};

		it('should succeed when using API key', async () => {
			const response = await request(app)
				.post(USERS_PATH)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
				.send(getNewUserData());
			expect(response.status).toBe(201);
		});

		it('should succeed when user is authenticated as root admin', async () => {
			const response = await request(app)
				.post(USERS_PATH)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, rootAdminAccessToken)
				.send(getNewUserData());
			expect(response.status).toBe(201);
		});

		it('should succeed when user is authenticated as ADMIN', async () => {
			const response = await request(app)
				.post(USERS_PATH)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.admin.accessToken)
				.send(getNewUserData());
			expect(response.status).toBe(201);
		});

		it('should fail when user is authenticated as ROOM_MANAGER', async () => {
			const response = await request(app)
				.post(USERS_PATH)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomManager.accessToken)
				.send(getNewUserData());
			expect(response.status).toBe(403);
		});

		it('should fail when user is authenticated as ROOM_MEMBER', async () => {
			const response = await request(app)
				.post(USERS_PATH)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomMember.accessToken)
				.send(getNewUserData());
			expect(response.status).toBe(403);
		});

		it('should fail when user is not authenticated', async () => {
			const response = await request(app).post(USERS_PATH).send(getNewUserData());
			expect(response.status).toBe(401);
		});
	});

	describe('Get Users Tests', () => {
		it('should succeed when using API key', async () => {
			const response = await request(app)
				.get(USERS_PATH)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY);
			expect(response.status).toBe(200);
		});

		it('should succeed when user is authenticated as root admin', async () => {
			const response = await request(app)
				.get(USERS_PATH)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, rootAdminAccessToken);
			expect(response.status).toBe(200);
		});

		it('should succeed when user is authenticated as ADMIN', async () => {
			const response = await request(app)
				.get(USERS_PATH)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.admin.accessToken);
			expect(response.status).toBe(200);
		});

		it('should succeed when user is authenticated as ROOM_MANAGER', async () => {
			const response = await request(app)
				.get(USERS_PATH)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomManager.accessToken);
			expect(response.status).toBe(200);
		});

		it('should fail when user is authenticated as ROOM_MEMBER', async () => {
			const response = await request(app)
				.get(USERS_PATH)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomMember.accessToken);
			expect(response.status).toBe(403);
		});

		it('should fail when user is not authenticated', async () => {
			const response = await request(app).get(USERS_PATH);
			expect(response.status).toBe(401);
		});
	});

	describe('Get User Tests', () => {
		let userId: string;

		beforeAll(async () => {
			const response = await createUser({
				userId: `usr_${Date.now()}`,
				name: 'Test User',
				password: 'testpass123',
				role: MeetUserRole.ROOM_MANAGER
			});
			expect(response.status).toBe(201);
			userId = response.body.userId;
		});

		it('should succeed when using API key', async () => {
			const response = await request(app)
				.get(`${USERS_PATH}/${userId}`)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY);
			expect(response.status).toBe(200);
		});

		it('should succeed when user is authenticated as root admin', async () => {
			const response = await request(app)
				.get(`${USERS_PATH}/${userId}`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, rootAdminAccessToken);
			expect(response.status).toBe(200);
		});

		it('should succeed when user is authenticated as ADMIN', async () => {
			const response = await request(app)
				.get(`${USERS_PATH}/${userId}`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.admin.accessToken);
			expect(response.status).toBe(200);
		});

		it('should succeed when user is authenticated as ROOM_MANAGER', async () => {
			const response = await request(app)
				.get(`${USERS_PATH}/${userId}`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomManager.accessToken);
			expect(response.status).toBe(200);
		});

		it('should fail when user is authenticated as ROOM_MEMBER', async () => {
			const response = await request(app)
				.get(`${USERS_PATH}/${userId}`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomMember.accessToken);
			expect(response.status).toBe(403);
		});

		it('should fail when user is not authenticated', async () => {
			const response = await request(app).get(`${USERS_PATH}/${userId}`);
			expect(response.status).toBe(401);
		});
	});

	describe('Reset User Password Tests', () => {
		let userId: string;
		const newPassword = 'resetpassword123';

		beforeAll(async () => {
			const response = await createUser({
				userId: `usr_${Date.now()}`,
				name: 'Test User',
				password: 'testpass123',
				role: MeetUserRole.ROOM_MANAGER
			});
			expect(response.status).toBe(201);
			userId = response.body.userId;
		});

		it('should succeed when using API key', async () => {
			const response = await request(app)
				.put(`${USERS_PATH}/${userId}/password`)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
				.send({ newPassword });
			expect(response.status).toBe(200);
		});

		it('should succeed when user is authenticated as root admin', async () => {
			const response = await request(app)
				.put(`${USERS_PATH}/${userId}/password`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, rootAdminAccessToken)
				.send({ newPassword });
			expect(response.status).toBe(200);
		});

		it('should succeed when user is authenticated as ADMIN', async () => {
			const response = await request(app)
				.put(`${USERS_PATH}/${userId}/password`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.admin.accessToken)
				.send({ newPassword });
			expect(response.status).toBe(200);
		});

		it('should fail when user is authenticated as ROOM_MANAGER', async () => {
			const response = await request(app)
				.put(`${USERS_PATH}/${userId}/password`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomManager.accessToken)
				.send({ newPassword });
			expect(response.status).toBe(403);
		});

		it('should fail when user is authenticated as ROOM_MEMBER', async () => {
			const response = await request(app)
				.put(`${USERS_PATH}/${userId}/password`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomMember.accessToken)
				.send({ newPassword });
			expect(response.status).toBe(403);
		});

		it('should fail when user is not authenticated', async () => {
			const response = await request(app).put(`${USERS_PATH}/${userId}/password`).send({ newPassword });
			expect(response.status).toBe(401);
		});
	});

	describe('Update User Role Tests', () => {
		let userId: string;

		beforeAll(async () => {
			const response = await createUser({
				userId: `usr_${Date.now()}`,
				name: 'Test User',
				password: 'testpass123',
				role: MeetUserRole.ROOM_MANAGER
			});
			expect(response.status).toBe(201);
			userId = response.body.userId;
		});

		it('should succeed when using API key', async () => {
			const response = await request(app)
				.put(`${USERS_PATH}/${userId}/role`)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
				.send({ role: MeetUserRole.ADMIN });
			expect(response.status).toBe(200);
		});

		it('should succeed when user is authenticated as root admin', async () => {
			const response = await request(app)
				.put(`${USERS_PATH}/${userId}/role`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, rootAdminAccessToken)
				.send({ role: MeetUserRole.ADMIN });
			expect(response.status).toBe(200);
		});

		it('should succeed when user is authenticated as ADMIN', async () => {
			const response = await request(app)
				.put(`${USERS_PATH}/${userId}/role`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.admin.accessToken)
				.send({ role: MeetUserRole.ADMIN });
			expect(response.status).toBe(200);
		});

		it('should fail when user is authenticated as ROOM_MANAGER', async () => {
			const response = await request(app)
				.put(`${USERS_PATH}/${userId}/role`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomManager.accessToken)
				.send({ role: MeetUserRole.ADMIN });
			expect(response.status).toBe(403);
		});

		it('should fail when user is authenticated as ROOM_MEMBER', async () => {
			const response = await request(app)
				.put(`${USERS_PATH}/${userId}/role`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomMember.accessToken)
				.send({ role: MeetUserRole.ADMIN });
			expect(response.status).toBe(403);
		});

		it('should fail when user is not authenticated', async () => {
			const response = await request(app).put(`${USERS_PATH}/${userId}/role`).send({ role: MeetUserRole.ADMIN });
			expect(response.status).toBe(401);
		});
	});

	describe('Delete User Tests', () => {
		let userId: string;

		beforeEach(async () => {
			// Create a user to delete in each test
			const response = await createUser({
				userId: `usr_${Date.now()}`,
				name: 'Test User',
				password: 'testpass123',
				role: MeetUserRole.ROOM_MANAGER
			});
			expect(response.status).toBe(201);
			userId = response.body.userId;
		});

		it('should succeed when using API key', async () => {
			const response = await request(app)
				.delete(`${USERS_PATH}/${userId}`)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY);
			expect(response.status).toBe(200);
		});

		it('should succeed when user is authenticated as root admin', async () => {
			const response = await request(app)
				.delete(`${USERS_PATH}/${userId}`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, rootAdminAccessToken);
			expect(response.status).toBe(200);
		});

		it('should succeed when user is authenticated as ADMIN', async () => {
			const response = await request(app)
				.delete(`${USERS_PATH}/${userId}`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.admin.accessToken);
			expect(response.status).toBe(200);
		});

		it('should fail when user is authenticated as ROOM_MANAGER', async () => {
			const response = await request(app)
				.delete(`${USERS_PATH}/${userId}`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomManager.accessToken);
			expect(response.status).toBe(403);
		});

		it('should fail when user is authenticated as ROOM_MEMBER', async () => {
			const response = await request(app)
				.delete(`${USERS_PATH}/${userId}`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomMember.accessToken);
			expect(response.status).toBe(403);
		});

		it('should fail when user is not authenticated', async () => {
			const response = await request(app).delete(`${USERS_PATH}/${userId}`);
			expect(response.status).toBe(401);
		});
	});

	describe('Bulk Delete Users Tests', () => {
		let userId: string;

		beforeEach(async () => {
			// Create user to delete in each test
			const response = await createUser({
				userId: `usr_${Date.now()}`,
				name: 'Test User',
				password: 'testpass123',
				role: MeetUserRole.ROOM_MANAGER
			});
			expect(response.status).toBe(201);
			userId = response.body.userId;
		});

		it('should succeed when using API key', async () => {
			const response = await request(app)
				.delete(USERS_PATH)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
				.query({ userIds: userId });
			expect(response.status).toBe(200);
		});

		it('should succeed when user is authenticated as root admin', async () => {
			const response = await request(app)
				.delete(USERS_PATH)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, rootAdminAccessToken)
				.query({ userIds: userId });
			expect(response.status).toBe(200);
		});

		it('should succeed when user is authenticated as ADMIN', async () => {
			const response = await request(app)
				.delete(USERS_PATH)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.admin.accessToken)
				.query({ userIds: userId });
			expect(response.status).toBe(200);
		});

		it('should fail when user is authenticated as ROOM_MANAGER', async () => {
			const response = await request(app)
				.delete(USERS_PATH)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomManager.accessToken)
				.query({ userIds: userId });
			expect(response.status).toBe(403);
		});

		it('should fail when user is authenticated as ROOM_MEMBER', async () => {
			const response = await request(app)
				.delete(USERS_PATH)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomMember.accessToken)
				.query({ userIds: userId });
			expect(response.status).toBe(403);
		});

		it('should fail when user is not authenticated', async () => {
			const response = await request(app).delete(USERS_PATH).query({ userIds: userId });
			expect(response.status).toBe(401);
		});
	});

	describe('Profile Tests', () => {
		it('should succeed when user is authenticated as root admin', async () => {
			const response = await request(app)
				.get(`${INTERNAL_USERS_PATH}/me`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, rootAdminAccessToken);
			expect(response.status).toBe(200);
		});

		it('should succeed when user is authenticated as ADMIN', async () => {
			const response = await request(app)
				.get(`${INTERNAL_USERS_PATH}/me`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.admin.accessToken);
			expect(response.status).toBe(200);
		});

		it('should succeed when user is authenticated as ROOM_MANAGER', async () => {
			const response = await request(app)
				.get(`${INTERNAL_USERS_PATH}/me`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomManager.accessToken);
			expect(response.status).toBe(200);
		});

		it('should succeed when user is authenticated as ROOM_MEMBER', async () => {
			const response = await request(app)
				.get(`${INTERNAL_USERS_PATH}/me`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomMember.accessToken);
			expect(response.status).toBe(200);
		});

		it('should fail when user is not authenticated', async () => {
			const response = await request(app).get(`${INTERNAL_USERS_PATH}/me`);
			expect(response.status).toBe(401);
		});
	});

	describe('Change Password Tests', () => {
		const newPassword = 'newpassword123';

		it('should succeed when user is authenticated as root admin', async () => {
			const response = await request(app)
				.post(`${INTERNAL_USERS_PATH}/change-password`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, rootAdminAccessToken)
				.send({
					currentPassword: MEET_ENV.INITIAL_ADMIN_PASSWORD,
					newPassword
				});
			expect(response.status).toBe(200);

			// Reset old password
			await changePassword(newPassword, MEET_ENV.INITIAL_ADMIN_PASSWORD, rootAdminAccessToken);
		});

		it('should succeed when user is authenticated as ADMIN', async () => {
			const response = await request(app)
				.post(`${INTERNAL_USERS_PATH}/change-password`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.admin.accessToken)
				.send({
					currentPassword: testUsers.admin.password,
					newPassword
				});
			expect(response.status).toBe(200);

			// Reset old password
			await changePassword(newPassword, testUsers.admin.password, testUsers.admin.accessToken);
		});

		it('should succeed when user is authenticated as ROOM_MANAGER', async () => {
			const response = await request(app)
				.post(`${INTERNAL_USERS_PATH}/change-password`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomManager.accessToken)
				.send({
					currentPassword: testUsers.roomManager.password,
					newPassword
				});
			expect(response.status).toBe(200);

			// Reset old password
			await changePassword(newPassword, testUsers.roomManager.password, testUsers.roomManager.accessToken);
		});

		it('should succeed when user is authenticated as ROOM_MEMBER', async () => {
			const response = await request(app)
				.post(`${INTERNAL_USERS_PATH}/change-password`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomMember.accessToken)
				.send({
					currentPassword: testUsers.roomMember.password,
					newPassword
				});
			expect(response.status).toBe(200);

			// Reset old password
			await changePassword(newPassword, testUsers.roomMember.password, testUsers.roomMember.accessToken);
		});

		it('should fail when user is not authenticated', async () => {
			const response = await request(app).post(`${INTERNAL_USERS_PATH}/change-password`).send({
				currentPassword: MEET_ENV.INITIAL_ADMIN_PASSWORD,
				newPassword
			});
			expect(response.status).toBe(401);
		});
	});
});

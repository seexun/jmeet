import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { MeetRoomThemeMode } from '@openvidu-meet/typings';
import { Express } from 'express';
import request from 'supertest';
import { INTERNAL_CONFIG } from '../../../../src/config/internal-config.js';
import { MEET_ENV } from '../../../../src/environment.js';
import {
	deleteAllUsers,
	getFullPath,
	restoreDefaultGlobalConfig,
	startTestServer
} from '../../../helpers/request-helpers.js';
import { setupTestUsers } from '../../../helpers/test-scenarios.js';
import { TestUsers } from '../../../interfaces/scenarios.js';

const CONFIG_PATH = getFullPath(`${INTERNAL_CONFIG.INTERNAL_API_BASE_PATH_V1}/config`);

describe('Global Config API Security Tests', () => {
	let app: Express;
	let testUsers: TestUsers;

	beforeAll(async () => {
		app = await startTestServer();
		testUsers = await setupTestUsers();
	});

	afterAll(async () => {
		await deleteAllUsers();
	});

	describe('Update Webhook Config Tests', () => {
		const webhookConfig = {
			enabled: true,
			url: 'https://example.com/webhook'
		};

		it('should fail when request includes API key', async () => {
			const response = await request(app)
				.put(`${CONFIG_PATH}/webhooks`)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
				.send(webhookConfig);
			expect(response.status).toBe(401);
		});

		it('should succeed when user is authenticated as ADMIN', async () => {
			const response = await request(app)
				.put(`${CONFIG_PATH}/webhooks`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.admin.accessToken)
				.send(webhookConfig);
			expect(response.status).toBe(200);

			await restoreDefaultGlobalConfig();
		});

		it('should fail when user is authenticated as ROOM_MANAGER', async () => {
			const response = await request(app)
				.put(`${CONFIG_PATH}/webhooks`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomManager.accessToken)
				.send(webhookConfig);
			expect(response.status).toBe(403);
		});

		it('should fail when user is authenticated as ROOM_MEMBER', async () => {
			const response = await request(app)
				.put(`${CONFIG_PATH}/webhooks`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomMember.accessToken)
				.send(webhookConfig);
			expect(response.status).toBe(403);
		});

		it('should fail when user is not authenticated', async () => {
			const response = await request(app).put(`${CONFIG_PATH}/webhooks`).send(webhookConfig);
			expect(response.status).toBe(401);
		});
	});

	describe('Get Webhook Config Tests', () => {
		it('should fail when request includes API key', async () => {
			const response = await request(app)
				.get(`${CONFIG_PATH}/webhooks`)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY);
			expect(response.status).toBe(401);
		});

		it('should succeed when user is authenticated as ADMIN', async () => {
			const response = await request(app)
				.get(`${CONFIG_PATH}/webhooks`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.admin.accessToken);
			expect(response.status).toBe(200);
		});

		it('should fail when user is authenticated as ROOM_MANAGER', async () => {
			const response = await request(app)
				.get(`${CONFIG_PATH}/webhooks`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomManager.accessToken);
			expect(response.status).toBe(403);
		});

		it('should fail when user is authenticated as ROOM_MEMBER', async () => {
			const response = await request(app)
				.get(`${CONFIG_PATH}/webhooks`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomMember.accessToken);
			expect(response.status).toBe(403);
		});

		it('should fail when user is not authenticated', async () => {
			const response = await request(app).get(`${CONFIG_PATH}/webhooks`);
			expect(response.status).toBe(401);
		});
	});

	describe('Update Security Config Tests', () => {
		const securityConfig = {
			authentication: {
				localLoginEnabled: true,
				identityProviders: []
			}
		};

		it('should fail when request includes API key', async () => {
			const response = await request(app)
				.put(`${CONFIG_PATH}/security`)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
				.send(securityConfig);
			expect(response.status).toBe(401);
		});

		it('should succeed when user is authenticated as ADMIN', async () => {
			const response = await request(app)
				.put(`${CONFIG_PATH}/security`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.admin.accessToken)
				.send(securityConfig);
			expect(response.status).toBe(200);

			await restoreDefaultGlobalConfig();
		});

		it('should fail when user is authenticated as ROOM_MANAGER', async () => {
			const response = await request(app)
				.put(`${CONFIG_PATH}/security`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomManager.accessToken)
				.send(securityConfig);
			expect(response.status).toBe(403);
		});

		it('should fail when user is authenticated as ROOM_MEMBER', async () => {
			const response = await request(app)
				.put(`${CONFIG_PATH}/security`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomMember.accessToken)
				.send(securityConfig);
			expect(response.status).toBe(403);
		});

		it('should fail when user is not authenticated', async () => {
			const response = await request(app).put(`${CONFIG_PATH}/security`).send(securityConfig);
			expect(response.status).toBe(401);
		});
	});

	describe('Get Security Config Tests', () => {
		it('should fail when user is not authenticated', async () => {
			const response = await request(app).get(`${CONFIG_PATH}/security`);
			expect(response.status).toBe(401);
		});

		it('should succeed when user is authenticated as ADMIN', async () => {
			const response = await request(app).get(`${CONFIG_PATH}/security`).set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.admin.accessToken);
			expect(response.status).toBe(200);
		});
	});

	describe('Update Rooms Appearance Config Tests', () => {
		const appearanceConfig = {
			appearance: {
				themes: [
					{
						name: 'default',
						enabled: true,
						baseTheme: MeetRoomThemeMode.DARK
					}
				]
			}
		};

		it('should fail when request includes API key', async () => {
			const response = await request(app)
				.put(`${CONFIG_PATH}/rooms/appearance`)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
				.send(appearanceConfig);
			expect(response.status).toBe(401);
		});

		it('should succeed when user is authenticated as ADMIN', async () => {
			const response = await request(app)
				.put(`${CONFIG_PATH}/rooms/appearance`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.admin.accessToken)
				.send(appearanceConfig);
			expect(response.status).toBe(200);

			await restoreDefaultGlobalConfig();
		});

		it('should fail when user is authenticated as ROOM_MANAGER', async () => {
			const response = await request(app)
				.put(`${CONFIG_PATH}/rooms/appearance`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomManager.accessToken)
				.send(appearanceConfig);
			expect(response.status).toBe(403);
		});

		it('should fail when user is authenticated as ROOM_MEMBER', async () => {
			const response = await request(app)
				.put(`${CONFIG_PATH}/rooms/appearance`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomMember.accessToken)
				.send(appearanceConfig);
			expect(response.status).toBe(403);
		});

		it('should fail when user is not authenticated', async () => {
			const response = await request(app).put(`${CONFIG_PATH}/rooms/appearance`).send(appearanceConfig);
			expect(response.status).toBe(401);
		});
	});

	describe('Get Rooms Appearance Config Tests', () => {
		it('should succeed when user is not authenticated', async () => {
			const response = await request(app).get(`${CONFIG_PATH}/rooms/appearance`);
			expect(response.status).toBe(200);
		});
	});
});

import { beforeAll, describe, expect, it } from '@jest/globals';
import { Express } from 'express';
import request from 'supertest';
import { INTERNAL_CONFIG } from '../../../../src/config/internal-config.js';
import { getFullPath, loginRootAdmin, startTestServer } from '../../../helpers/request-helpers.js';

const AUTH_PATH = getFullPath(`${INTERNAL_CONFIG.INTERNAL_API_BASE_PATH_V1}/auth`);

describe('Authentication API Tests', () => {
	let app: Express;
	let rootAdminAccessToken: string;

	beforeAll(async () => {
		app = await startTestServer();
		({ accessToken: rootAdminAccessToken } = await loginRootAdmin());
	});

	describe('Logout Tests', () => {
		it('should succeed with authentication', async () => {
			const response = await request(app)
				.post(`${AUTH_PATH}/logout`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, rootAdminAccessToken);
			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('Logout successful');
		});

		it('should succeed without authentication', async () => {
			const response = await request(app).post(`${AUTH_PATH}/logout`);
			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toBe('Logout successful');
		});
	});
});

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { MeetUserOptions, MeetUserRole } from '@openvidu-meet/typings';
import { expectValidationError } from '../../../helpers/assertion-helpers.js';
import { createUser, deleteAllUsers, getUser, loginReq, startTestServer } from '../../../helpers/request-helpers.js';

describe('Users API Tests', () => {
	beforeAll(async () => {
		await startTestServer();
	});

	afterAll(async () => {
		await deleteAllUsers();
	});

	describe('Create User Tests', () => {
		it('should successfully create a ROOM_MANAGER with all required fields', async () => {
			const userId = `user_${Date.now()}`;
			const userOptions = {
				userId,
				name: 'Test User',
				password: 'password123',
				role: MeetUserRole.ROOM_MANAGER
			};

			const response = await createUser(userOptions);

			expect(response.status).toBe(201);
			expect(response.body).toHaveProperty('userId', userId);
			expect(response.body).toHaveProperty('name', 'Test User');
			expect(response.body).toHaveProperty('role', MeetUserRole.ROOM_MANAGER);
			expect(response.body).toHaveProperty('registrationDate');
			expect(response.body).toHaveProperty('roleUpdatedAt');
			expect(response.body.roleUpdatedAt).toBe(response.body.registrationDate);
			expect(response.body).not.toHaveProperty('passwordHash');
			expect(response.body).not.toHaveProperty('mustChangePassword');

			// Verify Location header is set correctly
			expect(response.headers).toHaveProperty('location');
			expect(response.headers.location).toContain(`/users/${userId}`);
		});

		it('should successfully create an ADMIN user', async () => {
			const userId = `admin_${Date.now()}`;
			const userOptions = {
				userId,
				name: 'Test Admin',
				password: 'admin_pass',
				role: MeetUserRole.ADMIN
			};

			const response = await createUser(userOptions);

			expect(response.status).toBe(201);
			expect(response.body).toHaveProperty('userId', userId);
			expect(response.body).toHaveProperty('role', MeetUserRole.ADMIN);
		});

		it('should successfully create a ROOM_MEMBER user', async () => {
			const userId = `rm_${Date.now()}`;
			const userOptions = {
				userId,
				name: 'Test Room Member',
				password: 'member_pass',
				role: MeetUserRole.ROOM_MEMBER
			};

			const response = await createUser(userOptions);

			expect(response.status).toBe(201);
			expect(response.body).toHaveProperty('userId', userId);
			expect(response.body).toHaveProperty('role', MeetUserRole.ROOM_MEMBER);
		});

		it('should allow newly created user to login with the provided password', async () => {
			const userId = `user_${Date.now()}`;
			const password = 'password123';
			const userOptions = {
				userId,
				name: 'Test User',
				password,
				role: MeetUserRole.ROOM_MANAGER
			};

			const createResponse = await createUser(userOptions);
			expect(createResponse.status).toBe(201);

			// Try to login with the created user
			const loginResponse = await loginReq({ userId, password });
			expect(loginResponse.status).toBe(200);
		});

		it('should create user with mustChangePassword flag set to true', async () => {
			const userId = `user_${Date.now()}`;
			const password = 'password123';
			const userOptions = {
				userId,
				name: 'Test User',
				password,
				role: MeetUserRole.ROOM_MANAGER
			};

			const createResponse = await createUser(userOptions);
			expect(createResponse.status).toBe(201);

			// Login to verify mustChangePassword is true
			const loginResponse = await loginReq({ userId, password });
			expect(loginResponse.status).toBe(200);
			expect(loginResponse.body).toHaveProperty('mustChangePassword', true);
		});

		it('should retrieve created user with correct information', async () => {
			const userId = `user_${Date.now()}`;
			const userOptions = {
				userId,
				name: 'Test User',
				password: 'password123',
				role: MeetUserRole.ROOM_MANAGER
			};

			const createResponse = await createUser(userOptions);
			expect(createResponse.status).toBe(201);

			// Get user to verify it was created correctly
			const getResponse = await getUser(userId);
			expect(getResponse.status).toBe(200);
			expect(getResponse.body).toHaveProperty('userId', userId);
			expect(getResponse.body).toHaveProperty('name', 'Test User');
			expect(getResponse.body).toHaveProperty('role', MeetUserRole.ROOM_MANAGER);
		});

		it('should fail when trying to create a user with duplicate userId', async () => {
			const userId = `user_${Date.now()}`;
			const userOptions = {
				userId,
				name: 'Test User',
				password: 'password123',
				role: MeetUserRole.ROOM_MANAGER
			};

			// Create user first time
			const firstResponse = await createUser(userOptions);
			expect(firstResponse.status).toBe(201);

			// Try to create the same user again
			const secondResponse = await createUser(userOptions);
			expect(secondResponse.status).toBe(409);
			expect(secondResponse.body).toHaveProperty('message');
			expect(secondResponse.body.message).toContain('already exists');
		});
	});

	describe('Create User Validation Tests', () => {
		it('should fail when userId is missing', async () => {
			const response = await createUser({
				name: 'Test User',
				password: 'password123',
				role: MeetUserRole.ROOM_MANAGER
			} as MeetUserOptions);
			expectValidationError(response, 'userId', 'Required');
		});

		it('should fail when name is missing', async () => {
			const response = await createUser({
				userId: `user_${Date.now()}`,
				password: 'password123',
				role: MeetUserRole.ROOM_MANAGER
			} as MeetUserOptions);
			expectValidationError(response, 'name', 'Required');
		});

		it('should fail when name is empty', async () => {
			const response = await createUser({
				userId: `user_${Date.now()}`,
				name: '',
				password: 'password123',
				role: MeetUserRole.ROOM_MANAGER
			});
			expectValidationError(response, 'name', 'cannot be empty');
		});

		it('should fail when password is missing', async () => {
			const response = await createUser({
				userId: `user_${Date.now()}`,
				name: 'Test User',
				role: MeetUserRole.ROOM_MANAGER
			} as MeetUserOptions);
			expectValidationError(response, 'password', 'Required');
		});

		it('should fail when role is missing', async () => {
			const response = await createUser({
				userId: `user_${Date.now()}`,
				name: 'Test User',
				password: 'password123'
			} as MeetUserOptions);
			expectValidationError(response, 'role', 'Required');
		});

		it('should fail when userId exceeds maximum length', async () => {
			const response = await createUser({
				userId: 'a'.repeat(21), // Max is 20 characters
				name: 'Test User',
				password: 'password123',
				role: MeetUserRole.ROOM_MANAGER
			});
			expectValidationError(response, 'userId', 'cannot exceed 20 characters');
		});

		it('should fail when userId is too short', async () => {
			const response = await createUser({
				userId: 'abcd', // Min is 5 characters
				name: 'Test User',
				password: 'password123',
				role: MeetUserRole.ROOM_MANAGER
			});
			expectValidationError(response, 'userId', 'at least 5 characters');
		});

		it('should fail when userId contains uppercase letters', async () => {
			const response = await createUser({
				userId: 'User123',
				name: 'Test User',
				password: 'password123',
				role: MeetUserRole.ROOM_MANAGER
			});
			expectValidationError(response, 'userId', 'lowercase letters, numbers, and underscores');
		});

		it('should fail when userId contains invalid special characters', async () => {
			const response = await createUser({
				userId: 'user-123',
				name: 'Test User',
				password: 'password123',
				role: MeetUserRole.ROOM_MANAGER
			});
			expectValidationError(response, 'userId', 'lowercase letters, numbers, and underscores');
		});

		it('should fail when name exceeds maximum length', async () => {
			const response = await createUser({
				userId: `user_${Date.now()}`,
				name: 'a'.repeat(51), // Max is 50 characters
				password: 'password123',
				role: MeetUserRole.ROOM_MANAGER
			});
			expectValidationError(response, 'name', 'cannot exceed 50 characters');
		});

		it('should fail when password is too short', async () => {
			const response = await createUser({
				userId: `user_${Date.now()}`,
				name: 'Test User',
				password: '1234', // Min is 5 characters
				role: MeetUserRole.ROOM_MANAGER
			});
			expectValidationError(response, 'password', 'at least 5 characters');
		});

		it('should fail when role is invalid', async () => {
			const response = await createUser({
				userId: `user_${Date.now()}`,
				name: 'Test User',
				password: 'password123',
				role: 'invalid' as MeetUserRole
			});
			expectValidationError(response, 'role', 'Invalid enum value');
		});
	});
});

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import {
	MeetRoomMemberOptions,
	MeetRoomMemberRole,
	MeetRoomMemberType,
	MeetRoomRoles,
	MeetUserRole
} from '@openvidu-meet/typings';
import { expectValidationError } from '../../../helpers/assertion-helpers.js';
import {
	createRoom,
	createRoomMember,
	createUser,
	deleteAllRooms,
	deleteAllUsers,
	getRoomMember,
	startTestServer
} from '../../../helpers/request-helpers.js';
import { setupTestUsers } from '../../../helpers/test-scenarios.js';
import { TestUsers } from '../../../interfaces/scenarios.js';

describe('Room Members API Tests', () => {
	let roomId: string;
	let roomRoles: MeetRoomRoles;
	let testUsers: TestUsers;

	beforeAll(async () => {
		await startTestServer();
		testUsers = await setupTestUsers();

		const room = await createRoom({}, undefined, { xExtraFields: 'roles' });
		roomId = room.roomId;
		roomRoles = room.roles;
	});

	afterAll(async () => {
		await deleteAllRooms();
		await deleteAllUsers();
	});

	describe('Create Room Member Tests', () => {
		it('should successfully create room member with userId (user)', async () => {
			// Create a new user to be added as room member
			const userId = `user_${Date.now()}`;
			await createUser({
				userId,
				name: 'Test User',
				password: 'password123',
				role: MeetUserRole.ROOM_MANAGER
			});

			const response = await createRoomMember(roomId, {
				userId,
				baseRole: MeetRoomMemberRole.SPEAKER
			});

			expect(response.status).toBe(201);
			expect(response.body).toHaveProperty('memberId', userId);
			expect(response.body).toHaveProperty('roomId', roomId);
			expect(response.body).toHaveProperty('type', MeetRoomMemberType.USER);
			expect(response.body).toHaveProperty('name', 'Test User');
			expect(response.body).toHaveProperty('baseRole', MeetRoomMemberRole.SPEAKER);
			expect(response.body).toHaveProperty('membershipDate');
			expect(response.body).toHaveProperty('accessUrl');
			expect(response.body.accessUrl).toContain(`/room/${roomId}`);
			expect(response.body).toHaveProperty('effectivePermissions');
			expect(response.body).toHaveProperty('permissionsUpdatedAt');

			// Verify Location header is set correctly
			expect(response.headers).toHaveProperty('location');
			expect(response.headers.location).toContain(`/rooms/${roomId}/members/${userId}`);
		});

		it('should successfully create room member with name (identified guest)', async () => {
			const guestName = 'Identified Guest';
			const response = await createRoomMember(roomId, {
				name: guestName,
				baseRole: MeetRoomMemberRole.MODERATOR
			});

			expect(response.status).toBe(201);
			expect(response.body).toHaveProperty('memberId');
			expect(response.body.memberId).toMatch(/^guest-/); // Identified guests have memberId starting with 'guest-'
			expect(response.body).toHaveProperty('roomId', roomId);
			expect(response.body).toHaveProperty('type', MeetRoomMemberType.IDENTIFIED_GUEST);
			expect(response.body).toHaveProperty('name', guestName);
			expect(response.body).toHaveProperty('baseRole', MeetRoomMemberRole.MODERATOR);
			expect(response.body).toHaveProperty('membershipDate');
			expect(response.body).toHaveProperty('accessUrl');
			expect(response.body.accessUrl).toContain(`/room/${roomId}?secret=${response.body.memberId}`);
			expect(response.body).toHaveProperty('effectivePermissions');
			expect(response.body).toHaveProperty('permissionsUpdatedAt');
		});

		it('should exclude effectivePermissions by default and include it when requested via extraFields', async () => {
			// Without extraFields, effectivePermissions must be excluded
			const defaultResponse = await createRoomMember(
				roomId,
				{ name: 'No Extra Fields User', baseRole: MeetRoomMemberRole.SPEAKER },
				'' // do not request any extra field
			);
			expect(defaultResponse.status).toBe(201);
			expect(defaultResponse.body).not.toHaveProperty('effectivePermissions');
			expect(defaultResponse.body._extraFields).toContain('effectivePermissions');

			// With extraFields=effectivePermissions, it must be included
			const withExtraResponse = await createRoomMember(
				roomId,
				{ name: 'Extra Fields User', baseRole: MeetRoomMemberRole.SPEAKER },
				'effectivePermissions'
			);
			expect(withExtraResponse.status).toBe(201);
			expect(withExtraResponse.body).toHaveProperty('effectivePermissions');
			expect(withExtraResponse.body.effectivePermissions).toEqual(roomRoles.speaker.permissions);
			expect(withExtraResponse.body._extraFields).toContain('effectivePermissions');
		});

		it('should successfully create room member with MODERATOR role', async () => {
			const response = await createRoomMember(roomId, {
				name: 'Mod User',
				baseRole: MeetRoomMemberRole.MODERATOR
			});

			expect(response.status).toBe(201);
			expect(response.body).toHaveProperty('baseRole', MeetRoomMemberRole.MODERATOR);
			expect(response.body.effectivePermissions).toEqual(roomRoles.moderator.permissions);
		});

		it('should successfully create room member with SPEAKER role', async () => {
			const response = await createRoomMember(roomId, {
				name: 'Speaker User',
				baseRole: MeetRoomMemberRole.SPEAKER
			});

			expect(response.status).toBe(201);
			expect(response.body).toHaveProperty('baseRole', MeetRoomMemberRole.SPEAKER);
			expect(response.body.effectivePermissions).toEqual(roomRoles.speaker.permissions);
		});

		it('should successfully create room member with custom permissions', async () => {
			const response = await createRoomMember(roomId, {
				name: 'Custom Perm User',
				baseRole: MeetRoomMemberRole.SPEAKER,
				customPermissions: {
					canRecord: true,
					canDeleteRecordings: true
				}
			});

			expect(response.status).toBe(201);
			expect(response.body).toHaveProperty('customPermissions');
			expect(response.body.customPermissions).toHaveProperty('canRecord', true);
			expect(response.body.customPermissions).toHaveProperty('canDeleteRecordings', true);
			expect(response.body.effectivePermissions).toHaveProperty('canRecord', true);
			expect(response.body.effectivePermissions).toHaveProperty('canDeleteRecordings', true);
		});

		it('should verify room member is actually created', async () => {
			// Create room member
			const createResponse = await createRoomMember(roomId, {
				name: 'Verify User',
				baseRole: MeetRoomMemberRole.SPEAKER
			});
			expect(createResponse.status).toBe(201);

			// Verify member exists
			const getMemberResponse = await getRoomMember(roomId, createResponse.body.memberId);
			expect(getMemberResponse.status).toBe(200);
		});

		it('should fail when creating duplicate room member', async () => {
			// Create a new user to be added as room member
			const userId = `user_${Date.now()}`;
			await createUser({
				userId,
				name: 'Test User',
				password: 'password123',
				role: MeetUserRole.ROOM_MANAGER
			});

			// Create member first time
			const firstResponse = await createRoomMember(roomId, {
				userId,
				baseRole: MeetRoomMemberRole.SPEAKER
			});
			expect(firstResponse.status).toBe(201);

			// Try to create same member again
			const secondResponse = await createRoomMember(roomId, {
				userId,
				baseRole: MeetRoomMemberRole.SPEAKER
			});
			expect(secondResponse.status).toBe(409);
			expect(secondResponse.body).toHaveProperty('message');
			expect(secondResponse.body.message).toContain('already a member');
		});

		it('should fail when userId does not exist', async () => {
			const response = await createRoomMember(roomId, {
				userId: 'nonexistent_user_123',
				baseRole: MeetRoomMemberRole.SPEAKER
			});

			expect(response.status).toBe(404);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('not found');
		});

		it('should fail when room does not exist', async () => {
			const response = await createRoomMember('nonexistent_room_123', {
				name: 'Test User',
				baseRole: MeetRoomMemberRole.SPEAKER
			});

			expect(response.status).toBe(404);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('does not exist');
		});

		it('should fail when trying to add room owner as member', async () => {
			const room = await createRoom(undefined, testUsers.roomManager.accessToken);

			const response = await createRoomMember(room.roomId, {
				userId: testUsers.roomManager.user.userId,
				baseRole: MeetRoomMemberRole.SPEAKER
			});

			expect(response.status).toBe(409);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('cannot be added as a member');
		});

		it('should fail when trying to add admin user as member', async () => {
			const response = await createRoomMember(roomId, {
				userId: testUsers.admin.user.userId,
				baseRole: MeetRoomMemberRole.SPEAKER
			});

			expect(response.status).toBe(409);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('cannot be added as a member');
		});
	});

	describe('Create Room Member Validation Tests', () => {
		it('should fail when baseRole is missing', async () => {
			const response = await createRoomMember(roomId, {
				name: 'Test User'
			} as MeetRoomMemberOptions);
			expectValidationError(response, 'baseRole', 'Required');
		});

		it('should fail when baseRole is invalid', async () => {
			const response = await createRoomMember(roomId, {
				name: 'Test User',
				baseRole: 'invalid' as MeetRoomMemberRole
			});
			expectValidationError(response, 'baseRole', 'Invalid enum value');
		});

		it('should fail when neither userId nor name is provided', async () => {
			const response = await createRoomMember(roomId, {
				baseRole: MeetRoomMemberRole.SPEAKER
			} as MeetRoomMemberOptions);
			expectValidationError(response, 'userId', 'Either userId or name must be provided');
		});

		it('should fail when both userId and name are provided', async () => {
			const response = await createRoomMember(roomId, {
				userId: testUsers.roomManager.user.userId,
				name: 'Identified Guest',
				baseRole: MeetRoomMemberRole.SPEAKER
			});
			expectValidationError(response, 'userId', 'Either userId or name must be provided, but not both');
		});

		it('should fail when name is empty', async () => {
			const response = await createRoomMember(roomId, {
				name: '',
				baseRole: MeetRoomMemberRole.SPEAKER
			});
			expectValidationError(response, 'name', 'cannot be empty');
		});

		it('should fail when name exceeds max length', async () => {
			const response = await createRoomMember(roomId, {
				name: 'a'.repeat(51), // Max is 50
				baseRole: MeetRoomMemberRole.SPEAKER
			});
			expectValidationError(response, 'name', 'cannot exceed 50 characters');
		});

		it('should fail when userId contains invalid characters', async () => {
			const response = await createRoomMember(roomId, {
				userId: 'invalid-user-id!',
				baseRole: MeetRoomMemberRole.SPEAKER
			});
			expectValidationError(response, 'userId', 'must contain only lowercase letters, numbers, and underscores');
		});
	});
});

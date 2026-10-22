import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { MeetRoomMemberRole, MeetRoomMemberType, MeetRoomRoles, MeetUserRole } from '@openvidu-meet/typings';
import {
	createRoom,
	createRoomMember,
	createUser,
	deleteAllRooms,
	deleteAllUsers,
	getRoomMember,
	startTestServer
} from '../../../helpers/request-helpers.js';

describe('Room Members API Tests', () => {
	let roomId: string;
	let roomRoles: MeetRoomRoles;

	beforeAll(async () => {
		await startTestServer();

		const room = await createRoom({}, undefined, { xExtraFields: 'roles' });
		roomId = room.roomId;
		roomRoles = room.roles;
	});

	afterAll(async () => {
		await deleteAllRooms();
		await deleteAllUsers();
	});

	describe('Get Room Member Tests', () => {
		it('should successfully get a user room member', async () => {
			// Create a user as room member
			const userId = `user_${Date.now()}`;
			const userName = 'User';
			await createUser({
				userId,
				name: userName,
				password: 'password123',
				role: MeetUserRole.ROOM_MANAGER
			});
			const createResponse = await createRoomMember(roomId, {
				userId,
				baseRole: MeetRoomMemberRole.MODERATOR
			});
			const memberId = createResponse.body.memberId;

			const response = await getRoomMember(roomId, memberId);
			expect(response.status).toBe(200);

			expect(response.body).toHaveProperty('memberId', memberId);
			expect(response.body.memberId).toBe(userId);
			expect(response.body).toHaveProperty('roomId', roomId);
			expect(response.body).toHaveProperty('type', MeetRoomMemberType.USER);
			expect(response.body).toHaveProperty('name', userName);
			expect(response.body).toHaveProperty('baseRole', MeetRoomMemberRole.MODERATOR);
			expect(response.body).toHaveProperty('membershipDate');
			expect(response.body).toHaveProperty('accessUrl');
			expect(response.body).toHaveProperty('effectivePermissions');
			expect(response.body).toHaveProperty('permissionsUpdatedAt');
		});

		it('should successfully get an identified guest room member', async () => {
			// Create an identified guest room member
			const memberName = 'Identified Guest';
			const createResponse = await createRoomMember(roomId, {
				name: memberName,
				baseRole: MeetRoomMemberRole.SPEAKER
			});
			const memberId = createResponse.body.memberId;

			const response = await getRoomMember(roomId, memberId);
			expect(response.status).toBe(200);

			expect(response.body).toHaveProperty('memberId', memberId);
			expect(memberId).toMatch(/^guest-/);
			expect(response.body).toHaveProperty('roomId', roomId);
			expect(response.body).toHaveProperty('type', MeetRoomMemberType.IDENTIFIED_GUEST);
			expect(response.body).toHaveProperty('name', memberName);
			expect(response.body).toHaveProperty('baseRole', MeetRoomMemberRole.SPEAKER);
			expect(response.body).toHaveProperty('membershipDate');
			expect(response.body).toHaveProperty('accessUrl');
			expect(response.body).toHaveProperty('effectivePermissions');
			expect(response.body).toHaveProperty('permissionsUpdatedAt');
		});

		it('should exclude effectivePermissions by default and include it when requested via extraFields', async () => {
			const createResponse = await createRoomMember(roomId, {
				name: 'Extra Fields Member',
				baseRole: MeetRoomMemberRole.SPEAKER
			});
			const memberId = createResponse.body.memberId;

			// Without extraFields, effectivePermissions must be excluded
			const defaultResponse = await getRoomMember(roomId, memberId, '');
			expect(defaultResponse.status).toBe(200);
			expect(defaultResponse.body).not.toHaveProperty('effectivePermissions');
			expect(defaultResponse.body._extraFields).toContain('effectivePermissions');

			// With extraFields=effectivePermissions, it must be included
			const withExtraResponse = await getRoomMember(roomId, memberId, 'effectivePermissions');
			expect(withExtraResponse.status).toBe(200);
			expect(withExtraResponse.body).toHaveProperty('effectivePermissions');
			expect(withExtraResponse.body.effectivePermissions).toEqual(roomRoles.speaker.permissions);
			expect(withExtraResponse.body._extraFields).toContain('effectivePermissions');
		});

		it('should successfully get a room member with MODERATOR role', async () => {
			// Create an identified guest room member
			const createResponse = await createRoomMember(roomId, {
				name: 'Identified Guest',
				baseRole: MeetRoomMemberRole.MODERATOR
			});
			const memberId = createResponse.body.memberId;

			const response = await getRoomMember(roomId, memberId);
			expect(response.status).toBe(200);

			expect(response.body).toHaveProperty('baseRole', MeetRoomMemberRole.MODERATOR);
			expect(response.body.effectivePermissions).toEqual(roomRoles.moderator.permissions);
		});

		it('should successfully get a room member with SPEAKER role', async () => {
			// Create an identified guest room member
			const createResponse = await createRoomMember(roomId, {
				name: 'Identified Guest',
				baseRole: MeetRoomMemberRole.SPEAKER
			});
			const memberId = createResponse.body.memberId;

			const response = await getRoomMember(roomId, memberId);

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty('baseRole', MeetRoomMemberRole.SPEAKER);
			expect(response.body.effectivePermissions).toEqual(roomRoles.speaker.permissions);
		});

		it('should return member with custom permissions if set', async () => {
			// Create a member with custom permissions
			const memberResponse = await createRoomMember(roomId, {
				name: 'Custom Permissions Member',
				baseRole: MeetRoomMemberRole.SPEAKER,
				customPermissions: {
					canRecord: true,
					canDeleteRecordings: true
				}
			});

			const response = await getRoomMember(roomId, memberResponse.body.memberId);
			expect(response.status).toBe(200);

			expect(response.body).toHaveProperty('customPermissions');
			expect(response.body.customPermissions).toHaveProperty('canRecord', true);
			expect(response.body.customPermissions).toHaveProperty('canDeleteRecordings', true);
			expect(response.body.effectivePermissions).toHaveProperty('canRecord', true);
			expect(response.body.effectivePermissions).toHaveProperty('canDeleteRecordings', true);
		});

		it('should fail when member does not exist', async () => {
			const response = await getRoomMember(roomId, 'nonexistent_member_123');
			expect(response.status).toBe(404);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('not found');
		});

		it('should fail when room does not exist', async () => {
			const response = await getRoomMember('nonexistent_room_123', 'some_member_id');
			expect(response.status).toBe(404);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('does not exist');
		});
	});
});

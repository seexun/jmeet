import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { MeetRoomMember, MeetRoomMemberRole, MeetRoomMemberType, MeetUserRole } from '@openvidu-meet/typings';
import { expectValidationError } from '../../../helpers/assertion-helpers.js';
import {
	createRoom,
	createRoomMember,
	createUser,
	deleteAllRooms,
	deleteAllUsers,
	getRoomMembers,
	startTestServer
} from '../../../helpers/request-helpers.js';

describe('Room Members API Tests', () => {
	let roomId: string;

	beforeAll(async () => {
		await startTestServer();

		// Create a room for testing
		const room = await createRoom();
		roomId = room.roomId;

		// Create 5 room members sequentially with predictable timestamps
		// Mix of users and identified guests with different roles

		// Create a timestamp to ensure unique IDs (max 6 digits to fit in 20 char limit)
		const ts = String(Date.now()).slice(-6);

		// Alice - User, MODERATOR
		const aliceUserId = `alice_${ts}`;
		await createUser({
			userId: aliceUserId,
			name: 'Alice Smith',
			password: 'password123',
			role: MeetUserRole.ROOM_MANAGER
		});
		await createRoomMember(roomId, {
			userId: aliceUserId,
			baseRole: MeetRoomMemberRole.MODERATOR
		});

		// Bob - Identified guest, SPEAKER
		await createRoomMember(roomId, {
			name: 'Bob Johnson',
			baseRole: MeetRoomMemberRole.SPEAKER
		});

		// Charlie - User, SPEAKER
		const charlieUserId = `charlie_${ts}`;
		await createUser({
			userId: charlieUserId,
			name: 'Charlie Brown',
			password: 'password123',
			role: MeetUserRole.ROOM_MANAGER
		});
		await createRoomMember(roomId, {
			userId: charlieUserId,
			baseRole: MeetRoomMemberRole.SPEAKER
		});

		// Diana - Identified guest, MODERATOR
		await createRoomMember(roomId, {
			name: 'Diana Prince',
			baseRole: MeetRoomMemberRole.MODERATOR
		});

		// Eve - User, SPEAKER
		const eveUserId = `eve_${ts}`;
		await createUser({
			userId: eveUserId,
			name: 'Eve Anderson',
			password: 'password123',
			role: MeetUserRole.ROOM_MANAGER
		});
		await createRoomMember(roomId, {
			userId: eveUserId,
			baseRole: MeetRoomMemberRole.SPEAKER
		});
	});

	afterAll(async () => {
		await deleteAllRooms();
		await deleteAllUsers();
	});

	describe('Get Room Members Tests', () => {
		it('should successfully get all room members', async () => {
			const response = await getRoomMembers(roomId);
			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty('members');
			expect(response.body).toHaveProperty('pagination');
			expect(response.body.members).toBeInstanceOf(Array);

			// All 5 members should be returned
			expect(response.body.members.length).toBe(5);
			expect(response.body.pagination).toHaveProperty('isTruncated', false);
		});

		it('should return members with all required fields (effectivePermissions excluded by default)', async () => {
			const response = await getRoomMembers(roomId);
			expect(response.status).toBe(200);

			const member = response.body.members[0];
			expect(member).toHaveProperty('memberId');
			expect(member).toHaveProperty('roomId', roomId);
			expect(member).toHaveProperty('type');
			expect(member).toHaveProperty('name');
			expect(member).toHaveProperty('membershipDate');
			expect(member).toHaveProperty('accessUrl');
			expect(member).toHaveProperty('baseRole');
			expect(member).toHaveProperty('permissionsUpdatedAt');
			// effectivePermissions is an extra field, excluded by default
			expect(member).not.toHaveProperty('effectivePermissions');
			// _extraFields metadata is returned at the response root
			expect(response.body._extraFields).toContain('effectivePermissions');
		});

		it('should include effectivePermissions when requested via extraFields', async () => {
			const response = await getRoomMembers(roomId, { extraFields: 'effectivePermissions' });
			expect(response.status).toBe(200);

			const member = response.body.members[0];
			expect(member).toHaveProperty('effectivePermissions');
			expect(member.effectivePermissions).toBeDefined();
			expect(response.body._extraFields).toContain('effectivePermissions');
		});

		it('should return members with only specified fields', async () => {
			const response = await getRoomMembers(roomId, { fields: 'memberId,name' });
			expect(response.status).toBe(200);
			expect(response.body.members.length).toBe(5);

			const member = response.body.members[0];
			expect(member).toHaveProperty('memberId');
			expect(member).toHaveProperty('name');
			expect(Object.keys(member).length).toBe(2); // Only memberId and name should be present
		});

		it('should filter members by name using exact match by default', async () => {
			const response = await getRoomMembers(roomId, { name: 'Alice Smith' });
			expect(response.status).toBe(200);
			expect(response.body.members.length).toBe(1);
			expect(response.body.members[0].name).toBe('Alice Smith');
		});

		it('should filter members by name with prefix match mode', async () => {
			const response = await getRoomMembers(roomId, { name: 'Ali', nameMatchMode: 'prefix' });
			expect(response.status).toBe(200);
			expect(response.body.members.length).toBe(1);
			expect(response.body.members[0].name).toBe('Alice Smith');
		});

		it('should filter members by name with partial match mode', async () => {
			const response = await getRoomMembers(roomId, { name: 'son', nameMatchMode: 'partial' });
			expect(response.status).toBe(200);
			expect(response.body.members.length).toBe(2);

			// Bob Johnson, Eve Anderson
			const names = response.body.members.map((m: MeetRoomMember) => m.name);
			expect(names).toEqual(expect.arrayContaining(['Bob Johnson', 'Eve Anderson']));
		});

		it('should filter members by name with regex match mode', async () => {
			const response = await getRoomMembers(roomId, {
				name: '^Alice\\sSmith$',
				nameMatchMode: 'regex'
			});
			expect(response.status).toBe(200);
			expect(response.body.members.length).toBe(1);
			expect(response.body.members[0].name).toBe('Alice Smith');
		});

		it('should filter members by name using case-insensitive exact match', async () => {
			const response = await getRoomMembers(roomId, {
				name: 'alice smith',
				nameCaseInsensitive: true
			});
			expect(response.status).toBe(200);
			expect(response.body.members.length).toBe(1);
			expect(response.body.members[0].name).toBe('Alice Smith');
		});

		it('should return empty array when name filter matches no members', async () => {
			const response = await getRoomMembers(roomId, { name: 'nonexistent' });
			expect(response.status).toBe(200);
			expect(response.body.members.length).toBe(0);
			expect(response.body.pagination.isTruncated).toBe(false);
		});

		it('should filter members by baseRole moderator', async () => {
			const response = await getRoomMembers(roomId, { baseRole: MeetRoomMemberRole.MODERATOR });
			expect(response.status).toBe(200);
			// Alice and Diana are moderators
			expect(response.body.members.length).toBe(2);
			expect(
				response.body.members.every((m: MeetRoomMember) => m.baseRole === MeetRoomMemberRole.MODERATOR)
			).toBe(true);
		});

		it('should filter members by baseRole speaker', async () => {
			const response = await getRoomMembers(roomId, { baseRole: MeetRoomMemberRole.SPEAKER });
			expect(response.status).toBe(200);
			// Bob, Charlie and Eve are speakers
			expect(response.body.members.length).toBe(3);
			expect(response.body.members.every((m: MeetRoomMember) => m.baseRole === MeetRoomMemberRole.SPEAKER)).toBe(
				true
			);
		});

		it('should filter members by type user', async () => {
			const response = await getRoomMembers(roomId, { type: MeetRoomMemberType.USER });
			expect(response.status).toBe(200);
			// Alice, Charlie and Eve are users
			expect(response.body.members.length).toBe(3);
			expect(response.body.members.every((m: MeetRoomMember) => m.type === MeetRoomMemberType.USER)).toBe(
				true
			);
		});

		it('should filter members by type identified guest', async () => {
			const response = await getRoomMembers(roomId, { type: MeetRoomMemberType.IDENTIFIED_GUEST });
			expect(response.status).toBe(200);
			// Bob and Diana are identified guests
			expect(response.body.members.length).toBe(2);
			expect(response.body.members.every((m: MeetRoomMember) => m.type === MeetRoomMemberType.IDENTIFIED_GUEST)).toBe(
				true
			);
		});

		it('should combine baseRole and type filters', async () => {
			const response = await getRoomMembers(roomId, {
				baseRole: MeetRoomMemberRole.MODERATOR,
				type: MeetRoomMemberType.IDENTIFIED_GUEST
			});
			expect(response.status).toBe(200);
			// Only Diana is an identified guest moderator
			expect(response.body.members.length).toBe(1);
			expect(response.body.members[0].name).toBe('Diana Prince');
			expect(response.body.members[0].baseRole).toBe(MeetRoomMemberRole.MODERATOR);
			expect(response.body.members[0].type).toBe(MeetRoomMemberType.IDENTIFIED_GUEST);
		});

		it('should return empty array when baseRole/type filters match no members', async () => {
			const response = await getRoomMembers(roomId, {
				baseRole: MeetRoomMemberRole.MODERATOR,
				type: MeetRoomMemberType.USER,
				name: 'Bob Johnson'
			});
			expect(response.status).toBe(200);
			expect(response.body.members.length).toBe(0);
		});

		it('should paginate results with maxItems', async () => {
			const response = await getRoomMembers(roomId, { maxItems: 2 });
			expect(response.status).toBe(200);
			expect(response.body.members.length).toBe(2);
			expect(response.body.pagination.isTruncated).toBe(true);
			expect(response.body.pagination).toHaveProperty('nextPageToken');
			expect(response.body.pagination.maxItems).toBe(2);
		});

		it('should get next page using nextPageToken', async () => {
			// Get first page
			const firstPageResponse = await getRoomMembers(roomId, { maxItems: 2 });
			expect(firstPageResponse.status).toBe(200);
			expect(firstPageResponse.body.pagination.isTruncated).toBe(true);

			const nextPageToken = firstPageResponse.body.pagination.nextPageToken;

			// Get second page
			const secondPageResponse = await getRoomMembers(roomId, {
				maxItems: 2,
				nextPageToken
			});
			expect(secondPageResponse.status).toBe(200);
			expect(secondPageResponse.body.members.length).toBe(2);

			// Verify no overlap between pages
			const firstPageMemberIds = firstPageResponse.body.members.map((m: MeetRoomMember) => m.memberId);
			const secondPageMemberIds = secondPageResponse.body.members.map((m: MeetRoomMember) => m.memberId);
			expect(firstPageMemberIds).not.toEqual(secondPageMemberIds);
		});

		it('should cap maxItems at 100', async () => {
			const response = await getRoomMembers(roomId, { maxItems: 150 });
			expect(response.status).toBe(200);
			expect(response.body.pagination.maxItems).toBe(100);
		});

		it('should sort members by membershipDate descending (default)', async () => {
			const response = await getRoomMembers(roomId);
			expect(response.status).toBe(200);
			expect(response.body.members.length).toBe(5);

			// Verify descending order by membershipDate (most recent first)
			for (let i = 0; i < response.body.members.length - 1; i++) {
				const currentDate = response.body.members[i].membershipDate;
				const nextDate = response.body.members[i + 1].membershipDate;
				expect(currentDate).toBeGreaterThanOrEqual(nextDate);
			}
		});

		it('should sort members by membershipDate ascending', async () => {
			const response = await getRoomMembers(roomId, {
				sortField: 'membershipDate',
				sortOrder: 'asc'
			});
			expect(response.status).toBe(200);
			expect(response.body.members.length).toBe(5);

			// Verify ascending order by membershipDate (oldest first)
			for (let i = 0; i < response.body.members.length - 1; i++) {
				const currentDate = response.body.members[i].membershipDate;
				const nextDate = response.body.members[i + 1].membershipDate;
				expect(currentDate).toBeLessThanOrEqual(nextDate);
			}
		});

		it('should sort members by name ascending', async () => {
			const response = await getRoomMembers(roomId, {
				sortField: 'name',
				sortOrder: 'asc'
			});
			expect(response.status).toBe(200);
			expect(response.body.members.length).toBe(5);

			// Verify ascending alphabetical order
			for (let i = 0; i < response.body.members.length - 1; i++) {
				const currentName = response.body.members[i].name.toLowerCase();
				const nextName = response.body.members[i + 1].name.toLowerCase();
				expect(currentName.localeCompare(nextName)).toBeLessThanOrEqual(0);
			}
		});

		it('should sort members by name descending', async () => {
			const response = await getRoomMembers(roomId, {
				sortField: 'name',
				sortOrder: 'desc'
			});

			expect(response.status).toBe(200);
			expect(response.body.members.length).toBe(5);

			// Verify descending alphabetical order
			for (let i = 0; i < response.body.members.length - 1; i++) {
				const currentName = response.body.members[i].name.toLowerCase();
				const nextName = response.body.members[i + 1].name.toLowerCase();
				expect(currentName.localeCompare(nextName)).toBeGreaterThanOrEqual(0);
			}
		});

		it('should combine filtering, pagination, and sorting', async () => {
			const response = await getRoomMembers(roomId, {
				name: 'e', // Should match Alice, Charlie, Diana, Eve (4 members)
				nameMatchMode: 'partial',
				maxItems: 2,
				sortField: 'name',
				sortOrder: 'asc'
			});
			expect(response.status).toBe(200);
			expect(response.body.members.length).toBe(2);
			expect(response.body.pagination.isTruncated).toBe(true);

			// Should start with "Alice" and "Charlie" (alphabetically first with 'e')
			expect(response.body.members[0].name).toBe('Alice Smith');
			expect(response.body.members[1].name).toBe('Charlie Brown');
		});

		it('should fail when room does not exist', async () => {
			const response = await getRoomMembers('nonexistent_room_123');
			expect(response.status).toBe(404);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('does not exist');
		});
	});

	describe('Get Room Members Validation Tests', () => {
		it('should fail when nameMatchMode is invalid', async () => {
			const response = await getRoomMembers(roomId, { name: 'Alice', nameMatchMode: 'invalid' });
			expectValidationError(response, 'nameMatchMode', 'Invalid enum value');
		});

		it('should fail when nameCaseInsensitive is not a boolean', async () => {
			const response = await getRoomMembers(roomId, { nameCaseInsensitive: 'not-a-boolean' });
			expectValidationError(response, 'nameCaseInsensitive', 'Expected boolean, received string');
		});

		it('should fail when name regex pattern is invalid', async () => {
			const response = await getRoomMembers(roomId, { name: '[invalid-regex', nameMatchMode: 'regex' });
			expectValidationError(response, 'name', 'Invalid regular expression pattern');
		});

		it('should fail when maxItems is zero', async () => {
			const response = await getRoomMembers(roomId, { maxItems: 0 });
			expectValidationError(response, 'maxItems', 'must be a positive number');
		});

		it('should fail when maxItems is negative', async () => {
			const response = await getRoomMembers(roomId, { maxItems: -5 });
			expectValidationError(response, 'maxItems', 'must be a positive number');
		});

		it('should fail when sortField is invalid', async () => {
			const response = await getRoomMembers(roomId, { sortField: 'invalid' });
			expectValidationError(response, 'sortField', 'Invalid enum value');
		});

		it('should fail when sortOrder is invalid', async () => {
			const response = await getRoomMembers(roomId, { sortOrder: 'invalid' });
			expectValidationError(response, 'sortOrder', 'Invalid enum value');
		});

		it('should fail when baseRole is invalid', async () => {
			const response = await getRoomMembers(roomId, { baseRole: 'invalid' });
			expectValidationError(response, 'baseRole', 'Invalid enum value');
		});

		it('should fail when type is invalid', async () => {
			const response = await getRoomMembers(roomId, { type: 'invalid' });
			expectValidationError(response, 'type', 'Invalid enum value');
		});
	});
});

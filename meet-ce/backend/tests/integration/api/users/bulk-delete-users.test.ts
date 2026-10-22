import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { MeetRoomMemberRole, MeetRoomMemberTokenMetadata, MeetUserRole } from '@openvidu-meet/typings';
import { container } from '../../../../src/config/dependency-injector.config.js';
import { MEET_ENV } from '../../../../src/environment.js';
import { OpenViduMeetError } from '../../../../src/models/error.model.js';
import { MeetRecordingModel } from '../../../../src/models/mongoose-schemas/recording.schema.js';
import { LivekitWebhookService } from '../../../../src/services/livekit-webhook.service.js';
import { LiveKitService } from '../../../../src/services/livekit.service.js';
import { TokenService } from '../../../../src/services/token.service.js';
import { expectValidationError } from '../../../helpers/assertion-helpers.js';
import {
	disconnectFakeParticipants,
	joinFakeParticipant,
	updateParticipantMetadata
} from '../../../helpers/livekit-cli-helpers.js';
import {
	bulkDeleteUsers,
	createRoom,
	createRoomMember,
	deleteAllRecordings,
	deleteAllRooms,
	deleteAllUsers,
	generateRoomMemberToken,
	getRoom,
	getRoomMember,
	getUser,
	startTestServer
} from '../../../helpers/request-helpers.js';
import { createRecordingForRoom, setupTestUsers, setupUser } from '../../../helpers/test-scenarios.js';
import { TestUsers, UserData } from '../../../interfaces/scenarios.js';

describe('Users API Tests', () => {
	let testUsers: TestUsers;

	beforeAll(async () => {
		await startTestServer();
		testUsers = await setupTestUsers();
	});

	afterAll(async () => {
		await disconnectFakeParticipants();
		await deleteAllRooms();
		await deleteAllRecordings();
		await deleteAllUsers();
	});

	const createUserWithRole = async (role: MeetUserRole): Promise<UserData> => {
		const userId = `user_${Date.now()}`;
		const userData = await setupUser({
			userId,
			name: 'Test User',
			password: 'password123',
			role
		});
		return userData;
	};

	describe('Bulk Delete Users Tests', () => {
		it('should successfully delete multiple users with different roles', async () => {
			const { user: user1 } = await createUserWithRole(MeetUserRole.ROOM_MANAGER);
			const { user: user2 } = await createUserWithRole(MeetUserRole.ADMIN);
			const { user: user3 } = await createUserWithRole(MeetUserRole.ROOM_MEMBER);

			const response = await bulkDeleteUsers([user1.userId, user2.userId, user3.userId]);
			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty('message', 'All users deleted successfully');

			expect(response.body).toHaveProperty('deleted');
			expect(response.body.deleted).toHaveLength(3);
			expect(response.body.deleted).toContain(user1.userId);
			expect(response.body.deleted).toContain(user2.userId);
			expect(response.body.deleted).toContain(user3.userId);
			expect(response.body).toHaveProperty('failed');
			expect(response.body.failed).toHaveLength(0);

			// Verify users no longer exist
			const getUser1Response = await getUser(user1.userId);
			expect(getUser1Response.status).toBe(404);

			const getUser2Response = await getUser(user2.userId);
			expect(getUser2Response.status).toBe(404);

			const getUser3Response = await getUser(user3.userId);
			expect(getUser3Response.status).toBe(404);
		});

		it('should fail to delete root admin and return it in failed list', async () => {
			const response = await bulkDeleteUsers([MEET_ENV.INITIAL_ADMIN_USER], testUsers.admin.accessToken);
			expect(response.status).toBe(400);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('1 user(s) could not be deleted');

			expect(response.body).toHaveProperty('deleted');
			expect(response.body).toHaveProperty('failed');
			expect(response.body.deleted).toHaveLength(0);
			expect(response.body.failed).toHaveLength(1);
			expect(response.body.failed[0]).toHaveProperty('userId', MEET_ENV.INITIAL_ADMIN_USER);
			expect(response.body.failed[0]).toHaveProperty('error', 'Cannot delete the root admin user');
		});

		it('should fail to delete own account and return it in failed list', async () => {
			const response = await bulkDeleteUsers([testUsers.admin.user.userId], testUsers.admin.accessToken);
			expect(response.status).toBe(400);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('1 user(s) could not be deleted');

			expect(response.body).toHaveProperty('deleted');
			expect(response.body).toHaveProperty('failed');
			expect(response.body.deleted).toHaveLength(0);
			expect(response.body.failed).toHaveLength(1);
			expect(response.body.failed[0]).toHaveProperty('userId', testUsers.admin.user.userId);
			expect(response.body.failed[0]).toHaveProperty('error', 'Cannot delete your own account');
		});

		it('should return nonexistent users in failed list', async () => {
			const nonexistentId = 'nonexistent_user_123';

			const response = await bulkDeleteUsers([nonexistentId]);
			expect(response.status).toBe(400);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('1 user(s) could not be deleted');

			expect(response.body).toHaveProperty('deleted');
			expect(response.body).toHaveProperty('failed');
			expect(response.body.deleted).toHaveLength(0);
			expect(response.body.failed).toHaveLength(1);
			expect(response.body.failed[0]).toHaveProperty('userId', nonexistentId);
			expect(response.body.failed[0]).toHaveProperty('error', 'User not found');
		});

		it('should handle mixed success and failure results', async () => {
			const { user: user1 } = await createUserWithRole(MeetUserRole.ROOM_MANAGER);
			const { user: user2 } = await createUserWithRole(MeetUserRole.ROOM_MANAGER);
			const nonexistentId = 'nonexistent_user_123';

			const response = await bulkDeleteUsers([
				user1.userId,
				user2.userId,
				MEET_ENV.INITIAL_ADMIN_USER,
				nonexistentId
			]);
			expect(response.status).toBe(400);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('2 user(s) could not be deleted');

			expect(response.body).toHaveProperty('deleted');
			expect(response.body).toHaveProperty('failed');
			expect(response.body.deleted).toHaveLength(2);
			expect(response.body.deleted).toContain(user1.userId);
			expect(response.body.deleted).toContain(user2.userId);
			expect(response.body.failed).toHaveLength(2);
		});

		it('should fail when no users can be deleted', async () => {
			const response = await bulkDeleteUsers([MEET_ENV.INITIAL_ADMIN_USER, 'nonexistent_user_123']);
			expect(response.status).toBe(400);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('2 user(s) could not be deleted');

			expect(response.body).toHaveProperty('deleted');
			expect(response.body).toHaveProperty('failed');
			expect(response.body.deleted).toHaveLength(0);
			expect(response.body.failed).toHaveLength(2);
		});

		it('should transfer ownership of multiple rooms from multiple users', async () => {
			const user1Data = await createUserWithRole(MeetUserRole.ADMIN);
			const user2Data = await createUserWithRole(MeetUserRole.ROOM_MANAGER);

			// Create rooms owned by each user
			const room1 = await createRoom(undefined, user1Data.accessToken);
			const room2 = await createRoom(undefined, user1Data.accessToken);
			const room3 = await createRoom(undefined, user2Data.accessToken);

			// Delete both users
			const deleteResponse = await bulkDeleteUsers([user1Data.user.userId, user2Data.user.userId]);
			expect(deleteResponse.status).toBe(200);
			expect(deleteResponse.body.deleted).toHaveLength(2);

			// Verify all rooms have ownership transferred to root admin
			const getRoom1Response = await getRoom(room1.roomId);
			expect(getRoom1Response.body).toHaveProperty('owner', MEET_ENV.INITIAL_ADMIN_USER);

			const getRoom2Response = await getRoom(room2.roomId);
			expect(getRoom2Response.body).toHaveProperty('owner', MEET_ENV.INITIAL_ADMIN_USER);

			const getRoom3Response = await getRoom(room3.roomId);
			expect(getRoom3Response.body).toHaveProperty('owner', MEET_ENV.INITIAL_ADMIN_USER);
		});

		it('should update recording roomOwner when ownership is transferred by bulk delete', async () => {
			// Create user who will own a room
			const userData = await createUserWithRole(MeetUserRole.ROOM_MANAGER);

			// Create a room owned by this user and a recording for that room
			const room = await createRoom(undefined, userData.accessToken);
			const recordingId = await createRecordingForRoom(room.roomId);

			// Verify initial recording roomOwner
			let recording = await MeetRecordingModel.findOne({ recordingId }, 'roomOwner').lean().exec();
			expect(recording).toBeTruthy();
			expect(recording?.roomOwner).toBe(userData.user.userId);

			// Delete the user
			const response = await bulkDeleteUsers([userData.user.userId]);
			expect(response.status).toBe(200);

			// Verify the recording's roomOwner has been transferred to root admin
			recording = await MeetRecordingModel.findOne({ recordingId }, 'roomOwner').lean().exec();
			expect(recording).toBeTruthy();
			expect(recording?.roomOwner).toBe(MEET_ENV.INITIAL_ADMIN_USER);
		});

		it('should remove memberships from multiple rooms for multiple users', async () => {
			const user1Data = await createUserWithRole(MeetUserRole.ROOM_MANAGER);
			const user2Data = await createUserWithRole(MeetUserRole.ROOM_MEMBER);

			// Create rooms
			const room1 = await createRoom();
			const room2 = await createRoom();

			// Add both users as members to both rooms
			await createRoomMember(room1.roomId, {
				userId: user1Data.user.userId,
				baseRole: MeetRoomMemberRole.MODERATOR
			});
			await createRoomMember(room1.roomId, {
				userId: user2Data.user.userId,
				baseRole: MeetRoomMemberRole.SPEAKER
			});
			await createRoomMember(room2.roomId, {
				userId: user1Data.user.userId,
				baseRole: MeetRoomMemberRole.SPEAKER
			});
			await createRoomMember(room2.roomId, {
				userId: user2Data.user.userId,
				baseRole: MeetRoomMemberRole.MODERATOR
			});

			// Delete both users
			const deleteResponse = await bulkDeleteUsers([user1Data.user.userId, user2Data.user.userId]);
			expect(deleteResponse.status).toBe(200);
			expect(deleteResponse.body.deleted).toHaveLength(2);

			// Verify all memberships are removed
			const getMember1Room1Response = await getRoomMember(room1.roomId, user1Data.user.userId);
			expect(getMember1Room1Response.status).toBe(404);

			const getMember2Room1Response = await getRoomMember(room1.roomId, user2Data.user.userId);
			expect(getMember2Room1Response.status).toBe(404);

			const getMember1Room2Response = await getRoomMember(room2.roomId, user1Data.user.userId);
			expect(getMember1Room2Response.status).toBe(404);

			const getMember2Room2Response = await getRoomMember(room2.roomId, user2Data.user.userId);
			expect(getMember2Room2Response.status).toBe(404);
		});

		it('should kick users from active meetings when bulk deleting users', async () => {
			// Create admin users
			const user1Data = await createUserWithRole(MeetUserRole.ADMIN);
			const user2Data = await createUserWithRole(MeetUserRole.ADMIN);

			// Create a room
			const room = await createRoom();

			// Generate tokens to join the meeting
			const [roomMemberToken1, roomMemberToken2] = await Promise.all([
				generateRoomMemberToken(
					room.roomId,
					{
						joinMeeting: true
					},
					user1Data.accessToken
				),
				generateRoomMemberToken(
					room.roomId,
					{
						joinMeeting: true
					},
					user2Data.accessToken
				)
			]);

			// Extract participant identities and metadata from tokens
			const tokenService = container.get(TokenService);
			const claims1 = tokenService.getClaimsIgnoringExpiration(roomMemberToken1);
			const claims2 = tokenService.getClaimsIgnoringExpiration(roomMemberToken2);

			const participantIdentity1 = claims1.sub;
			const participantIdentity2 = claims2.sub;
			expect(participantIdentity1).toBeDefined();
			expect(participantIdentity2).toBeDefined();

			const metadata1 = JSON.parse(claims1.metadata || '{}') as MeetRoomMemberTokenMetadata;
			const metadata2 = JSON.parse(claims2.metadata || '{}') as MeetRoomMemberTokenMetadata;

			// Simulate participants joining the meeting and then receiving metadata update
			await Promise.all([
				joinFakeParticipant(room.roomId, participantIdentity1!),
				joinFakeParticipant(room.roomId, participantIdentity2!)
			]);
			await Promise.all([
				updateParticipantMetadata(room.roomId, participantIdentity1!, metadata1),
				updateParticipantMetadata(room.roomId, participantIdentity2!, metadata2)
			]);

			// Verify participant exists before deletion
			const livekitService = container.get(LiveKitService);
			const livekitWebhookService = container.get(LivekitWebhookService);
			const roomInfo = await livekitService.getRoom(room.roomId);

			let participant = await livekitService.getParticipant(room.roomId, participantIdentity1!);
			expect(participant.identity).toBe(participantIdentity1);
			await livekitWebhookService.handleParticipantJoined(roomInfo, participant);

			participant = await livekitService.getParticipant(room.roomId, participantIdentity2!);
			expect(participant.identity).toBe(participantIdentity2);
			await livekitWebhookService.handleParticipantJoined(roomInfo, participant);

			// Bulk delete both users
			const deleteResponse = await bulkDeleteUsers([user1Data.user.userId, user2Data.user.userId]);
			expect(deleteResponse.status).toBe(200);

			// Check if participants have been removed from LiveKit
			await expect(livekitService.getParticipant(room.roomId, participantIdentity1!)).rejects.toThrow(
				OpenViduMeetError
			);
			await expect(livekitService.getParticipant(room.roomId, participantIdentity2!)).rejects.toThrow(
				OpenViduMeetError
			);
		});

		it('should handle complex cleanup with multiple users having mixed roles', async () => {
			// Create users with different room relationships
			const owner1Data = await createUserWithRole(MeetUserRole.ADMIN);
			const owner2Data = await createUserWithRole(MeetUserRole.ROOM_MANAGER);
			const memberData = await createUserWithRole(MeetUserRole.ROOM_MEMBER);

			// Create rooms with various ownership
			const room1 = await createRoom(undefined, owner1Data.accessToken);
			const room2 = await createRoom(undefined, owner2Data.accessToken);
			const room3 = await createRoom();

			// Add members to rooms
			await createRoomMember(room1.roomId, {
				userId: memberData.user.userId,
				baseRole: MeetRoomMemberRole.SPEAKER
			});
			await createRoomMember(room2.roomId, {
				userId: memberData.user.userId,
				baseRole: MeetRoomMemberRole.SPEAKER
			});
			await createRoomMember(room3.roomId, {
				userId: owner2Data.user.userId,
				baseRole: MeetRoomMemberRole.MODERATOR
			});
			await createRoomMember(room3.roomId, {
				userId: memberData.user.userId,
				baseRole: MeetRoomMemberRole.SPEAKER
			});

			// Delete all three users
			const deleteResponse = await bulkDeleteUsers([
				owner1Data.user.userId,
				owner2Data.user.userId,
				memberData.user.userId
			]);
			expect(deleteResponse.status).toBe(200);
			expect(deleteResponse.body.deleted).toHaveLength(3);

			// Verify owned rooms transferred to root admin
			const getRoom1Response = await getRoom(room1.roomId);
			expect(getRoom1Response.body).toHaveProperty('owner', MEET_ENV.INITIAL_ADMIN_USER);

			const getRoom2Response = await getRoom(room2.roomId);
			expect(getRoom2Response.body).toHaveProperty('owner', MEET_ENV.INITIAL_ADMIN_USER);

			// Verify all memberships removed
			const getMember1Response = await getRoomMember(room1.roomId, memberData.user.userId);
			expect(getMember1Response.status).toBe(404);

			const getMember2Response = await getRoomMember(room2.roomId, memberData.user.userId);
			expect(getMember2Response.status).toBe(404);

			const getMember3Response = await getRoomMember(room3.roomId, owner2Data.user.userId);
			expect(getMember3Response.status).toBe(404);

			const getMember4Response = await getRoomMember(room3.roomId, memberData.user.userId);
			expect(getMember4Response.status).toBe(404);
		});
	});

	describe('Bulk Delete Users Validation Tests', () => {
		it('should fail when userIds parameter is empty', async () => {
			const response = await bulkDeleteUsers([]);
			expectValidationError(response, 'userIds', 'At least one userId is required');
		});
	});
});

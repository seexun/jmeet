import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { MeetRoomMemberRole, MeetRoomMemberTokenMetadata, MeetUserRole } from '@openvidu-meet/typings';
import { container } from '../../../../src/config/dependency-injector.config.js';
import { MEET_ENV } from '../../../../src/environment.js';
import { OpenViduMeetError } from '../../../../src/models/error.model.js';
import { MeetRecordingModel } from '../../../../src/models/mongoose-schemas/recording.schema.js';
import { LivekitWebhookService } from '../../../../src/services/livekit-webhook.service.js';
import { LiveKitService } from '../../../../src/services/livekit.service.js';
import { TokenService } from '../../../../src/services/token.service.js';
import {
	disconnectFakeParticipants,
	joinFakeParticipant,
	updateParticipantMetadata
} from '../../../helpers/livekit-cli-helpers.js';
import {
	createRoom,
	createRoomMember,
	deleteAllRecordings,
	deleteAllRooms,
	deleteAllUsers,
	deleteUser,
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

	describe('Delete User Tests', () => {
		it('should successfully delete ROOM_MANAGER', async () => {
			const { user } = await createUserWithRole(MeetUserRole.ROOM_MANAGER);

			const response = await deleteUser(user.userId);
			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('deleted successfully');
			expect(response.body.message).toContain(user.userId);
		});

		it('should successfully delete ADMIN user', async () => {
			const { user } = await createUserWithRole(MeetUserRole.ADMIN);

			const response = await deleteUser(user.userId);
			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('deleted successfully');
		});

		it('should successfully delete ROOM_MEMBER user', async () => {
			const { user } = await createUserWithRole(MeetUserRole.ROOM_MEMBER);

			const response = await deleteUser(user.userId);
			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('deleted successfully');
		});

		it('should verify user is actually deleted', async () => {
			const { user } = await createUserWithRole(MeetUserRole.ROOM_MANAGER);

			// Delete user
			const deleteResponse = await deleteUser(user.userId);
			expect(deleteResponse.status).toBe(200);

			// Verify user no longer exists
			const getUserResponse = await getUser(user.userId);
			expect(getUserResponse.status).toBe(404);
			expect(getUserResponse.body).toHaveProperty('message');
			expect(getUserResponse.body.message).toContain('not found');
		});

		it('should fail when trying to delete root admin user', async () => {
			const response = await deleteUser(MEET_ENV.INITIAL_ADMIN_USER);
			expect(response.status).toBe(403);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('Cannot delete the root admin user');
		});

		it('should fail when admin tries to delete own account', async () => {
			const response = await deleteUser(testUsers.admin.user.userId, testUsers.admin.accessToken);
			expect(response.status).toBe(403);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('Cannot delete your own account');
		});

		it('should fail when root admin tries to delete own account', async () => {
			const response = await deleteUser(MEET_ENV.INITIAL_ADMIN_USER);
			expect(response.status).toBe(403);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('Cannot delete the root admin user');
		});

		it('should fail when user does not exist', async () => {
			const response = await deleteUser('nonexistent_user_123');
			expect(response.status).toBe(404);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('not found');
		});

		it('should transfer room ownership to root admin when deleting room owner', async () => {
			// Create user who will own a room
			const userData = await createUserWithRole(MeetUserRole.ADMIN);

			// Create room owned by this user
			const room = await createRoom(undefined, userData.accessToken);

			// Verify initial ownership
			const getRoomResponse = await getRoom(room.roomId);
			expect(getRoomResponse.status).toBe(200);
			expect(getRoomResponse.body).toHaveProperty('owner', userData.user.userId);

			// Delete the user
			const deleteResponse = await deleteUser(userData.user.userId);
			expect(deleteResponse.status).toBe(200);

			// Verify room ownership transferred to root admin
			const getRoomAfterResponse = await getRoom(room.roomId);
			expect(getRoomAfterResponse.status).toBe(200);
			expect(getRoomAfterResponse.body).toHaveProperty('owner', MEET_ENV.INITIAL_ADMIN_USER);
		});

		it('should update recording roomOwner when deleting a room owner', async () => {
			// Create user who will own a room
			const userData = await createUserWithRole(MeetUserRole.ADMIN);

			// Create a room owned by this user and a recording for that room
			const room = await createRoom(undefined, userData.accessToken);
			const recordingId = await createRecordingForRoom(room.roomId);

			// Verify initial recording roomOwner
			let recording = await MeetRecordingModel.findOne({ recordingId }, 'roomOwner').lean().exec();
			expect(recording).toBeTruthy();
			expect(recording?.roomOwner).toBe(userData.user.userId);

			// Delete the user
			const deleteResponse = await deleteUser(userData.user.userId);
			expect(deleteResponse.status).toBe(200);

			// Verify the recording's roomOwner has been transferred to root admin
			recording = await MeetRecordingModel.findOne({ recordingId }, 'roomOwner').lean().exec();
			expect(recording).toBeTruthy();
			expect(recording?.roomOwner).toBe(MEET_ENV.INITIAL_ADMIN_USER);
		});

		it('should transfer ownership of multiple rooms when deleting room owner', async () => {
			// Create user who will own multiple rooms
			const userData = await createUserWithRole(MeetUserRole.ROOM_MANAGER);

			// Create 3 rooms owned by this user
			const room1 = await createRoom(undefined, userData.accessToken);
			const room2 = await createRoom(undefined, userData.accessToken);
			const room3 = await createRoom(undefined, userData.accessToken);

			// Delete the user
			const deleteResponse = await deleteUser(userData.user.userId);
			expect(deleteResponse.status).toBe(200);

			// Verify all rooms have ownership transferred to root admin
			const getRoom1Response = await getRoom(room1.roomId);
			expect(getRoom1Response.body).toHaveProperty('owner', MEET_ENV.INITIAL_ADMIN_USER);

			const getRoom2Response = await getRoom(room2.roomId);
			expect(getRoom2Response.body).toHaveProperty('owner', MEET_ENV.INITIAL_ADMIN_USER);

			const getRoom3Response = await getRoom(room3.roomId);
			expect(getRoom3Response.body).toHaveProperty('owner', MEET_ENV.INITIAL_ADMIN_USER);
		});

		it('should remove user memberships when deleting a room member', async () => {
			// Create user who will be a room member
			const userData = await createUserWithRole(MeetUserRole.ROOM_MANAGER);
			const userId = userData.user.userId;

			// Create a room
			const room = await createRoom();

			// Add user as member to the room
			await createRoomMember(room.roomId, { userId, baseRole: MeetRoomMemberRole.MODERATOR });

			// Verify membership exists
			const getMemberResponse = await getRoomMember(room.roomId, userId);
			expect(getMemberResponse.status).toBe(200);
			expect(getMemberResponse.body).toHaveProperty('memberId', userId);

			// Delete the user
			const deleteResponse = await deleteUser(userId);
			expect(deleteResponse.status).toBe(200);

			// Verify membership no longer exists
			const getMemberAfterResponse = await getRoomMember(room.roomId, userId);
			expect(getMemberAfterResponse.status).toBe(404);
			expect(getMemberAfterResponse.body).toHaveProperty('message');
			expect(getMemberAfterResponse.body.message).toContain('not found');
		});

		it('should remove memberships from multiple rooms when deleting a room member', async () => {
			// Create user who will be a member of multiple rooms
			const userData = await createUserWithRole(MeetUserRole.ROOM_MANAGER);
			const userId = userData.user.userId;

			// Create 3 rooms and add user as member to each
			const room1 = await createRoom();
			const room2 = await createRoom();
			const room3 = await createRoom();

			await createRoomMember(room1.roomId, { userId, baseRole: MeetRoomMemberRole.MODERATOR });
			await createRoomMember(room2.roomId, { userId, baseRole: MeetRoomMemberRole.MODERATOR });
			await createRoomMember(room3.roomId, { userId, baseRole: MeetRoomMemberRole.SPEAKER });

			// Verify memberships exist
			const getMember1Response = await getRoomMember(room1.roomId, userId);
			expect(getMember1Response.status).toBe(200);
			expect(getMember1Response.body).toHaveProperty('memberId', userId);

			const getMember2Response = await getRoomMember(room2.roomId, userId);
			expect(getMember2Response.status).toBe(200);
			expect(getMember2Response.body).toHaveProperty('memberId', userId);

			const getMember3Response = await getRoomMember(room3.roomId, userId);
			expect(getMember3Response.status).toBe(200);
			expect(getMember3Response.body).toHaveProperty('memberId', userId);

			// Delete the user
			const deleteResponse = await deleteUser(userId);
			expect(deleteResponse.status).toBe(200);

			// Verify all memberships are removed
			const getMember1AfterResponse = await getRoomMember(room1.roomId, userId);
			expect(getMember1AfterResponse.status).toBe(404);

			const getMember2AfterResponse = await getRoomMember(room2.roomId, userId);
			expect(getMember2AfterResponse.status).toBe(404);

			const getMember3AfterResponse = await getRoomMember(room3.roomId, userId);
			expect(getMember3AfterResponse.status).toBe(404);
		});

		it('should kick user from active meeting when deleting user', async () => {
			// Create admin user
			const userData = await createUserWithRole(MeetUserRole.ADMIN);
			const userId = userData.user.userId;

			// Create a room
			const room = await createRoom();

			// Generate token to join the meeting
			const roomMemberToken = await generateRoomMemberToken(
				room.roomId,
				{
					joinMeeting: true
				},
				userData.accessToken
			);

			// Extract participant identity and metadata from the token
			const tokenService = container.get(TokenService);
			const claims = tokenService.getClaimsIgnoringExpiration(roomMemberToken);
			const participantIdentity = claims.sub;
			expect(participantIdentity).toBeDefined();
			const metadata = JSON.parse(claims.metadata || '{}') as MeetRoomMemberTokenMetadata;

			// Simulate participant joining the meeting and then receiving metadata update
			await joinFakeParticipant(room.roomId, participantIdentity!);
			await updateParticipantMetadata(room.roomId, participantIdentity!, metadata);

			// Verify participant exists before deletion
			const livekitService = container.get(LiveKitService);
			const participant = await livekitService.getParticipant(room.roomId, participantIdentity!);
			expect(participant).toBeDefined();
			expect(participant.identity).toBe(participantIdentity);

			// Simulate the participant_joined handling with metadata already available
			const livekitWebhookService = container.get(LivekitWebhookService);
			const roomInfo = await livekitService.getRoom(room.roomId);
			await livekitWebhookService.handleParticipantJoined(roomInfo, participant);

			// Delete the user
			const deleteResponse = await deleteUser(userId);
			expect(deleteResponse.status).toBe(200);

			// Check if the participant has been removed from LiveKit
			await expect(livekitService.getParticipant(room.roomId, participantIdentity!)).rejects.toThrow(
				OpenViduMeetError
			);
		});

		it('should handle both room ownership transfer and membership removal when deleting user', async () => {
			// Create user who will own some rooms and be member of others
			const userData = await createUserWithRole(MeetUserRole.ROOM_MANAGER);
			const userId = userData.user.userId;

			// Create rooms owned by this user
			const ownedRoom1 = await createRoom(undefined, userData.accessToken);
			const ownedRoom2 = await createRoom(undefined, userData.accessToken);

			// Create rooms where user is just a member
			const memberRoom1 = await createRoom();
			const memberRoom2 = await createRoom();

			await createRoomMember(memberRoom1.roomId, { userId, baseRole: MeetRoomMemberRole.SPEAKER });
			await createRoomMember(memberRoom2.roomId, { userId, baseRole: MeetRoomMemberRole.MODERATOR });

			// Delete the user
			const deleteResponse = await deleteUser(userId);
			expect(deleteResponse.status).toBe(200);

			// Verify owned rooms transferred to root admin
			const getOwnedRoom1Response = await getRoom(ownedRoom1.roomId);
			expect(getOwnedRoom1Response.body).toHaveProperty('owner', MEET_ENV.INITIAL_ADMIN_USER);

			const getOwnedRoom2Response = await getRoom(ownedRoom2.roomId);
			expect(getOwnedRoom2Response.body).toHaveProperty('owner', MEET_ENV.INITIAL_ADMIN_USER);

			// Verify memberships removed
			const getMember1Response = await getRoomMember(memberRoom1.roomId, userId);
			expect(getMember1Response.status).toBe(404);

			const getMember2Response = await getRoomMember(memberRoom2.roomId, userId);
			expect(getMember2Response.status).toBe(404);
		});

		it('should not affect other room members when deleting a room owner', async () => {
			// Create owner user
			const ownerData = await createUserWithRole(MeetUserRole.ROOM_MANAGER);
			const ownerId = ownerData.user.userId;

			// Create another user who will be a member
			const memberData = await createUserWithRole(MeetUserRole.ROOM_MANAGER);
			const memberId = memberData.user.userId;

			// Create room owned by owner
			const room = await createRoom(undefined, ownerData.accessToken);

			// Add member to the room
			await createRoomMember(room.roomId, { userId: memberId, baseRole: MeetRoomMemberRole.SPEAKER });

			// Verify both owner and member before deletion
			const getRoomBeforeResponse = await getRoom(room.roomId);
			expect(getRoomBeforeResponse.body).toHaveProperty('owner', ownerId);

			const getMemberBeforeResponse = await getRoomMember(room.roomId, memberId);
			expect(getMemberBeforeResponse.status).toBe(200);

			// Delete the owner
			const deleteResponse = await deleteUser(ownerId);
			expect(deleteResponse.status).toBe(200);

			// Verify room ownership transferred
			const getRoomAfterResponse = await getRoom(room.roomId);
			expect(getRoomAfterResponse.body).toHaveProperty('owner', MEET_ENV.INITIAL_ADMIN_USER);

			// Verify member still exists
			const getMemberAfterResponse = await getRoomMember(room.roomId, memberId);
			expect(getMemberAfterResponse.status).toBe(200);
			expect(getMemberAfterResponse.body).toHaveProperty('memberId', memberId);
		});
	});
});

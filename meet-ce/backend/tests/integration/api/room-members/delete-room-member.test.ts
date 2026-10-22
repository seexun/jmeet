import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { MeetRoomMember, MeetRoomMemberRole, MeetUserRole } from '@openvidu-meet/typings';
import { container } from '../../../../src/config/dependency-injector.config.js';
import { OpenViduMeetError } from '../../../../src/models/error.model.js';
import { LiveKitService } from '../../../../src/services/livekit.service.js';
import {
	createRoom,
	createRoomMember,
	createUser,
	deleteAllRooms,
	deleteAllUsers,
	deleteRoomMember,
	getRoomMember,
	getUser,
	startTestServer
} from '../../../helpers/request-helpers.js';

import { disconnectFakeParticipants, joinFakeParticipant } from '../../../helpers/livekit-cli-helpers.js';

describe('Room Members API Tests', () => {
	let roomId: string;

	beforeAll(async () => {
		await startTestServer();

		const room = await createRoom();
		roomId = room.roomId;
	});

	afterAll(async () => {
		await disconnectFakeParticipants();
		await deleteAllRooms();
		await deleteAllUsers();
	});

	describe('Delete Room Member Tests', () => {
		it('should successfully delete identified guest', async () => {
			// Create an identified guest
			const createResponse = await createRoomMember(roomId, {
				name: 'Identified Guest',
				baseRole: MeetRoomMemberRole.SPEAKER
			});
			const memberId = createResponse.body.memberId;

			// Delete the member
			const response = await deleteRoomMember(roomId, memberId);
			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('deleted successfully');

			// Verify member no longer exists
			const getResponse = await getRoomMember(roomId, memberId);
			expect(getResponse.status).toBe(404);
			expect(getResponse.body.message).toContain('not found');
		});

		it('should successfully delete user member', async () => {
			// Create a user
			const userId = `user_${Date.now()}`;
			await createUser({
				userId,
				name: 'User',
				password: 'password123',
				role: MeetUserRole.ROOM_MANAGER
			});

			// Add as room member
			const createResponse = await createRoomMember(roomId, {
				userId,
				baseRole: MeetRoomMemberRole.SPEAKER
			});
			const memberId = createResponse.body.memberId;

			// Delete the member
			const response = await deleteRoomMember(roomId, memberId);
			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('deleted successfully');

			// Check that user still exists
			const getUserResponse = await getUser(userId);
			expect(getUserResponse.status).toBe(200);
		});

		it('should fail when member does not exist', async () => {
			const response = await deleteRoomMember(roomId, 'nonexistent_member_123');
			expect(response.status).toBe(404);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('not found');
		});

		it('should fail when room does not exist', async () => {
			const response = await deleteRoomMember('nonexistent_room_123', 'some_member_id');
			expect(response.status).toBe(404);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('does not exist');
		});

		it('should kick participant from meeting when deleting member', async () => {
			// Create a member
			const createResponse = await createRoomMember(roomId, {
				name: 'Test Member',
				baseRole: MeetRoomMemberRole.SPEAKER
			});
			const member = createResponse.body as MeetRoomMember;
			const memberId = member.memberId;

			// Join fake participant to the room to simulate real join
			const participantIdentity = memberId; // Participant identity is the same as memberId for members
			await joinFakeParticipant(roomId, participantIdentity);

			// Verify participant exists before deletion
			const livekitService = container.get(LiveKitService);
			const participant = await livekitService.getParticipant(roomId, participantIdentity);
			expect(participant).toBeDefined();
			expect(participant.identity).toBe(participantIdentity);

			// Delete the member
			const response = await deleteRoomMember(roomId, memberId);
			expect(response.status).toBe(200);

			// Check if the participant has been removed from LiveKit
			await expect(livekitService.getParticipant(roomId, participantIdentity)).rejects.toThrow(OpenViduMeetError);
		});
	});
});

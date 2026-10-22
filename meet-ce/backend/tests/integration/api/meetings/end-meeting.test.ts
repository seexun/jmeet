import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { container } from '../../../../src/config/dependency-injector.config.js';
import { OpenViduMeetError } from '../../../../src/models/error.model.js';
import { LiveKitService } from '../../../../src/services/livekit.service.js';
import { disconnectFakeParticipants } from '../../../helpers/livekit-cli-helpers.js';
import { deleteAllRooms, endMeeting, getRoom, startTestServer } from '../../../helpers/request-helpers.js';

import { setupSingleRoom } from '../../../helpers/test-scenarios.js';
import { RoomData } from '../../../interfaces/scenarios.js';

describe('Meetings API Tests', () => {
	let livekitService: LiveKitService;
	let roomData: RoomData;

	beforeAll(async () => {
		await startTestServer();
		roomData = await setupSingleRoom(true);
		livekitService = container.get(LiveKitService);
	});

	afterAll(async () => {
		await disconnectFakeParticipants();
		await deleteAllRooms();
	});

	describe('End Meeting Tests', () => {
		it('should remove LiveKit room when ending meeting', async () => {
			// Check if the LiveKit room exists before ending the meeting
			const lkRoom = await livekitService.getRoom(roomData.room.roomId);
			expect(lkRoom).toBeDefined();
			expect(lkRoom.name).toBe(roomData.room.roomId);

			// End the meeting
			let response = await endMeeting(roomData.room.roomId, roomData.moderatorToken);
			expect(response.status).toBe(200);

			// Check if the LiveKit room has been removed
			try {
				await livekitService.getRoom(roomData.room.roomId);
			} catch (error) {
				expect((error as OpenViduMeetError).statusCode).toBe(404);
			}

			// Check if the Meet room already exists
			response = await getRoom(roomData.room.roomId);
			expect(response.status).toBe(200);
		});

		it('should succeed even if there is not a current meeting for the room', async () => {
			// Set up a new room without participants
			roomData = await setupSingleRoom();

			// Check that the LiveKit room does not exist before ending the meeting
			try {
				await livekitService.getRoom(roomData.room.roomId);
			} catch (error) {
				expect((error as OpenViduMeetError).statusCode).toBe(404);
			}

			// End the meeting
			const response = await endMeeting(roomData.room.roomId, roomData.moderatorToken);
			expect(response.status).toBe(200);

			// Recreate the room with a participant
			roomData = await setupSingleRoom(true);
		});

		it('should fail with 404 if the room does not exist', async () => {
			const response = await endMeeting('nonexistent-room-id', roomData.moderatorToken);
			expect(response.status).toBe(404);
		});
	});
});

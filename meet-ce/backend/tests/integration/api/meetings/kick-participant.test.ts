import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { container } from '../../../../src/config/dependency-injector.config.js';
import { OpenViduMeetError } from '../../../../src/models/error.model.js';
import { LiveKitService } from '../../../../src/services/livekit.service.js';
import {
	disconnectFakeParticipants
} from '../../../helpers/livekit-cli-helpers.js';
import { deleteAllRooms, kickParticipant, startTestServer } from '../../../helpers/request-helpers.js';

import { setupSingleRoom } from '../../../helpers/test-scenarios.js';
import { RoomData } from '../../../interfaces/scenarios.js';

const participantIdentity = 'TEST_PARTICIPANT';

describe('Meetings API Tests', () => {
	let livekitService: LiveKitService;
	let roomData: RoomData;

	beforeAll(async () => {
		await startTestServer();
		livekitService = container.get(LiveKitService);
	});

	afterAll(async () => {
		await disconnectFakeParticipants();
		await deleteAllRooms();
	});

	describe('Kick Participant Tests', () => {
		beforeEach(async () => {
			roomData = await setupSingleRoom(true);
		});

		it('should kick participant from LiveKit room', async () => {
			// Check if participant exists before deletion
			const participant = await livekitService.getParticipant(roomData.room.roomId, participantIdentity);
			expect(participant).toBeDefined();
			expect(participant.identity).toBe(participantIdentity);

			// Delete the participant
			const response = await kickParticipant(roomData.room.roomId, participantIdentity, roomData.moderatorToken);
			expect(response.status).toBe(200);

			// Check if the participant has been removed from LiveKit
			await expect(livekitService.getParticipant(roomData.room.roomId, participantIdentity)).rejects.toThrow(
				OpenViduMeetError
			);
		});

		it('should fail with 404 if participant does not exist', async () => {
			const response = await kickParticipant(
				roomData.room.roomId,
				'NON_EXISTENT_PARTICIPANT',
				roomData.moderatorToken
			);
			expect(response.status).toBe(404);
			expect(response.body.error).toBe('Participant Error');
		});

		it('should fail with 404 if room does not exist', async () => {
			const response = await kickParticipant('nonexistent-room-id', participantIdentity, roomData.moderatorToken);
			expect(response.status).toBe(404);
			expect(response.body.error).toBe('Room Error');
		});
	});
});

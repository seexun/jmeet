import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
	MeetParticipantModerationAction,
	MeetRoomMemberRole,
	MeetRoomMemberTokenMetadata,
	MeetRoomMemberUIBadge,
	MeetSignalType
} from '@openvidu-meet/typings';
import { container } from '../../../../src/config/dependency-injector.config.js';
import { MEET_ENV } from '../../../../src/environment.js';
import { FrontendEventService } from '../../../../src/services/frontend-event.service.js';
import { LiveKitService } from '../../../../src/services/livekit.service.js';
import { expectValidationError } from '../../../helpers/assertion-helpers.js';
import { disconnectFakeParticipants, updateParticipantMetadata } from '../../../helpers/livekit-cli-helpers.js';
import { deleteAllRooms, startTestServer, updateParticipant } from '../../../helpers/request-helpers.js';
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

	describe('Update Participant Tests', () => {
		const setParticipantMetadata = async (roomData: RoomData, baseRole: MeetRoomMemberRole) => {
			const metadata: MeetRoomMemberTokenMetadata = {
				iat: Date.now(),
				livekitUrl: MEET_ENV.LIVEKIT_URL,
				roomId: roomData.room.roomId,
				permissions: roomData.room.roles[baseRole].permissions,
				badge:
					baseRole === MeetRoomMemberRole.MODERATOR
						? MeetRoomMemberUIBadge.MODERATOR
						: MeetRoomMemberUIBadge.OTHER,
				isPromotedModerator: undefined
			};
			await updateParticipantMetadata(roomData.room.roomId, participantIdentity, metadata);
		};

		beforeEach(async () => {
			roomData = await setupSingleRoom(true);
		});

		it('should update participant role from speaker to moderator', async () => {
			const frontendEventService = container.get(FrontendEventService);
			const sendSignalSpy = jest.spyOn(frontendEventService as any, 'sendSignal');

			await setParticipantMetadata(roomData, MeetRoomMemberRole.SPEAKER);

			const response = await updateParticipant(
				roomData.room.roomId,
				participantIdentity,
				MeetParticipantModerationAction.UPGRADE,
				roomData.moderatorToken
			);
			expect(response.status).toBe(200);

			// Check if the participant has been updated
			const participant = await livekitService.getParticipant(roomData.room.roomId, participantIdentity);
			expect(participant).toBeDefined();
			expect(participant).toHaveProperty('metadata');

			const metadata = JSON.parse(participant.metadata || '{}');
			expect(metadata).toHaveProperty('roomId', roomData.room.roomId);
			expect(metadata).toHaveProperty('badge', MeetRoomMemberUIBadge.MODERATOR);
			expect(metadata).toHaveProperty('isPromotedModerator', true);

			const moderatorPermissions = roomData.room.roles.moderator.permissions;
			const speakerPermissions = roomData.room.roles.speaker.permissions;
			expect(metadata).toHaveProperty('permissions', moderatorPermissions);
			expect(metadata).toHaveProperty('originalPermissions', speakerPermissions);

			// Verify sendSignal method has been called once
			expect(sendSignalSpy).toHaveBeenCalledTimes(1);
			expect(sendSignalSpy).toHaveBeenCalledWith(
				roomData.room.roomId,
				{
					roomId: roomData.room.roomId,
					participantIdentity,
					newBadge: MeetRoomMemberUIBadge.MODERATOR,
					timestamp: expect.any(Number)
				},
				{
					topic: MeetSignalType.MEET_PARTICIPANT_ROLE_UPDATED,
					destinationIdentities: [participantIdentity]
				}
			);
		});

		it('should downgrade participant role from promoted moderator to original permissions', async () => {
			await setParticipantMetadata(roomData, MeetRoomMemberRole.SPEAKER);
			await updateParticipant(
				roomData.room.roomId,
				participantIdentity,
				MeetParticipantModerationAction.UPGRADE,
				roomData.moderatorToken
			);

			const response = await updateParticipant(
				roomData.room.roomId,
				participantIdentity,
				MeetParticipantModerationAction.DOWNGRADE,
				roomData.moderatorToken
			);
			expect(response.status).toBe(200);

			// Check if the participant has been updated
			const participant = await livekitService.getParticipant(roomData.room.roomId, participantIdentity);
			expect(participant).toBeDefined();
			expect(participant).toHaveProperty('metadata');

			const metadata = JSON.parse(participant.metadata || '{}');
			expect(metadata).toHaveProperty('roomId', roomData.room.roomId);
			expect(metadata).toHaveProperty('badge', MeetRoomMemberUIBadge.OTHER);
			const permissions = roomData.room.roles.speaker.permissions;
			expect(metadata).toHaveProperty('permissions', permissions);
			expect(metadata).not.toHaveProperty('originalPermissions');
		});

		it('should fail with 404 if participant does not exist', async () => {
			const response = await updateParticipant(
				roomData.room.roomId,
				'NON_EXISTENT_PARTICIPANT',
				MeetParticipantModerationAction.UPGRADE,
				roomData.moderatorToken
			);
			expect(response.status).toBe(404);
			expect(response.body.error).toBe('Participant Error');
		});

		it('should fail with 404 if room does not exist', async () => {
			const response = await updateParticipant(
				'nonexistent-room-id',
				participantIdentity,
				MeetParticipantModerationAction.UPGRADE,
				roomData.moderatorToken
			);
			expect(response.status).toBe(404);
			expect(response.body.error).toBe('Room Error');
		});

		it('should fail with 409 when upgrading an already moderator participant', async () => {
			await setParticipantMetadata(roomData, MeetRoomMemberRole.MODERATOR);

			const response = await updateParticipant(
				roomData.room.roomId,
				participantIdentity,
				MeetParticipantModerationAction.UPGRADE,
				roomData.moderatorToken
			);

			expect(response.status).toBe(409);
			expect(response.body.error).toBe('Participant Error');
			expect(response.body.message).toContain('cannot be promoted to moderator');
		});

		it('should fail with 409 when downgrading a non-promoted participant', async () => {
			await setParticipantMetadata(roomData, MeetRoomMemberRole.SPEAKER);

			const response = await updateParticipant(
				roomData.room.roomId,
				participantIdentity,
				MeetParticipantModerationAction.DOWNGRADE,
				roomData.moderatorToken
			);

			expect(response.status).toBe(409);
			expect(response.body.error).toBe('Participant Error');
			expect(response.body.message).toContain('cannot be demoted');
		});
	});

	describe('Update Participant Validation Tests', () => {
		beforeAll(async () => {
			roomData = await setupSingleRoom(true);
		});

		it('should fail when action is missing', async () => {
			const response = await updateParticipant(
				roomData.room.roomId,
				participantIdentity,
				undefined as unknown as MeetParticipantModerationAction,
				roomData.moderatorToken
			);
			expectValidationError(response, 'action', 'Required');
		});

		it('should fail when action is invalid', async () => {
			const response = await updateParticipant(
				roomData.room.roomId,
				participantIdentity,
				'invalid-action' as unknown as MeetParticipantModerationAction,
				roomData.moderatorToken
			);
			expectValidationError(response, 'action', 'Invalid enum value');
		});
	});
});

import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import {
	MeetingEndAction,
	MeetRoomDeletionErrorCode,
	MeetRoomDeletionPolicyWithMeeting,
	MeetRoomDeletionPolicyWithRecordings,
	MeetRoomDeletionSuccessCode,
	MeetRoomStatus
} from '@openvidu-meet/typings';
import {
	expectExtraFieldsInResponse,
	expectSuccessListRecordingResponse,
	expectValidRoom
} from '../../../helpers/assertion-helpers.js';
import { disconnectFakeParticipants } from "../../../helpers/livekit-cli-helpers.js";
import {
	createRoom,
	deleteAllRecordings,
	deleteAllRooms,
	deleteRoom,
	endMeeting,
	getAllRecordings,
	getRoom,
	startTestServer
} from '../../../helpers/request-helpers.js';
import { setupSingleRoom, setupSingleRoomWithRecording } from '../../../helpers/test-scenarios.js';
import { waitForParticipantsToDisconnect, waitForRoomToClose, waitForRoomToDelete } from '../../../helpers/wait-helpers.js';

describe('Room API Tests', () => {
	beforeAll(async () => {
		await startTestServer();
	});

	afterAll(async () => {
		// Remove all rooms created
		await disconnectFakeParticipants();
		await deleteAllRooms();
		await deleteAllRecordings();
	});

	describe('Delete Room Tests', () => {
		describe('without active meeting or recordings', () => {
			it('should return 200 with successCode=room_deleted', async () => {
				const { roomId } = await createRoom();

				const response = await deleteRoom(roomId);
				expect(response.status).toBe(200);
				expect(response.body).toHaveProperty('successCode', MeetRoomDeletionSuccessCode.ROOM_DELETED);
				expect(response.body).not.toHaveProperty('room');

				// Check room is deleted
				const getResponse = await getRoom(roomId);
				expect(getResponse.status).toBe(404);
			});
		});

		describe('with active meeting but no recordings', () => {
			let roomId: string;
			let roomName: string;
			let moderatorToken: string;

			beforeEach(async () => {
				// Create a room with an active meeting
				const { room, moderatorToken: token } = await setupSingleRoom(true);
				roomId = room.roomId;
				roomName = room.roomName;
				moderatorToken = token;
			});

			it('should return 200 with successCode=room_with_active_meeting_deleted when withMeeting=force', async () => {
				const response = await deleteRoom(roomId, {
					withMeeting: MeetRoomDeletionPolicyWithMeeting.FORCE
				});
				expect(response.status).toBe(200);
				expect(response.body).toHaveProperty(
					'successCode',
					MeetRoomDeletionSuccessCode.ROOM_WITH_ACTIVE_MEETING_DELETED
				);
				expect(response.body).not.toHaveProperty('room');
				await waitForRoomToDelete(roomId); // Wait for the meeting to end and webhook to be processed
				// Check room is deleted
				const getResponse = await getRoom(roomId);
				expect(getResponse.status).toBe(404);
			});

			it('should return 202 with successCode=room_with_active_meeting_deleted when withMeeting=force', async () => {
				const response = await deleteRoom(roomId, {
					withMeeting: MeetRoomDeletionPolicyWithMeeting.WHEN_MEETING_ENDS
				});
				expect(response.status).toBe(202);
				expect(response.body).toHaveProperty(
					'successCode',
					MeetRoomDeletionSuccessCode.ROOM_WITH_ACTIVE_MEETING_SCHEDULED_TO_BE_DELETED
				);
				expectValidRoom(
					response.body.room,
					roomName,
					undefined,
					undefined,
					undefined,
					undefined,
					MeetRoomStatus.ACTIVE_MEETING,
					MeetingEndAction.DELETE
				);
				expectExtraFieldsInResponse(response.body.room);

				// End meeting and check the room is deleted
				await endMeeting(roomId, moderatorToken);
				await waitForRoomToDelete(roomId); // Wait for the meeting to end and webhook to be processed
				const getResponse = await getRoom(roomId);
				expect(getResponse.status).toBe(404);
			});

			it('should return partial room response when fields parameter are included with successCode=room_with_active_meeting_scheduled_to_be_closed when withMeeting=when_meeting_ends and withRecordings=close', async () => {
				const response = await deleteRoom(roomId, {
					withMeeting: MeetRoomDeletionPolicyWithMeeting.WHEN_MEETING_ENDS,
					fields: 'roomId,roomName'
				});

				expect(response.status).toBe(202);
				expect(response.body).toHaveProperty(
					'successCode',
					MeetRoomDeletionSuccessCode.ROOM_WITH_ACTIVE_MEETING_SCHEDULED_TO_BE_DELETED
				);

				// Verify only requested fields are present
				expect(Object.keys(response.body.room)).toHaveLength(3); // roomId, roomName, and _extraFields
				expect(response.body.room.roomId).toBe(roomId);
				expect(response.body.room.roomName).toBeDefined();
				expectExtraFieldsInResponse(response.body.room);
			});

			it('should return partial room response with extra fields when fields and extraFields parameters are included with successCode=room_with_active_meeting_scheduled_to_be_closed when withMeeting=when_meeting_ends and withRecordings=close', async () => {
				const response = await deleteRoom(roomId, {
					withMeeting: MeetRoomDeletionPolicyWithMeeting.WHEN_MEETING_ENDS,
					fields: 'roomId,status',
					extraFields: 'config'
				});

				expect(response.status).toBe(202);
				expect(response.body).toHaveProperty(
					'successCode',
					MeetRoomDeletionSuccessCode.ROOM_WITH_ACTIVE_MEETING_SCHEDULED_TO_BE_DELETED
				);

				// Verify only requested base fields are present
				expect(Object.keys(response.body.room)).toHaveLength(4); // roomId, status, config and _extraFields
				expectExtraFieldsInResponse(response.body.room);

				expect(response.body.room.roomId).toBe(roomId);
				expect(response.body.room.status).toBe(MeetRoomStatus.ACTIVE_MEETING);
				// Verify extra field is present
				expect(response.body.room.config).toBeDefined();
			});

			it('should return partial room response when X-Fields headers are included with successCode=room_with_active_meeting_scheduled_to_be_closed when withMeeting=when_meeting_ends and withRecordings=close', async () => {
				const response = await deleteRoom(
					roomId,
					{
						withMeeting: MeetRoomDeletionPolicyWithMeeting.WHEN_MEETING_ENDS
					},
					{
						xFields: 'roomId'
					}
				);

				expect(response.status).toBe(202);
				expect(response.body).toHaveProperty(
					'successCode',
					MeetRoomDeletionSuccessCode.ROOM_WITH_ACTIVE_MEETING_SCHEDULED_TO_BE_DELETED
				);

				// Verify only requested field is present
				expect(Object.keys(response.body.room)).toHaveLength(2); // roomId and _extraFields
				expect(response.body.room.roomId).toBe(roomId);
				expectExtraFieldsInResponse(response.body.room);
			});

			it('should return partial room response when X-ExtraFields headers are included with successCode=room_with_active_meeting_scheduled_to_be_closed when withMeeting=when_meeting_ends and withRecordings=close', async () => {
				const response = await deleteRoom(
					roomId,
					{
						withMeeting: MeetRoomDeletionPolicyWithMeeting.WHEN_MEETING_ENDS
					},
					{
						xExtraFields: 'config,roles'
					}
				);

				expect(response.status).toBe(202);
				expect(response.body).toHaveProperty(
					'successCode',
					MeetRoomDeletionSuccessCode.ROOM_WITH_ACTIVE_MEETING_SCHEDULED_TO_BE_DELETED
				);

				// Verify extra fields are present
				expectExtraFieldsInResponse(response.body.room);
				expect(response.body.room.config).toBeDefined();
				expect(response.body.room.roles).toBeDefined();
				// All base fields should be present (no fields param)
				expect(response.body.room.roomId).toBe(roomId);
				expect(response.body.room.roomName).toBeDefined();
				expect(response.body.room.status).toBe(MeetRoomStatus.ACTIVE_MEETING);
			});

			it('should return partial room response when fields parameters and X-Fields headers are included with successCode=room_with_active_meeting_scheduled_to_be_closed when withMeeting=when_meeting_ends and withRecordings=close', async () => {
				const response = await deleteRoom(
					roomId,
					{
						withMeeting: MeetRoomDeletionPolicyWithMeeting.WHEN_MEETING_ENDS,
						fields: 'roomId'
					},
					{
						xFields: 'roomName,status'
					}
				);

				expect(response.status).toBe(202);
				expect(response.body).toHaveProperty(
					'successCode',
					MeetRoomDeletionSuccessCode.ROOM_WITH_ACTIVE_MEETING_SCHEDULED_TO_BE_DELETED
				);

				// Verify merged fields from both query param and header are present
				expect(Object.keys(response.body.room)).toHaveLength(4); // roomId, roomName, status and _extraFields
				expectExtraFieldsInResponse(response.body.room);

				expect(response.body.room.roomId).toBe(roomId);
				expect(response.body.room.roomName).toBeDefined();
			});

			it('should return partial room response when X-Fields and X-ExtraFields headers are included with successCode=room_with_active_meeting_scheduled_to_be_closed when withMeeting=when_meeting_ends and withRecordings=close', async () => {
				const response = await deleteRoom(
					roomId,
					{
						withMeeting: MeetRoomDeletionPolicyWithMeeting.WHEN_MEETING_ENDS
					},
					{
						xFields: 'roomId,status',
						xExtraFields: 'config'
					}
				);

				expect(response.status).toBe(202);
				expect(response.body).toHaveProperty(
					'successCode',
					MeetRoomDeletionSuccessCode.ROOM_WITH_ACTIVE_MEETING_SCHEDULED_TO_BE_DELETED
				);

				// Verify only requested base fields are present
				expect(Object.keys(response.body.room)).toHaveLength(4); // roomId, status, config and _extraFields
				expect(response.body.room.roomId).toBe(roomId);
				expect(response.body.room.status).toBe(MeetRoomStatus.ACTIVE_MEETING);
				// Other base fields should not be present
				expect(response.body.room.roomName).toBeUndefined();

				// Verify requested extra field is present
				expect(response.body.room.config).toBeDefined();
			});

			it('should return 409 with error=room_has_active_meeting when withMeeting=fail', async () => {
				const response = await deleteRoom(roomId, { withMeeting: MeetRoomDeletionPolicyWithMeeting.FAIL });
				expect(response.status).toBe(409);
				expect(response.body).toHaveProperty('error', MeetRoomDeletionErrorCode.ROOM_HAS_ACTIVE_MEETING);
			});
		});

		describe('with recordings but no active meeting', () => {
			let roomId: string;
			let roomName: string;

			beforeEach(async () => {
				// Create a room with recordings and end the meeting
				const { room, moderatorToken } = await setupSingleRoomWithRecording(true);
				roomId = room.roomId;
				roomName = room.roomName;
				await endMeeting(roomId, moderatorToken);
			});

			it('should return 200 with successCode=room_and_recordings_deleted when withRecording=force', async () => {
				const response = await deleteRoom(roomId, {
					withRecordings: MeetRoomDeletionPolicyWithRecordings.FORCE
				});
				await waitForRoomToDelete(roomId); // Wait for the webhook to process the deletion
				expect(response.status).toBe(200);
				expect(response.body).toHaveProperty(
					'successCode',
					MeetRoomDeletionSuccessCode.ROOM_AND_RECORDINGS_DELETED
				);
				expect(response.body).not.toHaveProperty('room');

				// Check the room and recordings are deleted
				const roomResponse = await getRoom(roomId);
				expect(roomResponse.status).toBe(404);
				const recordingsResponse = await getAllRecordings({ roomId, maxItems: 1 });
				expectSuccessListRecordingResponse(recordingsResponse, 0, false, false, 1);
			});

			it('should return 200 with successCode=room_closed when withRecording=close', async () => {
				const response = await deleteRoom(roomId, {
					withRecordings: MeetRoomDeletionPolicyWithRecordings.CLOSE
				});
				expect(response.status).toBe(200);
				expect(response.body).toHaveProperty('successCode', MeetRoomDeletionSuccessCode.ROOM_CLOSED);
				expect(response.body).toHaveProperty('room');
				// Check that the room is closed and recordings are not deleted
				expectValidRoom(
					response.body.room,
					roomName,
					undefined,
					undefined,
					undefined,
					undefined,
					MeetRoomStatus.CLOSED,
					MeetingEndAction.NONE
				);
				expectExtraFieldsInResponse(response.body.room);

				const recordingsResponse = await getAllRecordings({ roomId, maxItems: 1 });
				expectSuccessListRecordingResponse(recordingsResponse, 1, false, false, 1);
			});

			it('should return 409 with error=room_has_recordings when withRecording=fail', async () => {
				const response = await deleteRoom(roomId, {
					withRecordings: MeetRoomDeletionPolicyWithRecordings.FAIL
				});
				expect(response.status).toBe(409);
				expect(response.body).toHaveProperty('error', MeetRoomDeletionErrorCode.ROOM_HAS_RECORDINGS);
			});
		});

		describe('with active meeting and recordings', () => {
			let roomId: string;
			let roomName: string;
			let moderatorToken: string;

			beforeEach(async () => {
				// Create a room with recordings, keep the meeting active
				const { room, moderatorToken: token } = await setupSingleRoomWithRecording(true);
				roomId = room.roomId;
				roomName = room.roomName;
				moderatorToken = token;
			});

			it('should return 200 with successCode=room_with_active_meeting_and_recordings_deleted when withMeeting=force and withRecording=force', async () => {
				const response = await deleteRoom(roomId, {
					withMeeting: MeetRoomDeletionPolicyWithMeeting.FORCE,
					withRecordings: MeetRoomDeletionPolicyWithRecordings.FORCE
				});
				expect(response.status).toBe(200);
				expect(response.body).toHaveProperty(
					'successCode',
					MeetRoomDeletionSuccessCode.ROOM_WITH_ACTIVE_MEETING_AND_RECORDINGS_DELETED
				);
				expect(response.body).not.toHaveProperty('room');
				await waitForRoomToDelete(roomId); // Wait for the meeting to end and webhook to be processed

				// Check the room and recordings are deleted
				const roomResponse = await getRoom(roomId);
				expect(roomResponse.status).toBe(404);
				const recordingsResponse = await getAllRecordings({ roomId, maxItems: 1 });
				expectSuccessListRecordingResponse(recordingsResponse, 0, false, false, 1);
			});

			it('should return 200 with successCode=room_with_active_meeting_closed when withMeeting=force and withRecording=close', async () => {
				const response = await deleteRoom(roomId, {
					withMeeting: MeetRoomDeletionPolicyWithMeeting.FORCE,
					withRecordings: MeetRoomDeletionPolicyWithRecordings.CLOSE
				});

				expect(response.status).toBe(200);
				expect(response.body).toHaveProperty(
					'successCode',
					MeetRoomDeletionSuccessCode.ROOM_WITH_ACTIVE_MEETING_CLOSED
				);
				expectValidRoom(
					response.body.room,
					roomName,
					undefined,
					undefined,
					undefined,
					undefined,
					MeetRoomStatus.ACTIVE_MEETING,
					MeetingEndAction.CLOSE
				);
				expectExtraFieldsInResponse(response.body.room);
				await waitForParticipantsToDisconnect([roomId]); // Wait for participants to be disconnected after meeting is closed
				await waitForRoomToClose(roomId); // Wait for the room status to be updated to closed

				// Check that the room is closed and recordings are not deleted
				const roomResponse = await getRoom(roomId);
				expect(roomResponse.status).toBe(200);
				expectValidRoom(
					roomResponse.body,
					roomName,
					undefined,
					undefined,
					undefined,
					undefined,
					MeetRoomStatus.CLOSED,
					MeetingEndAction.NONE
				);

				const recordingsResponse = await getAllRecordings({ roomId, maxItems: 1 });
				expectSuccessListRecordingResponse(recordingsResponse, 1, false, false, 1);
			});

			it('should return 409 with error=room_with_active_meeting_has_recordings when withMeeting=force and withRecording=fail', async () => {
				const response = await deleteRoom(roomId, {
					withMeeting: MeetRoomDeletionPolicyWithMeeting.FORCE,
					withRecordings: MeetRoomDeletionPolicyWithRecordings.FAIL
				});
				expect(response.status).toBe(409);
				expect(response.body).toHaveProperty(
					'error',
					MeetRoomDeletionErrorCode.ROOM_WITH_ACTIVE_MEETING_HAS_RECORDINGS
				);
			});

			it('should return 202 with successCode=room_with_active_meeting_and_recordings_scheduled_to_be_deleted when withMeeting=when_meeting_ends and withRecording=force', async () => {
				const response = await deleteRoom(roomId, {
					withMeeting: MeetRoomDeletionPolicyWithMeeting.WHEN_MEETING_ENDS,
					withRecordings: MeetRoomDeletionPolicyWithRecordings.FORCE
				});
				expect(response.status).toBe(202);
				expect(response.body).toHaveProperty(
					'successCode',
					MeetRoomDeletionSuccessCode.ROOM_WITH_ACTIVE_MEETING_AND_RECORDINGS_SCHEDULED_TO_BE_DELETED
				);
				expectValidRoom(
					response.body.room,
					roomName,
					undefined,
					undefined,
					undefined,
					undefined,
					MeetRoomStatus.ACTIVE_MEETING,
					MeetingEndAction.DELETE
				);
				expectExtraFieldsInResponse(response.body.room);

				// End meeting and check the room and recordings are deleted
				await endMeeting(roomId, moderatorToken);
				await waitForRoomToDelete(roomId);
				const roomResponse = await getRoom(roomId);
				expect(roomResponse.status).toBe(404);
				const recordingsResponse = await getAllRecordings({ roomId, maxItems: 1 });
				expectSuccessListRecordingResponse(recordingsResponse, 0, false, false, 1);
			});

			it('should return 202 with successCode=room_with_active_meeting_scheduled_to_be_closed when withMeeting=when_meeting_ends and withRecording=close', async () => {
				const response = await deleteRoom(roomId, {
					withMeeting: MeetRoomDeletionPolicyWithMeeting.WHEN_MEETING_ENDS,
					withRecordings: MeetRoomDeletionPolicyWithRecordings.CLOSE
				});
				expect(response.status).toBe(202);
				expect(response.body).toHaveProperty(
					'successCode',
					MeetRoomDeletionSuccessCode.ROOM_WITH_ACTIVE_MEETING_SCHEDULED_TO_BE_CLOSED
				);
				expectValidRoom(
					response.body.room,
					roomName,
					undefined,
					undefined,
					undefined,
					undefined,
					MeetRoomStatus.ACTIVE_MEETING,
					MeetingEndAction.CLOSE
				);
				expectExtraFieldsInResponse(response.body.room);

				// End meeting and check that the room is closed and recordings are not deleted
				await endMeeting(roomId, moderatorToken);

				// Wait for the room to be closed (with retry logic to avoid flakiness in CI)
				let roomResponse;
				let attempts = 0;
				const maxAttempts = 10;
				const retryDelay = 500; // 500ms between retries

				while (attempts < maxAttempts) {
					roomResponse = await getRoom(roomId);

					if (roomResponse.status === 200 && roomResponse.body.status === MeetRoomStatus.CLOSED) {
						break;
					}

					attempts++;

					if (attempts < maxAttempts) {
						await new Promise((resolve) => setTimeout(resolve, retryDelay));
					}
				}

				expect(roomResponse!.status).toBe(200);
				expectValidRoom(
					roomResponse!.body,
					roomName,
					undefined,
					undefined,
					undefined,
					undefined,
					MeetRoomStatus.CLOSED,
					MeetingEndAction.NONE
				);

				const recordingsResponse = await getAllRecordings({ roomId, maxItems: 1 });
				expectSuccessListRecordingResponse(recordingsResponse, 1, false, false, 1);
			});

			it('should return 409 with error=room_with_active_meeting_has_recordings_cannot_schedule_deletion when withMeeting=when_meeting_ends and withRecording=fail', async () => {
				const response = await deleteRoom(roomId, {
					withMeeting: MeetRoomDeletionPolicyWithMeeting.WHEN_MEETING_ENDS,
					withRecordings: MeetRoomDeletionPolicyWithRecordings.FAIL
				});
				expect(response.status).toBe(409);
				expect(response.body).toHaveProperty(
					'error',
					MeetRoomDeletionErrorCode.ROOM_WITH_ACTIVE_MEETING_HAS_RECORDINGS_CANNOT_SCHEDULE_DELETION
				);
			});

			it('should return 409 with error=room_with_recordings_has_active_meeting when withMeeting=fail', async () => {
				const response = await deleteRoom(roomId, {
					withMeeting: MeetRoomDeletionPolicyWithMeeting.FAIL,
					withRecordings: MeetRoomDeletionPolicyWithRecordings.FORCE
				});
				expect(response.status).toBe(409);
				expect(response.body).toHaveProperty(
					'error',
					MeetRoomDeletionErrorCode.ROOM_WITH_RECORDINGS_HAS_ACTIVE_MEETING
				);
			});
		});
	});

	describe('Delete Room Validation failures', () => {
		it('should fail when roomId becomes empty after sanitization', async () => {
			const response = await deleteRoom('!!*!@#$%^&*()+{}|:"<>?');

			expect(response.status).toBe(422);
			// Expect an error message indicating the resulting roomId is empty.
			expect(response.body.error).toContain('Unprocessable Entity');
			expect(JSON.stringify(response.body.details)).toContain('roomId cannot be empty after sanitization');
		});

		it('should fail when withMeeting parameter is invalid', async () => {
			const response = await deleteRoom('testRoom', { withMeeting: 'invalid_value' });

			expect(response.status).toBe(422);
			expect(response.body.error).toContain('Unprocessable Entity');
			expect(JSON.stringify(response.body.details)).toContain('Invalid enum value');
		});

		it('should fail when withRecordings parameter is invalid', async () => {
			const response = await deleteRoom('testRoom', { withRecordings: 'invalid_value' });

			expect(response.status).toBe(422);
			expect(response.body.error).toContain('Unprocessable Entity');
			expect(JSON.stringify(response.body.details)).toContain('Invalid enum value');
		});
	});
});

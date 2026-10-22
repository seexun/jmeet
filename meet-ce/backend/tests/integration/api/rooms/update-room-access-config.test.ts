import { afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import { MeetRoomAccessConfig } from '@openvidu-meet/typings';
import { MeetRecordingModel } from '../../../../src/models/mongoose-schemas/recording.schema.js';
import { expectValidationError } from '../../../helpers/assertion-helpers.js';
import { disconnectFakeParticipants } from '../../../helpers/livekit-cli-helpers.js';
import {
	createRoom,
	deleteAllRecordings,
	deleteAllRooms,
	getRoom,
	startTestServer,
	updateRoomAccessConfig
} from '../../../helpers/request-helpers.js';
import { createRecordingForRoom, setupSingleRoom } from '../../../helpers/test-scenarios.js';

describe('Room API Tests', () => {
	beforeAll(async () => {
		await startTestServer();
	});

	afterEach(async () => {
		await disconnectFakeParticipants();
		await deleteAllRooms();
		await deleteAllRecordings();
	});

	describe('Update Room Access Config Tests', () => {
		it('should successfully fully update room access config', async () => {
			const createdRoom = await createRoom({ roomName: 'update-access-config-test' });

			const updatedAccessConfig = {
				anonymous: {
					moderator: { enabled: false },
					speaker: { enabled: false },
					recording: { enabled: false }
				},
				user: { enabled: true }
			};

			const updateResponse = await updateRoomAccessConfig(createdRoom.roomId, updatedAccessConfig);
			expect(updateResponse.status).toBe(200);
			expect(updateResponse.body).toMatchObject(updatedAccessConfig);

			const getResponse = await getRoom(createdRoom.roomId, 'access');
			expect(getResponse.status).toBe(200);
			expect(getResponse.body.access.anonymous.moderator.enabled).toBe(false);
			expect(getResponse.body.access.anonymous.speaker.enabled).toBe(false);
			expect(getResponse.body.access.anonymous.recording.enabled).toBe(false);
			expect(getResponse.body.access.user.enabled).toBe(true);
		});

		it('should allow partial access updates while preserving other values', async () => {
			const createdRoom = await createRoom({
				roomName: 'partial-access-config-test',
				access: {
					anonymous: {
						moderator: { enabled: false },
						speaker: { enabled: true },
						recording: { enabled: true }
					},
					user: { enabled: true }
				}
			});

			const updateResponse = await updateRoomAccessConfig(createdRoom.roomId, {
				anonymous: {
					speaker: { enabled: false }
				}
			});
			expect(updateResponse.status).toBe(200);

			const getResponse = await getRoom(createdRoom.roomId, 'access');
			expect(getResponse.status).toBe(200);
			expect(getResponse.body.access.anonymous.moderator.enabled).toBe(false);
			expect(getResponse.body.access.anonymous.speaker.enabled).toBe(false);
			expect(getResponse.body.access.anonymous.recording.enabled).toBe(true);
			expect(getResponse.body.access.user.enabled).toBe(true);
		});

		it('should update recording roomUserAccess when user access changes', async () => {
			// Create room with user access disabled and canRetrieveRecordings permission enabled for speakers
			const room = await createRoom({
				access: {
					user: {
						enabled: false
					}
				},
				roles: {
					speaker: {
						permissions: {
							canRetrieveRecordings: true
						}
					}
				}
			});

			// Create a recording for that room
			const recordingId = await createRecordingForRoom(room.roomId);

			// Verify initial recording roomUserAccess is false
			let recording = await MeetRecordingModel.findOne({ recordingId }, 'roomUserAccess').lean().exec();
			expect(recording).toBeTruthy();
			expect(recording?.roomUserAccess).toBe(false);

			// Update room access config to enable user access
			const updateResponse = await updateRoomAccessConfig(room.roomId, {
				user: {
					enabled: true
				}
			});
			expect(updateResponse.status).toBe(200);

			// Verify the recording's roomUserAccess has been updated to true
			recording = await MeetRecordingModel.findOne({ recordingId }, 'roomUserAccess').lean().exec();
			expect(recording).toBeTruthy();
			expect(recording?.roomUserAccess).toBe(true);
		});

		it('should not update recording roomUserAccess when user access changes but canRetrieveRecordings permission is false', async () => {
			// Create room with user access disabled and canRetrieveRecordings permission disabled for speakers
			const room = await createRoom({
				access: {
					user: {
						enabled: false
					}
				},
				roles: {
					speaker: {
						permissions: {
							canRetrieveRecordings: false
						}
					}
				}
			});

			// Create a recording for that room
			const recordingId = await createRecordingForRoom(room.roomId);

			// Verify initial recording roomUserAccess is false
			let recording = await MeetRecordingModel.findOne({ recordingId }, 'roomUserAccess').lean().exec();
			expect(recording).toBeTruthy();
			expect(recording?.roomUserAccess).toBe(false);

			// Update room access config to enable user access
			const updateResponse = await updateRoomAccessConfig(room.roomId, {
				user: {
					enabled: true
				}
			});
			expect(updateResponse.status).toBe(200);

			// Verify the recording's roomUserAccess has NOT been updated and remains false
			recording = await MeetRecordingModel.findOne({ recordingId }, 'roomUserAccess').lean().exec();
			expect(recording).toBeTruthy();
			expect(recording?.roomUserAccess).toBe(false);
		});

		it('should reject room access config update when there is an active meeting', async () => {
			const roomData = await setupSingleRoom(true);

			const response = await updateRoomAccessConfig(roomData.room.roomId, {
				user: { enabled: true }
			});

			expect(response.status).toBe(409);
			expect(response.body.error).toBe('Room Error');
			expect(response.body.message).toContain(`Room '${roomData.room.roomId}' has an active meeting`);
		});

		it('should return 404 when updating access config for non-existent room', async () => {
			const nonExistentRoomId = 'non-existent-room';

			const response = await updateRoomAccessConfig(nonExistentRoomId, {
				user: { enabled: true }
			});

			expect(response.status).toBe(404);
			expect(response.body.message).toContain(`'${nonExistentRoomId}' does not exist`);
		});
	});

	describe('Update Room Access Config Validation failures', () => {
		it('should fail when access config has incorrect types', async () => {
			const createdRoom = await createRoom({ roomName: 'invalid-access-types' });

			const invalidAccessConfig = {
				user: {
					enabled: 'true'
				}
			};

			const response = await updateRoomAccessConfig(
				createdRoom.roomId,
				invalidAccessConfig as unknown as MeetRoomAccessConfig
			);
			expectValidationError(response, 'access.user.enabled', 'Expected boolean');
		});

		it('should fail when access object is missing', async () => {
			const createdRoom = await createRoom({ roomName: 'missing-access-object' });

			const response = await updateRoomAccessConfig(
				createdRoom.roomId,
				undefined as unknown as MeetRoomAccessConfig
			);
			expectValidationError(response, 'access', 'Required');
		});
	});
});

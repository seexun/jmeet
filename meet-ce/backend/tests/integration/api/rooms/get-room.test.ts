import { afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import {
	MeetRecordingAudioCodec,
	MeetRecordingEncodingPreset,
	MeetRecordingLayout,
	MeetRecordingVideoCodec
} from '@openvidu-meet/typings';
import ms from 'ms';
import {
	expectExtraFieldsInResponse,
	expectSuccessRoomResponse,
	expectValidationError,
	expectValidRoom,
	expectValidRoomWithFields
} from '../../../helpers/assertion-helpers.js';
import { createRoom, deleteAllRooms, getRoom, startTestServer } from '../../../helpers/request-helpers.js';
import { setupSingleRoom } from '../../../helpers/test-scenarios.js';

describe('Room API Tests', () => {
	beforeAll(async () => {
		await startTestServer();
	});

	afterEach(async () => {
		// Remove all rooms created
		await deleteAllRooms();
	});

	describe('Get Room Tests', () => {
		it('should successfully retrieve a room by its ID without config by default', async () => {
			const createdRoom = await createRoom({
				roomName: 'test-room'
			});

			// Get room without extraFields - config should not be present
			const response = await getRoom(createdRoom.roomId);
			expectValidRoom(response.body, 'test-room');
			expectExtraFieldsInResponse(response.body);
		});

		it('should not include roles by default and include them when requested via extraFields', async () => {
			const createdRoom = await createRoom({ roomName: 'roles-extra-field' });

			// Without extraFields, roles should be excluded
			const defaultResponse = await getRoom(createdRoom.roomId);
			expect(defaultResponse.status).toBe(200);
			expect(defaultResponse.body.roles).toBeUndefined();
			expectExtraFieldsInResponse(defaultResponse.body);

			// With extraFields=roles, roles should be included
			const withRolesResponse = await getRoom(createdRoom.roomId, undefined, 'roles');
			expect(withRolesResponse.status).toBe(200);
			expect(withRolesResponse.body.roles).toBeDefined();
			expect(withRolesResponse.body.roles.moderator.permissions).toBeDefined();
			expect(withRolesResponse.body.roles.speaker.permissions).toBeDefined();
			// config remains excluded since it was not requested
			expect(withRolesResponse.body.config).toBeUndefined();
		});

		it('should retrieve a room with custom config', async () => {
			const payload = {
				roomName: 'custom-config',
				config: {
					recording: {
						enabled: true,
						layout: MeetRecordingLayout.SPEAKER,
						encoding: MeetRecordingEncodingPreset.H264_1080P_30
					},
					chat: { enabled: true },
					virtualBackground: { enabled: false },
					e2ee: { enabled: false },
					captions: { enabled: true }
				}
			};
			// Create a room with custom config
			const { roomId } = await createRoom(payload);

			// Retrieve the room by its ID with expand=config
			const response = await getRoom(roomId, undefined, 'config');

			expectSuccessRoomResponse(response, 'custom-config', 'custom_config', undefined, payload.config);
		});

		it('should retrieve only specified fields when using fields parameter', async () => {
			// Create a room
			const createdRoom = await createRoom({
				roomName: 'field-filtered'
			});

			// Get the room with field filtering
			const response = await getRoom(createdRoom.roomId, 'roomId,roomName');

			// Verify that only the requested fields are returned
			expect(response.status).toBe(200);

			expectValidRoomWithFields(response.body, ['roomId', 'roomName']);
		});

		it('should handle roomId with characters that need sanitization', async () => {
			// Create a room
			const createdRoom = await createRoom({
				roomName: 'test-room'
			});

			const dirtyRoomId = ' ' + createdRoom.roomId + ' '; // Add spaces that should be trimmed

			const response = await getRoom(dirtyRoomId);

			expectSuccessRoomResponse(response, 'test-room', 'test_room');
			expectExtraFieldsInResponse(response.body);
		});

		it('should retrieve a room with autoDeletionDate', async () => {
			// Use validAutoDeletionDate that's defined in the test file or create here
			const validAutoDeletionDate = Date.now() + ms('2h');

			// Create a room with autoDeletionDate
			const createdRoom = await createRoom({
				roomName: 'deletion-date',
				autoDeletionDate: validAutoDeletionDate
			});

			// Get the room
			const response = await getRoom(createdRoom.roomId);

			expectSuccessRoomResponse(response, 'deletion-date', 'deletion_date', validAutoDeletionDate);
		});

		it("should not include access.anonymous URLs when user doesn't have canShareAccessLinks permission", async () => {
			const roomData = await setupSingleRoom();
			const response = await getRoom(roomData.room.roomId, undefined, undefined, roomData.speakerToken);

			expect(response.status).toBe(200);
			expect(response.body.access).toBeDefined();
			expect(response.body.access.anonymous).toBeDefined();
			expect(response.body.access.anonymous.moderator).toBeDefined();
			expect(response.body.access.anonymous.moderator.url).toBeUndefined();
			expect(response.body.access.anonymous.speaker).toBeDefined();
			expect(response.body.access.anonymous.speaker.url).toBeUndefined();
			expect(response.body.access.anonymous.recording).toBeDefined();
			expect(response.body.access.anonymous.recording.url).toBeUndefined();
		});

		it('should retrieve a room with encoding preset', async () => {
			const createdRoom = await createRoom({
				roomName: 'encoding-preset-test',
				config: {
					recording: {
						enabled: true,
						encoding: MeetRecordingEncodingPreset.H264_1080P_60
					}
				}
			});

			const response = await getRoom(createdRoom.roomId, undefined, 'config');
			expect(response.status).toBe(200);
			expect(response.body.config.recording.encoding).toBe(MeetRecordingEncodingPreset.H264_1080P_60);
		});

		it('should retrieve a room with advanced encoding options', async () => {
			const advancedEncoding = {
				video: {
					width: 1920,
					height: 1080,
					framerate: 60,
					codec: MeetRecordingVideoCodec.H264_HIGH,
					bitrate: 5000,
					keyFrameInterval: 2,
					depth: 24
				},
				audio: {
					codec: MeetRecordingAudioCodec.AAC,
					bitrate: 192,
					frequency: 48000
				}
			};

			const createdRoom = await createRoom({
				roomName: 'advanced-encoding-test',
				config: {
					recording: {
						enabled: true,
						encoding: advancedEncoding
					}
				}
			});

			const response = await getRoom(createdRoom.roomId, undefined, 'config');
			expect(response.status).toBe(200);
			expect(response.body.config.recording.encoding).toMatchObject(advancedEncoding);
		});

		it('should return 404 for a non-existent room', async () => {
			const fakeRoomId = 'non-existent-room-id';
			const response = await getRoom(fakeRoomId);
			expect(response.status).toBe(404);
			expect(response.body.message).toBe(`Room '${fakeRoomId}' does not exist`);
		});
	});

	describe('Get Room Validation failures', () => {
		it('should fail when roomId becomes empty after sanitization', async () => {
			const response = await getRoom('!!*!@#$%^&*()+{}|:"<>?');

			expectValidationError(response, 'roomId', 'cannot be empty after sanitization');
		});
	});
});

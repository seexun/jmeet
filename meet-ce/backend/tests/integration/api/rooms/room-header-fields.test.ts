import { afterAll, afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import {
	MeetRecordingEncodingPreset,
	MeetRecordingLayout,
	MeetRoom,
	MeetRoomDeletionPolicyWithMeeting,
	MeetRoomDeletionSuccessCode
} from '@openvidu-meet/typings';
import {
	expectSuccessRoomsResponse,
	expectValidRoom,
	expectValidRoomWithFields
} from '../../../helpers/assertion-helpers.js';
import { disconnectFakeParticipants } from '../../../helpers/livekit-cli-helpers.js';
import {
	bulkDeleteRooms,
	createRoom,
	deleteAllRecordings,
	deleteAllRooms,
	deleteRoom,
	getRoom,
	getRooms,
	startTestServer
} from '../../../helpers/request-helpers.js';
import { setupSingleRoom } from '../../../helpers/test-scenarios.js';

/**
 * Tests for X-Fields and X-ExtraFields header support across all room operations.
 *
 * All room operations (POST, GET, DELETE) support the X-Fields and X-ExtraFields headers
 * for controlling which fields are included in the response.
 *
 * For GET and DELETE operations, headers can be combined with query parameters.
 * When both are provided, values are merged (union of unique fields).
 */
describe('Room Header Fields Tests', () => {
	beforeAll(async () => {
		await startTestServer();
	});

	afterEach(async () => {
		await deleteAllRooms();
	});

	afterAll(async () => {
		await disconnectFakeParticipants();
		await deleteAllRecordings();
	});

	describe('GET /rooms - X-Fields and X-ExtraFields headers', () => {
		it('should filter fields using X-Fields header', async () => {
			await createRoom({ roomName: 'header-fields-test' });

			const response = await getRooms({}, { xFields: 'roomId,roomName' });
			expectSuccessRoomsResponse(response, 1, 10, false, false);

			const room = response.body.rooms[0];
			expectValidRoomWithFields(room, ['roomId', 'roomName']);
		});

		it('should include extra fields using X-ExtraFields header', async () => {
			const customConfig = {
				recording: {
					enabled: true,
					layout: MeetRecordingLayout.SPEAKER,
					encoding: MeetRecordingEncodingPreset.H264_1080P_30
				},
				chat: { enabled: false },
				virtualBackground: { enabled: true },
				e2ee: { enabled: false },
				captions: { enabled: true }
			};

			await createRoom({ roomName: 'header-extrafields-test', config: customConfig });

			const response = await getRooms({}, { xExtraFields: 'config' });
			expectSuccessRoomsResponse(response, 1, 10, false, false);

			const room = response.body.rooms[0];
			expectValidRoom(room, 'header-extrafields-test', 'header_extrafields_test', customConfig);
		});

		it('should combine X-Fields header with fields query param (union)', async () => {
			await createRoom({ roomName: 'merge-fields-test' });

			// Query param requests 'roomId', header requests 'roomName' → result should have both
			const response = await getRooms({ fields: 'roomId' }, { xFields: 'roomName' });
			expectSuccessRoomsResponse(response, 1, 10, false, false);

			const room = response.body.rooms[0];
			expectValidRoomWithFields(room, ['roomId', 'roomName']);
		});

		it('should combine X-ExtraFields header with extraFields query param (union)', async () => {
			await createRoom({ roomName: 'merge-extrafields-test' });

			// Both specify 'config' → result should contain config (deduplication)
			const response = await getRooms({ extraFields: 'config' }, { xExtraFields: 'config' });
			expectSuccessRoomsResponse(response, 1, 10, false, false);

			const room = response.body.rooms[0];
			expect(room.config).toBeDefined();
		});

		it('should combine query params and headers for both fields and extraFields', async () => {
			await createRoom({ roomName: 'full-merge-test' });

			// Query: fields=roomId, Header: X-Fields=roomName, X-ExtraFields=config
			const response = await getRooms({ fields: 'roomId' }, { xFields: 'roomName', xExtraFields: 'config' });
			expectSuccessRoomsResponse(response, 1, 10, false, false);

			const room = response.body.rooms[0];
			expectValidRoomWithFields(room, ['roomId', 'roomName', 'config']);
		});

		it('should work with only headers and no query params', async () => {
			await createRoom({ roomName: 'only-headers-test' });

			const response = await getRooms({}, { xFields: 'roomId,status', xExtraFields: 'config' });
			expectSuccessRoomsResponse(response, 1, 10, false, false);

			const room = response.body.rooms[0];
			expectValidRoomWithFields(room, ['roomId', 'status', 'config']);
		});

		it('should ignore invalid header values gracefully and fallback to query params', async () => {
			await createRoom({ roomName: 'invalid-header-test' });

			// Invalid header values should be silently ignored
			const response = await getRooms({ fields: 'roomId,roomName' }, { xFields: '' });
			expectSuccessRoomsResponse(response, 1, 10, false, false);

			const room = response.body.rooms[0];
			expectValidRoomWithFields(room, ['roomId', 'roomName']);
		});
	});

	describe('GET /rooms/:roomId - X-Fields and X-ExtraFields headers', () => {
		it('should filter fields using X-Fields header', async () => {
			const createdRoom = await createRoom({ roomName: 'get-room-header-test' });

			const response = await getRoom(createdRoom.roomId, undefined, undefined, undefined, {
				xFields: 'roomId,roomName'
			});

			expect(response.status).toBe(200);
			expectValidRoomWithFields(response.body, ['roomId', 'roomName']);
		});

		it('should include extra fields using X-ExtraFields header', async () => {
			const customConfig = {
				recording: {
					enabled: true,
					layout: MeetRecordingLayout.GRID,
					encoding: MeetRecordingEncodingPreset.H264_720P_30
				},
				chat: { enabled: true },
				virtualBackground: { enabled: true },
				e2ee: { enabled: false },
				captions: { enabled: true }
			};

			const createdRoom = await createRoom({
				roomName: 'get-room-extrafields-header',
				config: customConfig
			});

			const response = await getRoom(createdRoom.roomId, undefined, undefined, undefined, {
				xExtraFields: 'config'
			});

			expect(response.status).toBe(200);
			expect(response.body.config).toBeDefined();
			expect(response.body.config).toMatchObject(customConfig);
		});

		it('should combine X-Fields header with fields query param', async () => {
			const createdRoom = await createRoom({ roomName: 'get-room-merge-test' });

			// Query param: fields=roomId, Header: X-Fields=status
			const response = await getRoom(createdRoom.roomId, 'roomId', undefined, undefined, {
				xFields: 'status'
			});

			expect(response.status).toBe(200);
			expectValidRoomWithFields(response.body, ['roomId', 'status']);
		});

		it('should combine X-ExtraFields header with extraFields query param', async () => {
			const createdRoom = await createRoom({ roomName: 'get-room-merge-extra' });

			// Both specify 'config' via different mechanisms
			const response = await getRoom(createdRoom.roomId, undefined, 'config', undefined, {
				xExtraFields: 'config'
			});

			expect(response.status).toBe(200);
			expect(response.body.config).toBeDefined();
		});

		it('should work with both X-Fields and X-ExtraFields headers together', async () => {
			const createdRoom = await createRoom({ roomName: 'get-room-both-headers' });

			const response = await getRoom(createdRoom.roomId, undefined, undefined, undefined, {
				xFields: 'roomId,roomName',
				xExtraFields: 'config'
			});

			expect(response.status).toBe(200);
			expectValidRoomWithFields(response.body, ['roomId', 'roomName', 'config']);
		});
	});

	describe('DELETE /rooms/:roomId - X-Fields and X-ExtraFields headers', () => {
		it('should filter room fields in response using X-Fields header when room is returned', async () => {
			const { room } = await setupSingleRoom(true);

			const response = await deleteRoom(
				room.roomId,
				{ withMeeting: MeetRoomDeletionPolicyWithMeeting.WHEN_MEETING_ENDS },
				{ xFields: 'roomId,status' }
			);

			expect(response.status).toBe(202);
			expect(response.body).toHaveProperty(
				'successCode',
				MeetRoomDeletionSuccessCode.ROOM_WITH_ACTIVE_MEETING_SCHEDULED_TO_BE_DELETED
			);
			expect(response.body.room).toBeDefined();
			expectValidRoomWithFields(response.body.room, ['roomId', 'status']);
		});

		it('should include extra fields in response using X-ExtraFields header', async () => {
			const { room } = await setupSingleRoom(true);

			const response = await deleteRoom(
				room.roomId,
				{ withMeeting: MeetRoomDeletionPolicyWithMeeting.WHEN_MEETING_ENDS },
				{ xExtraFields: 'config' }
			);

			expect(response.status).toBe(202);
			expect(response.body.room).toBeDefined();
			expect(response.body.room.config).toBeDefined();
		});

		it('should not affect response when room is not returned (direct deletion)', async () => {
			const { roomId } = await createRoom();

			// Direct deletion (no meeting, no recordings) → no room in response
			const response = await deleteRoom(roomId, {}, { xFields: 'roomId' });

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty('successCode', MeetRoomDeletionSuccessCode.ROOM_DELETED);
			expect(response.body).not.toHaveProperty('room');
		});
	});

	describe('DELETE /rooms (bulk) - X-Fields and X-ExtraFields headers', () => {
		it('should filter room fields in bulk delete response using X-Fields header', async () => {
			const { room } = await setupSingleRoom(true);

			const response = await bulkDeleteRooms(
				[room.roomId],
				MeetRoomDeletionPolicyWithMeeting.WHEN_MEETING_ENDS,
				undefined,
				undefined,
				undefined,
				{ xFields: 'roomId,status' }
			);

			expect(response.status).toBe(200);
			const successItem = response.body.deleted.find((s: { room?: MeetRoom }) => s.room !== undefined);
			expect(successItem).toBeDefined();
			expectValidRoomWithFields(successItem.room, ['roomId', 'status']);
		});

		it('should include extra fields in bulk delete response using X-ExtraFields header', async () => {
			const { room } = await setupSingleRoom(true);

			const response = await bulkDeleteRooms(
				[room.roomId],
				MeetRoomDeletionPolicyWithMeeting.WHEN_MEETING_ENDS,
				undefined,
				undefined,
				undefined,
				{ xExtraFields: 'config' }
			);

			expect(response.status).toBe(200);
			const successItem = response.body.deleted.find((s: { room?: MeetRoom }) => s.room !== undefined);
			expect(successItem).toBeDefined();
			expect(successItem.room.config).toBeDefined();
		});

		it('should combine headers and query params in bulk delete', async () => {
			const [room1, { room: room2 }] = await Promise.all([createRoom(), setupSingleRoom(true)]);

			const response = await bulkDeleteRooms(
				[room1.roomId, room2.roomId],
				MeetRoomDeletionPolicyWithMeeting.WHEN_MEETING_ENDS,
				undefined,
				undefined,
				undefined,
				{ xFields: 'roomId,roomName', xExtraFields: 'config' }
			);

			// room1 gets deleted (no room in response), room2 gets scheduled (room in response)
			const successWithRoom = response.body.deleted.find((s: { room?: MeetRoom }) => s.room !== undefined);

			if (successWithRoom) {
				expectValidRoomWithFields(successWithRoom.room, ['roomId', 'roomName', 'config']);
			}
		});

		it('should not affect items without room in response', async () => {
			const { roomId } = await createRoom();

			const response = await bulkDeleteRooms([roomId], undefined, undefined, undefined, undefined, {
				xFields: 'roomId'
			});

			expect(response.status).toBe(200);
			expect(response.body.deleted[0]).toHaveProperty('successCode', MeetRoomDeletionSuccessCode.ROOM_DELETED);
			expect(response.body.deleted[0]).not.toHaveProperty('room');
		});
	});

	describe('POST /rooms - X-Fields and X-ExtraFields headers (existing behavior)', () => {
		it('should continue to support X-ExtraFields header on create', async () => {
			const room = await createRoom({ roomName: 'post-header-test' }, undefined, { xExtraFields: 'config' });

			expect(room.config).toBeDefined();
		});

		it('should continue to support X-Fields header on create', async () => {
			const room = await createRoom({ roomName: 'post-xfields-test' }, undefined, { xFields: 'roomId,roomName' });

			expectValidRoomWithFields(room, ['roomId', 'roomName']);
		});

		it('should support both X-Fields and X-ExtraFields on create', async () => {
			const room = await createRoom({ roomName: 'post-both-test' }, undefined, {
				xFields: 'roomId',
				xExtraFields: 'config'
			});

			expectValidRoomWithFields(room, ['roomId', 'config']);
		});
	});
});

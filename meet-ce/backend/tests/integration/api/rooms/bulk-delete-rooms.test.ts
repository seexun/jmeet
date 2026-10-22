import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import {
	MeetingEndAction,
	MeetRoom,
	MeetRoomDeletionErrorCode,
	MeetRoomDeletionPolicyWithMeeting,
	MeetRoomDeletionPolicyWithRecordings,
	MeetRoomDeletionSuccessCode,
	MeetRoomStatus
} from '@openvidu-meet/typings';
import { expectExtraFieldsInResponse, expectValidRoom } from '../../../helpers/assertion-helpers.js';
import { disconnectFakeParticipants } from '../../../helpers/livekit-cli-helpers.js';
import {
	bulkDeleteRooms,
	createRoom,
	deleteAllRecordings,
	deleteAllRooms,
	endMeeting,
	startTestServer
} from '../../../helpers/request-helpers.js';
import { setupSingleRoom, setupSingleRoomWithRecording } from '../../../helpers/test-scenarios.js';
import { waitForAllRoomsToDelete, waitForRoomToClose } from '../../../helpers/wait-helpers.js';

describe('Room API Tests', () => {
	beforeAll(async () => {
		await startTestServer();
	});

	afterAll(async () => {
		await disconnectFakeParticipants();
		await deleteAllRooms();
		await deleteAllRecordings();
	});

	describe('Bulk Delete Room Tests', () => {
		it('should return 200 when all rooms are processed for deletion successfully', async () => {
			const { roomId } = await createRoom();

			const response = await bulkDeleteRooms([roomId]);
			await waitForAllRoomsToDelete([roomId]);
			expect(response.status).toBe(200);
			expect(response.body).toEqual({
				message: 'All rooms successfully processed for deletion',
				deleted: expect.arrayContaining([
					{
						roomId,
						successCode: MeetRoomDeletionSuccessCode.ROOM_DELETED,
						message: expect.any(String)
					}
				]),
				failed: []
			});
		});

		it('should return 400 when some rooms fail to process for deletion', async () => {
			const room1 = await createRoom();
			const { room: room2 } = await setupSingleRoom(true);

			const response = await bulkDeleteRooms([room1.roomId, room2.roomId]);
			await waitForAllRoomsToDelete([room1.roomId]);
			expect(response.status).toBe(400);
			expect(response.body).toEqual({
				message: '1 room(s) failed to process while deleting',
				deleted: expect.arrayContaining([
					{
						roomId: room1.roomId,
						successCode: MeetRoomDeletionSuccessCode.ROOM_DELETED,
						message: expect.any(String)
					}
				]),
				failed: expect.arrayContaining([
					{
						roomId: room2.roomId,
						error: MeetRoomDeletionErrorCode.ROOM_HAS_ACTIVE_MEETING,
						message: expect.any(String)
					}
				])
			});
		});

		it('should return 400 when all rooms fail to process for deletion', async () => {
			const { room } = await setupSingleRoom(true);

			const response = await bulkDeleteRooms([room.roomId]);
			expect(response.status).toBe(400);
			expect(response.body).toEqual({
				message: '1 room(s) failed to process while deleting',
				deleted: [],
				failed: expect.arrayContaining([
					{
						roomId: room.roomId,
						error: MeetRoomDeletionErrorCode.ROOM_HAS_ACTIVE_MEETING,
						message: expect.any(String)
					}
				])
			});
		});

		it('should successfully delete the room requesting the same roomId multiple times', async () => {
			const { roomId } = await createRoom();

			const response = await bulkDeleteRooms([roomId, roomId, roomId]);
			await waitForAllRoomsToDelete([roomId]);
			expect(response.status).toBe(200);
			expect(response.body).toEqual({
				message: 'All rooms successfully processed for deletion',
				deleted: expect.arrayContaining([
					{
						roomId,
						successCode: MeetRoomDeletionSuccessCode.ROOM_DELETED,
						message: expect.any(String)
					}
				]),
				failed: []
			});
		});

		it('should successfully delete valid roomIds while ignoring invalid ones', async () => {
			const { roomId } = await createRoom();

			const response = await bulkDeleteRooms([roomId, '!!@##$']);
			await waitForAllRoomsToDelete([roomId]);
			expect(response.status).toBe(200);
			expect(response.body).toEqual({
				message: 'All rooms successfully processed for deletion',
				deleted: expect.arrayContaining([
					{
						roomId,
						successCode: MeetRoomDeletionSuccessCode.ROOM_DELETED,
						message: expect.any(String)
					}
				]),
				failed: []
			});
		});

		it('should handle a large number of room IDs', async () => {
			// Create 20 rooms
			const rooms = await Promise.all(
				Array.from({ length: 20 }, (_, i) => createRoom({ roomName: `bulk-${i}` }))
			);

			const response = await bulkDeleteRooms(rooms.map((r) => r.roomId));
			expect(response.status).toBe(200);
			expect(response.body).toEqual({
				message: 'All rooms successfully processed for deletion',
				deleted: expect.arrayContaining(
					rooms.map((room) => ({
						roomId: room.roomId,
						successCode: MeetRoomDeletionSuccessCode.ROOM_DELETED,
						message: expect.any(String)
					}))
				),
				failed: []
			});

			// Verify all rooms are deleted
			await waitForAllRoomsToDelete(rooms.map((r) => r.roomId));
		});

		it('should handle deletion when specifying withMeeting and withRecordings parameters', async () => {
			const [
				room1,
				{ room: room2, moderatorToken: modToken2 },
				{ room: room3, moderatorToken: modToken3 },
				{ room: room4, moderatorToken: modToken4 }
			] = await Promise.all([
				createRoom(), // Room without active meeting or recordings
				setupSingleRoom(true), // Room with active meeting
				setupSingleRoomWithRecording(true), // Room with active meeting and recordings
				setupSingleRoomWithRecording(true) // Room with recordings
			]);
			await endMeeting(room4.roomId, modToken4); // End meeting for room4 so it has recordings but no active meeting
			const fakeRoomId = 'fake_room-123'; // Non-existing room
			const response = await bulkDeleteRooms(
				[room1.roomId, room2.roomId, room3.roomId, room4.roomId, fakeRoomId],
				MeetRoomDeletionPolicyWithMeeting.WHEN_MEETING_ENDS,
				MeetRoomDeletionPolicyWithRecordings.CLOSE
			);

			// Room 3 and Room 2 are scheduled to be closed, so we need to wait for the meeting to end before asserting the response
			await waitForAllRoomsToDelete([room1.roomId]);
			await waitForRoomToClose(room4.roomId); // Room 4 should be CLOSED
			expect(response.status).toBe(400);
			expect(response.body).toEqual({
				message: '1 room(s) failed to process while deleting',
				deleted: expect.arrayContaining([
					{
						roomId: room1.roomId,
						successCode: MeetRoomDeletionSuccessCode.ROOM_DELETED,
						message: expect.any(String)
					},
					{
						roomId: room2.roomId,
						successCode: MeetRoomDeletionSuccessCode.ROOM_WITH_ACTIVE_MEETING_SCHEDULED_TO_BE_DELETED,
						message: expect.any(String),
						room: expect.any(Object)
					},
					{
						roomId: room3.roomId,
						successCode: MeetRoomDeletionSuccessCode.ROOM_WITH_ACTIVE_MEETING_SCHEDULED_TO_BE_CLOSED,
						message: expect.any(String),
						room: expect.any(Object)
					},
					{
						roomId: room4.roomId,
						successCode: MeetRoomDeletionSuccessCode.ROOM_CLOSED,
						message: expect.any(String),
						room: expect.any(Object)
					}
				]),
				failed: expect.arrayContaining([
					{
						roomId: fakeRoomId,
						error: 'Room Error',
						message: expect.stringContaining('does not exist')
					}
				])
			});

			// Check successful rooms properties
			const successfulRoom2 = response.body.deleted.find(
				(s: { roomId: string; successCode: MeetRoomDeletionSuccessCode; message: string; room?: MeetRoom }) =>
					s.room?.roomId === room2.roomId
			);
			expectValidRoom(
				successfulRoom2.room,
				successfulRoom2.room.roomName,
				undefined,
				undefined,
				undefined,
				undefined,
				MeetRoomStatus.ACTIVE_MEETING,
				MeetingEndAction.DELETE
			);
			expectExtraFieldsInResponse(successfulRoom2.room);
			const successfulRoom3 = response.body.deleted.find(
				(r: { roomId: string; successCode: MeetRoomDeletionSuccessCode; message: string; room?: MeetRoom }) =>
					r.room?.roomId === room3.roomId
			);
			expectValidRoom(
				successfulRoom3.room,
				successfulRoom3.room.roomName,
				undefined,
				undefined,
				undefined,
				undefined,
				MeetRoomStatus.ACTIVE_MEETING,
				MeetingEndAction.CLOSE
			);
			expectExtraFieldsInResponse(successfulRoom3.room);

			const successfulRoom4 = response.body.deleted.find(
				(r: { roomId: string; successCode: MeetRoomDeletionSuccessCode; message: string; room?: MeetRoom }) =>
					r.room?.roomId === room4.roomId
			);
			expectValidRoom(
				successfulRoom4.room,
				successfulRoom4.room.roomName,
				undefined,
				undefined,
				undefined,
				undefined,
				MeetRoomStatus.CLOSED,
				MeetingEndAction.NONE
			);
			expectExtraFieldsInResponse(successfulRoom4.room);

			await endMeeting(room2.roomId, modToken2);
			await endMeeting(room3.roomId, modToken3);

			await waitForAllRoomsToDelete([room2.roomId]);
			await waitForRoomToClose(room3.roomId); // Room 3 should be CLOSED
		});

		it('should return partial room properties based on fields parameter when some rooms fail due to active meetings', async () => {
			// Create a room with an active meeting that will be scheduled for deletion
			const { room: roomWithMeeting } = await setupSingleRoom(true);

			// Create a room without an active meeting that will be deleted immediately
			const { room: roomWithoutMeeting } = await setupSingleRoom(false);

			// Attempt to bulk delete both rooms with specific fields using query params
			const response = await bulkDeleteRooms(
				[roomWithMeeting.roomId, roomWithoutMeeting.roomId],
				MeetRoomDeletionPolicyWithMeeting.WHEN_MEETING_ENDS,
				MeetRoomDeletionPolicyWithRecordings.FAIL,
				['roomId', 'roomName'] // fields query param
			);

			expect(response.status).toBe(200);
			expect(response.body.deleted).toHaveLength(2);

			// Find the room with meeting (should have room object in response)
			const scheduledRoom = response.body.deleted.find(
				(s: { roomId: string; room?: MeetRoom }) => s.roomId === roomWithMeeting.roomId
			);

			expect(scheduledRoom).toBeDefined();
			expect(scheduledRoom.room).toBeDefined();
			expect(scheduledRoom.successCode).toBe(
				MeetRoomDeletionSuccessCode.ROOM_WITH_ACTIVE_MEETING_SCHEDULED_TO_BE_DELETED
			);

			// Verify only requested fields are present
			expect(Object.keys(scheduledRoom.room)).toHaveLength(3); // roomId, roomName, and _extraFields
			expect(scheduledRoom.room.roomId).toBe(roomWithMeeting.roomId);
			expect(scheduledRoom.room.roomName).toBeDefined();

			// Find the room without meeting (should NOT have room object)
			const deletedRoom = response.body.deleted.find(
				(s: { roomId: string; room?: MeetRoom }) => s.roomId === roomWithoutMeeting.roomId
			);

			expect(deletedRoom).toBeDefined();
			expect(deletedRoom.room).toBeUndefined();
			expect(deletedRoom.successCode).toBe(MeetRoomDeletionSuccessCode.ROOM_DELETED);
		});
		it('should return partial room properties based on fields header when some rooms fail due to active meetings', async () => {
			// Create a room with an active meeting that will be scheduled for deletion
			const { room: roomWithMeeting } = await setupSingleRoom(true);

			// Create a room without an active meeting
			const { room: roomWithoutMeeting } = await setupSingleRoom(false);

			// Attempt to bulk delete both rooms with specific fields using X-Fields header
			const response = await bulkDeleteRooms(
				[roomWithMeeting.roomId, roomWithoutMeeting.roomId],
				MeetRoomDeletionPolicyWithMeeting.WHEN_MEETING_ENDS,
				MeetRoomDeletionPolicyWithRecordings.FAIL,
				undefined, // no query param fields
				undefined, // no query param extraFields
				{ xFields: 'roomId' } // X-Fields header
			);

			expect(response.status).toBe(200);
			expect(response.body.deleted).toHaveLength(2);

			// Find the room with meeting (should have room object in response)
			const scheduledRoom = response.body.deleted.find(
				(s: { roomId: string; room?: MeetRoom }) => s.roomId === roomWithMeeting.roomId
			);

			expect(scheduledRoom).toBeDefined();
			expect(scheduledRoom.room).toBeDefined();

			// Verify only requested fields are present
			expect(Object.keys(scheduledRoom.room)).toHaveLength(2); // roomId and _extraFields
			expect(scheduledRoom.room.roomId).toBe(roomWithMeeting.roomId);
			expectExtraFieldsInResponse(scheduledRoom.room);
		});
		it('should return partial room properties based on extraFields parameter when some rooms fail due to active meetings', async () => {
			// Create a room with an active meeting that will be scheduled for deletion
			const { room: roomWithMeeting } = await setupSingleRoom(true);

			// Create a room without an active meeting
			const { room: roomWithoutMeeting } = await setupSingleRoom(false);

			// Attempt to bulk delete both rooms with specific extraFields using query params
			const response = await bulkDeleteRooms(
				[roomWithMeeting.roomId, roomWithoutMeeting.roomId],
				MeetRoomDeletionPolicyWithMeeting.WHEN_MEETING_ENDS,
				MeetRoomDeletionPolicyWithRecordings.FAIL,
				undefined, // no fields param
				['config'] // extraFields query param
			);

			expect(response.status).toBe(200);
			expect(response.body.deleted).toHaveLength(2);

			// Find the room with meeting (should have room object in response)
			const scheduledRoom = response.body.deleted.find(
				(s: { roomId: string; room?: MeetRoom }) => s.roomId === roomWithMeeting.roomId
			);

			expect(scheduledRoom).toBeDefined();
			expect(scheduledRoom.room).toBeDefined();

			// Verify requested extra field is present, while the non-requested 'roles' extra field is excluded
			expect(scheduledRoom.room.config).toBeDefined();
			expect(scheduledRoom.room.roles).toBeUndefined();
			// Base fields should still be present (all base fields returned when no fields param)
			expect(scheduledRoom.room.roomId).toBe(roomWithMeeting.roomId);
			expect(scheduledRoom.room.roomName).toBeDefined();
			expect(scheduledRoom.room.status).toBe(MeetRoomStatus.ACTIVE_MEETING);
			expectExtraFieldsInResponse(scheduledRoom.room);
		});
		it('should return partial room properties based on extraFields header when some rooms fail due to active meetings', async () => {
			// Create a room with an active meeting that will be scheduled for deletion
			const { room: roomWithMeeting } = await setupSingleRoom(true);

			// Create a room without an active meeting
			const { room: roomWithoutMeeting } = await setupSingleRoom(false);

			// Attempt to bulk delete both rooms with specific extraFields using X-ExtraFields header
			const response = await bulkDeleteRooms(
				[roomWithMeeting.roomId, roomWithoutMeeting.roomId],
				MeetRoomDeletionPolicyWithMeeting.WHEN_MEETING_ENDS,
				MeetRoomDeletionPolicyWithRecordings.FAIL,
				undefined, // no query param fields
				undefined, // no query param extraFields
				{ xExtraFields: 'config' } // X-ExtraFields header
			);

			expect(response.status).toBe(200);
			expect(response.body.deleted).toHaveLength(2);

			// Find the room with meeting (should have room object in response)
			const scheduledRoom = response.body.deleted.find(
				(s: { roomId: string; room?: MeetRoom }) => s.roomId === roomWithMeeting.roomId
			);

			expect(scheduledRoom).toBeDefined();
			expect(scheduledRoom.room).toBeDefined();

			// Verify config extra field is present
			expect(scheduledRoom.room.config).toBeDefined();
			// All base fields should be present (no fields param)
			expect(scheduledRoom.room.roomId).toBe(roomWithMeeting.roomId);
			expect(scheduledRoom.room.roomName).toBeDefined();
			expect(scheduledRoom.room.status).toBe(MeetRoomStatus.ACTIVE_MEETING);
			expectExtraFieldsInResponse(scheduledRoom.room);
		});

		it('should return partial room properties based on fields and extraFields parameters when some rooms fail due to active meetings', async () => {
			// This test will verify that when some rooms fail to delete due to active meetings, the response includes the room details with the correct fields based on the fields and extraFields query parameters.

			// Create a room with an active meeting that will be scheduled for deletion
			const { room: roomWithMeeting } = await setupSingleRoom(true);

			// Create a room without an active meeting
			const { room: roomWithoutMeeting } = await setupSingleRoom(false);

			// Attempt to bulk delete both rooms with specific fields and extraFields using query params
			const response = await bulkDeleteRooms(
				[roomWithMeeting.roomId, roomWithoutMeeting.roomId],
				MeetRoomDeletionPolicyWithMeeting.WHEN_MEETING_ENDS,
				MeetRoomDeletionPolicyWithRecordings.FAIL,
				['roomId', 'roomName', 'status'], // fields query param
				['config'] // extraFields query param
			);

			expect(response.status).toBe(200);
			expect(response.body.deleted).toHaveLength(2);

			// Find the room with meeting (should have room object in response)
			const scheduledRoom = response.body.deleted.find(
				(s: { roomId: string; room?: MeetRoom }) => s.roomId === roomWithMeeting.roomId
			);

			expect(scheduledRoom).toBeDefined();
			expect(scheduledRoom.room).toBeDefined();
			expect(scheduledRoom.successCode).toBe(
				MeetRoomDeletionSuccessCode.ROOM_WITH_ACTIVE_MEETING_SCHEDULED_TO_BE_DELETED
			);

			// Verify only requested base fields are present
			expect(Object.keys(scheduledRoom.room)).toHaveLength(5); // roomId, roomName, status, config and _extraFields
			expect(scheduledRoom.room.roomId).toBe(roomWithMeeting.roomId);
			expect(scheduledRoom.room.roomName).toBeDefined();
			expect(scheduledRoom.room.status).toBe(MeetRoomStatus.ACTIVE_MEETING);

			// Verify requested extra field is present
			expect(scheduledRoom.room.config).toBeDefined();

			expectExtraFieldsInResponse(scheduledRoom.room);

			// Find the room without meeting (should NOT have room object)
			const deletedRoom = response.body.deleted.find(
				(s: { roomId: string; room?: MeetRoom }) => s.roomId === roomWithoutMeeting.roomId
			);

			expect(deletedRoom).toBeDefined();
			expect(deletedRoom.room).toBeUndefined();
			expect(deletedRoom.successCode).toBe(MeetRoomDeletionSuccessCode.ROOM_DELETED);
		});

		it('should return partial room properties based on fields and extraFields headers when some rooms fail due to active meetings', async () => {
			// This test will verify that when some rooms fail to delete due to active meetings, the response includes the room details with the correct fields based on the fields and extraFields headers.

			// Create a room with an active meeting
			const { room: roomWithMeeting } = await setupSingleRoom(true);

			// Create a room without an active meeting
			const { room: roomWithoutMeeting } = await setupSingleRoom(false);

			// Attempt to bulk delete both rooms with specific fields and extraFields using headers
			const response = await bulkDeleteRooms(
				[roomWithMeeting.roomId, roomWithoutMeeting.roomId],
				MeetRoomDeletionPolicyWithMeeting.WHEN_MEETING_ENDS,
				MeetRoomDeletionPolicyWithRecordings.FAIL,
				undefined, // no query param fields
				undefined, // no query param extraFields
				{
					xFields: 'roomId,roomName', // X-Fields header
					xExtraFields: 'config,roles' // X-ExtraFields header
				}
			);

			expect(response.status).toBe(200);
			expect(response.body.deleted).toHaveLength(2);

			// Find the room with meeting (should have room object in response)
			const scheduledRoom = response.body.deleted.find(
				(s: { roomId: string; room?: MeetRoom }) => s.roomId === roomWithMeeting.roomId
			);

			console.log('Scheduled Room Response:', scheduledRoom.room);
			expect(scheduledRoom).toBeDefined();
			expect(scheduledRoom.room).toBeDefined();
			expect(scheduledRoom.successCode).toBe(
				MeetRoomDeletionSuccessCode.ROOM_WITH_ACTIVE_MEETING_SCHEDULED_TO_BE_DELETED
			);

			// Verify only requested base fields are present
			expect(Object.keys(scheduledRoom.room)).toHaveLength(5); // roomId, roomName, config, roles and _extraFields
			expect(scheduledRoom.room.roomId).toBe(roomWithMeeting.roomId);
			expect(scheduledRoom.room.roomName).toBeDefined();

			// Verify requested extra fields are present
			expect(scheduledRoom.room.config).toBeDefined();

			expectExtraFieldsInResponse(scheduledRoom.room);

			// Find the room without meeting (should NOT have room object)
			const deletedRoom = response.body.deleted.find(
				(s: { roomId: string; room?: MeetRoom }) => s.roomId === roomWithoutMeeting.roomId
			);

			expect(deletedRoom).toBeDefined();
			expect(deletedRoom.room).toBeUndefined();
			expect(deletedRoom.successCode).toBe(MeetRoomDeletionSuccessCode.ROOM_DELETED);
		});
	});

	describe('Bulk delete Room Validation failures', () => {
		it('should handle empty roomIds array (no rooms deleted)', async () => {
			const response = await bulkDeleteRooms([]);

			expect(response.status).toBe(422);
			expect(response.body.error).toContain('Unprocessable Entity');
			expect(JSON.stringify(response.body.details)).toContain(
				'At least one valid roomId is required after sanitization'
			);
		});
		it('should fail when roomIds contains an ID that becomes empty after sanitization', async () => {
			const response = await bulkDeleteRooms([',,,,']);

			expect(response.status).toBe(422);

			expect(response.body.error).toContain('Unprocessable Entity');
			expect(JSON.stringify(response.body.details)).toContain(
				'At least one valid roomId is required after sanitization'
			);
		});

		it('should validate roomIds and return 422 when all are invalid', async () => {
			const response = await bulkDeleteRooms(['!!@##$', '!!@##$', ',', '.,}{¡$#<+']);

			expect(response.status).toBe(422);
			expect(response.body.error).toContain('Unprocessable Entity');
			expect(JSON.stringify(response.body.details)).toContain(
				'At least one valid roomId is required after sanitization'
			);
		});

		it('should fail when withMeeting parameter is invalid', async () => {
			const response = await bulkDeleteRooms(['testRoom'], 'invalid_value');

			expect(response.status).toBe(422);
			expect(response.body.error).toContain('Unprocessable Entity');
			expect(JSON.stringify(response.body.details)).toContain('Invalid enum value');
		});

		it('should fail when withRecordings parameter is invalid', async () => {
			const response = await bulkDeleteRooms(['testRoom'], 'force', 'invalid_value');

			expect(response.status).toBe(422);
			expect(response.body.error).toContain('Unprocessable Entity');
			expect(JSON.stringify(response.body.details)).toContain('Invalid enum value');
		});
	});
});

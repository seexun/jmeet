import { afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import { MeetRoomMemberRole, MeetRoomRolesConfig } from '@openvidu-meet/typings';
import { MeetRecordingModel } from '../../../../src/models/mongoose-schemas/recording.schema.js';
import { expectValidationError } from '../../../helpers/assertion-helpers.js';
import { disconnectFakeParticipants } from '../../../helpers/livekit-cli-helpers.js';
import {
	createRoom,
	createRoomMember,
	deleteAllRecordings,
	deleteAllRooms,
	getRoom,
	getRoomMember,
	startTestServer,
	updateRoomRoles
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

	describe('Update Room Roles Tests', () => {
		it('should successfully fully update room roles permissions', async () => {
			const createdRoom = await createRoom({ roomName: 'update-roles-test' });

			const updatedRoles = {
				moderator: {
					permissions: {
						canRecord: false,
						canRetrieveRecordings: true,
						canDeleteRecordings: true,
						canJoinMeeting: true,
						canShareAccessLinks: false,
						canMakeModerator: false,
						canKickParticipants: true,
						canEndMeeting: true,
						canPublishVideo: true,
						canPublishAudio: true,
						canShareScreen: false,
						canReadChat: true,
						canWriteChat: false,
						canChangeVirtualBackground: true
					}
				},
				speaker: {
					permissions: {
						canRecord: true,
						canRetrieveRecordings: true,
						canDeleteRecordings: true,
						canJoinMeeting: true,
						canShareAccessLinks: true,
						canMakeModerator: true,
						canKickParticipants: true,
						canEndMeeting: true,
						canPublishVideo: false,
						canPublishAudio: false,
						canShareScreen: false,
						canReadChat: false,
						canWriteChat: false,
						canChangeVirtualBackground: true
					}
				}
			};

			const updateResponse = await updateRoomRoles(createdRoom.roomId, updatedRoles);
			expect(updateResponse.status).toBe(200);
			expect(updateResponse.body).toMatchObject(updatedRoles);

			const getResponse = await getRoom(createdRoom.roomId, undefined, 'roles');
			expect(getResponse.status).toBe(200);
			expect(getResponse.body.roles).toMatchObject(updatedRoles);
		});

		it('should successfully partially update room roles permissions', async () => {
			const createdRoom = await createRoom({ roomName: 'update-roles-test' });

			const updatedRoles = {
				moderator: {
					permissions: {
						canRecord: false,
						canKickParticipants: false,
						canDeleteRecordings: false
					}
				},
				speaker: {
					permissions: {
						canRetrieveRecordings: false,
						canWriteChat: false
					}
				}
			};

			const updateResponse = await updateRoomRoles(createdRoom.roomId, updatedRoles);
			expect(updateResponse.status).toBe(200);
			expect(updateResponse.body).toMatchObject(updatedRoles);

			const getResponse = await getRoom(createdRoom.roomId, undefined, 'roles');
			expect(getResponse.status).toBe(200);
			expect(getResponse.body.roles).toMatchObject(updatedRoles);
		});

		it('should allow fully updating all permissions for a single role', async () => {
			const createdRoom = await createRoom({ roomName: 'partial-roles-update-test' }, undefined, {
				xExtraFields: 'roles'
			});

			const partialRoles = {
				speaker: {
					permissions: {
						canRecord: true,
						canRetrieveRecordings: true,
						canDeleteRecordings: true,
						canJoinMeeting: true,
						canShareAccessLinks: true,
						canMakeModerator: true,
						canKickParticipants: true,
						canEndMeeting: true,
						canPublishVideo: false,
						canPublishAudio: false,
						canShareScreen: false,
						canReadChat: false,
						canWriteChat: false,
						canChangeVirtualBackground: true
					}
				}
			};

			const updateResponse = await updateRoomRoles(createdRoom.roomId, partialRoles);
			expect(updateResponse.status).toBe(200);

			const getResponse = await getRoom(createdRoom.roomId, undefined, 'roles');
			expect(getResponse.status).toBe(200);
			expect(getResponse.body.roles.speaker.permissions).toMatchObject(partialRoles.speaker.permissions);
			expect(getResponse.body.roles.moderator.permissions).toMatchObject(
				createdRoom.roles.moderator.permissions as unknown as Record<string, boolean>
			);
		});

		it('should allow partially updating permissions for a single role while preserving other permissions', async () => {
			const createdRoom = await createRoom({ roomName: 'partial-roles-update-test' }, undefined, {
				xExtraFields: 'roles'
			});

			const partialRoles = {
				speaker: {
					permissions: {
						canWriteChat: false
					}
				}
			};

			const updateResponse = await updateRoomRoles(createdRoom.roomId, partialRoles);
			expect(updateResponse.status).toBe(200);

			const getResponse = await getRoom(createdRoom.roomId, undefined, 'roles');
			expect(getResponse.status).toBe(200);
			expect(getResponse.body.roles.speaker.permissions.canWriteChat).toBe(false);
			expect(getResponse.body.roles.moderator.permissions).toMatchObject(
				createdRoom.roles.moderator.permissions as unknown as Record<string, boolean>
			);
		});

		it('should update recording roomUserAccess when speaker canRetrieveRecordings permission changes', async () => {
			// Create room with user access enabled and canRetrieveRecordings permission enabled for speakers
			const room = await createRoom({
				access: {
					user: {
						enabled: true
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

			// Verify initial recording roomUserAccess is true
			let recording = await MeetRecordingModel.findOne({ recordingId }, 'roomUserAccess').lean().exec();
			expect(recording).toBeTruthy();
			expect(recording?.roomUserAccess).toBe(true);

			// Update canRetrieveRecordings permission for speakers to false
			const updateResponse = await updateRoomRoles(room.roomId, {
				speaker: {
					permissions: {
						canRetrieveRecordings: false
					}
				}
			});
			expect(updateResponse.status).toBe(200);

			// Verify the recording's roomUserAccess has been updated to false
			recording = await MeetRecordingModel.findOne({ recordingId }, 'roomUserAccess').lean().exec();
			expect(recording).toBeTruthy();
			expect(recording?.roomUserAccess).toBe(false);
		});

		it('should not update recording roomUserAccess when canRetrieveRecordings permission changes but user access is disabled', async () => {
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

			// Update canRetrieveRecordings permission for speakers to true
			const updateResponse = await updateRoomRoles(room.roomId, {
				speaker: {
					permissions: {
						canRetrieveRecordings: true
					}
				}
			});
			expect(updateResponse.status).toBe(200);

			// Verify the recording's roomUserAccess has not been updated (remains false)
			recording = await MeetRecordingModel.findOne({ recordingId }, 'roomUserAccess').lean().exec();
			expect(recording).toBeTruthy();
			expect(recording?.roomUserAccess).toBe(false);
		});

		it('should update speaker members effectivePermissions when speaker base role changes', async () => {
			// Create a room and add two members with speaker role and one member with moderator role
			const room = await createRoom();

			let memberResponse = await createRoomMember(room.roomId, {
				name: 'Member 1',
				baseRole: MeetRoomMemberRole.SPEAKER
			});
			expect(memberResponse.status).toBe(201);
			const memberId1 = memberResponse.body.memberId;

			memberResponse = await createRoomMember(room.roomId, {
				name: 'Member 2',
				baseRole: MeetRoomMemberRole.SPEAKER,
				customPermissions: {
					canWriteChat: true
				}
			});
			expect(memberResponse.status).toBe(201);
			const memberId2 = memberResponse.body.memberId;

			memberResponse = await createRoomMember(room.roomId, {
				name: 'Member 3',
				baseRole: MeetRoomMemberRole.MODERATOR
			});
			expect(memberResponse.status).toBe(201);
			const memberId3 = memberResponse.body.memberId;

			// Verify initial canWriteChat permission for all members is true
			let beforeResponse = await getRoomMember(room.roomId, memberId1);
			expect(beforeResponse.status).toBe(200);
			expect(beforeResponse.body.effectivePermissions.canWriteChat).toBe(true);

			beforeResponse = await getRoomMember(room.roomId, memberId2);
			expect(beforeResponse.status).toBe(200);
			expect(beforeResponse.body.effectivePermissions.canWriteChat).toBe(true);

			beforeResponse = await getRoomMember(room.roomId, memberId3);
			expect(beforeResponse.status).toBe(200);
			expect(beforeResponse.body.effectivePermissions.canWriteChat).toBe(true);

			// Update canWriteChat permission for speaker role to false
			const updateResponse = await updateRoomRoles(room.roomId, {
				speaker: {
					permissions: {
						canWriteChat: false
					}
				}
			});
			expect(updateResponse.status).toBe(200);

			// Verify the speaker members' effectivePermissions have been updated to reflect the new role permissions,
			// while moderator member's permissions remain unchanged
			let afterResponse = await getRoomMember(room.roomId, memberId1);
			expect(afterResponse.status).toBe(200);
			expect(afterResponse.body.effectivePermissions.canWriteChat).toBe(false);

			afterResponse = await getRoomMember(room.roomId, memberId2);
			expect(afterResponse.status).toBe(200);
			expect(afterResponse.body.effectivePermissions.canWriteChat).toBe(true); // custom permission should override role permission

			afterResponse = await getRoomMember(room.roomId, memberId3);
			expect(afterResponse.status).toBe(200);
			expect(afterResponse.body.effectivePermissions.canWriteChat).toBe(true);
		});

		it('should update moderator members effectivePermissions when moderator base role changes', async () => {
			// Create a room and add two members with moderator role and one member with speaker role
			const room = await createRoom();

			let memberResponse = await createRoomMember(room.roomId, {
				name: 'Member 1',
				baseRole: MeetRoomMemberRole.MODERATOR
			});
			expect(memberResponse.status).toBe(201);
			const memberId1 = memberResponse.body.memberId;

			memberResponse = await createRoomMember(room.roomId, {
				name: 'Member 2',
				baseRole: MeetRoomMemberRole.MODERATOR,
				customPermissions: {
					canKickParticipants: true
				}
			});
			expect(memberResponse.status).toBe(201);
			const memberId2 = memberResponse.body.memberId;

			memberResponse = await createRoomMember(room.roomId, {
				name: 'Member 3',
				baseRole: MeetRoomMemberRole.SPEAKER
			});
			expect(memberResponse.status).toBe(201);
			const memberId3 = memberResponse.body.memberId;

			// Verify initial canKickParticipants permission for all members is true
			let beforeResponse = await getRoomMember(room.roomId, memberId1);
			expect(beforeResponse.status).toBe(200);
			expect(beforeResponse.body.effectivePermissions.canKickParticipants).toBe(true);

			beforeResponse = await getRoomMember(room.roomId, memberId2);
			expect(beforeResponse.status).toBe(200);
			expect(beforeResponse.body.effectivePermissions.canKickParticipants).toBe(true);

			beforeResponse = await getRoomMember(room.roomId, memberId3);
			expect(beforeResponse.status).toBe(200);
			expect(beforeResponse.body.effectivePermissions.canKickParticipants).toBe(false);

			// Update canKickParticipants permission for moderator role to false
			const updateResponse = await updateRoomRoles(room.roomId, {
				moderator: {
					permissions: {
						canKickParticipants: false
					}
				}
			});
			expect(updateResponse.status).toBe(200);

			// Verify the moderator members' effectivePermissions have been updated to reflect the new role permissions,
			// while speaker member's permissions remain unchanged
			let afterResponse = await getRoomMember(room.roomId, memberId1);
			expect(afterResponse.status).toBe(200);
			expect(afterResponse.body.effectivePermissions.canKickParticipants).toBe(false);

			afterResponse = await getRoomMember(room.roomId, memberId2);
			expect(afterResponse.status).toBe(200);
			expect(afterResponse.body.effectivePermissions.canKickParticipants).toBe(true); // custom permission should override role permission

			afterResponse = await getRoomMember(room.roomId, memberId3);
			expect(afterResponse.status).toBe(200);
			expect(afterResponse.body.effectivePermissions.canKickParticipants).toBe(false);
		});

		it('should reject room roles update when there is an active meeting', async () => {
			const roomData = await setupSingleRoom(true);

			const response = await updateRoomRoles(roomData.room.roomId, {
				speaker: {
					permissions: {
						canWriteChat: false
					}
				}
			});

			expect(response.status).toBe(409);
			expect(response.body.error).toBe('Room Error');
			expect(response.body.message).toContain(`Room '${roomData.room.roomId}' has an active meeting`);
		});

		it('should return 404 when updating roles for non-existent room', async () => {
			const nonExistentRoomId = 'non-existent-room';

			const response = await updateRoomRoles(nonExistentRoomId, {
				speaker: {
					permissions: {
						canWriteChat: false
					}
				}
			});

			expect(response.status).toBe(404);
			expect(response.body.message).toContain(`'${nonExistentRoomId}' does not exist`);
		});
	});

	describe('Update Room Roles Validation failures', () => {
		it('should fail when roles permission has incorrect type', async () => {
			const createdRoom = await createRoom({ roomName: 'invalid-roles-types' });

			const invalidRoles = {
				moderator: {
					permissions: {
						canRecord: 'true'
					}
				}
			};

			const response = await updateRoomRoles(createdRoom.roomId, invalidRoles as unknown as MeetRoomRolesConfig);
			expectValidationError(response, 'roles.moderator.permissions.canRecord', 'Expected boolean');
		});

		it('should fail when roles object is missing', async () => {
			const createdRoom = await createRoom({ roomName: 'missing-roles-object' });

			const response = await updateRoomRoles(createdRoom.roomId, undefined as unknown as MeetRoomRolesConfig);
			expectValidationError(response, 'roles', 'Required');
		});
	});
});

import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import {
	MeetRoomMember,
	MeetRoomMemberRole,
	MeetRoomRoles,
	MeetSignalType,
	MeetUserRole
} from '@openvidu-meet/typings';
import { container } from '../../../../src/config/dependency-injector.config.js';
import { OpenViduMeetError } from '../../../../src/models/error.model.js';
import { FrontendEventService } from '../../../../src/services/frontend-event.service.js';
import { LiveKitService } from '../../../../src/services/livekit.service.js';
import { expectValidationError } from '../../../helpers/assertion-helpers.js';
import { disconnectFakeParticipants, joinFakeParticipant } from '../../../helpers/livekit-cli-helpers.js';
import {
	createRoom,
	createRoomMember,
	createUser,
	deleteAllRooms,
	deleteAllUsers,
	getRoomMember,
	sleep,
	startTestServer,
	updateRoomMember
} from '../../../helpers/request-helpers.js';

describe('Room Members API Tests', () => {
	let roomId: string;
	let roomRoles: MeetRoomRoles;

	beforeAll(async () => {
		await startTestServer();

		const room = await createRoom({}, undefined, { xExtraFields: 'roles' });
		roomId = room.roomId;
		roomRoles = room.roles;
	});

	afterAll(async () => {
		await disconnectFakeParticipants();
		await deleteAllRooms();
		await deleteAllUsers();
	});

	describe('Update Room Member Tests', () => {
		it('should successfully update baseRole from SPEAKER to MODERATOR', async () => {
			// Create a member with SPEAKER role
			const createResponse = await createRoomMember(roomId, {
				name: 'Test Member',
				baseRole: MeetRoomMemberRole.SPEAKER
			});
			const memberId = createResponse.body.memberId;

			// Update to MODERATOR
			const response = await updateRoomMember(roomId, memberId, {
				baseRole: MeetRoomMemberRole.MODERATOR
			});
			expect(response.status).toBe(200);

			expect(response.body).toHaveProperty('baseRole', MeetRoomMemberRole.MODERATOR);
			expect(response.body.effectivePermissions).toEqual(roomRoles.moderator.permissions);
		});

		it('should successfully update baseRole from MODERATOR to SPEAKER', async () => {
			// Create a member with MODERATOR role
			const createResponse = await createRoomMember(roomId, {
				name: 'Test Member',
				baseRole: MeetRoomMemberRole.MODERATOR
			});
			const memberId = createResponse.body.memberId;

			// Update to SPEAKER
			const response = await updateRoomMember(roomId, memberId, {
				baseRole: MeetRoomMemberRole.SPEAKER
			});
			expect(response.status).toBe(200);

			expect(response.body).toHaveProperty('baseRole', MeetRoomMemberRole.SPEAKER);
			expect(response.body.effectivePermissions).toEqual(roomRoles.speaker.permissions);
		});

		it('should exclude effectivePermissions by default and include it when requested via extraFields', async () => {
			// Create a member to update
			const createResponse = await createRoomMember(roomId, {
				name: 'Extra Fields Member',
				baseRole: MeetRoomMemberRole.SPEAKER
			});
			const memberId = createResponse.body.memberId;

			// Without extraFields, effectivePermissions must be excluded
			const defaultResponse = await updateRoomMember(
				roomId,
				memberId,
				{ baseRole: MeetRoomMemberRole.MODERATOR },
				'' // do not request any extra field
			);
			expect(defaultResponse.status).toBe(200);
			expect(defaultResponse.body).toHaveProperty('baseRole', MeetRoomMemberRole.MODERATOR);
			expect(defaultResponse.body).not.toHaveProperty('effectivePermissions');
			expect(defaultResponse.body._extraFields).toContain('effectivePermissions');

			// With extraFields=effectivePermissions, it must be included
			const withExtraResponse = await updateRoomMember(
				roomId,
				memberId,
				{ baseRole: MeetRoomMemberRole.SPEAKER },
				'effectivePermissions'
			);
			expect(withExtraResponse.status).toBe(200);
			expect(withExtraResponse.body).toHaveProperty('baseRole', MeetRoomMemberRole.SPEAKER);
			expect(withExtraResponse.body).toHaveProperty('effectivePermissions');
			expect(withExtraResponse.body.effectivePermissions).toEqual(roomRoles.speaker.permissions);
			expect(withExtraResponse.body._extraFields).toContain('effectivePermissions');
		});

		it('should successfully update customPermissions', async () => {
			// Create a member without custom permissions
			const createResponse = await createRoomMember(roomId, {
				name: 'Test Member',
				baseRole: MeetRoomMemberRole.SPEAKER
			});
			const memberId = createResponse.body.memberId;

			// Add custom permissions
			const response = await updateRoomMember(roomId, memberId, {
				customPermissions: {
					canRecord: true,
					canDeleteRecordings: true,
					canKickParticipants: true
				}
			});
			expect(response.status).toBe(200);

			expect(response.body).toHaveProperty('customPermissions');
			expect(response.body.customPermissions).toHaveProperty('canRecord', true);
			expect(response.body.customPermissions).toHaveProperty('canDeleteRecordings', true);
			expect(response.body.customPermissions).toHaveProperty('canKickParticipants', true);
			expect(response.body.effectivePermissions).toHaveProperty('canRecord', true);
			expect(response.body.effectivePermissions).toHaveProperty('canDeleteRecordings', true);
			expect(response.body.effectivePermissions).toHaveProperty('canKickParticipants', true);
		});

		it('should successfully update both baseRole and customPermissions', async () => {
			// Create a member
			const createResponse = await createRoomMember(roomId, {
				name: 'Test Member',
				baseRole: MeetRoomMemberRole.SPEAKER
			});
			const memberId = createResponse.body.memberId;

			// Update both
			const response = await updateRoomMember(roomId, memberId, {
				baseRole: MeetRoomMemberRole.MODERATOR,
				customPermissions: {
					canRecord: false // Override a permission
				}
			});
			expect(response.status).toBe(200);

			expect(response.body).toHaveProperty('baseRole', MeetRoomMemberRole.MODERATOR);
			expect(response.body.customPermissions).toHaveProperty('canRecord', false);
			expect(response.body.effectivePermissions).toHaveProperty('canRecord', false);
		});

		it('should override existing customPermissions with new ones', async () => {
			// Create a member with custom permissions
			const createResponse = await createRoomMember(roomId, {
				name: 'Test Member',
				baseRole: MeetRoomMemberRole.SPEAKER,
				customPermissions: {
					canRecord: true,
					canDeleteRecordings: true
				}
			});
			const memberId = createResponse.body.memberId;

			// Update with different custom permissions
			const response = await updateRoomMember(roomId, memberId, {
				customPermissions: {
					canKickParticipants: true,
					canEndMeeting: true
				}
			});
			expect(response.status).toBe(200);

			expect(response.body.customPermissions).toHaveProperty('canKickParticipants', true);
			expect(response.body.customPermissions).toHaveProperty('canEndMeeting', true);
			expect(response.body.customPermissions).not.toHaveProperty('canRecord');
			expect(response.body.customPermissions).not.toHaveProperty('canDeleteRecordings');
			expect(response.body.effectivePermissions).toHaveProperty('canKickParticipants', true);
			expect(response.body.effectivePermissions).toHaveProperty('canEndMeeting', true);
			expect(response.body.effectivePermissions).toHaveProperty('canRecord', false); // From base role
			expect(response.body.effectivePermissions).toHaveProperty('canDeleteRecordings', false); // From base role
		});

		it('should verify member update is persisted', async () => {
			// Create a member
			const createResponse = await createRoomMember(roomId, {
				name: 'Test Member',
				baseRole: MeetRoomMemberRole.SPEAKER
			});
			const memberId = createResponse.body.memberId;

			// Update member
			const updateResponse = await updateRoomMember(roomId, memberId, {
				baseRole: MeetRoomMemberRole.MODERATOR
			});
			expect(updateResponse.status).toBe(200);

			// Verify persistence
			const getResponse = await getRoomMember(roomId, memberId);
			expect(getResponse.status).toBe(200);
			expect(getResponse.body).toHaveProperty('baseRole', MeetRoomMemberRole.MODERATOR);
			expect(getResponse.body.effectivePermissions).toEqual(roomRoles.moderator.permissions);
		});

		it('should update permissionsUpdatedAt timestamp', async () => {
			// Create a member
			const createResponse = await createRoomMember(roomId, {
				name: 'Test Member',
				baseRole: MeetRoomMemberRole.SPEAKER
			});
			const memberId = createResponse.body.memberId;
			const originalTimestamp = createResponse.body.permissionsUpdatedAt;

			// Wait a bit to ensure timestamp difference
			await sleep('1s');

			// Update member
			const updateResponse = await updateRoomMember(roomId, memberId, {
				baseRole: MeetRoomMemberRole.MODERATOR
			});
			expect(updateResponse.status).toBe(200);
			expect(updateResponse.body.permissionsUpdatedAt).toBeGreaterThan(originalTimestamp);
		});

		it('should successfully update user room member', async () => {
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

			// Update member
			const response = await updateRoomMember(roomId, memberId, {
				baseRole: MeetRoomMemberRole.MODERATOR
			});
			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty('memberId', userId);
			expect(response.body).toHaveProperty('baseRole', MeetRoomMemberRole.MODERATOR);
		});

		it('should allow empty update body (no changes)', async () => {
			// Create a member
			const createResponse = await createRoomMember(roomId, {
				name: 'Test Member',
				baseRole: MeetRoomMemberRole.SPEAKER
			});
			const memberId = createResponse.body.memberId;

			// Update with empty body
			const response = await updateRoomMember(roomId, memberId, {});
			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty('baseRole', MeetRoomMemberRole.SPEAKER);
		});

		it('should fail when member does not exist', async () => {
			const response = await updateRoomMember(roomId, 'nonexistent_member_123', {
				baseRole: MeetRoomMemberRole.MODERATOR
			});
			expect(response.status).toBe(404);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('not found');
		});

		it('should fail when room does not exist', async () => {
			const response = await updateRoomMember('nonexistent_room_123', 'some_member_id', {
				baseRole: MeetRoomMemberRole.MODERATOR
			});
			expect(response.status).toBe(404);
			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('does not exist');
		});

		it('should kick participant from meeting when joinMeeting permission is removed', async () => {
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

			// Update room member to remove canJoinMeeting permission
			const response = await updateRoomMember(roomId, memberId, {
				customPermissions: {
					canJoinMeeting: false
				}
			});
			expect(response.status).toBe(200);
			expect(response.body.effectivePermissions.canJoinMeeting).toBe(false);

			// Check if the participant has been removed from LiveKit
			await expect(livekitService.getParticipant(roomId, participantIdentity)).rejects.toThrow(OpenViduMeetError);
		});

		it('should send permissions-updated signal when member permissions change and participant is in meeting', async () => {
			// Create a member
			const createResponse = await createRoomMember(roomId, {
				name: 'Test Member',
				baseRole: MeetRoomMemberRole.SPEAKER
			});
			const member = createResponse.body as MeetRoomMember;
			const memberId = member.memberId;

			// Join fake participant to the room to simulate real join
			const participantIdentity = memberId; // Participant identity is the same as memberId for members
			await joinFakeParticipant(roomId, memberId);

			const frontendEventService = container.get(FrontendEventService);
			const sendSignalSpy = jest.spyOn(frontendEventService as any, 'sendSignal');

			// Update room member permissions
			const response = await updateRoomMember(roomId, memberId, {
				customPermissions: {
					canRecord: true
				}
			});
			expect(response.status).toBe(200);

			expect(sendSignalSpy).toHaveBeenCalledTimes(1);
			expect(sendSignalSpy).toHaveBeenCalledWith(
				roomId,
				{
					roomId,
					participantIdentity: memberId,
					timestamp: expect.any(Number)
				},
				{
					topic: MeetSignalType.MEET_PARTICIPANT_PERMISSIONS_UPDATED,
					destinationIdentities: [participantIdentity]
				}
			);
		});
	});

	describe('Update Room Member Validation Tests', () => {
		let memberId: string;

		beforeAll(async () => {
			// Create a member
			const createResponse = await createRoomMember(roomId, {
				name: 'Test Member',
				baseRole: MeetRoomMemberRole.SPEAKER
			});
			memberId = createResponse.body.memberId;
		});

		it('should fail when baseRole is invalid', async () => {
			const response = await updateRoomMember(roomId, memberId, {
				baseRole: 'invalid' as MeetRoomMemberRole
			});
			expectValidationError(response, 'baseRole', 'Invalid enum value');
		});

		it('should fail when customPermissions has invalid boolean values', async () => {
			const response = await updateRoomMember(roomId, memberId, {
				customPermissions: {
					canRecord: 'not_a_boolean' as unknown as boolean
				}
			});
			expectValidationError(response, 'customPermissions.canRecord', 'Expected boolean');
		});
	});
});

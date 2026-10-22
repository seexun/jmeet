import { afterAll, afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import {
	MeetParticipantModerationAction,
	MeetRoomMember,
	MeetRoomMemberPermissions,
	MeetRoomMemberRole,
	MeetRoomMemberTokenMetadata,
	MeetRoomMemberUIBadge,
	MeetRoomRoles,
	MeetRoomStatus,
	MeetUserRole
} from '@openvidu-meet/typings';
import { container } from '../../../../src/config/dependency-injector.config.js';
import { LiveKitService } from '../../../../src/services/livekit.service.js';
import { TokenService } from '../../../../src/services/token.service.js';
import { expectValidationError, expectValidRoomMemberTokenResponse } from '../../../helpers/assertion-helpers.js';
import {
	disconnectFakeParticipants,
	joinFakeParticipant,
	updateParticipantMetadata
} from '../../../helpers/livekit-cli-helpers.js';
import {
	createRoom,
	createRoomMember,
	deleteAllRooms,
	deleteAllUsers,
	endMeeting,
	generateRoomMemberToken,
	generateRoomMemberTokenRequest,
	startTestServer,
	updateParticipant,
	updateRoomAccessConfig,
	updateRoomRoles,
	updateRoomStatus,
	updateUserRole
} from '../../../helpers/request-helpers.js';
import { setupSingleRoom, setupTestUsers, setupTestUsersForRoom, setupUser } from '../../../helpers/test-scenarios.js';
import { RoomData, RoomTestUsers, TestUsers } from '../../../interfaces/scenarios.js';

const allPermissions: MeetRoomMemberPermissions = {
	canRecord: true,
	canRetrieveRecordings: true,
	canDeleteRecordings: true,
	canJoinMeeting: true,
	canShareAccessLinks: true,
	canMakeModerator: true,
	canKickParticipants: true,
	canEndMeeting: true,
	canPublishVideo: true,
	canPublishAudio: true,
	canShareScreen: true,
	canReadChat: true,
	canWriteChat: true,
	canChangeVirtualBackground: true
};

const recordingReadOnlyPermissions: MeetRoomMemberPermissions = {
	canRecord: false,
	canRetrieveRecordings: true,
	canDeleteRecordings: false,
	canJoinMeeting: false,
	canShareAccessLinks: false,
	canMakeModerator: false,
	canKickParticipants: false,
	canEndMeeting: false,
	canPublishVideo: false,
	canPublishAudio: false,
	canShareScreen: false,
	canReadChat: false,
	canWriteChat: false,
	canChangeVirtualBackground: false
};

const noPermissions: MeetRoomMemberPermissions = {
	canRecord: false,
	canRetrieveRecordings: false,
	canDeleteRecordings: false,
	canJoinMeeting: false,
	canShareAccessLinks: false,
	canMakeModerator: false,
	canKickParticipants: false,
	canEndMeeting: false,
	canPublishVideo: false,
	canPublishAudio: false,
	canShareScreen: false,
	canReadChat: false,
	canWriteChat: false,
	canChangeVirtualBackground: false
};

const mergePermissions = (
	first: MeetRoomMemberPermissions,
	second: MeetRoomMemberPermissions
): MeetRoomMemberPermissions => {
	const merged = { ...noPermissions };

	for (const key of Object.keys(merged) as Array<keyof MeetRoomMemberPermissions>) {
		merged[key] = first[key] || second[key];
	}

	return merged;
};

describe('Room Members API Tests', () => {
	let roomData: RoomData;
	let roomId: string;
	let roomRoles: MeetRoomRoles;

	let roomUsers: RoomTestUsers;
	let testUsers: TestUsers;

	let tokenService: TokenService;
	let livekitService: LiveKitService;

	const getRawToken = (token: string) => token.replace(/^Bearer\s+/i, '');

	beforeAll(async () => {
		await startTestServer();
		tokenService = container.get(TokenService);
		livekitService = container.get(LiveKitService);

		roomData = await setupSingleRoom();
		roomId = roomData.room.roomId;
		roomRoles = roomData.room.roles;

		roomData = await setupTestUsersForRoom(roomData);
		roomUsers = roomData.users!;
		testUsers = await setupTestUsers();
	});

	afterEach(async () => {
		// End the meeting for further tests
		// Note: We need to generate a new moderator token since some tests modify the room roles or anonymous config,
		// which invalidate the previous moderator token.
		roomData.moderatorToken = await generateRoomMemberToken(roomId, {
			secret: roomData.moderatorSecret
		});
		await endMeeting(roomId, roomData.moderatorToken);
	});

	afterAll(async () => {
		await disconnectFakeParticipants();
		await deleteAllRooms();
		await deleteAllUsers();
	});

	describe('Generate Room Member Token Tests', () => {
		it('should generate anonymous moderator token when anonymous.moderator.enabled is true', async () => {
			// Enable anonymous moderator access
			await updateRoomAccessConfig(roomId, {
				anonymous: {
					moderator: { enabled: true }
				}
			});

			const response = await generateRoomMemberTokenRequest(roomId, { secret: roomData.moderatorSecret });
			expectValidRoomMemberTokenResponse(response, {
				roomId,
				badge: MeetRoomMemberUIBadge.MODERATOR,
				permissions: roomRoles.moderator.permissions
			});
		});

		it('should fail to generate anonymous moderator token when anonymous.moderator.enabled is false', async () => {
			// Disable anonymous moderator access
			await updateRoomAccessConfig(roomId, {
				anonymous: {
					moderator: { enabled: false }
				}
			});

			const response = await generateRoomMemberTokenRequest(roomId, { secret: roomData.moderatorSecret });
			expect(response.status).toBe(403);

			// Enable anonymous moderator access for further tests
			await updateRoomAccessConfig(roomId, {
				anonymous: {
					moderator: { enabled: true }
				}
			});
		});

		it('should generate anonymous speaker token when anonymous.speaker.enabled is true', async () => {
			// Enable anonymous speaker access
			await updateRoomAccessConfig(roomId, {
				anonymous: {
					speaker: { enabled: true }
				}
			});

			const response = await generateRoomMemberTokenRequest(roomId, { secret: roomData.speakerSecret });
			expectValidRoomMemberTokenResponse(response, {
				roomId,
				badge: MeetRoomMemberUIBadge.OTHER,
				permissions: roomRoles.speaker.permissions
			});
		});

		it('should fail to generate anonymous speaker token when anonymous.speaker.enabled is false', async () => {
			// Disable anonymous speaker access
			await updateRoomAccessConfig(roomId, {
				anonymous: {
					speaker: { enabled: false }
				}
			});

			const response = await generateRoomMemberTokenRequest(roomId, { secret: roomData.speakerSecret });
			expect(response.status).toBe(403);

			// Enable anonymous speaker access for further tests
			await updateRoomAccessConfig(roomId, {
				anonymous: {
					speaker: { enabled: true }
				}
			});
		});

		it('should generate read-only recording token when anonymous.recording.enabled is true', async () => {
			expect(roomData.recordingSecret).toBeDefined();
			const recordingSecret = roomData.recordingSecret!;

			await updateRoomAccessConfig(roomId, {
				anonymous: {
					recording: { enabled: true }
				}
			});

			const response = await generateRoomMemberTokenRequest(roomId, { secret: recordingSecret });
			expectValidRoomMemberTokenResponse(response, {
				roomId,
				badge: MeetRoomMemberUIBadge.OTHER,
				permissions: recordingReadOnlyPermissions
			});
		});

		it('should fail to generate recording token when anonymous.recording.enabled is false', async () => {
			expect(roomData.recordingSecret).toBeDefined();
			const recordingSecret = roomData.recordingSecret!;

			await updateRoomAccessConfig(roomId, {
				anonymous: {
					recording: { enabled: false }
				}
			});

			const response = await generateRoomMemberTokenRequest(roomId, { secret: recordingSecret });
			expect(response.status).toBe(403);

			await updateRoomAccessConfig(roomId, {
				anonymous: {
					recording: { enabled: true }
				}
			});
		});

		it('should fail to generate recording token for joining meeting', async () => {
			expect(roomData.recordingSecret).toBeDefined();
			const recordingSecret = roomData.recordingSecret!;

			const response = await generateRoomMemberTokenRequest(roomId, {
				secret: recordingSecret,
				joinMeeting: true,
				participantName: 'Recording Viewer'
			});

			expect(response.status).toBe(403);
		});

		it('should fail to generate token when secret is invalid', async () => {
			const response = await generateRoomMemberTokenRequest(roomId, {
				secret: 'invalid-secret'
			});
			expect(response.status).toBe(400);
		});

		it('should generate token for ADMIN user', async () => {
			// Generate token without specifying secret (should use ADMIN privileges)
			const response = await generateRoomMemberTokenRequest(roomId, {}, testUsers.admin.accessToken);
			expectValidRoomMemberTokenResponse(response, {
				roomId,
				userId: testUsers.admin.user.userId,
				badge: MeetRoomMemberUIBadge.ADMIN,
				permissions: allPermissions // ADMIN users should have all permissions
			});
		});

		it('should generate token for room owner', async () => {
			// Create room with the user as owner
			const roomWithOwner = await createRoom({}, testUsers.roomManager.accessToken);

			// Generate token for the room owner
			const response = await generateRoomMemberTokenRequest(roomWithOwner.roomId, {}, testUsers.roomManager.accessToken);
			expectValidRoomMemberTokenResponse(response, {
				roomId: roomWithOwner.roomId,
				userId: testUsers.roomManager.user.userId,
				badge: MeetRoomMemberUIBadge.OWNER,
				permissions: allPermissions // Room owner should have all permissions
			});
		});

		it('should generate token for user room member', async () => {
			// Generate token without specifying secret
			const response = await generateRoomMemberTokenRequest(roomId, {}, roomUsers.roomManagerMember.accessToken);
			expectValidRoomMemberTokenResponse(response, {
				roomId,
				userId: roomUsers.roomManagerMember.user.userId,
				memberId: roomUsers.roomManagerMember.user.userId,
				badge: MeetRoomMemberUIBadge.MODERATOR,
				permissions: roomRoles.moderator.permissions
			});
		});

		it('should generate token for user non-member when user access is enabled', async () => {
			// Enable user access for the room
			await updateRoomAccessConfig(roomId, {
				user: {
					enabled: true
				}
			});

			const response = await generateRoomMemberTokenRequest(roomId, {}, testUsers.roomMember.accessToken);
			expectValidRoomMemberTokenResponse(response, {
				roomId,
				userId: testUsers.roomMember.user.userId,
				badge: MeetRoomMemberUIBadge.OTHER,
				permissions: roomRoles.speaker.permissions
			});
			expect(response.body.memberId).toBeUndefined();

			// Disable user access after test
			await updateRoomAccessConfig(roomId, {
				user: {
					enabled: false
				}
			});
		});

		it('should generate token for identified guest room member', async () => {
			// Create identified guest room member
			const createResponse = await createRoomMember(roomId, {
				name: 'Identified Guest',
				baseRole: MeetRoomMemberRole.SPEAKER
			});
			const memberId = createResponse.body.memberId;

			// Generate token using identified guestId as secret
			const response = await generateRoomMemberTokenRequest(roomId, {
				secret: memberId
			});
			expectValidRoomMemberTokenResponse(response, {
				roomId,
				memberId,
				badge: MeetRoomMemberUIBadge.OTHER,
				permissions: roomRoles.speaker.permissions
			});
		});

		it('should generate token with custom permissions for room member', async () => {
			// Create room member with custom permissions
			const createResponse = await createRoomMember(roomId, {
				name: 'Custom Member',
				baseRole: MeetRoomMemberRole.SPEAKER,
				customPermissions: {
					canRecord: true,
					canDeleteRecordings: true,
					canKickParticipants: true
				}
			});
			const memberId = createResponse.body.memberId;
			const permissions = createResponse.body.effectivePermissions;

			const response = await generateRoomMemberTokenRequest(roomId, {
				secret: memberId
			});
			expectValidRoomMemberTokenResponse(response, {
				roomId,
				memberId,
				badge: MeetRoomMemberUIBadge.OTHER,
				permissions
			});
		});

		it('should fail to generate token when room does not exist', async () => {
			const response = await generateRoomMemberTokenRequest('non-existent-room-id', {
				secret: roomData.moderatorSecret
			});
			expect(response.status).toBe(404);
		});

		it('should combine permissions when using ADMIN access token and recording secret', async () => {
			expect(roomData.recordingSecret).toBeDefined();
			const response = await generateRoomMemberTokenRequest(
				roomId,
				{ secret: roomData.recordingSecret! },
				testUsers.admin.accessToken
			);
			expectValidRoomMemberTokenResponse(response, {
				roomId,
				userId: testUsers.admin.user.userId,
				badge: MeetRoomMemberUIBadge.ADMIN,
				permissions: allPermissions
			});
		});

		it('should combine permissions when using ADMIN access token and identified guest secret', async () => {
			const createResponse = await createRoomMember(roomId, {
				name: 'Identified Guest',
				baseRole: MeetRoomMemberRole.SPEAKER,
				customPermissions: {
					canKickParticipants: true,
					canDeleteRecordings: true
				}
			});
			const guestMemberId = createResponse.body.memberId as string;

			const response = await generateRoomMemberTokenRequest(
				roomId,
				{ secret: guestMemberId },
				testUsers.admin.accessToken
			);
			expectValidRoomMemberTokenResponse(response, {
				roomId,
				memberId: guestMemberId,
				userId: testUsers.admin.user.userId,
				badge: MeetRoomMemberUIBadge.ADMIN,
				permissions: allPermissions
			});
		});

		it('should combine permissions when using room member access token and recording secret', async () => {
			const userData = await setupUser({
				userId: `usr_${Date.now()}`,
				name: 'Test User',
				password: 'password123',
				role: MeetUserRole.ROOM_MANAGER
			});

			const createResponse = await createRoomMember(roomId, {
				userId: userData.user.userId,
				baseRole: MeetRoomMemberRole.SPEAKER,
				customPermissions: {
					canRetrieveRecordings: false,
					canDeleteRecordings: true,
					canJoinMeeting: false,
					canPublishVideo: false,
					canPublishAudio: false,
					canShareScreen: false,
					canReadChat: false,
					canWriteChat: false,
					canChangeVirtualBackground: false
				}
			});
			const memberPermissions = createResponse.body.effectivePermissions as MeetRoomMemberPermissions;
			const expectedPermissions = mergePermissions(memberPermissions, recordingReadOnlyPermissions);

			expect(roomData.recordingSecret).toBeDefined();
			const response = await generateRoomMemberTokenRequest(
				roomId,
				{ secret: roomData.recordingSecret! },
				userData.accessToken
			);
			expectValidRoomMemberTokenResponse(response, {
				roomId,
				userId: userData.user.userId,
				memberId: userData.user.userId,
				badge: MeetRoomMemberUIBadge.OTHER,
				permissions: expectedPermissions
			});
		});

		it('should combine permissions when using room member access token and identified guest secret', async () => {
			const userData = await setupUser({
				userId: `usr_${Date.now()}`,
				name: 'Test User',
				password: 'password123',
				role: MeetUserRole.ROOM_MANAGER
			});

			const createRoomManagerMemberResponse = await createRoomMember(roomId, {
				userId: userData.user.userId,
				baseRole: MeetRoomMemberRole.SPEAKER,
				customPermissions: {
					canRecord: true,
					canDeleteRecordings: true,
					canShareAccessLinks: true,
					canMakeModerator: true,
					canKickParticipants: true,
					canEndMeeting: true
				}
			});
			const roomManagerMemberPermissions = createRoomManagerMemberResponse.body
				.effectivePermissions as MeetRoomMemberPermissions;

			const createGuestResponse = await createRoomMember(roomId, {
				name: 'Guest Merge Source',
				baseRole: MeetRoomMemberRole.SPEAKER,
				customPermissions: {
					canRecord: true,
					canPublishAudio: false
				}
			});
			const guestMemberId = createGuestResponse.body.memberId as string;
			const guestPermissions = createGuestResponse.body.effectivePermissions as MeetRoomMemberPermissions;
			const expectedPermissions = mergePermissions(roomManagerMemberPermissions, guestPermissions);

			const response = await generateRoomMemberTokenRequest(
				roomId,
				{ secret: guestMemberId },
				userData.accessToken
			);
			expectValidRoomMemberTokenResponse(response, {
				roomId,
				memberId: guestMemberId,
				userId: userData.user.userId,
				// Should get moderator badge because they will have all permissions of a moderator
				// due to the custom permissions set when creating the user member
				badge: MeetRoomMemberUIBadge.MODERATOR,
				permissions: expectedPermissions
			});
		});

		it('should generate normal token when not specifying joinMeeting', async () => {
			const response = await generateRoomMemberTokenRequest(roomId, {
				secret: roomData.moderatorSecret
			});
			expectValidRoomMemberTokenResponse(response, {
				roomId,
				badge: MeetRoomMemberUIBadge.MODERATOR,
				permissions: roomRoles.moderator.permissions,
				joinMeeting: false
			});
		});

		it('should generate token for joining meeting when specifying joinMeeting true and participantName', async () => {
			const participantName = 'Alice Smith';
			const response = await generateRoomMemberTokenRequest(roomId, {
				secret: roomData.moderatorSecret,
				joinMeeting: true,
				participantName
			});
			expectValidRoomMemberTokenResponse(response, {
				roomId,
				badge: MeetRoomMemberUIBadge.MODERATOR,
				permissions: roomRoles.moderator.permissions,
				joinMeeting: true,
				participantName,
				participantIdentityPrefix: 'alice_smith'
			});
		});

		it('should generate token when specifying joinMeeting true and participant already exists in the room', async () => {
			const participantName = 'Alice Smith Unique';

			// Create token for the first participant
			let response = await generateRoomMemberTokenRequest(roomId, {
				secret: roomData.moderatorSecret,
				joinMeeting: true,
				participantName
			});
			expectValidRoomMemberTokenResponse(response, {
				roomId,
				badge: MeetRoomMemberUIBadge.MODERATOR,
				permissions: roomRoles.moderator.permissions,
				joinMeeting: true,
				participantName,
				participantIdentityPrefix: 'alice_smith_unique'
			});

			// Create token for the second participant with the same name
			response = await generateRoomMemberTokenRequest(roomId, {
				secret: roomData.moderatorSecret,
				joinMeeting: true,
				participantName
			});
			expectValidRoomMemberTokenResponse(response, {
				roomId,
				badge: MeetRoomMemberUIBadge.MODERATOR,
				permissions: roomRoles.moderator.permissions,
				joinMeeting: true,
				participantName: participantName + '_1', // Suffix is added to avoid conflict with the first participant
				participantIdentityPrefix: 'alice_smith_unique_1'
			});
		});

		it('should fail to generate token when anonymous user tries to join meeting without canJoinMeeting permission', async () => {
			// Disable canJoinMeeting permission for anonymous speakers
			await updateRoomRoles(roomId, {
				speaker: {
					permissions: {
						canJoinMeeting: false
					}
				}
			});

			const response = await generateRoomMemberTokenRequest(roomId, {
				secret: roomData.speakerSecret,
				joinMeeting: true,
				participantName: 'Anonymous User'
			});
			expect(response.status).toBe(403);

			// Restore default config
			await updateRoomRoles(roomId, {
				speaker: {
					permissions: {
						canJoinMeeting: true
					}
				}
			});
		});

		it('should fail to generate token when room member does not have canJoinMeeting permission', async () => {
			// Create room member without canJoinMeeting permission
			const createResponse = await createRoomMember(roomId, {
				name: 'No Join Member',
				baseRole: MeetRoomMemberRole.SPEAKER,
				customPermissions: {
					canJoinMeeting: false
				}
			});
			const member = createResponse.body as MeetRoomMember;

			// Try to generate token to join meeting
			const response = await generateRoomMemberTokenRequest(roomId, {
				secret: member.memberId,
				joinMeeting: true,
				participantName: member.name
			});
			expect(response.status).toBe(403);
		});

		it('should fail to generate token for joining meeting when room is closed', async () => {
			// Close the room
			await updateRoomStatus(roomId, MeetRoomStatus.CLOSED);

			const response = await generateRoomMemberTokenRequest(roomId, {
				secret: roomData.moderatorSecret,
				joinMeeting: true,
				participantName: 'Alice Smith'
			});
			expect(response.status).toBe(409);

			// Reopen the room for further tests
			await updateRoomStatus(roomId, MeetRoomStatus.OPEN);
		});

		it('should handle special characters in participant name', async () => {
			const participantName = "José María O'Brien-García";
			const response = await generateRoomMemberTokenRequest(roomId, {
				secret: roomData.moderatorSecret,
				joinMeeting: true,
				participantName
			});
			expectValidRoomMemberTokenResponse(response, {
				roomId,
				badge: MeetRoomMemberUIBadge.MODERATOR,
				permissions: roomRoles.moderator.permissions,
				joinMeeting: true,
				participantName,
				participantIdentityPrefix: 'jose_maria_obrien_garcia'
			});
		});

		it('should use default participant identity prefix when participant name has no valid characters', async () => {
			const participantName = '!!!@@@###';
			const response = await generateRoomMemberTokenRequest(roomId, {
				secret: roomData.moderatorSecret,
				joinMeeting: true,
				participantName
			});
			expectValidRoomMemberTokenResponse(response, {
				roomId,
				badge: MeetRoomMemberUIBadge.MODERATOR,
				permissions: roomRoles.moderator.permissions,
				joinMeeting: true,
				participantName,
				participantIdentityPrefix: 'participant'
			});
		});
	});

	describe('Regenerate Room Member Token Tests', () => {
		it('should regenerate token to join meeting for an existing participant', async () => {
			// Generate initial token for a speaker to join the meeting
			const initialToken = await generateRoomMemberToken(roomId, {
				secret: roomData.speakerSecret,
				joinMeeting: true,
				participantName: `Test Participant`
			});

			// Extract participant identity and metadata from the initial token
			const claims = tokenService.getClaimsIgnoringExpiration(getRawToken(initialToken));
			const participantIdentity = claims.sub;
			expect(participantIdentity).toBeDefined();
			const metadata = JSON.parse(claims.metadata || '{}') as MeetRoomMemberTokenMetadata;

			// Simulate participant joining the meeting
			await joinFakeParticipant(roomId, participantIdentity!);
			await updateParticipantMetadata(roomId, participantIdentity!, metadata);

			// Regenerate token for the same participant
			const response = await generateRoomMemberTokenRequest(
				roomId,
				{
					secret: roomData.speakerSecret,
					joinMeeting: true
				},
				undefined,
				initialToken
			);
			expectValidRoomMemberTokenResponse(response, {
				roomId,
				badge: MeetRoomMemberUIBadge.OTHER,
				permissions: roomRoles.speaker.permissions,
				joinMeeting: true,
				participantName: 'Test Participant'
			});
		});

		it('should fail to regenerate token when participant does not exist in the meeting', async () => {
			// Generate initial token for a user to join the meeting
			const initialToken = await generateRoomMemberToken(roomId, {
				secret: roomData.moderatorSecret,
				joinMeeting: true,
				participantName: 'Non-Existent Participant'
			});

			// Attempt to regenerate token before the participant has joined the meeting
			const response = await generateRoomMemberTokenRequest(
				roomId,
				{
					secret: roomData.moderatorSecret,
					joinMeeting: true
				},
				undefined,
				initialToken
			);
			expect(response.status).toBe(404);
		});

		it('should regenerate token with moderator permissions after promotion although source remains speaker', async () => {
			// Generate initial token for a speaker to join the meeting
			const initialToken = await generateRoomMemberToken(roomId, {
				secret: roomData.speakerSecret,
				joinMeeting: true,
				participantName: 'Promoted Participant'
			});

			// Extract participant identity and metadata from the initial token
			const claims = tokenService.getClaimsIgnoringExpiration(getRawToken(initialToken));
			const participantIdentity = claims.sub;
			expect(participantIdentity).toBeDefined();
			const metadata = JSON.parse(claims.metadata || '{}') as MeetRoomMemberTokenMetadata;

			// Simulate participant joining the meeting
			await joinFakeParticipant(roomId, participantIdentity!);
			await updateParticipantMetadata(roomId, participantIdentity!, metadata);

			// Promote participant to moderator
			await updateParticipant(
				roomId,
				participantIdentity!,
				MeetParticipantModerationAction.UPGRADE,
				roomData.moderatorToken
			);

			// Regenerate token for the same participant
			const response = await generateRoomMemberTokenRequest(
				roomId,
				{
					secret: roomData.speakerSecret,
					joinMeeting: true
				},
				undefined,
				initialToken
			);
			expectValidRoomMemberTokenResponse(response, {
				roomId,
				badge: MeetRoomMemberUIBadge.MODERATOR,
				permissions: roomRoles.moderator.permissions,
				isPromotedModerator: true,
				joinMeeting: true,
				participantName: 'Promoted Participant'
			});

			// Verify participant's metadata info still reflects the promotion to moderator
			const participant = await livekitService.getParticipant(roomData.room.roomId, participantIdentity!);
			expect(participant).toBeDefined();
			expect(participant).toHaveProperty('metadata');

			const participantMetadata = JSON.parse(participant.metadata || '{}');
			expect(participantMetadata).toHaveProperty('roomId', roomId);
			expect(participantMetadata).toHaveProperty('badge', MeetRoomMemberUIBadge.MODERATOR);
			expect(participantMetadata).toHaveProperty('permissions', roomRoles.moderator.permissions);
			expect(participantMetadata).toHaveProperty('isPromotedModerator', true);
			expect(participantMetadata).toHaveProperty('originalPermissions', roomRoles.speaker.permissions);
		});

		it('should regenerate token with admin permissions ignoring moderator promotion', async () => {
			// Create a new user and make them a speaker member of the room
			const userData = await setupUser({
				userId: `usr_${Date.now()}`,
				name: 'Test User',
				password: 'password123',
				role: MeetUserRole.ROOM_MANAGER
			});
			await createRoomMember(roomId, {
				userId: userData.user.userId,
				baseRole: MeetRoomMemberRole.SPEAKER
			});

			const initialToken = await generateRoomMemberToken(
				roomId,
				{
					joinMeeting: true
				},
				userData.accessToken
			);

			const initialClaims = tokenService.getClaimsIgnoringExpiration(getRawToken(initialToken));
			const participantIdentity = initialClaims.sub;
			expect(participantIdentity).toBeDefined();
			const initialMetadata = JSON.parse(initialClaims.metadata || '{}') as MeetRoomMemberTokenMetadata;

			// Simulate participant joining the meeting
			await joinFakeParticipant(roomId, participantIdentity!);
			await updateParticipantMetadata(roomId, participantIdentity!, initialMetadata);

			// Promote participant to moderator
			await updateParticipant(
				roomId,
				participantIdentity!,
				MeetParticipantModerationAction.UPGRADE,
				roomData.moderatorToken
			);

			// Update user role to ADMIN
			await updateUserRole(userData.user.userId, MeetUserRole.ADMIN);

			// Regenerate token for the same participant
			const response = await generateRoomMemberTokenRequest(
				roomId,
				{
					secret: roomData.moderatorSecret,
					joinMeeting: true
				},
				userData.accessToken,
				initialToken
			);
			expectValidRoomMemberTokenResponse(response, {
				roomId,
				userId: userData.user.userId,
				badge: MeetRoomMemberUIBadge.ADMIN,
				permissions: allPermissions,
				joinMeeting: true,
				participantName: 'Test User'
			});

			// Verify participant's metadata info reflects the admin role with all permissions, ignoring the previous promotion to moderator
			const participant = await livekitService.getParticipant(roomData.room.roomId, participantIdentity!);
			expect(participant).toBeDefined();
			expect(participant).toHaveProperty('metadata');

			const participantMetadata = JSON.parse(participant.metadata || '{}');
			expect(participantMetadata).toHaveProperty('roomId', roomId);
			expect(participantMetadata).toHaveProperty('badge', MeetRoomMemberUIBadge.ADMIN);
			expect(participantMetadata).toHaveProperty('permissions', allPermissions);
			expect(participantMetadata).not.toHaveProperty('isPromotedModerator');
			expect(participantMetadata).not.toHaveProperty('originalPermissions');
		});
	});

	describe('Generate Room Member Token Validation Tests', () => {
		it('should fail when joinMeeting is not a boolean', async () => {
			const response = await generateRoomMemberTokenRequest(roomData.room.roomId, {
				joinMeeting: 'not-a-boolean' as unknown as boolean
			});
			expectValidationError(response, 'joinMeeting', 'Expected boolean');
		});

		it('should fail when participantName is not provided when joinMeeting is true and user is anonymous', async () => {
			const response = await generateRoomMemberTokenRequest(roomData.room.roomId, {
				secret: roomData.moderatorSecret,
				joinMeeting: true
			});
			expect(response.status).toBe(400);
			expect(response.body.message).toContain(
				'participantName is required when joining a meeting and it cannot be inferred from member/user context'
			);
		});
	});
});

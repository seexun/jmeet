import { afterAll, afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import {
	MeetParticipantModerationAction,
	MeetRoomMemberTokenMetadata,
	MeetRoomMemberUIBadge,
	MeetRoomRoles
} from '@openvidu-meet/typings';
import { container } from '../../../../src/config/dependency-injector.config.js';
import { INTERNAL_CONFIG } from '../../../../src/config/internal-config.js';
import { MEET_ENV } from '../../../../src/environment.js';
import { TokenService } from '../../../../src/services/token.service.js';
import { expectValidRoomMemberTokenResponse } from '../../../helpers/assertion-helpers.js';
import {
	disconnectFakeParticipants,
	joinFakeParticipant,
	updateParticipantMetadata
} from '../../../helpers/livekit-cli-helpers.js';
import {
	deleteAllRooms,
	endMeeting,
	generateRoomMemberToken,
	refreshRoomMemberTokenRequest,
	sleep,
	startTestServer,
	updateParticipant
} from '../../../helpers/request-helpers.js';
import { setupSingleRoom } from '../../../helpers/test-scenarios.js';
import { RoomData } from '../../../interfaces/scenarios.js';

describe('Room Members API Tests', () => {
	let roomData: RoomData;
	let roomId: string;
	let roomRoles: MeetRoomRoles;
	let tokenService: TokenService;

	const getRawToken = (token: string) => token.replace(/^Bearer\s+/i, '');

	beforeAll(async () => {
		await startTestServer();
		tokenService = container.get(TokenService);
		roomData = await setupSingleRoom();
		roomId = roomData.room.roomId;
		roomRoles = roomData.room.roles;
	});

	afterEach(async () => {
		await endMeeting(roomId, roomData.moderatorToken);
	});

	afterAll(async () => {
		await disconnectFakeParticipants();
		await deleteAllRooms();
	});

	describe('Refresh Room Member Token Tests', () => {
		it('should refresh room member token for joining meeting', async () => {
			// Generate a room member token for joining the meeting
			const previousToken = await generateRoomMemberToken(roomId, {
				secret: roomData.moderatorSecret,
				joinMeeting: true,
				participantName: 'Test Participant'
			});

			// Extract participant identity and metadata from the token
			const claims = tokenService.getClaimsIgnoringExpiration(getRawToken(previousToken));
			const participantIdentity = claims.sub;
			expect(participantIdentity).toBeDefined();
			const metadata = JSON.parse(claims.metadata || '{}') as MeetRoomMemberTokenMetadata;

			// Simulate participant joining the meeting
			await joinFakeParticipant(roomId, participantIdentity!);
			await updateParticipantMetadata(roomId, participantIdentity!, metadata);

			const response = await refreshRoomMemberTokenRequest(roomId, previousToken);
			expectValidRoomMemberTokenResponse(response, {
				roomId,
				badge: MeetRoomMemberUIBadge.MODERATOR,
				permissions: roomRoles.moderator.permissions,
				joinMeeting: true,
				participantName: 'Test Participant',
				participantIdentityPrefix: 'test_participant'
			});
		});

		it('should fail when using valid room member token for joining meeting but participant has not joined', async () => {
			// Generate a room member token for joining the meeting
			const previousToken = await generateRoomMemberToken(roomId, {
				secret: roomData.moderatorSecret,
				joinMeeting: true,
				participantName: 'Test Participant'
			});

			// Attempt to refresh the token without the participant joining the meeting
			const response = await refreshRoomMemberTokenRequest(roomId, previousToken);
			expect(response.status).toBe(404);
		});

		it('should succeed when previous token is expired but still within clock tolerance', async () => {
			const initialTokenTtl = MEET_ENV.ROOM_MEMBER_TOKEN_EXPIRATION;
			const initialClockTolerance = INTERNAL_CONFIG.REFRESH_CLOCK_TOLERANCE_SECONDS;

			try {
				// Set token TTL to 1 second and clock tolerance to 5 seconds for testing
				MEET_ENV.ROOM_MEMBER_TOKEN_EXPIRATION = '1s';
				INTERNAL_CONFIG.REFRESH_CLOCK_TOLERANCE_SECONDS = 5;

				const previousToken = await generateRoomMemberToken(roomId, {
					secret: roomData.moderatorSecret,
					joinMeeting: true,
					participantName: 'Test Participant'
				});

				const claims = tokenService.getClaimsIgnoringExpiration(getRawToken(previousToken));
				const participantIdentity = claims.sub;
				expect(participantIdentity).toBeDefined();
				const metadata = JSON.parse(claims.metadata || '{}') as MeetRoomMemberTokenMetadata;

				await joinFakeParticipant(roomId, participantIdentity!);
				await updateParticipantMetadata(roomId, participantIdentity!, metadata);

				// Wait for token expiry (1s) but keep it within tolerance (5s).
				await sleep('2s');

				const response = await refreshRoomMemberTokenRequest(roomId, previousToken);
				expect(response.status).toBe(200);
			} finally {
				// Restore original config values after the test
				MEET_ENV.ROOM_MEMBER_TOKEN_EXPIRATION = initialTokenTtl;
				INTERNAL_CONFIG.REFRESH_CLOCK_TOLERANCE_SECONDS = initialClockTolerance;
			}
		});

		it('should fail when previous token is totally expired', async () => {
			const initialTokenTtl = MEET_ENV.ROOM_MEMBER_TOKEN_EXPIRATION;
			const initialClockTolerance = INTERNAL_CONFIG.REFRESH_CLOCK_TOLERANCE_SECONDS;

			try {
				// Set token TTL to 1 second and clock tolerance to 1 second for testing
				MEET_ENV.ROOM_MEMBER_TOKEN_EXPIRATION = '1s';
				INTERNAL_CONFIG.REFRESH_CLOCK_TOLERANCE_SECONDS = 1;

				const previousToken = await generateRoomMemberToken(roomId, {
					secret: roomData.moderatorSecret,
					joinMeeting: true,
					participantName: 'Test Participant'
				});

				const claims = tokenService.getClaimsIgnoringExpiration(getRawToken(previousToken));
				const participantIdentity = claims.sub;
				expect(participantIdentity).toBeDefined();
				const metadata = JSON.parse(claims.metadata || '{}') as MeetRoomMemberTokenMetadata;

				await joinFakeParticipant(roomId, participantIdentity!);
				await updateParticipantMetadata(roomId, participantIdentity!, metadata);

				// Wait long enough to exceed both token TTL and tolerance.
				await sleep('3s');

				const response = await refreshRoomMemberTokenRequest(roomId, previousToken);
				expect(response.status).toBe(401);
			} finally {
				// Restore original config values after the test
				MEET_ENV.ROOM_MEMBER_TOKEN_EXPIRATION = initialTokenTtl;
				INTERNAL_CONFIG.REFRESH_CLOCK_TOLERANCE_SECONDS = initialClockTolerance;
			}
		});

		it('should refresh token using promoted moderator permissions and badge from participant metadata', async () => {
			// Generate a room member token for joining the meeting with speaker role
			const previousToken = await generateRoomMemberToken(roomId, {
				secret: roomData.speakerSecret,
				joinMeeting: true,
				participantName: 'Test Participant'
			});

			// Extract participant identity and metadata from the token
			const claims = tokenService.getClaimsIgnoringExpiration(getRawToken(previousToken));
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

			// Refresh the token and expect it to have moderator permissions and badge based on the updated participant metadata
			const response = await refreshRoomMemberTokenRequest(roomId, previousToken);
			expectValidRoomMemberTokenResponse(response, {
				roomId,
				badge: MeetRoomMemberUIBadge.MODERATOR,
				permissions: roomRoles.moderator.permissions,
				isPromotedModerator: true,
				joinMeeting: true,
				participantName: 'Test Participant',
				participantIdentityPrefix: 'test_participant'
			});
		});
	});
});

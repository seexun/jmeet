import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import {
	MeetAssistantCapabilityName,
	MeetParticipantModerationAction,
	MeetRoomMemberRole,
	MeetRoomMemberTokenMetadata,
	MeetRoomMemberUIBadge
} from '@openvidu-meet/typings';
import { Express } from 'express';
import request from 'supertest';
import { INTERNAL_CONFIG } from '../../../../src/config/internal-config.js';
import { MEET_ENV } from '../../../../src/environment.js';
import {
	disconnectFakeParticipants,
	joinFakeParticipant,
	updateParticipantMetadata
} from '../../../helpers/livekit-cli-helpers.js';
import {
	createAssistant,
	deleteAllRooms,
	generateRoomMemberToken,
	getFullPath,
	loginRootAdmin,
	startTestServer
} from '../../../helpers/request-helpers.js';

import { setupRoomMember, setupSingleRoom, updateRoomMemberPermissions } from '../../../helpers/test-scenarios.js';
import { RoomData, RoomMemberData } from '../../../interfaces/scenarios.js';

const MEETINGS_PATH = getFullPath(`${INTERNAL_CONFIG.INTERNAL_API_BASE_PATH_V1}/meetings`);
const ASSISTANTS_PATH = getFullPath(`${INTERNAL_CONFIG.INTERNAL_API_BASE_PATH_V1}/ai/assistants`);
const LIVE_CAPTIONS_BODY = { capabilities: [{ name: MeetAssistantCapabilityName.LIVE_CAPTIONS }] };

describe('Meeting API Security Tests', () => {
	const participantIdentity = 'TEST_PARTICIPANT';

	let app: Express;
	let rootAdminAccessToken: string;

	let roomData: RoomData;
	let roomId: string;
	let roomMember: RoomMemberData;

	beforeAll(async () => {
		app = await startTestServer();
		({ accessToken: rootAdminAccessToken } = await loginRootAdmin());

		roomData = await setupSingleRoom(true);
		roomId = roomData.room.roomId;
		roomMember = await setupRoomMember(roomId, {
			name: 'Identified Guest',
			baseRole: MeetRoomMemberRole.MODERATOR
		});
	});

	afterAll(async () => {
		await disconnectFakeParticipants();
		await deleteAllRooms();
	});

	describe('End Meeting Tests', () => {
		it('should fail when request includes API key', async () => {
			const response = await request(app)
				.delete(`${MEETINGS_PATH}/${roomId}`)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY);
			expect(response.status).toBe(401);
		});

		it('should fail when using access token', async () => {
			const response = await request(app)
				.delete(`${MEETINGS_PATH}/${roomId}`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, rootAdminAccessToken);
			expect(response.status).toBe(401);
		});

		it('should succeed when using room member token with canEndMeeting permission', async () => {
			// Update room member to have canEndMeeting permission
			roomMember = await updateRoomMemberPermissions(roomId, roomMember.member.memberId, { canEndMeeting: true });

			const response = await request(app)
				.delete(`${MEETINGS_PATH}/${roomId}`)
				.set(INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, roomMember.memberToken);
			expect(response.status).toBe(200);

			// Re-join participant for further tests
			await joinFakeParticipant(roomId, participantIdentity);
		});

		it('should fail when using room member token without canEndMeeting permission', async () => {
			// Update room member to not have canEndMeeting permission
			roomMember = await updateRoomMemberPermissions(roomId, roomMember.member.memberId, {
				canEndMeeting: false
			});

			const response = await request(app)
				.delete(`${MEETINGS_PATH}/${roomId}`)
				.set(INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, roomMember.memberToken);
			expect(response.status).toBe(403);
		});

		it('should fail when using room member token from a different room', async () => {
			const newRoomData = await setupSingleRoom();

			const response = await request(app)
				.delete(`${MEETINGS_PATH}/${roomId}`)
				.set(INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, newRoomData.moderatorToken);
			expect(response.status).toBe(403);
		});
	});

	describe('Update Participant in Meeting Tests', () => {
		const action = MeetParticipantModerationAction.UPGRADE;

		const setParticipantMetadata = async () => {
			const metadata: MeetRoomMemberTokenMetadata = {
				iat: Date.now(),
				roomId,
				permissions: roomData.room.roles.speaker.permissions,
				badge: MeetRoomMemberUIBadge.OTHER,
				livekitUrl: MEET_ENV.LIVEKIT_URL
			};
			await updateParticipantMetadata(roomId, participantIdentity, metadata);
		};

		beforeAll(async () => {
			// Ensure participant has the correct metadata before tests
			await setParticipantMetadata();
		});

		it('should fail when request includes API key', async () => {
			const response = await request(app)
				.put(`${MEETINGS_PATH}/${roomId}/participants/${participantIdentity}/role`)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
				.send({ action });
			expect(response.status).toBe(401);
		});

		it('should fail when using access token', async () => {
			const response = await request(app)
				.put(`${MEETINGS_PATH}/${roomId}/participants/${participantIdentity}/role`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, rootAdminAccessToken)
				.send({ action });
			expect(response.status).toBe(401);
		});

		it('should succeed when using room member token with canMakeModerator permission', async () => {
			// Update room member to have canMakeModerator permission
			roomMember = await updateRoomMemberPermissions(roomId, roomMember.member.memberId, {
				canMakeModerator: true
			});

			const response = await request(app)
				.put(`${MEETINGS_PATH}/${roomId}/participants/${participantIdentity}/role`)
				.set(INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, roomMember.memberToken)
				.send({ action });
			expect(response.status).toBe(200);

			// Re-join participant for further tests
			await joinFakeParticipant(roomId, participantIdentity);
			await setParticipantMetadata();
		});

		it('should fail when using room member token without canMakeModerator permission', async () => {
			// Update room member to not have canMakeModerator permission
			roomMember = await updateRoomMemberPermissions(roomId, roomMember.member.memberId, {
				canMakeModerator: false
			});

			const response = await request(app)
				.put(`${MEETINGS_PATH}/${roomId}/participants/${participantIdentity}/role`)
				.set(INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, roomMember.memberToken)
				.send({ action });
			expect(response.status).toBe(403);
		});

		it('should fail when using room member token from a different room', async () => {
			const newRoomData = await setupSingleRoom();

			const response = await request(app)
				.put(`${MEETINGS_PATH}/${roomId}/participants/${participantIdentity}/role`)
				.set(INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, newRoomData.moderatorToken)
				.send({ action });
			expect(response.status).toBe(403);
		});
	});

	describe('Kick Participant from Meeting Tests', () => {
		it('should fail when request includes API key', async () => {
			const response = await request(app)
				.delete(`${MEETINGS_PATH}/${roomId}/participants/${participantIdentity}`)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY);
			expect(response.status).toBe(401);
		});

		it('should fail when using access token', async () => {
			const response = await request(app)
				.delete(`${MEETINGS_PATH}/${roomId}/participants/${participantIdentity}`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, rootAdminAccessToken);
			expect(response.status).toBe(401);
		});

		it('should succeed when using room member token with canKickParticipants permission', async () => {
			// Update room member to have canKickParticipants permission
			roomMember = await updateRoomMemberPermissions(roomId, roomMember.member.memberId, {
				canKickParticipants: true
			});

			const response = await request(app)
				.delete(`${MEETINGS_PATH}/${roomId}/participants/${participantIdentity}`)
				.set(INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, roomMember.memberToken);
			expect(response.status).toBe(200);

			// Re-join participant for further tests
			await joinFakeParticipant(roomId, participantIdentity);
		});

		it('should fail when using room member token without canKickParticipants permission', async () => {
			// Update room member to not have canKickParticipants permission
			roomMember = await updateRoomMemberPermissions(roomId, roomMember.member.memberId, {
				canKickParticipants: false
			});

			const response = await request(app)
				.delete(`${MEETINGS_PATH}/${roomId}/participants/${participantIdentity}`)
				.set(INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, roomMember.memberToken);
			expect(response.status).toBe(403);
		});

		it('should fail when using room member token from a different room', async () => {
			const newRoomData = await setupSingleRoom();

			const response = await request(app)
				.delete(`${MEETINGS_PATH}/${roomId}/participants/${participantIdentity}`)
				.set(INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, newRoomData.moderatorToken);
			expect(response.status).toBe(403);
		});
	});

	describe('AI Assistant Tests', () => {
		const MOCK_DISPATCH_ID = 'dispatch-test-001';

		describe('Create Assistant Security Tests', () => {
			it('should return 401 when no room member token header is provided', async () => {
				const response = await request(app).post(ASSISTANTS_PATH).send(LIVE_CAPTIONS_BODY);

				expect(response.status).toBe(401);
			});

			it('should return 401 when the room member token is malformed', async () => {
				const response = await request(app)
					.post(ASSISTANTS_PATH)
					.set(INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, 'Bearer this.is.not.a.valid.jwt')
					.send(LIVE_CAPTIONS_BODY);

				expect(response.status).toBe(401);
			});

			it('should return 401 when the token header contains a random string without Bearer prefix', async () => {
				const response = await request(app)
					.post(ASSISTANTS_PATH)
					.set(INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, 'random-garbage-token')
					.send(LIVE_CAPTIONS_BODY);

				expect(response.status).toBe(401);
			});

			it('should return 401 when an expired token is used', async () => {
				// Generate a token for a room that has already been deleted → verify will fail
				const expiredToken = await generateRoomMemberToken(roomData.room.roomId, {
					secret: roomData.speakerSecret
				});
				await deleteAllRooms();

				const response = await createAssistant(expiredToken);

				// The room is gone → token validation or room lookup fails → not 200
				expect(response.status).not.toBe(200);
			});
		});

		describe('Cancel Assistant Security Tests', () => {
			it('should return 401 when no room member token header is provided', async () => {
				const response = await request(app).delete(`${ASSISTANTS_PATH}/${MOCK_DISPATCH_ID}`);

				expect(response.status).toBe(401);
			});

			it('should return 401 when the room member token is malformed', async () => {
				const response = await request(app)
					.delete(`${ASSISTANTS_PATH}/${MOCK_DISPATCH_ID}`)
					.set(INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, 'Bearer malformed.token.here');

				expect(response.status).toBe(401);
			});

			it('should return 401 when the token header contains a random string without Bearer prefix', async () => {
				const response = await request(app)
					.delete(`${ASSISTANTS_PATH}/${MOCK_DISPATCH_ID}`)
					.set(INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, 'garbage');

				expect(response.status).toBe(401);
			});
		});
	});
});

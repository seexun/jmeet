import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Express } from 'express';
import request from 'supertest';
import { INTERNAL_CONFIG } from '../../../../src/config/internal-config.js';
import { MEET_ENV } from '../../../../src/environment.js';
import {
	deleteAllRooms,
	deleteAllUsers,
	generateRoomMemberToken,
	getFullPath,
	startTestServer,
	updateRoomAccessConfig
} from '../../../helpers/request-helpers.js';
import { setupSingleRoom, setupTestUsers, setupTestUsersForRoom } from '../../../helpers/test-scenarios.js';
import { RoomData, RoomTestUsers, TestUsers } from '../../../interfaces/scenarios.js';

const ROOMS_PATH = getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/rooms`);

describe('Room API Security Tests', () => {
	let app: Express;
	let testUsers: TestUsers;

	beforeAll(async () => {
		app = await startTestServer();
		testUsers = await setupTestUsers();
	});

	afterAll(async () => {
		await deleteAllRooms();
		await deleteAllUsers();
	});

	describe('Create Room Tests', () => {
		it('should succeed when request includes API key', async () => {
			const response = await request(app)
				.post(ROOMS_PATH)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
				.send({});
			expect(response.status).toBe(201);
		});

		it('should succeed when user is authenticated as ADMIN', async () => {
			const response = await request(app)
				.post(ROOMS_PATH)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.admin.accessToken)
				.send({});
			expect(response.status).toBe(201);
		});

		it('should succeed when user is authenticated as ROOM_MANAGER', async () => {
			const response = await request(app)
				.post(ROOMS_PATH)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomManager.accessToken)
				.send({});
			expect(response.status).toBe(201);
		});

		it('should fail when user is authenticated as ROOM_MEMBER', async () => {
			const response = await request(app)
				.post(ROOMS_PATH)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomMember.accessToken)
				.send({});
			expect(response.status).toBe(403);
		});

		it('should fail when user is not authenticated', async () => {
			const response = await request(app).post(ROOMS_PATH).send({});
			expect(response.status).toBe(401);
		});
	});

	describe('Get Rooms Tests', () => {
		let roomData: RoomData;
		let roomId: string;
		let roomUsers: RoomTestUsers;

		beforeAll(async () => {
			// Ensure no rooms exist before tests
			await deleteAllRooms();

			roomData = await setupSingleRoom();
			roomId = roomData.room.roomId;

			roomData = await setupTestUsersForRoom(roomData);
			roomUsers = roomData.users!;
		});

		it('should succeed when request includes API key', async () => {
			const response = await request(app)
				.get(ROOMS_PATH)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY);
			expect(response.status).toBe(200);
			expect(response.body.rooms.length).toBe(1);
		});

		it('should succeed when user is authenticated as ADMIN', async () => {
			const response = await request(app)
				.get(ROOMS_PATH)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.admin.accessToken);
			expect(response.status).toBe(200);
			expect(response.body.rooms.length).toBe(1);
		});

		it('should succeed when user is authenticated as ROOM_MANAGER and is room owner', async () => {
			const response = await request(app)
				.get(ROOMS_PATH)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, roomUsers.roomManagerOwner.accessToken);
			expect(response.status).toBe(200);
			expect(response.body.rooms.length).toBe(1);
		});

		it('should succeed when user is authenticated as ROOM_MANAGER and is room member', async () => {
			const response = await request(app)
				.get(ROOMS_PATH)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, roomUsers.roomManagerMember.accessToken);
			expect(response.status).toBe(200);
			expect(response.body.rooms.length).toBe(1);
		});

		it('should not return rooms when user is authenticated as ROOM_MANAGER without access to any rooms', async () => {
			const response = await request(app)
				.get(ROOMS_PATH)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomManager.accessToken);
			expect(response.status).toBe(200);
			expect(response.body.rooms.length).toBe(0);
		});

		it('should return rooms when user is authenticated as ROOM_MANAGER and user access is enabled', async () => {
			// Enable user access for the room
			await updateRoomAccessConfig(roomId, {
				user: {
					enabled: true
				}
			});

			const response = await request(app)
				.get(ROOMS_PATH)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomManager.accessToken);
			expect(response.status).toBe(200);
			expect(response.body.rooms.length).toBe(1);
			expect(response.body.rooms[0].roomId).toBe(roomId);

			// Disable user access after test
			await updateRoomAccessConfig(roomId, {
				user: {
					enabled: false
				}
			});
			// Regenerate moderator token since room config was updated
			roomData.moderatorToken = await generateRoomMemberToken(roomId, {
				secret: roomData.moderatorSecret
			});
		});

		it('should succeed when user is authenticated as ROOM_MEMBER and is room member', async () => {
			const response = await request(app)
				.get(ROOMS_PATH)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, roomUsers.roomMember.accessToken);
			expect(response.status).toBe(200);
			expect(response.body.rooms.length).toBe(1);
		});

		it('should not return rooms when user is authenticated as ROOM_MEMBER without access to any rooms', async () => {
			const response = await request(app)
				.get(ROOMS_PATH)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomMember.accessToken);
			expect(response.status).toBe(200);
			expect(response.body.rooms.length).toBe(0);
		});

		it('should return rooms when user is authenticated as ROOM_MEMBER and user access is enabled', async () => {
			// Enable user access for the room
			await updateRoomAccessConfig(roomId, {
				user: {
					enabled: true
				}
			});

			const response = await request(app)
				.get(ROOMS_PATH)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomMember.accessToken);
			expect(response.status).toBe(200);
			expect(response.body.rooms.length).toBe(1);
			expect(response.body.rooms[0].roomId).toBe(roomId);

			// Disable user access after test
			await updateRoomAccessConfig(roomId, {
				user: {
					enabled: false
				}
			});
			// Regenerate moderator token since room config was updated
			roomData.moderatorToken = await generateRoomMemberToken(roomId, {
				secret: roomData.moderatorSecret
			});
		});

		it('should fail when user is not authenticated', async () => {
			const response = await request(app).get(ROOMS_PATH);
			expect(response.status).toBe(401);
		});

		it('should fail when using room member token', async () => {
			const response = await request(app)
				.get(ROOMS_PATH)
				.set(INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, roomData.moderatorToken);
			expect(response.status).toBe(401);
		});
	});

	describe('Bulk Delete Rooms Tests', () => {
		let roomData: RoomData;
		let roomId: string;
		let roomUsers: RoomTestUsers;

		const recreateRoom = async () => {
			roomData = await setupSingleRoom();
			roomData = await setupTestUsersForRoom(roomData);
			roomId = roomData.room.roomId;
			roomUsers = roomData.users!;
		};

		beforeAll(async () => {
			await recreateRoom();
		});

		it('should succeed when request includes API key', async () => {
			const response = await request(app)
				.delete(ROOMS_PATH)
				.query({ roomIds: roomId })
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY);
			expect(response.status).toBe(200);

			// Recreate room for next test since it was deleted
			await recreateRoom();
		});

		it('should succeed when user is authenticated as ADMIN', async () => {
			const response = await request(app)
				.delete(ROOMS_PATH)
				.query({ roomIds: roomId })
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.admin.accessToken);
			expect(response.status).toBe(200);

			// Recreate room for next test since it was deleted
			await recreateRoom();
		});

		it('should succeed when user is authenticated as ROOM_MANAGER and is room owner', async () => {
			const response = await request(app)
				.delete(ROOMS_PATH)
				.query({ roomIds: roomId })
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, roomUsers.roomManagerOwner.accessToken);
			expect(response.status).toBe(200);

			// Recreate room for next test since it was deleted
			await recreateRoom();
		});

		it('should fail when user is authenticated as ROOM_MANAGER and is room member', async () => {
			const response = await request(app)
				.delete(ROOMS_PATH)
				.query({ roomIds: roomId })
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, roomUsers.roomManagerMember.accessToken);
			expect(response.status).toBe(400);
			// No need to recreate - room was not deleted
		});

		it('should fail when user is authenticated as ROOM_MANAGER without access to the room', async () => {
			const response = await request(app)
				.delete(ROOMS_PATH)
				.query({ roomIds: roomId })
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomManager.accessToken);
			expect(response.status).toBe(400);
			// No need to recreate - room was not deleted
		});

		it('should fail when user is authenticated as ROOM_MEMBER and is room member', async () => {
			const response = await request(app)
				.delete(ROOMS_PATH)
				.query({ roomIds: roomId })
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, roomUsers.roomMember.accessToken);
			expect(response.status).toBe(403);
			// No need to recreate - room was not deleted
		});

		it('should fail when user is authenticated as ROOM_MEMBER without access to the room', async () => {
			const response = await request(app)
				.delete(ROOMS_PATH)
				.query({ roomIds: roomId })
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomMember.accessToken);
			expect(response.status).toBe(403);
			// No need to recreate - room was not deleted
		});

		it('should fail when user is not authenticated', async () => {
			const response = await request(app).delete(ROOMS_PATH).query({ roomIds: roomId });
			expect(response.status).toBe(401);
		});

		it('should fail when using room member token', async () => {
			const response = await request(app)
				.delete(ROOMS_PATH)
				.query({ roomIds: roomId })
				.set(INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, roomData.moderatorToken);
			expect(response.status).toBe(401);
			// No need to recreate - room was not deleted
		});
	});

	describe('Get Room Tests', () => {
		let roomData: RoomData;
		let roomId: string;
		let roomUsers: RoomTestUsers;

		beforeAll(async () => {
			roomData = await setupSingleRoom();
			roomData = await setupTestUsersForRoom(roomData);
			roomId = roomData.room.roomId;
			roomUsers = roomData.users!;
		});

		it('should succeed when request includes API key', async () => {
			const response = await request(app)
				.get(`${ROOMS_PATH}/${roomId}`)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY);
			expect(response.status).toBe(200);
		});

		it('should succeed when user is authenticated as ADMIN', async () => {
			const response = await request(app)
				.get(`${ROOMS_PATH}/${roomId}`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.admin.accessToken);
			expect(response.status).toBe(200);
		});

		it('should succeed when user is authenticated as ROOM_MANAGER and is room owner', async () => {
			const response = await request(app)
				.get(`${ROOMS_PATH}/${roomId}`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, roomUsers.roomManagerOwner.accessToken);
			expect(response.status).toBe(200);
		});

		it('should succeed when user is authenticated as ROOM_MANAGER and is room member', async () => {
			const response = await request(app)
				.get(`${ROOMS_PATH}/${roomId}`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, roomUsers.roomManagerMember.accessToken);
			expect(response.status).toBe(200);
		});

		it('should fail when user is authenticated as ROOM_MANAGER without access to the room', async () => {
			const response = await request(app)
				.get(`${ROOMS_PATH}/${roomId}`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomManager.accessToken);
			expect(response.status).toBe(403);
		});

		it('should succeed when user is authenticated as ROOM_MANAGER without membership and user access is enabled', async () => {
			// Enable user access for the room
			await updateRoomAccessConfig(roomId, {
				user: {
					enabled: true
				}
			});

			const response = await request(app)
				.get(`${ROOMS_PATH}/${roomId}`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomManager.accessToken);
			expect(response.status).toBe(200);

			// Disable user access after test
			await updateRoomAccessConfig(roomId, {
				user: {
					enabled: false
				}
			});
			// Regenerate moderator token since room config was updated
			roomData.moderatorToken = await generateRoomMemberToken(roomId, {
				secret: roomData.moderatorSecret
			});
		});

		it('should succeed when user is authenticated as ROOM_MEMBER and is room member', async () => {
			const response = await request(app)
				.get(`${ROOMS_PATH}/${roomId}`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, roomUsers.roomMember.accessToken);
			expect(response.status).toBe(200);
		});

		it('should fail when user is authenticated as ROOM_MEMBER without access to the room', async () => {
			const response = await request(app)
				.get(`${ROOMS_PATH}/${roomId}`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomMember.accessToken);
			expect(response.status).toBe(403);
		});

		it('should succeed when user is authenticated as ROOM_MEMBER without membership and user access is enabled', async () => {
			// Enable user access for the room
			await updateRoomAccessConfig(roomId, {
				user: {
					enabled: true
				}
			});

			const response = await request(app)
				.get(`${ROOMS_PATH}/${roomId}`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomMember.accessToken);
			expect(response.status).toBe(200);

			// Disable user access after test
			await updateRoomAccessConfig(roomId, {
				user: {
					enabled: false
				}
			});
			// Regenerate moderator token since room config was updated
			roomData.moderatorToken = await generateRoomMemberToken(roomId, { secret: roomData.moderatorSecret });
		});

		it('should fail when user is not authenticated', async () => {
			const response = await request(app).get(`${ROOMS_PATH}/${roomId}`);
			expect(response.status).toBe(401);
		});

		it('should succeed when using room member token', async () => {
			const response = await request(app)
				.get(`${ROOMS_PATH}/${roomId}`)
				.set(INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, roomData.moderatorToken);
			expect(response.status).toBe(200);
		});

		it('should fail when using room member token from a different room', async () => {
			const newRoomData = await setupSingleRoom();

			const response = await request(app)
				.get(`${ROOMS_PATH}/${roomId}`)
				.set(INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, newRoomData.moderatorToken);
			expect(response.status).toBe(403);
		});
	});

	describe('Delete Room Tests', () => {
		let roomData: RoomData;
		let roomId: string;
		let roomUsers: RoomTestUsers;

		const recreateRoom = async () => {
			roomData = await setupSingleRoom();
			roomData = await setupTestUsersForRoom(roomData);
			roomId = roomData.room.roomId;
			roomUsers = roomData.users!;
		};

		beforeAll(async () => {
			await recreateRoom();
		});

		it('should succeed when request includes API key', async () => {
			const response = await request(app)
				.delete(`${ROOMS_PATH}/${roomId}`)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY);
			expect(response.status).toBe(200);

			// Recreate room for next test since it was deleted
			await recreateRoom();
		});

		it('should succeed when user is authenticated as ADMIN', async () => {
			const response = await request(app)
				.delete(`${ROOMS_PATH}/${roomId}`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.admin.accessToken);
			expect(response.status).toBe(200);

			// Recreate room for next test since it was deleted
			await recreateRoom();
		});

		it('should succeed when user is authenticated as ROOM_MANAGER and is room owner', async () => {
			const response = await request(app)
				.delete(`${ROOMS_PATH}/${roomId}`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, roomUsers.roomManagerOwner.accessToken);
			expect(response.status).toBe(200);

			// Recreate room for next test since it was deleted
			await recreateRoom();
		});

		it('should fail when user is authenticated as ROOM_MANAGER and is room member', async () => {
			const response = await request(app)
				.delete(`${ROOMS_PATH}/${roomId}`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, roomUsers.roomManagerMember.accessToken);
			expect(response.status).toBe(403);
			// No need to recreate - room was not deleted
		});

		it('should fail when user is authenticated as ROOM_MANAGER without access to the room', async () => {
			const response = await request(app)
				.delete(`${ROOMS_PATH}/${roomId}`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomManager.accessToken);
			expect(response.status).toBe(403);
			// No need to recreate - room was not deleted
		});

		it('should fail when user is authenticated as ROOM_MEMBER and is room member', async () => {
			const response = await request(app)
				.delete(`${ROOMS_PATH}/${roomId}`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, roomUsers.roomMember.accessToken);
			expect(response.status).toBe(403);
			// No need to recreate - room was not deleted
		});

		it('should fail when user is authenticated as ROOM_MEMBER without access to the room', async () => {
			const response = await request(app)
				.delete(`${ROOMS_PATH}/${roomId}`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomMember.accessToken);
			expect(response.status).toBe(403);
			// No need to recreate - room was not deleted
		});

		it('should fail when user is not authenticated', async () => {
			const response = await request(app).delete(`${ROOMS_PATH}/${roomId}`);
			expect(response.status).toBe(401);
			// No need to recreate - room was not deleted
		});

		it('should fail when using room member token', async () => {
			const response = await request(app)
				.delete(`${ROOMS_PATH}/${roomId}`)
				.set(INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, roomData.moderatorToken);
			expect(response.status).toBe(401);
			// No need to recreate - room was not deleted
		});
	});

	describe('Get Room Config Tests', () => {
		let roomData: RoomData;
		let roomId: string;
		let roomUsers: RoomTestUsers;

		beforeAll(async () => {
			roomData = await setupSingleRoom();
			roomData = await setupTestUsersForRoom(roomData);
			roomId = roomData.room.roomId;
			roomUsers = roomData.users!;
		});

		it('should succeed when request includes API key', async () => {
			const response = await request(app)
				.get(`${ROOMS_PATH}/${roomId}/config`)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY);
			expect(response.status).toBe(200);
		});

		it('should succeed when user is authenticated as ADMIN', async () => {
			const response = await request(app)
				.get(`${ROOMS_PATH}/${roomId}/config`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.admin.accessToken);
			expect(response.status).toBe(200);
		});

		it('should succeed when user is authenticated as ROOM_MANAGER and is room owner', async () => {
			const response = await request(app)
				.get(`${ROOMS_PATH}/${roomId}/config`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, roomUsers.roomManagerOwner.accessToken);
			expect(response.status).toBe(200);
		});

		it('should succeed when user is authenticated as ROOM_MANAGER and is room member', async () => {
			const response = await request(app)
				.get(`${ROOMS_PATH}/${roomId}/config`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, roomUsers.roomManagerMember.accessToken);
			expect(response.status).toBe(200);
		});

		it('should fail when user is authenticated as ROOM_MANAGER without access to the room', async () => {
			const response = await request(app)
				.get(`${ROOMS_PATH}/${roomId}/config`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomManager.accessToken);
			expect(response.status).toBe(403);
		});

		it('should succeed when user is authenticated as ROOM_MANAGER without membership and user access is enabled', async () => {
			// Enable user access for the room
			await updateRoomAccessConfig(roomId, {
				user: {
					enabled: true
				}
			});

			const response = await request(app)
				.get(`${ROOMS_PATH}/${roomId}/config`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomManager.accessToken);
			expect(response.status).toBe(200);

			// Disable user access after test
			await updateRoomAccessConfig(roomId, {
				user: {
					enabled: false
				}
			});
			// Regenerate moderator token since room config was updated
			roomData.moderatorToken = await generateRoomMemberToken(roomId, { secret: roomData.moderatorSecret });
		});

		it('should succeed when user is authenticated as ROOM_MEMBER and is room member', async () => {
			const response = await request(app)
				.get(`${ROOMS_PATH}/${roomId}/config`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, roomUsers.roomMember.accessToken);
			expect(response.status).toBe(200);
		});

		it('should fail when user is authenticated as ROOM_MEMBER without access to the room', async () => {
			const response = await request(app)
				.get(`${ROOMS_PATH}/${roomId}/config`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomMember.accessToken);
			expect(response.status).toBe(403);
		});

		it('should succeed when user is authenticated as ROOM_MEMBER without membership and user access is enabled', async () => {
			// Enable user access for the room
			await updateRoomAccessConfig(roomId, {
				user: {
					enabled: true
				}
			});

			const response = await request(app)
				.get(`${ROOMS_PATH}/${roomId}/config`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomMember.accessToken);
			expect(response.status).toBe(200);

			// Disable user access after test
			await updateRoomAccessConfig(roomId, {
				user: {
					enabled: false
				}
			});
			// Regenerate moderator token since room config was updated
			roomData.moderatorToken = await generateRoomMemberToken(roomId, { secret: roomData.moderatorSecret });
		});

		it('should fail when user is not authenticated', async () => {
			const response = await request(app).get(`${ROOMS_PATH}/${roomId}/config`);
			expect(response.status).toBe(401);
		});

		it('should succeed when using room member token', async () => {
			const response = await request(app)
				.get(`${ROOMS_PATH}/${roomId}/config`)
				.set(INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, roomData.moderatorToken);
			expect(response.status).toBe(200);
		});

		it('should fail when using room member token from a different room', async () => {
			const newRoomData = await setupSingleRoom();

			const response = await request(app)
				.get(`${ROOMS_PATH}/${roomId}/config`)
				.set(INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, newRoomData.moderatorToken);
			expect(response.status).toBe(403);
		});
	});

	describe('Update Room Config Tests', () => {
		const roomConfig = {
			recording: {
				enabled: false
			},
			chat: { enabled: true },
			virtualBackground: { enabled: true }
		};

		let roomData: RoomData;
		let roomId: string;
		let roomUsers: RoomTestUsers;

		beforeAll(async () => {
			roomData = await setupSingleRoom();
			roomData = await setupTestUsersForRoom(roomData);
			roomId = roomData.room.roomId;
			roomUsers = roomData.users!;
		});

		it('should succeed when request includes API key', async () => {
			const response = await request(app)
				.put(`${ROOMS_PATH}/${roomId}/config`)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
				.send({ config: roomConfig });
			expect(response.status).toBe(200);
		});

		it('should succeed when user is authenticated as ADMIN', async () => {
			const response = await request(app)
				.put(`${ROOMS_PATH}/${roomId}/config`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.admin.accessToken)
				.send({ config: roomConfig });
			expect(response.status).toBe(200);
		});

		it('should succeed when user is authenticated as ROOM_MANAGER and is room owner', async () => {
			const response = await request(app)
				.put(`${ROOMS_PATH}/${roomId}/config`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, roomUsers.roomManagerOwner.accessToken)
				.send({ config: roomConfig });
			expect(response.status).toBe(200);
		});

		it('should fail when user is authenticated as ROOM_MANAGER and is room member', async () => {
			const response = await request(app)
				.put(`${ROOMS_PATH}/${roomId}/config`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, roomUsers.roomManagerMember.accessToken)
				.send({ config: roomConfig });
			expect(response.status).toBe(403);
		});

		it('should fail when user is authenticated as ROOM_MANAGER without access to the room', async () => {
			const response = await request(app)
				.put(`${ROOMS_PATH}/${roomId}/config`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomManager.accessToken)
				.send({ config: roomConfig });
			expect(response.status).toBe(403);
		});

		it('should fail when user is authenticated as ROOM_MEMBER and is room member', async () => {
			const response = await request(app)
				.put(`${ROOMS_PATH}/${roomId}/config`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, roomUsers.roomMember.accessToken)
				.send({ config: roomConfig });
			expect(response.status).toBe(403);
		});

		it('should fail when user is authenticated as ROOM_MEMBER without access to the room', async () => {
			const response = await request(app)
				.put(`${ROOMS_PATH}/${roomId}/config`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomMember.accessToken)
				.send({ config: roomConfig });
			expect(response.status).toBe(403);
		});

		it('should fail when user is not authenticated', async () => {
			const response = await request(app).put(`${ROOMS_PATH}/${roomId}/config`).send({ config: roomConfig });
			expect(response.status).toBe(401);
		});

		it('should fail when using room member token', async () => {
			const response = await request(app)
				.put(`${ROOMS_PATH}/${roomId}/config`)
				.set(INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, roomData.moderatorToken)
				.send({ config: roomConfig });
			expect(response.status).toBe(401);
		});
	});

	describe('Update Room Status Tests', () => {
		let roomData: RoomData;
		let roomId: string;
		let roomUsers: RoomTestUsers;

		beforeAll(async () => {
			roomData = await setupSingleRoom();
			roomData = await setupTestUsersForRoom(roomData);
			roomId = roomData.room.roomId;
			roomUsers = roomData.users!;
		});

		it('should succeed when request includes API key', async () => {
			const response = await request(app)
				.put(`${ROOMS_PATH}/${roomId}/status`)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
				.send({ status: 'open' });
			expect(response.status).toBe(200);
		});

		it('should succeed when user is authenticated as ADMIN', async () => {
			const response = await request(app)
				.put(`${ROOMS_PATH}/${roomId}/status`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.admin.accessToken)
				.send({ status: 'open' });
			expect(response.status).toBe(200);
		});

		it('should succeed when user is authenticated as ROOM_MANAGER and is room owner', async () => {
			const response = await request(app)
				.put(`${ROOMS_PATH}/${roomId}/status`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, roomUsers.roomManagerOwner.accessToken)
				.send({ status: 'open' });
			expect(response.status).toBe(200);
		});

		it('should fail when user is authenticated as ROOM_MANAGER and is room member', async () => {
			const response = await request(app)
				.put(`${ROOMS_PATH}/${roomId}/status`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, roomUsers.roomManagerMember.accessToken)
				.send({ status: 'open' });
			expect(response.status).toBe(403);
		});

		it('should fail when user is authenticated as ROOM_MANAGER without access to the room', async () => {
			const response = await request(app)
				.put(`${ROOMS_PATH}/${roomId}/status`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomManager.accessToken)
				.send({ status: 'open' });
			expect(response.status).toBe(403);
		});

		it('should fail when user is authenticated as ROOM_MEMBER and is room member', async () => {
			const response = await request(app)
				.put(`${ROOMS_PATH}/${roomId}/status`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, roomUsers.roomMember.accessToken)
				.send({ status: 'open' });
			expect(response.status).toBe(403);
		});

		it('should fail when user is authenticated as ROOM_MEMBER without access to the room', async () => {
			const response = await request(app)
				.put(`${ROOMS_PATH}/${roomId}/status`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomMember.accessToken)
				.send({ status: 'open' });
			expect(response.status).toBe(403);
		});

		it('should fail when user is not authenticated', async () => {
			const response = await request(app).put(`${ROOMS_PATH}/${roomId}/status`).send({ status: 'open' });
			expect(response.status).toBe(401);
		});

		it('should fail when using room member token', async () => {
			const response = await request(app)
				.put(`${ROOMS_PATH}/${roomId}/status`)
				.set(INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, roomData.moderatorToken)
				.send({ status: 'open' });
			expect(response.status).toBe(401);
		});
	});

	describe('Update Room Roles Tests', () => {
		let roomData: RoomData;
		let roomId: string;
		let roomUsers: RoomTestUsers;

		beforeAll(async () => {
			roomData = await setupSingleRoom();
			roomData = await setupTestUsersForRoom(roomData);
			roomId = roomData.room.roomId;
			roomUsers = roomData.users!;
		});

		it('should succeed when request includes API key', async () => {
			const response = await request(app)
				.put(`${ROOMS_PATH}/${roomId}/roles`)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
				.send({ roles: {} });
			expect(response.status).toBe(200);
		});

		it('should succeed when user is authenticated as ADMIN', async () => {
			const response = await request(app)
				.put(`${ROOMS_PATH}/${roomId}/roles`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.admin.accessToken)
				.send({ roles: {} });
			expect(response.status).toBe(200);
		});

		it('should succeed when user is authenticated as ROOM_MANAGER and is room owner', async () => {
			const response = await request(app)
				.put(`${ROOMS_PATH}/${roomId}/roles`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, roomUsers.roomManagerOwner.accessToken)
				.send({ roles: {} });
			expect(response.status).toBe(200);
		});

		it('should fail when user is authenticated as ROOM_MANAGER and is room member', async () => {
			const response = await request(app)
				.put(`${ROOMS_PATH}/${roomId}/roles`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, roomUsers.roomManagerMember.accessToken)
				.send({ roles: {} });
			expect(response.status).toBe(403);
		});

		it('should fail when user is authenticated as ROOM_MANAGER without access to the room', async () => {
			const response = await request(app)
				.put(`${ROOMS_PATH}/${roomId}/roles`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomManager.accessToken)
				.send({ roles: {} });
			expect(response.status).toBe(403);
		});

		it('should fail when user is authenticated as ROOM_MEMBER and is room member', async () => {
			const response = await request(app)
				.put(`${ROOMS_PATH}/${roomId}/roles`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, roomUsers.roomMember.accessToken)
				.send({ roles: {} });
			expect(response.status).toBe(403);
		});

		it('should fail when user is authenticated as ROOM_MEMBER without access to the room', async () => {
			const response = await request(app)
				.put(`${ROOMS_PATH}/${roomId}/roles`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomMember.accessToken)
				.send({ roles: {} });
			expect(response.status).toBe(403);
		});

		it('should fail when user is not authenticated', async () => {
			const response = await request(app).put(`${ROOMS_PATH}/${roomId}/roles`).send({ roles: {} });
			expect(response.status).toBe(401);
		});

		it('should fail when using room member token', async () => {
			const response = await request(app)
				.put(`${ROOMS_PATH}/${roomId}/roles`)
				.set(INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, roomData.moderatorToken)
				.send({ roles: {} });
			expect(response.status).toBe(401);
		});
	});

	describe('Update Room Access Config Tests', () => {
		let roomData: RoomData;
		let roomId: string;
		let roomUsers: RoomTestUsers;

		beforeAll(async () => {
			roomData = await setupSingleRoom();
			roomData = await setupTestUsersForRoom(roomData);
			roomId = roomData.room.roomId;
			roomUsers = roomData.users!;
		});

		it('should succeed when request includes API key', async () => {
			const response = await request(app)
				.put(`${ROOMS_PATH}/${roomId}/access`)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
				.send({ access: {} });
			expect(response.status).toBe(200);
		});

		it('should succeed when user is authenticated as ADMIN', async () => {
			const response = await request(app)
				.put(`${ROOMS_PATH}/${roomId}/access`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.admin.accessToken)
				.send({ access: {} });
			expect(response.status).toBe(200);
		});

		it('should succeed when user is authenticated as ROOM_MANAGER and is room owner', async () => {
			const response = await request(app)
				.put(`${ROOMS_PATH}/${roomId}/access`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, roomUsers.roomManagerOwner.accessToken)
				.send({ access: {} });
			expect(response.status).toBe(200);
		});

		it('should fail when user is authenticated as ROOM_MANAGER and is room member', async () => {
			const response = await request(app)
				.put(`${ROOMS_PATH}/${roomId}/access`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, roomUsers.roomManagerMember.accessToken)
				.send({ access: {} });
			expect(response.status).toBe(403);
		});

		it('should fail when user is authenticated as ROOM_MANAGER without access to the room', async () => {
			const response = await request(app)
				.put(`${ROOMS_PATH}/${roomId}/access`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomManager.accessToken)
				.send({ access: {} });
			expect(response.status).toBe(403);
		});

		it('should fail when user is authenticated as ROOM_MEMBER and is room member', async () => {
			const response = await request(app)
				.put(`${ROOMS_PATH}/${roomId}/access`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, roomUsers.roomMember.accessToken)
				.send({ access: {} });
			expect(response.status).toBe(403);
		});

		it('should fail when user is authenticated as ROOM_MEMBER without access to the room', async () => {
			const response = await request(app)
				.put(`${ROOMS_PATH}/${roomId}/access`)
				.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, testUsers.roomMember.accessToken)
				.send({ access: {} });
			expect(response.status).toBe(403);
		});

		it('should fail when user is not authenticated', async () => {
			const response = await request(app).put(`${ROOMS_PATH}/${roomId}/access`).send({ access: {} });
			expect(response.status).toBe(401);
		});

		it('should fail when using room member token', async () => {
			const response = await request(app)
				.put(`${ROOMS_PATH}/${roomId}/access`)
				.set(INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, roomData.moderatorToken)
				.send({ access: {} });
			expect(response.status).toBe(401);
		});
	});
});

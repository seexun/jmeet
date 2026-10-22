import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { MeetRoom } from '@openvidu-meet/typings';
import { Express } from 'express';
import request from 'supertest';
import { INTERNAL_CONFIG } from '../../../../src/config/internal-config.js';
import { MEET_ENV } from '../../../../src/environment.js';
import {
	createRoom,
	deleteAllRecordings,
	deleteAllRooms,
	getFullPath,
	getRoomConfig,
	startRecording,
	startTestServer,
	updateRoomConfig
} from '../../../helpers/request-helpers.js';
import { setupMultiRoomTestContext } from '../../../helpers/test-scenarios.js';

const ROOMS_PATH = getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/rooms`);

describe('E2EE Room Configuration Tests', () => {
	let app: Express;

	beforeAll(async () => {
		app = await startTestServer();
	});

	afterAll(async () => {
		await deleteAllRooms();
		await deleteAllRecordings();
	});

	describe('E2EE Default Configuration', () => {
		it('Should create a room with E2EE disabled by default', async () => {
			const room = await createRoom(
				{
					roomName: 'Test E2EE Default'
				},
				undefined,
				{ xExtraFields: 'config' }
			);

			// Validate room structure (skip config validation in expectValidRoom since we're checking it below)
			expect(room).toBeDefined();
			expect(room.roomName).toBe('Test E2EE Default');
			expect(room.roomId).toBeDefined();
			expect(room.config).toBeDefined();
			expect(room.config.e2ee).toBeDefined();
			expect(room.config.e2ee.enabled).toBe(false);
		});
	});

	describe('E2EE Enabled Configuration', () => {
		it('Should create a room with E2EE enabled and recording automatically disabled', async () => {
			const payload = {
				roomName: 'Test E2EE Enabled',
				config: {
					recording: {
						enabled: true // This should be automatically disabled
					},
					chat: { enabled: true },
					virtualBackground: { enabled: true },
					e2ee: { enabled: true },
					captions: { enabled: true }
				}
			};

			const room = await createRoom(payload, undefined, { xFields: 'roomName,config', xExtraFields: 'config' });

			expect(room.roomName).toBe('Test E2EE Enabled');
			expect(room.config.e2ee.enabled).toBe(true);
			expect(room.config.recording.enabled).toBe(false); // Recording should be disabled
		});
	});

	describe('E2EE and Recording Interaction', () => {
		it('Should not allow starting recording in a room with E2EE enabled', async () => {
			const context = await setupMultiRoomTestContext(1, true, {
				e2ee: { enabled: true }
			});

			const { room } = context.getRoomByIndex(0)!;

			// Try to start recording (should fail because recording is not enabled in room config)
			const response = await startRecording(room.roomId);

			// The endpoint returns 403 when the recording endpoint doesn't exist for disabled recording rooms
			expect(response.status).toBe(403);
			expect(response.body.message).toBe(`Recording is disabled for room '${room.roomId}'`);
		});

		it('Should disable recording when updating room config to enable E2EE', async () => {
			// Create room with recording enabled and E2EE disabled
			const room = await createRoom(
				{
					roomName: 'Test E2EE Update',
					config: {
						recording: {
							enabled: true
						},
						chat: { enabled: true },
						virtualBackground: { enabled: true },
						e2ee: { enabled: false },
						captions: { enabled: true }
					}
				},
				undefined,
				{ xExtraFields: 'config' }
			);

			expect(room.config.recording.enabled).toBe(true);
			expect(room.config.e2ee?.enabled).toBe(false);

			// Update room to enable E2EE (recording should be automatically disabled)
			const updatedConfig = {
				e2ee: { enabled: true }
			};
			const response = await updateRoomConfig(room.roomId, updatedConfig);

			expect(response.status).toBe(200);

			// Fetch the updated room to verify changes
			const { status, body: config } = await getRoomConfig(room.roomId);

			expect(status).toBe(200);
			expect(config.e2ee.enabled).toBe(true);
			expect(config.recording.enabled).toBe(false);
		});
	});

	describe('E2EE Validation Tests', () => {
		it('Should fail when e2ee is not an object', async () => {
			const payload = {
				roomName: 'Test Invalid E2EE',
				config: {
					recording: {
						enabled: true
					},
					chat: { enabled: true },
					virtualBackground: { enabled: true },
					e2ee: 'invalid-e2ee', // Should be an object
					captions: { enabled: true }
				}
			};

			const response = await request(app)
				.post(ROOMS_PATH)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
				.send(payload)
				.expect(422);

			expect(JSON.stringify(response.body.details)).toContain('Expected object');
		});

		it('Should fail when e2ee.enabled is not a boolean', async () => {
			const payload = {
				roomName: 'Test Invalid E2EE Enabled',
				config: {
					recording: {
						enabled: true
					},
					chat: { enabled: true },
					virtualBackground: { enabled: true },
					e2ee: { enabled: 'yes' }, // Should be a boolean
					captions: { enabled: true }
				}
			};

			const response = await request(app)
				.post(ROOMS_PATH)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
				.send(payload)
				.expect(422);

			expect(JSON.stringify(response.body.details)).toContain('Expected boolean');
		});
	});

	describe('E2EE Update Configuration Tests', () => {
		it('Should successfully update room config with E2EE disabled to enabled', async () => {
			const room = await createRoom(
				{
					roomName: 'Test E2EE Update Enabled'
				},
				undefined,
				{ xExtraFields: 'config' }
			);

			expect(room.config.e2ee.enabled).toBe(false);

			const { status, body: config } = await updateRoomConfig(room.roomId, {
				recording: {
					enabled: false
				},
				chat: { enabled: true },
				virtualBackground: { enabled: true },
				e2ee: { enabled: true },
				captions: { enabled: true }
			});

			expect(status).toBe(200);
			expect(config.e2ee.enabled).toBe(true);
			expect(config.recording.enabled).toBe(false);
		});
	});

	describe('E2EE and Room Status Tests', () => {
		it('Should return E2EE configuration when listing rooms', async () => {
			await deleteAllRooms();

			const room1 = await createRoom(
				{
					roomName: 'E2EE Enabled Room',
					config: {
						recording: {
							enabled: false
						},
						chat: { enabled: true },
						virtualBackground: { enabled: true },
						e2ee: { enabled: true },
						captions: { enabled: true }
					}
				},
				undefined,
				{ xFields: 'roomId' }
			);

			const room2 = await createRoom(
				{
					roomName: 'E2EE Disabled Room',
					config: {
						recording: {
							enabled: true
						},
						chat: { enabled: true },
						virtualBackground: { enabled: true },
						e2ee: { enabled: false },
						captions: { enabled: true }
					}
				},
				undefined,
				{ xFields: 'roomId' }
			);

			const response = await request(app)
				.get(ROOMS_PATH)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
				.query({ extraFields: 'config' })
				.expect(200);

			// Filter out any rooms from other test suites
			const testRooms = response.body.rooms.filter(
				(r: MeetRoom) => r.roomId === room1.roomId || r.roomId === room2.roomId
			);

			expect(testRooms).toHaveLength(2);

			const e2eeEnabledRoom = testRooms.find((r: MeetRoom) => r.roomId === room1.roomId);
			const e2eeDisabledRoom = testRooms.find((r: MeetRoom) => r.roomId === room2.roomId);

			expect(e2eeEnabledRoom.config.e2ee.enabled).toBe(true);
			expect(e2eeEnabledRoom.config.recording.enabled).toBe(false);

			expect(e2eeDisabledRoom.config.e2ee.enabled).toBe(false);
			expect(e2eeDisabledRoom.config.recording.enabled).toBe(true);
		});
	});
});

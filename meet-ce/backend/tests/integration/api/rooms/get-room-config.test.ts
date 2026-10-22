import { afterEach, beforeAll, describe, it } from '@jest/globals';
import { MeetRecordingEncodingPreset, MeetRecordingLayout } from '@openvidu-meet/typings';
import { Response } from 'supertest';
import { expectSuccessRoomConfigResponse } from '../../../helpers/assertion-helpers.js';
import { deleteAllRooms, getRoomConfig, startTestServer } from '../../../helpers/request-helpers.js';
import { setupSingleRoom } from '../../../helpers/test-scenarios.js';

describe('Room API Tests', () => {
	const DEFAULT_CONFIG = {
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

	beforeAll(async () => {
		await startTestServer();
	});

	afterEach(async () => {
		// Remove all rooms created
		await deleteAllRooms();
	});

	describe('Get Room Config Tests', () => {
		it('should successfully retrieve a room by its ID', async () => {
			const roomData = await setupSingleRoom();
			const roomId = roomData.room.roomId;

			const response: Response = await getRoomConfig(roomId);
			expectSuccessRoomConfigResponse(response, DEFAULT_CONFIG);
		});

		it('should retrieve custom room config', async () => {
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

			const roomData = await setupSingleRoom(false, payload.roomName, payload.config);
			const roomId = roomData.room.roomId;

			const response = await getRoomConfig(roomId);
			expectSuccessRoomConfigResponse(response, payload.config);
		});
	});
});

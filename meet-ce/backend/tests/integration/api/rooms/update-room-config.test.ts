import { afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import {
	MeetRecordingAudioCodec,
	MeetRecordingEncodingPreset,
	MeetRecordingLayout,
	MeetRecordingVideoCodec,
	MeetRoomConfig
} from '@openvidu-meet/typings';
import { DEFAULT_RECORDING_ENCODING_PRESET, expectValidationError } from '../../../helpers/assertion-helpers.js';
import {
	createRoom,
	deleteAllRooms,
	getRoom,
	startTestServer,
	updateRoomConfig
} from '../../../helpers/request-helpers.js';
import { setupSingleRoom } from '../../../helpers/test-scenarios.js';

describe('Room API Tests', () => {
	beforeAll(async () => {
		await startTestServer();
	});

	afterEach(async () => {
		// Remove all rooms created
		await deleteAllRooms();
	});

	describe('Update Room Config Tests', () => {
		it('should successfully update room config', async () => {
			const createdRoom = await createRoom({
				roomName: 'update-test',
				config: {
					recording: {
						enabled: true,
						encoding: MeetRecordingEncodingPreset.H264_720P_30
					},
					chat: { enabled: true },
					virtualBackground: { enabled: true },
					e2ee: { enabled: false },
					captions: { enabled: true }
				}
			});

			// Update the room config
			const updatedConfig = {
				recording: {
					enabled: false,
					encoding: MeetRecordingEncodingPreset.H264_1080P_60
				},
				chat: { enabled: false },
				virtualBackground: { enabled: false },
				e2ee: { enabled: true },
				captions: { enabled: true }
			};
			const updateResponse = await updateRoomConfig(createdRoom.roomId, updatedConfig);

			// Verify update response returns the updated config
			expect(updateResponse.status).toBe(200);
			expect(updateResponse.body).toEqual({
				...updatedConfig,
				recording: { ...updatedConfig.recording, layout: MeetRecordingLayout.GRID } // Layout remains unchanged
			});

			// Verify with a get request
			const getResponse = await getRoom(createdRoom.roomId, 'config', 'config');
			expect(getResponse.status).toBe(200);
			expect(getResponse.body.config).toEqual({
				...updatedConfig,
				recording: { ...updatedConfig.recording, layout: MeetRecordingLayout.GRID } // Layout remains unchanged
			});
		});

		it('should allow partial config updates', async () => {
			// Create a room first with all config enabled
			const createdRoom = await createRoom({
				roomName: 'partial-update',
				config: {
					recording: {
						enabled: true,
						layout: MeetRecordingLayout.SPEAKER
					},
					chat: { enabled: true },
					virtualBackground: { enabled: true },
					e2ee: { enabled: false },
					captions: { enabled: true }
				}
			});

			// Update only one config field
			const partialConfig = {
				recording: {
					enabled: false
				}
			};
			const updateResponse = await updateRoomConfig(createdRoom.roomId, partialConfig);

			// Verify update response returns the updated config
			expect(updateResponse.status).toBe(200);
			expect(updateResponse.body.recording.enabled).toBe(false);

			// Verify with a get request
			const getResponse = await getRoom(createdRoom.roomId, undefined, 'config');
			expect(getResponse.status).toBe(200);

			const expectedConfig: MeetRoomConfig = {
				recording: {
					enabled: false,
					layout: MeetRecordingLayout.SPEAKER,
					encoding: DEFAULT_RECORDING_ENCODING_PRESET
				},
				chat: { enabled: true },
				virtualBackground: { enabled: true },
				e2ee: { enabled: false },
				captions: { enabled: true }
			};
			expect(getResponse.body.config).toEqual(expectedConfig);
		});

		it('should reject room config update when there is an active meeting', async () => {
			// Create a room with active meeting
			const roomData = await setupSingleRoom(true);

			// Try to update room config
			const newConfig = {
				recording: {
					enabled: false
				},
				chat: {
					enabled: false
				},
				virtualBackground: {
					enabled: false
				},
				e2ee: {
					enabled: false
				}
			};

			const response = await updateRoomConfig(roomData.room.roomId, newConfig);
			expect(response.status).toBe(409);
			expect(response.body.error).toBe('Room Error');
			expect(response.body.message).toContain(`Room '${roomData.room.roomId}' has an active meeting`);
		});

		it('should return 404 when updating non-existent room', async () => {
			const nonExistentRoomId = 'non-existent-room';

			const config = {
				recording: {
					enabled: false
				},
				chat: { enabled: false },
				virtualBackground: { enabled: false }
			};
			const response = await updateRoomConfig(nonExistentRoomId, config);

			expect(response.status).toBe(404);
			expect(response.body.message).toContain(`'${nonExistentRoomId}' does not exist`);
		});

		it('should update room encoding preset from H264_720P_30 to H264_1080P_60', async () => {
			const createdRoom = await createRoom({
				roomName: 'encoding-update-test',
				config: {
					recording: {
						enabled: true,
						encoding: MeetRecordingEncodingPreset.H264_720P_30
					}
				}
			});

			// Update encoding preset
			const updatedConfig = {
				recording: {
					enabled: true,
					encoding: MeetRecordingEncodingPreset.H264_1080P_60
				}
			};
			const updateResponse = await updateRoomConfig(createdRoom.roomId, updatedConfig);

			expect(updateResponse.status).toBe(200);

			// Verify with a get request
			const getResponse = await getRoom(createdRoom.roomId, 'config', 'config');
			expect(getResponse.status).toBe(200);
			expect(getResponse.body.config.recording.encoding).toBe(MeetRecordingEncodingPreset.H264_1080P_60);
		});

		it('should update room encoding from preset to advanced options', async () => {
			const createdRoom = await createRoom({
				roomName: 'preset-to-advanced',
				config: {
					recording: {
						enabled: true
					}
				}
			});

			// Update to advanced encoding with both video and audio
			const updatedConfig = {
				recording: {
					enabled: true,
					encoding: {
						video: {
							width: 1920,
							height: 1080,
							framerate: 60,
							codec: MeetRecordingVideoCodec.H264_HIGH,
							bitrate: 5000,
							keyFrameInterval: 2,
							depth: 24
						},
						audio: {
							codec: MeetRecordingAudioCodec.AAC,
							bitrate: 192,
							frequency: 48000
						}
					}
				}
			};
			const updateResponse = await updateRoomConfig(createdRoom.roomId, updatedConfig);

			expect(updateResponse.status).toBe(200);

			// Verify with a get request
			const getResponse = await getRoom(createdRoom.roomId, undefined, 'config');
			expect(getResponse.status).toBe(200);
			expect(getResponse.body.config.recording.encoding).toMatchObject(updatedConfig.recording.encoding);
		});

		it('should update room encoding config from advanced options to preset', async () => {
			const recordingEncoding = {
				video: {
					width: 1280,
					height: 720,
					framerate: 30,
					codec: MeetRecordingVideoCodec.H264_MAIN,
					bitrate: 3000,
					keyFrameInterval: 4,
					depth: 24
				},
				audio: {
					codec: MeetRecordingAudioCodec.OPUS,
					bitrate: 128,
					frequency: 44100
				}
			};
			const createdRoom = await createRoom(
				{
					roomName: 'advanced-to-preset',
					config: {
						recording: {
							enabled: true,
							encoding: recordingEncoding
						}
					}
				},
				undefined,
				{ xExtraFields: 'config' }
			);

			expect(createdRoom.config.recording.encoding).toMatchObject(recordingEncoding);
			// Update to preset encoding
			const updatedConfig = {
				recording: {
					enabled: true,
					encoding: MeetRecordingEncodingPreset.PORTRAIT_H264_1080P_60
				}
			};
			const updateResponse = await updateRoomConfig(createdRoom.roomId, updatedConfig);

			expect(updateResponse.status).toBe(200);

			// Verify with a get request
			const getResponse = await getRoom(createdRoom.roomId, undefined, 'config');
			expect(getResponse.status).toBe(200);
			expect(getResponse.body.config.recording.encoding).toBe(MeetRecordingEncodingPreset.PORTRAIT_H264_1080P_60);
		});

		it('should update only encoding while keeping other recording config', async () => {
			const createdRoom = await createRoom(
				{
					roomName: 'partial-encoding-update',
					config: {
						recording: {
							enabled: true,
							layout: MeetRecordingLayout.SPEAKER,
							encoding: MeetRecordingEncodingPreset.H264_720P_30
						}
					}
				},
				undefined,
				{ xExtraFields: 'config' }
			);

			expect(createdRoom.config.recording.layout).toBe(MeetRecordingLayout.SPEAKER);
			expect(createdRoom.config.recording.encoding).toBe(MeetRecordingEncodingPreset.H264_720P_30);

			// Update only encoding
			const partialConfig: Partial<MeetRoomConfig> = {
				recording: {
					enabled: true,
					encoding: MeetRecordingEncodingPreset.H264_1080P_30
				}
			};
			const updateResponse = await updateRoomConfig(createdRoom.roomId, partialConfig);

			expect(updateResponse.status).toBe(200);

			// Verify with a get request
			const getResponse = await getRoom(createdRoom.roomId, 'config', 'config');
			expect(getResponse.status).toBe(200);

			const expectedConfig = {
				recording: {
					enabled: true,
					layout: MeetRecordingLayout.SPEAKER,
					encoding: MeetRecordingEncodingPreset.H264_1080P_30
				},
				chat: { enabled: true },
				virtualBackground: { enabled: true },
				e2ee: { enabled: false },
				captions: { enabled: true }
			};
			expect(getResponse.body.config).toEqual(expectedConfig);
		});
	});

	describe('Update Room Config Validation failures', () => {
		it('should fail when config has incorrect types', async () => {
			const createdRoom = await createRoom({
				roomName: 'type-test'
			});

			// Invalid config (wrong types)
			const invalidConfig = {
				recording: {
					enabled: 'true' // String instead of boolean
				},
				chat: { enabled: false },
				virtualBackground: { enabled: false }
			};
			const response = await updateRoomConfig(createdRoom.roomId, invalidConfig as unknown as MeetRoomConfig);

			expect(response.status).toBe(422);
			expect(response.body.error).toContain('Unprocessable Entity');
			expect(JSON.stringify(response.body.details)).toContain('recording.enabled');
		});

		it('should reject update with video-only encoding (audio required)', async () => {
			const createdRoom = await createRoom({
				roomName: 'video-only-update',
				config: {
					recording: {
						enabled: true,
						encoding: MeetRecordingEncodingPreset.H264_720P_30
					}
				}
			});

			const updatedConfig = {
				recording: {
					enabled: true,
					encoding: {
						video: {
							width: 1920,
							height: 1080,
							framerate: 60,
							codec: MeetRecordingVideoCodec.H264_HIGH,
							bitrate: 5000
						}
						// No audio encoding
					}
				}
			} as unknown as MeetRoomConfig;
			const updateResponse = await updateRoomConfig(createdRoom.roomId, updatedConfig);

			expectValidationError(
				updateResponse,
				'config.recording.encoding',
				'Both video and audio configuration must be provided when using encoding options'
			);
		});

		it('should reject update with audio-only encoding (video required)', async () => {
			const createdRoom = await createRoom({
				roomName: 'audio-only-update',
				config: {
					recording: {
						enabled: true,
						encoding: MeetRecordingEncodingPreset.H264_720P_30
					}
				}
			});

			const updatedConfig = {
				recording: {
					enabled: true,
					encoding: {
						audio: {
							codec: MeetRecordingAudioCodec.AAC,
							bitrate: 256,
							frequency: 48000
						}
						// No video encoding
					}
				}
			} as unknown as MeetRoomConfig;
			const updateResponse = await updateRoomConfig(createdRoom.roomId, updatedConfig);

			expectValidationError(
				updateResponse,
				'config.recording.encoding',
				'Both video and audio configuration must be provided when using encoding options'
			);
		});

		it('should fail when updating with partial video encoding missing required fields', async () => {
			const createdRoom = await createRoom({
				roomName: 'partial-video-update-test'
			});

			const invalidConfig = {
				recording: {
					enabled: true,
					encoding: {
						video: {
							width: 1920,
							height: 1080
							// Missing framerate, codec, bitrate
						},
						audio: {
							codec: MeetRecordingAudioCodec.AAC,
							bitrate: 192,
							frequency: 48000
						}
					}
				}
			};
			const response = await updateRoomConfig(createdRoom.roomId, invalidConfig as unknown as MeetRoomConfig);

			expect(response.status).toBe(422);
			expect(JSON.stringify(response.body.details)).toContain(
				'When video encoding is provided, required fields are missing'
			);
		});

		it('should fail when updating with partial audio encoding missing required fields', async () => {
			const createdRoom = await createRoom({
				roomName: 'partial-audio-update-test'
			});

			const invalidConfig = {
				recording: {
					enabled: true,
					encoding: {
						video: {
							width: 1920,
							height: 1080,
							framerate: 30,
							codec: MeetRecordingVideoCodec.H264_MAIN,
							bitrate: 4500,
							keyFrameInterval: 4,
							depth: 24
						},
						audio: {
							codec: MeetRecordingAudioCodec.AAC
							// Missing bitrate and frequency
						}
					}
				}
			};
			const response = await updateRoomConfig(createdRoom.roomId, invalidConfig as unknown as MeetRoomConfig);

			expect(response.status).toBe(422);
			expect(JSON.stringify(response.body.details)).toContain(
				'When audio encoding is provided, required fields are missing'
			);
		});

		it('should fail when updating with empty encoding object', async () => {
			const createdRoom = await createRoom({
				roomName: 'empty-encoding-update-test'
			});

			const invalidConfig = {
				recording: {
					enabled: true,
					encoding: {}
				}
			};
			const response = await updateRoomConfig(createdRoom.roomId, invalidConfig as unknown as MeetRoomConfig);

			expect(response.status).toBe(422);
			expect(JSON.stringify(response.body.details)).toContain(
				'Both video and audio configuration must be provided when using encoding options'
			);
		});

		it('should fail when updating encoding with invalid types', async () => {
			const createdRoom = await createRoom({
				roomName: 'invalid-types-update-test'
			});

			const invalidConfig = {
				recording: {
					enabled: true,
					encoding: {
						video: {
							width: '1920', // String instead of number
							height: 1080,
							framerate: 30,
							codec: MeetRecordingVideoCodec.H264_MAIN,
							bitrate: 4500
						},
						audio: {
							codec: MeetRecordingAudioCodec.AAC,
							bitrate: 192,
							frequency: 48000
						}
					}
				}
			};
			const response = await updateRoomConfig(createdRoom.roomId, invalidConfig as unknown as MeetRoomConfig);

			expect(response.status).toBe(422);
			expect(JSON.stringify(response.body.details)).toContain('Expected number');
		});
	});
});

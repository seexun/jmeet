/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import {
	MeetRecordingAudioCodec,
	MeetRecordingEncodingOptions,
	MeetRecordingEncodingPreset,
	MeetRecordingLayout,
	MeetRecordingVideoCodec,
	MeetRoomDeletionPolicyWithMeeting,
	MeetRoomDeletionPolicyWithRecordings
} from '@openvidu-meet/typings';
import { Express } from 'express';
import ms from 'ms';
import request from 'supertest';
import { INTERNAL_CONFIG } from '../../../../src/config/internal-config.js';
import { MEET_ENV } from '../../../../src/environment.js';
import {
	DEFAULT_RECORDING_ENCODING_PRESET,
	DEFAULT_RECORDING_LAYOUT,
	expectExtraFieldsInResponse,
	expectValidRoom,
	expectValidationError
} from '../../../helpers/assertion-helpers.js';
import { createRoom, deleteAllRooms, getFullPath, getRoom, startTestServer } from '../../../helpers/request-helpers.js';

const ROOMS_PATH = getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/rooms`);

describe('Room API Tests', () => {
	const validAutoDeletionDate = Date.now() + ms('2h');

	let app: Express;

	beforeAll(async () => {
		app = await startTestServer();
	});

	afterAll(async () => {
		await deleteAllRooms();
	});

	describe('Room Creation Tests', () => {
		it('Should create a room with default name when roomName is omitted', async () => {
			const room = await createRoom();
			expectValidRoom(room, 'Room');
			expectExtraFieldsInResponse(room);
		});

		it('Should create a room without autoDeletionDate (default behavior)', async () => {
			const room = await createRoom({
				roomName: 'Test Room'
			});
			expectValidRoom(room, 'Test Room');
			expectExtraFieldsInResponse(room);
		});

		it('Should create a room with a valid autoDeletionDate', async () => {
			const room = await createRoom({
				autoDeletionDate: validAutoDeletionDate,
				roomName: 'Room'
			});

			expectValidRoom(room, 'Room', 'room', undefined, validAutoDeletionDate);
			expectExtraFieldsInResponse(room);
		});

		it('Should create a room when sending full valid payload', async () => {
			const payload = {
				roomName: 'Example Room',
				autoDeletionDate: validAutoDeletionDate,
				autoDeletionPolicy: {
					withMeeting: MeetRoomDeletionPolicyWithMeeting.FORCE,
					withRecordings: MeetRoomDeletionPolicyWithRecordings.FORCE
				},
				config: {
					recording: {
						enabled: false,
						layout: MeetRecordingLayout.GRID,
						encoding: MeetRecordingEncodingPreset.H264_720P_30
					},
					chat: { enabled: false },
					virtualBackground: { enabled: true },
					e2ee: { enabled: true },
					captions: { enabled: false }
				}
			};

			const room = await createRoom(payload);

			expectValidRoom(
				room,
				'Example Room',
				'example_room',
				undefined,
				validAutoDeletionDate,
				payload.autoDeletionPolicy
			);
			expectExtraFieldsInResponse(room);
		});

		it('Should create a room when sending partial config', async () => {
			const payload = {
				roomName: 'Partial Config Room',
				autoDeletionDate: validAutoDeletionDate,
				config: {
					recording: {
						enabled: false
					},
					captions: {
						enabled: true
					}
				}
			};

			const room = await createRoom(payload);

			const expectedConfig = {
				recording: {
					enabled: false,
					layout: MeetRecordingLayout.GRID, // Default value
					encoding: MeetRecordingEncodingPreset.H264_720P_30 // Default value
				},
				chat: { enabled: true }, // Default value
				virtualBackground: { enabled: true }, // Default value
				e2ee: { enabled: false }, // Default value
				captions: { enabled: true }
			};
			expectValidRoom(room, 'Partial Config Room', 'partial_config_room', undefined, validAutoDeletionDate);
			expectExtraFieldsInResponse(room);
			const response = await getRoom(room.roomId, undefined, 'config');
			expectValidRoom(
				response.body,
				'Partial Config Room',
				'partial_config_room',
				expectedConfig,
				validAutoDeletionDate
			);
		});

		it('Should create a room when sending partial config with two fields', async () => {
			const payload = {
				roomName: 'Partial Config Room',
				autoDeletionDate: validAutoDeletionDate,
				config: {
					chat: {
						enabled: false
					},
					virtualBackground: {
						enabled: false
					}
				}
			};

			const room = await createRoom(payload);

			const expectedConfig = {
				recording: {
					enabled: true, // Default value
					layout: MeetRecordingLayout.GRID, // Default value
					encoding: MeetRecordingEncodingPreset.H264_720P_30 // Default value
				},
				chat: { enabled: false },
				virtualBackground: { enabled: false },
				e2ee: { enabled: false }, // Default value
				captions: { enabled: true } // Default value
			};
			expectValidRoom(room, 'Partial Config Room', 'partial_config_room', undefined, validAutoDeletionDate);
			expectExtraFieldsInResponse(room);
			const response = await getRoom(room.roomId, undefined, 'config');
			expectValidRoom(
				response.body,
				'Partial Config Room',
				'partial_config_room',
				expectedConfig,
				validAutoDeletionDate
			);
		});

		it('should not include config nor roles properties by default (extraFields not specified)', async () => {
			const room = await createRoom({
				roomName: 'Default Room'
			});

			// config and roles should not be in the response by default
			expect(room.config).toBeUndefined();
			expect(room.roles).toBeUndefined();
			// But _extraFields metadata should be present and list both extra fields
			expect((room as any)._extraFields).toBeDefined();
			expect((room as any)._extraFields).toContain('config');
			expect((room as any)._extraFields).toContain('roles');
			expect((room as any)._extraFields.length).toBe(2);
		});

		it('should include extra fields when X-ExtraFields header is provided', async () => {
			const room = await createRoom(
				{
					roomName: 'Extra Fields Room'
				},
				undefined,
				{ xExtraFields: 'config,roles' }
			);

			// config and roles should be present when requested via extraFields
			expect(room.config).toBeDefined();
			expect(room.config.recording.layout).toBe(DEFAULT_RECORDING_LAYOUT);
			expect(room.roles).toBeDefined();
			expect(room.roles.moderator.permissions).toBeDefined();
			expect(room.roles.speaker.permissions).toBeDefined();
			expect((room as any)._extraFields).toContain('config');
			expect((room as any)._extraFields).toContain('roles');
			expect((room as any)._extraFields.length).toBe(2);
		});

		it('should include only the requested extra field (roles) when X-ExtraFields=roles', async () => {
			const room = await createRoom(
				{
					roomName: 'Roles Only Room'
				},
				undefined,
				{ xExtraFields: 'roles' }
			);

			// Only roles should be present; config remains excluded
			expect(room.roles).toBeDefined();
			expect(room.config).toBeUndefined();
			expect((room as any)._extraFields).toContain('roles');
		});

		it('should filter fields when x-Fields header is provided', async () => {
			const room = await createRoom(undefined, undefined, { xFields: 'roomName' });

			expect(Object.keys(room).length).toBe(2); // roomName + _extraFields
			expect(room.roomName).toBeDefined();
			expect((room as any)._extraFields).toBeDefined();
			// Config should not be present even though we're filtering fields
			expect(room.config).toBeUndefined();
		});

		it('should include extra fields even when fields filter is applied', async () => {
			const room = await createRoom(undefined, undefined, { xFields: 'roomId,config', xExtraFields: 'config' });

			// Should only have roomId, config, and _extraFields
			expect(Object.keys(room).length).toBe(3);
			expect(room.roomId).toBeDefined();
			expect(room.config).toBeDefined();
			expect((room as any)._extraFields).toContain('config');
			expect((room as any)._extraFields).toContain('roles');
			expect((room as any)._extraFields.length).toBe(2);
		});

		it('should not include config if filter fields are provided without config but should include it with extraFields', async () => {
			const room = await createRoom(undefined, undefined, { xFields: 'roomName', xExtraFields: 'config' });

			expect(Object.keys(room).length).toBe(3); // roomName, config, _extraFields
			expect(room.roomName).toBeDefined();
			expect(room.config).toBeDefined();
			expect((room as any)._extraFields).toBeDefined();
		});
	});

	describe('Room Name Sanitization Tests', () => {
		it('should create room with Spanish characters and generate sanitized roomId', async () => {
			const room = await createRoom({
				roomName: 'Habitación José'
			});
			expectValidRoom(room, 'Habitación José', 'habitacion_jose');
		});

		it('should create room with German umlauts and generate sanitized roomId', async () => {
			const room = await createRoom({
				roomName: 'Café Müller'
			});
			expectValidRoom(room, 'Café Müller', 'cafe_muller');
		});

		it('should create room with French accents and generate sanitized roomId', async () => {
			const room = await createRoom({
				roomName: 'Réunion François'
			});
			expectValidRoom(room, 'Réunion François', 'reunion_francois');
		});

		it('should create room with uppercase letters and convert to lowercase in roomId', async () => {
			const room = await createRoom({
				roomName: 'MY ROOM'
			});
			expectValidRoom(room, 'MY ROOM', 'my_room');
		});

		it('should create room with mixed case and convert to lowercase in roomId', async () => {
			const room = await createRoom({
				roomName: 'MyRoom123'
			});
			expectValidRoom(room, 'MyRoom123', 'myroom123');
		});

		it('should create room with hyphens and convert to underscores in roomId', async () => {
			const room = await createRoom({
				roomName: 'my-test-room'
			});
			expectValidRoom(room, 'my-test-room', 'my_test_room');
		});

		it('should create room with spaces and convert to underscores in roomId', async () => {
			const room = await createRoom({
				roomName: 'My Test Room'
			});
			expectValidRoom(room, 'My Test Room', 'my_test_room');
		});

		it('should create room with multiple consecutive spaces and normalize in roomId', async () => {
			const room = await createRoom({
				roomName: 'My    Test    Room'
			});
			expectValidRoom(room, 'My Test Room', 'my_test_room');
		});

		it('should create room with special characters and remove them in roomId', async () => {
			const room = await createRoom({
				roomName: 'Room@#$%^&*()123'
			});
			expectValidRoom(room, 'Room@#$%^&*()123', 'room123');
		});

		it('should create room with emojis and remove them in roomId', async () => {
			const room = await createRoom({
				roomName: 'Meeting 🎉 Room'
			});
			expectValidRoom(room, 'Meeting 🎉 Room', 'meeting_room');
		});

		it('should create room with leading/trailing underscores and remove them in roomId', async () => {
			const room = await createRoom({
				roomName: '__test_room__'
			});
			expectValidRoom(room, '__test_room__', 'test_room');
		});

		it('should create room with leading/trailing hyphens and remove them in roomId', async () => {
			const room = await createRoom({
				roomName: '--test-room--'
			});
			expectValidRoom(room, '--test-room--', 'test_room');
		});

		it('should create room with multiple consecutive hyphens/underscores and normalize in roomId', async () => {
			const room = await createRoom({
				roomName: 'test___---room'
			});
			expectValidRoom(room, 'test___---room', 'test_room');
		});

		it('should create room with numbers and preserve them in roomId', async () => {
			const room = await createRoom({
				roomName: 'Room 123 456'
			});
			expectValidRoom(room, 'Room 123 456', 'room_123_456');
		});

		it('should create room with mix of all sanitization rules', async () => {
			const room = await createRoom({
				roomName: 'SALA--Médica  #2024  (Niños)'
			});
			expectValidRoom(room, 'SALA--Médica #2024 (Niños)', 'sala_medica_2024_ninos');
		});

		it('should create room with Portuguese characters and generate sanitized roomId', async () => {
			const room = await createRoom({
				roomName: 'Reunião São Paulo'
			});
			expectValidRoom(room, 'Reunião São Paulo', 'reuniao_sao_paulo');
		});

		it('should create room with Scandinavian characters and generate sanitized roomId', async () => {
			const room = await createRoom({
				roomName: 'Møde Åse'
			});
			expectValidRoom(room, 'Møde Åse', 'mde_ase');
		});

		it('should create room with Chinese characters and use default "room" prefix', async () => {
			const room = await createRoom({
				roomName: '会议室'
			});
			expectValidRoom(room, '会议室', 'room');
		});

		it('should create room with only special characters and use default "room" prefix', async () => {
			const room = await createRoom({
				roomName: '@#$%^&*()'
			});
			expectValidRoom(room, '@#$%^&*()', 'room');
		});

		it('should create room with emojis only and use default "room" prefix', async () => {
			const room = await createRoom({
				roomName: '🎉🎊🎈'
			});
			expectValidRoom(room, '🎉🎊🎈', 'room');
		});
	});

	describe('Recording Encoding Configuration Tests', () => {
		it('Should create a room without encoding and return default value', async () => {
			const payload = {
				roomName: 'Room without encoding',
				config: {
					recording: {
						enabled: true
						// No encoding specified
					}
				}
			};

			const room = await createRoom(payload);

			const expectedConfig = {
				recording: {
					enabled: true,
					layout: DEFAULT_RECORDING_LAYOUT,
					encoding: DEFAULT_RECORDING_ENCODING_PRESET
				},
				chat: { enabled: true },
				virtualBackground: { enabled: true },
				e2ee: { enabled: false },
				captions: { enabled: true }
			};
			expectValidRoom(room, 'Room without encoding', 'room_without_encoding', undefined);
			expectExtraFieldsInResponse(room);

			const response = await getRoom(room.roomId, undefined, 'config');
			expectValidRoom(response.body, 'Room without encoding', 'room_without_encoding', expectedConfig);
		});

		it('Should create a room with H264_1080P_30 encoding preset', async () => {
			const payload = {
				roomName: '1080p Preset Room',
				config: {
					recording: {
						enabled: true,
						encoding: MeetRecordingEncodingPreset.H264_1080P_30
					}
				}
			};

			const room = await createRoom(payload);

			const expectedConfig = {
				recording: {
					enabled: true,
					layout: DEFAULT_RECORDING_LAYOUT,
					encoding: MeetRecordingEncodingPreset.H264_1080P_30
				},
				chat: { enabled: true },
				virtualBackground: { enabled: true },
				e2ee: { enabled: false },
				captions: { enabled: true }
			};
			expectValidRoom(room, '1080p Preset Room', '1080p_preset_room', undefined);
			const response = await getRoom(room.roomId, undefined, 'config');
			expectValidRoom(response.body, '1080p Preset Room', '1080p_preset_room', expectedConfig);
		});

		it('Should create a room with PORTRAIT_H264_720P_30 encoding preset', async () => {
			const payload = {
				roomName: 'Portrait 720p Room',
				config: {
					recording: {
						enabled: true,
						encoding: MeetRecordingEncodingPreset.PORTRAIT_H264_720P_30
					}
				}
			};

			const room = await createRoom(payload);

			const expectedConfig = {
				recording: {
					enabled: true,
					layout: DEFAULT_RECORDING_LAYOUT,
					encoding: MeetRecordingEncodingPreset.PORTRAIT_H264_720P_30
				},
				chat: { enabled: true },
				virtualBackground: { enabled: true },
				e2ee: { enabled: false },
				captions: { enabled: true }
			};
			expectValidRoom(room, 'Portrait 720p Room', 'portrait_720p_room', undefined);
			const response = await getRoom(room.roomId, undefined, 'config');
			expectValidRoom(response.body, 'Portrait 720p Room', 'portrait_720p_room', expectedConfig);
		});

		it('Should create a room with advanced encoding options - both video and audio', async () => {
			const payload = {
				roomName: 'Full Advanced Encoding Room',
				config: {
					recording: {
						enabled: true,
						encoding: {
							video: {
								width: 1280,
								height: 720,
								framerate: 60,
								codec: MeetRecordingVideoCodec.H264_HIGH,
								bitrate: 3000,
								keyFrameInterval: 2,
								depth: 24
							},
							audio: {
								codec: MeetRecordingAudioCodec.AAC,
								bitrate: 192,
								frequency: 44100
							}
						} as MeetRecordingEncodingOptions
					}
				}
			};

			const room = await createRoom(payload);

			const expectedConfig = {
				recording: {
					enabled: true,
					layout: MeetRecordingLayout.GRID,
					encoding: {
						video: {
							width: 1280,
							height: 720,
							framerate: 60,
							codec: MeetRecordingVideoCodec.H264_HIGH,
							bitrate: 3000,
							keyFrameInterval: 2,
							depth: 24
						},
						audio: {
							codec: MeetRecordingAudioCodec.AAC,
							bitrate: 192,
							frequency: 44100
						}
					}
				},
				chat: { enabled: true },
				virtualBackground: { enabled: true },
				e2ee: { enabled: false },
				captions: { enabled: true }
			};
			expectValidRoom(room, 'Full Advanced Encoding Room', 'full_advanced_encoding_room', undefined);
			const response = await getRoom(room.roomId, undefined, 'config');
			expectValidRoom(
				response.body,
				'Full Advanced Encoding Room',
				'full_advanced_encoding_room',
				expectedConfig
			);
		});
	});

	describe('Room Creation Validation failures', () => {
		it('should fail when autoDeletionDate is negative', async () => {
			const payload = {
				autoDeletionDate: -5000,
				roomName: 'TestRoom'
			};

			const response = await request(app)
				.post(ROOMS_PATH)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
				.send(payload)
				.expect(422);

			// Check that the error message contains the positive number validation
			expect(response.body.error).toContain('Unprocessable Entity');
			expect(JSON.stringify(response.body.details)).toContain('autoDeletionDate must be a positive integer');
		});

		it('should fail when autoDeletionDate is less than 1 hour in the future', async () => {
			const payload = {
				autoDeletionDate: Date.now() + ms('30m'),
				roomName: 'TestRoom'
			};

			const response = await request(app)
				.post(ROOMS_PATH)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
				.send(payload)
				.expect(422);

			expect(response.body.error).toContain('Unprocessable Entity');
			expect(JSON.stringify(response.body.details)).toContain(
				`autoDeletionDate must be at least ${INTERNAL_CONFIG.MIN_ROOM_AUTO_DELETE_DURATION} in the future`
			);
		});

		it('should fail when autoDeletionDate is not a number (string provided)', async () => {
			const payload = {
				autoDeletionDate: 'not-a-number',
				roomName: 'TestRoom'
			};

			const response = await request(app)
				.post(ROOMS_PATH)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
				.send(payload)
				.expect(422);

			expect(JSON.stringify(response.body.details)).toContain('Expected number');
		});

		it('should fail when autoDeletionDate is a boolean', async () => {
			const payload = {
				autoDeletionDate: true,
				roomName: 'TestRoom'
			};

			const response = await request(app)
				.post(ROOMS_PATH)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
				.send(payload)
				.expect(422);

			expect(JSON.stringify(response.body.details)).toContain('Expected number');
		});

		it('should fail when autoDeletionDate is omitted but provided as null', async () => {
			const payload = {
				autoDeletionDate: null,
				roomName: 'TestRoom'
			};

			const response = await request(app)
				.post(ROOMS_PATH)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
				.send(payload)
				.expect(422);

			expect(JSON.stringify(response.body.details)).toContain('Expected number');
		});

		it('should fail when autoDeletionPolicy is not an object (string provided)', async () => {
			const payload = {
				roomName: 'TestRoom',
				autoDeletionDate: validAutoDeletionDate,
				autoDeletionPolicy: 'invalid-policy'
			};

			const response = await request(app)
				.post(ROOMS_PATH)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
				.send(payload)
				.expect(422);

			expect(JSON.stringify(response.body.details)).toContain('Expected object');
		});

		it('should fail when autoDeletionPolicy has invalid structure', async () => {
			const payload = {
				roomName: 'TestRoom',
				autoDeletionDate: validAutoDeletionDate,
				autoDeletionPolicy: {
					withMeeting: 'invalid-value',
					withRecordings: MeetRoomDeletionPolicyWithRecordings.CLOSE
				}
			};

			const response = await request(app)
				.post(ROOMS_PATH)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
				.send(payload)
				.expect(422);

			expect(JSON.stringify(response.body.details)).toContain('Invalid enum value');
		});

		it('should fail when autoDeletionPolicy.withMeeting has FAIL policy', async () => {
			const payload = {
				roomName: 'TestRoom',
				autoDeletionDate: validAutoDeletionDate,
				autoDeletionPolicy: {
					withMeeting: MeetRoomDeletionPolicyWithMeeting.FAIL,
					withRecordings: MeetRoomDeletionPolicyWithRecordings.CLOSE
				}
			};

			const response = await request(app)
				.post(ROOMS_PATH)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
				.send(payload)
				.expect(422);

			expect(JSON.stringify(response.body.details)).toContain(
				'FAIL policy is not allowed for withMeeting auto-deletion policy'
			);
		});

		it('should fail when autoDeletionPolicy.withRecordings has FAIL policy', async () => {
			const payload = {
				roomName: 'TestRoom',
				autoDeletionDate: validAutoDeletionDate,
				autoDeletionPolicy: {
					withMeeting: MeetRoomDeletionPolicyWithMeeting.WHEN_MEETING_ENDS,
					withRecordings: MeetRoomDeletionPolicyWithRecordings.FAIL
				}
			};

			const response = await request(app)
				.post(ROOMS_PATH)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
				.send(payload)
				.expect(422);

			expect(JSON.stringify(response.body.details)).toContain(
				'FAIL policy is not allowed for withRecordings auto-deletion policy'
			);
		});

		it('should fail when roomName is not a string (number provided)', async () => {
			const payload = {
				roomName: 12345,
				autoDeletionDate: validAutoDeletionDate
			};

			const response = await request(app)
				.post(ROOMS_PATH)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
				.send(payload)
				.expect(422);

			expect(JSON.stringify(response.body.details)).toContain('Expected string');
		});

		it('should fail when roomName is a boolean', async () => {
			const payload = {
				roomName: false,
				autoDeletionDate: validAutoDeletionDate
			};

			const response = await request(app)
				.post(ROOMS_PATH)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
				.send(payload)
				.expect(422);

			expect(JSON.stringify(response.body.details)).toContain('Expected string');
		});

		it('should fail when config is not an object (string provided)', async () => {
			const payload = {
				roomName: 'TestRoom',
				autoDeletionDate: validAutoDeletionDate,
				config: 'invalid-config'
			};

			const response = await request(app)
				.post(ROOMS_PATH)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
				.send(payload)
				.expect(422);

			expect(JSON.stringify(response.body.details)).toContain('Expected object');
		});

		it('should fail when config has an invalid structure', async () => {
			// Assuming config expects each sub-property to be an object with a boolean "enabled",
			// here we deliberately use an invalid structure.
			const payload = {
				roomName: 'TestRoom',
				autoDeletionDate: validAutoDeletionDate,
				config: {
					recording: {
						enabled: 'yes' // invalid boolean
					},
					chat: { enabled: true },
					virtualBackground: { enabled: true }
				}
			};

			const response = await request(app)
				.post(ROOMS_PATH)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
				.send(payload)
				.expect(422);

			expect(JSON.stringify(response.body.details)).toContain('Expected boolean');
		});

		it('should fail with invalid JSON payload', async () => {
			// In this case, instead of sending JSON object, send an invalid JSON string.
			const response = await request(app)
				.post(ROOMS_PATH)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
				.set('Content-Type', 'application/json')
				.send('{"roomName": "TestRoom",') // invalid JSON syntax
				.expect(400);

			expect(response.body.error).toContain('Bad Request');
			expect(response.body.message).toContain('Malformed body');
		});

		it('should fail when roomName is too long', async () => {
			const longRoomId = 'a'.repeat(51);
			const payload = {
				roomName: longRoomId,
				autoDeletionDate: validAutoDeletionDate
			};

			const response = await request(app)
				.post(ROOMS_PATH)
				.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
				.send(payload)
				.expect(422);

			expect(JSON.stringify(response.body.details)).toContain('roomName cannot exceed 50 characters');
		});

		describe('Encoding Validation Failures', () => {
			it('Should reject room with video-only encoding (audio required)', async () => {
				const payload = {
					roomName: 'Video Only Encoding Room',
					config: {
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
								}
								// No audio encoding
							} as MeetRecordingEncodingOptions
						}
					}
				};

				const response = await request(app)
					.post(ROOMS_PATH)
					.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
					.send(payload)
					.expect(422);

				expectValidationError(
					response,
					'config.recording.encoding',
					'Both video and audio configuration must be provided'
				);
			});

			it('Should reject room with audio-only encoding (video required)', async () => {
				const payload = {
					roomName: 'Audio Only Encoding Room',
					config: {
						recording: {
							enabled: true,
							encoding: {
								// No video encoding
								audio: {
									codec: MeetRecordingAudioCodec.OPUS,
									bitrate: 128,
									frequency: 48000
								}
							} as MeetRecordingEncodingOptions
						}
					}
				};

				const response = await request(app)
					.post(ROOMS_PATH)
					.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
					.send(payload)
					.expect(422);
				expectValidationError(
					response,
					'config.recording.encoding',
					'Both video and audio configuration must be provided'
				);
			});
			it('Should fail when encoding preset is invalid', async () => {
				const payload = {
					roomName: 'Invalid Preset',
					config: {
						recording: {
							enabled: true,
							encoding: 'INVALID_PRESET'
						}
					}
				};

				const response = await request(app)
					.post(ROOMS_PATH)
					.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
					.send(payload)
					.expect(422);

				expect(JSON.stringify(response.body.details)).toContain('Invalid encoding preset');
			});

			it('Should fail when video encoding has missing required fields', async () => {
				const payload = {
					roomName: 'Missing Video Fields',
					config: {
						recording: {
							enabled: true,
							encoding: {
								video: {
									width: 1920
									// Missing height, framerate, codec, bitrate
								},
								audio: {
									codec: 'OPUS',
									bitrate: 128,
									frequency: 48000
								}
							}
						}
					}
				};

				const response = await request(app)
					.post(ROOMS_PATH)
					.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
					.send(payload)
					.expect(422);

				// Partial video config - missing required fields
				expect(JSON.stringify(response.body.details)).toContain(
					'When video encoding is provided, required fields are missing'
				);
			});

			it('Should fail when audio encoding has missing required fields', async () => {
				const payload = {
					roomName: 'Missing Audio Fields',
					config: {
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
									codec: 'OPUS'
									// Missing bitrate and frequency
								}
							}
						}
					}
				};

				const response = await request(app)
					.post(ROOMS_PATH)
					.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
					.send(payload)
					.expect(422);

				// Partial audio config - missing required fields
				expect(JSON.stringify(response.body.details)).toContain(
					'When audio encoding is provided, required fields are missing'
				);
			});

			it('Should fail when encoding has neither video nor audio', async () => {
				const payload = {
					roomName: 'Empty Encoding',
					config: {
						recording: {
							enabled: true,
							encoding: {}
						}
					}
				};

				const response = await request(app)
					.post(ROOMS_PATH)
					.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
					.send(payload)
					.expect(422);

				expect(JSON.stringify(response.body.details)).toContain(
					'Both video and audio configuration must be provided when using encoding options'
				);
			});

			it('Should fail when encoding has invalid types', async () => {
				const payload = {
					roomName: 'Invalid Types',
					config: {
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
									codec: MeetRecordingAudioCodec.OPUS,
									bitrate: 128,
									frequency: 48000
								}
							}
						}
					}
				};

				const response = await request(app)
					.post(ROOMS_PATH)
					.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
					.send(payload)
					.expect(422);

				expect(JSON.stringify(response.body.details)).toContain('Expected number');
			});
		});
	});
});

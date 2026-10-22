import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import {
	MeetingEndAction,
	MeetRecordingEncodingPreset,
	MeetRecordingLayout,
	MeetRoomStatus
} from '@openvidu-meet/typings';
import { container } from '../../../../src/config/dependency-injector.config.js';
import { INTERNAL_CONFIG } from '../../../../src/config/internal-config.js';
import { MEET_ENV } from '../../../../src/environment.js';
import { roomMigrations } from '../../../../src/migrations/room-migrations.js';
import { generateSchemaMigrationName } from '../../../../src/models/migration.model.js';
import {
	meetRoomCollectionName,
	MeetRoomDocument,
	MeetRoomModel
} from '../../../../src/models/mongoose-schemas/room.schema.js';
import { MigrationService } from '../../../../src/services/migration.service.js';
import { startTestServer } from '../../../helpers/request-helpers.js';

// Legacy document builders used by integration tests.
// When ROOM_SCHEMA_VERSION increases, add one builder per legacy version that
// must still be migrated to the current one.

const buildLegacyRoomBase = (roomId: string) => ({
	roomId,
	roomName: 'Room',
	creationDate: Date.now(),
	status: MeetRoomStatus.OPEN,
	meetingEndAction: MeetingEndAction.NONE
});

const buildLegacyRoomV1 = (roomId: string) => ({
	schemaVersion: 1,
	...buildLegacyRoomBase(roomId),
	config: {
		chat: { enabled: true },
		recording: {
			enabled: true,
			allowAccessTo: 'admin_moderator_speaker'
		},
		virtualBackground: { enabled: true },
		e2ee: { enabled: false }
	},
	moderatorUrl: `/room/${roomId}?secret=123456`,
	speakerUrl: `/room/${roomId}?secret=abcdef`
});

const buildLegacyRoomV2 = (roomId: string) => ({
	schemaVersion: 2,
	...buildLegacyRoomBase(roomId),
	config: {
		chat: { enabled: true },
		recording: {
			enabled: true,
			layout: MeetRecordingLayout.GRID,
			encoding: MeetRecordingEncodingPreset.H264_720P_30,
			allowAccessTo: 'admin_moderator_speaker'
		},
		virtualBackground: { enabled: true },
		e2ee: { enabled: false },
		captions: { enabled: true }
	},
	moderatorUrl: `/room/${roomId}?secret=123456`,
	speakerUrl: `/room/${roomId}?secret=abcdef`
});

/**
 * Single assertion function for migrated room documents in integration tests.
 * This ensures all fields are validated consistently across test cases, and serves
 * as a single source of truth for the expected final state of any migrated room
 * document (regardless of the original version).
 * Keep this aligned with the CURRENT room schema (not intermediate versions).
 */
const expectMigratedRoomToCurrentVersion = (migratedRoom: Record<string, unknown>, roomId: string) => {
	expect(migratedRoom).toMatchObject({
		schemaVersion: INTERNAL_CONFIG.ROOM_SCHEMA_VERSION,
		roomId,
		roomName: 'Room',
		owner: MEET_ENV.INITIAL_ADMIN_USER,
		creationDate: expect.any(Number),
		config: {
			chat: { enabled: true },
			recording: {
				enabled: true,
				layout: MeetRecordingLayout.GRID,
				encoding: MeetRecordingEncodingPreset.H264_720P_30
			},
			virtualBackground: { enabled: true },
			e2ee: { enabled: false },
			captions: {
				enabled: true
			}
		},
		roles: {
			moderator: {
				permissions: expect.any(Object)
			},
			speaker: {
				permissions: expect.any(Object)
			}
		},
		access: {
			anonymous: {
				moderator: {
					enabled: true,
					url: `/room/${roomId}?secret=123456`
				},
				speaker: {
					enabled: true,
					url: `/room/${roomId}?secret=abcdef`
				},
				recording: {
					enabled: true,
					url: expect.stringContaining(`/room/${roomId}/recordings`)
				}
			},
			user: {
				enabled: false,
				url: `/room/${roomId}`
			}
		},
		rolesUpdatedAt: expect.any(Number),
		status: MeetRoomStatus.OPEN,
		meetingEndAction: MeetingEndAction.NONE
	});

	expect(migratedRoom).not.toHaveProperty('moderatorUrl');
	expect(migratedRoom).not.toHaveProperty('speakerUrl');
	expect(migratedRoom).not.toHaveProperty('config.recording.allowAccessTo');
};

describe('Room Schema Migrations', () => {
	/**
	 * Unit tests validate each transform independently.
	 * Add one test per room transform function.
	 */
	describe('Room Migration Transforms', () => {
		it('should transform room schema from v1 to v2', () => {
			const migrationName = generateSchemaMigrationName(meetRoomCollectionName, 1, 2);
			const transform = roomMigrations.get(migrationName);
			expect(transform).toBeDefined();

			const roomV1 = {
				schemaVersion: 1,
				roomId: 'room-v1',
				roomName: 'Room V1',
				creationDate: Date.now(),
				config: {
					chat: { enabled: true },
					recording: {
						enabled: true,
						allowAccessTo: 'admin_moderator_speaker'
					},
					virtualBackground: { enabled: true },
					e2ee: { enabled: false }
				},
				moderatorUrl: '/room/room-v1?secret=123456',
				speakerUrl: '/room/room-v1?secret=abcdef',
				status: MeetRoomStatus.OPEN,
				meetingEndAction: MeetingEndAction.NONE
			} as unknown as MeetRoomDocument;

			const migratedRoom = transform!(roomV1);
			expect(migratedRoom).toMatchObject({
				roomId: 'room-v1',
				roomName: 'Room V1',
				creationDate: expect.any(Number),
				config: {
					chat: { enabled: true },
					recording: {
						enabled: true,
						allowAccessTo: 'admin_moderator_speaker',
						layout: MeetRecordingLayout.GRID,
						encoding: MeetRecordingEncodingPreset.H264_720P_30
					},
					virtualBackground: { enabled: true },
					e2ee: { enabled: false },
					captions: { enabled: true }
				},
				moderatorUrl: '/room/room-v1?secret=123456',
				speakerUrl: '/room/room-v1?secret=abcdef',
				status: MeetRoomStatus.OPEN,
				meetingEndAction: MeetingEndAction.NONE
			});
		});

		it('should transform room schema from v2 to v3', () => {
			const migrationName = generateSchemaMigrationName(meetRoomCollectionName, 2, 3);
			const transform = roomMigrations.get(migrationName);
			expect(transform).toBeDefined();

			const roomV2 = {
				schemaVersion: 2,
				roomId: 'room-v2',
				roomName: 'Room V2',
				creationDate: Date.now(),
				config: {
					chat: { enabled: true },
					recording: {
						enabled: true,
						layout: MeetRecordingLayout.GRID,
						encoding: MeetRecordingEncodingPreset.H264_720P_30,
						allowAccessTo: 'admin_moderator_speaker'
					},
					virtualBackground: { enabled: true },
					e2ee: { enabled: false },
					captions: { enabled: true }
				},
				moderatorUrl: '/room/room-v2?secret=123456',
				speakerUrl: '/room/room-v2?secret=abcdef',
				status: MeetRoomStatus.OPEN,
				meetingEndAction: MeetingEndAction.NONE
			} as unknown as MeetRoomDocument;

			const migratedRoom = transform!(roomV2);
			expect(migratedRoom).toMatchObject({
				roomId: 'room-v2',
				roomName: 'Room V2',
				owner: MEET_ENV.INITIAL_ADMIN_USER,
				creationDate: expect.any(Number),
				config: {
					chat: { enabled: true },
					recording: {
						enabled: true,
						layout: MeetRecordingLayout.GRID,
						encoding: MeetRecordingEncodingPreset.H264_720P_30
					},
					virtualBackground: { enabled: true },
					e2ee: { enabled: false },
					captions: { enabled: true }
				},
				roles: {
					moderator: {
						permissions: {
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
						}
					},
					speaker: {
						permissions: {
							canRecord: false,
							canRetrieveRecordings: true,
							canDeleteRecordings: false,
							canJoinMeeting: true,
							canShareAccessLinks: false,
							canMakeModerator: false,
							canKickParticipants: false,
							canEndMeeting: false,
							canPublishVideo: true,
							canPublishAudio: true,
							canShareScreen: true,
							canReadChat: true,
							canWriteChat: true,
							canChangeVirtualBackground: true
						}
					}
				},
				access: {
					anonymous: {
						moderator: {
							enabled: true,
							url: '/room/room-v2?secret=123456'
						},
						speaker: {
							enabled: true,
							url: '/room/room-v2?secret=abcdef'
						},
						recording: {
							enabled: true,
							url: expect.stringContaining('/room/room-v2/recordings')
						}
					},
					user: {
						enabled: false,
						url: '/room/room-v2'
					}
				},
				rolesUpdatedAt: expect.any(Number),
				status: MeetRoomStatus.OPEN,
				meetingEndAction: MeetingEndAction.NONE
			});
			expect(migratedRoom).not.toHaveProperty('moderatorUrl');
			expect(migratedRoom).not.toHaveProperty('speakerUrl');
			expect(migratedRoom).not.toHaveProperty('config.recording.allowAccessTo');
		});
	});

	describe('Room Migration Integration', () => {
		let migrationService: MigrationService;
		const testRoomIds: string[] = [];

		beforeAll(async () => {
			await startTestServer();
			migrationService = container.get(MigrationService);
		});

		afterAll(async () => {
			await MeetRoomModel.collection.deleteMany({ roomId: { $in: testRoomIds } });
		});

		// Integration tests validate that any legacy version reaches the CURRENT version.
		// Keep one case per supported legacy version in this matrix.
		it.each([
			{ fromVersion: 1, buildDocument: buildLegacyRoomV1 },
			{ fromVersion: 2, buildDocument: buildLegacyRoomV2 }
		])(
			'should migrate a legacy room document from v$fromVersion to current version (v3)',
			async ({ buildDocument }) => {
				const roomId = `legacy-room-${Date.now()}`;
				testRoomIds.push(roomId);

				await MeetRoomModel.collection.insertOne(buildDocument(roomId));
				await migrationService.runMigrations();

				const migratedRoom = await MeetRoomModel.collection.findOne({ roomId });
				expect(migratedRoom).toBeTruthy();
				expectMigratedRoomToCurrentVersion(migratedRoom as Record<string, unknown>, roomId);
			}
		);
	});
});

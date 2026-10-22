import { MeetRecordingEncodingPreset, MeetRecordingLayout } from '@openvidu-meet/typings';
import { uid as secureUid } from 'uid/secure';
import { MEET_ENV } from '../environment.js';
import type { SchemaMigrationMap, SchemaTransform } from '../models/migration.model.js';
import { generateSchemaMigrationName } from '../models/migration.model.js';
import type { MeetRoomDocument } from '../models/mongoose-schemas/room.schema.js';
import { meetRoomCollectionName } from '../models/mongoose-schemas/room.schema.js';

const roomMigrationV1ToV2Name = generateSchemaMigrationName(meetRoomCollectionName, 1, 2);
const roomMigrationV2ToV3Name = generateSchemaMigrationName(meetRoomCollectionName, 2, 3);

const roomMigrationV1ToV2Transform: SchemaTransform<MeetRoomDocument> = (room) => {
	room.config.captions = { enabled: true };
	room.config.recording.layout = MeetRecordingLayout.GRID;
	room.config.recording.encoding = MeetRecordingEncodingPreset.H264_720P_30;
	return room;
};

const roomMigrationV2ToV3Transform: SchemaTransform<MeetRoomDocument> = (room) => {
	const legacyRoom = room as unknown as {
		moderatorUrl?: string;
		speakerUrl?: string;
		config: {
			recording: {
				allowAccessTo?: unknown;
			};
		};
	};

	room.owner = MEET_ENV.INITIAL_ADMIN_USER;
	room.roles = {
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
	};
	room.access = {
		anonymous: {
			moderator: {
				enabled: true,
				url: legacyRoom.moderatorUrl!
			},
			speaker: {
				enabled: true,
				url: legacyRoom.speakerUrl!
			},
			recording: {
				enabled: true,
				url: `/room/${room.roomId}/recordings?secret=${secureUid(10)}`
			}
		},
		user: {
			enabled: false,
			url: `/room/${room.roomId}`
		}
	};
	room.rolesUpdatedAt = Date.now();

	delete legacyRoom.moderatorUrl;
	delete legacyRoom.speakerUrl;
	delete legacyRoom.config.recording.allowAccessTo;

	return room;
};

/**
 * Schema migrations for MeetRoom.
 * Key format: schema_{collection}_v{from}_to_v{to}
 */
export const roomMigrations: SchemaMigrationMap<MeetRoomDocument> = new Map([
	[roomMigrationV1ToV2Name, roomMigrationV1ToV2Transform],
	[roomMigrationV2ToV3Name, roomMigrationV2ToV3Transform]
]);

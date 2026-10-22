import type {
	MeetRoom} from '@openvidu-meet/typings';
import {
	MeetRecordingLayout,
	MeetRoomDeletionPolicyWithMeeting,
	MeetRoomDeletionPolicyWithRecordings,
	MeetRoomStatus,
	MeetRoomThemeMode,
	MeetingEndAction
} from '@openvidu-meet/typings';
import { Schema, model } from 'mongoose';
import { INTERNAL_CONFIG } from '../../config/internal-config.js';
import type { DocumentOnlyField } from '../database.model.js';
import type { SchemaMigratableDocument } from '../migration.model.js';
import { MeetRoomMemberPermissionsSchema } from './room-member.schema.js';

/**
 * Mongoose Document interface for rooms.
 * Extends the MeetRoom interface with schemaVersion for migration tracking.
 */
export interface MeetRoomDocument extends MeetRoom, SchemaMigratableDocument {}

/**
 * Type for fields in MeetRoomDocument that are not present in MeetRoom domain model.
 */
export type MeetRoomDocumentOnlyField = DocumentOnlyField<MeetRoomDocument, MeetRoom>;

/**
 * List of fields that exist only in the MeetRoomDocument and not in the MeetRoom domain model.
 * IMPORTANT: Update this list if new document-only fields are added to the MeetRoomDocument interface
 */
export const MEET_ROOM_DOCUMENT_ONLY_FIELDS = ['schemaVersion'] as const satisfies readonly MeetRoomDocumentOnlyField[];

/**
 * Sub-schema for auto-deletion policy.
 */
const MeetRoomAutoDeletionPolicySchema = new Schema(
	{
		withMeeting: {
			type: String,
			enum: Object.values(MeetRoomDeletionPolicyWithMeeting),
			required: true
		},
		withRecordings: {
			type: String,
			enum: Object.values(MeetRoomDeletionPolicyWithRecordings),
			required: true
		}
	},
	{ _id: false }
);

const MeetRoomScheduleSchema = new Schema(
	{
		startDate: { type: Number, required: true },
		durationMinutes: { type: Number, required: true, min: 15, max: 1440 },
		timezone: { type: String, required: true },
		recurrence: { type: String, enum: ['none', 'daily', 'weekly'], required: true, default: 'none' },
		allowEarlyJoinMinutes: { type: Number, required: true, min: 0, max: 120, default: 15 }
	},
	{ _id: false }
);

/**
 * Sub-schema recording configuration.
 */
const MeetRecordingConfigSchema = new Schema(
	{
		enabled: {
			type: Boolean,
			required: true
		},
		layout: {
			type: String,
			enum: Object.values(MeetRecordingLayout),
			required: true
		},
		encoding: {
			type: Schema.Types.Mixed,
			required: true
		}
	},
	{ _id: false }
);

/**
 * Sub-schema for chat configuration.
 */
const MeetChatConfigSchema = new Schema(
	{
		enabled: {
			type: Boolean,
			required: true
		}
	},
	{ _id: false }
);

/**
 * Sub-schema for virtual background configuration.
 */
const MeetVirtualBackgroundConfigSchema = new Schema(
	{
		enabled: {
			type: Boolean,
			required: true
		}
	},
	{ _id: false }
);

/**
 * Sub-schema for E2EE configuration.
 */
const MeetE2EEConfigSchema = new Schema(
	{
		enabled: {
			type: Boolean,
			required: true
		}
	},
	{ _id: false }
);

/**
 * Sub-schema for captions configuration.
 */
const MeetCaptionsConfigSchema = new Schema(
	{
		enabled: {
			type: Boolean,
			required: true
		}
	},
	{ _id: false }
);

const MeetMeetingSecurityConfigSchema = new Schema(
	{
		securityLevel: { type: String, enum: ['standard', 'internal', 'confidential'], required: true, default: 'standard' },
		waitingRoomEnabled: { type: Boolean, required: true, default: false },
		locked: { type: Boolean, required: true, default: false },
		accessScope: {
			type: String,
			enum: ['invited_and_internal', 'internal_only', 'anyone_with_link'],
			required: true,
			default: 'anyone_with_link'
		},
		allowJoinBeforeHost: { type: Boolean, required: true, default: true },
		muteOnEntry: { type: Boolean, required: true, default: true },
		allowSelfUnmute: { type: Boolean, required: true, default: true },
		screenSharePolicy: {
			type: String,
			enum: ['moderators_only', 'all_participants'],
			required: true,
			default: 'all_participants'
		},
		allowParticipantRename: { type: Boolean, required: true, default: true },
		allowMultipleDevices: { type: Boolean, required: true, default: false },
		watermarkEnabled: { type: Boolean, required: true, default: false }
	},
	{ _id: false }
);

/**
 * Sub-schema for room theme configuration.
 */
const MeetRoomThemeSchema = new Schema(
	{
		name: {
			type: String,
			required: true
		},
		enabled: {
			type: Boolean,
			required: true
		},
		baseTheme: {
			type: String,
			enum: Object.values(MeetRoomThemeMode),
			required: true
		},
		backgroundColor: {
			type: String,
			required: false
		},
		primaryColor: {
			type: String,
			required: false
		},
		secondaryColor: {
			type: String,
			required: false
		},
		accentColor: {
			type: String,
			required: false
		},
		surfaceColor: {
			type: String,
			required: false
		}
	},
	{ _id: false }
);

/**
 * Sub-schema for appearance configuration.
 */
export const MeetAppearanceConfigSchema = new Schema(
	{
		themes: {
			type: [MeetRoomThemeSchema],
			required: true
		}
	},
	{ _id: false }
);

/**
 * Sub-schema for room roles configuration.
 */
const MeetRoomRolesSchema = new Schema(
	{
		moderator: {
			permissions: {
				type: MeetRoomMemberPermissionsSchema,
				required: true
			}
		},
		speaker: {
			permissions: {
				type: MeetRoomMemberPermissionsSchema,
				required: true
			}
		}
	},
	{ _id: false }
);

/**
 * Sub-schema for access configuration.
 */
const MeetRoomAccessSchema = new Schema(
	{
		anonymous: {
			moderator: {
				enabled: {
					type: Boolean,
					required: true
				},
				url: {
					type: String,
					required: true
				}
			},
			speaker: {
				enabled: {
					type: Boolean,
					required: true
				},
				url: {
					type: String,
					required: true
				}
			},
			recording: {
				enabled: {
					type: Boolean,
					required: true
				},
				url: {
					type: String,
					required: true
				}
			}
		},
		user: {
			enabled: {
				type: Boolean,
				required: true
			},
			url: {
				type: String,
				required: true
			}
		}
	},
	{ _id: false }
);

/**
 * Sub-schema for room configuration.
 */
const MeetRoomConfigSchema = new Schema(
	{
		security: {
			type: MeetMeetingSecurityConfigSchema,
			required: true,
			default: () => ({})
		},
		chat: {
			type: MeetChatConfigSchema,
			required: true
		},
		recording: {
			type: MeetRecordingConfigSchema,
			required: true
		},
		virtualBackground: {
			type: MeetVirtualBackgroundConfigSchema,
			required: true
		},
		e2ee: {
			type: MeetE2EEConfigSchema,
			required: true
		},
		captions: {
			type: MeetCaptionsConfigSchema,
			required: true
		}
	},
	{ _id: false }
);

/**
 * Mongoose schema for MeetRoom entity.
 * Defines the structure and validation rules for room documents in MongoDB.
 */
const MeetRoomSchema = new Schema<MeetRoomDocument>(
	{
		schemaVersion: {
			type: Number,
			required: true,
			default: INTERNAL_CONFIG.ROOM_SCHEMA_VERSION
		},
		roomId: {
			type: String,
			required: true
		},
		meetingCode: {
			type: String,
			required: false
		},
		roomName: {
			type: String,
			required: true
		},
		owner: {
			type: String,
			required: true
		},
		creationDate: {
			type: Number,
			required: true
		},
		schedule: {
			type: MeetRoomScheduleSchema,
			required: false
		},
		autoDeletionDate: {
			type: Number,
			required: false
		},
		autoDeletionPolicy: {
			type: MeetRoomAutoDeletionPolicySchema,
			required: false
		},
		config: {
			type: MeetRoomConfigSchema,
			required: true
		},
		roles: {
			type: MeetRoomRolesSchema,
			required: true
		},
		access: {
			type: MeetRoomAccessSchema,
			required: true
		},
		status: {
			type: String,
			enum: Object.values(MeetRoomStatus),
			required: true
		},
		rolesUpdatedAt: {
			type: Number,
			required: true
		},
		meetingEndAction: {
			type: String,
			enum: Object.values(MeetingEndAction),
			required: true
		}
	},
	{
		versionKey: false
	}
);

// Create indexes for efficient querying
MeetRoomSchema.index({ roomId: 1 }, { unique: true });
// sparse: legacy rooms without a code stay out of the index so multiple missing values never
// collide; codes are generated at creation and lazily backfilled, so every room converges.
MeetRoomSchema.index({ meetingCode: 1 }, { unique: true, sparse: true });
MeetRoomSchema.index({ creationDate: -1, _id: -1 });
MeetRoomSchema.index({ roomName: 1, creationDate: -1, _id: -1 });
MeetRoomSchema.index({ 'schedule.startDate': 1, _id: 1 });
MeetRoomSchema.index({ status: 1, creationDate: -1, _id: -1 });
MeetRoomSchema.index({ owner: 1, creationDate: -1, _id: -1 });
MeetRoomSchema.index({ 'access.user.enabled': 1, creationDate: -1, _id: -1 });
MeetRoomSchema.index({ autoDeletionDate: 1, _id: 1 });

export const meetRoomCollectionName = 'MeetRoom';

/**
 * Mongoose model for MeetRoom entity.
 */
export const MeetRoomModel = model<MeetRoomDocument>(meetRoomCollectionName, MeetRoomSchema);

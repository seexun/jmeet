import type { MeetRoomMember } from '@openvidu-meet/typings';
import { MeetRoomMemberRole, MeetRoomMemberType } from '@openvidu-meet/typings';
import { Schema, model } from 'mongoose';
import { INTERNAL_CONFIG } from '../../config/internal-config.js';
import type { DocumentOnlyField } from '../database.model.js';
import type { SchemaMigratableDocument } from '../migration.model.js';

/**
 * Mongoose Document interface for room members.
 * Extends the MeetRoomMember interface with schemaVersion for migration tracking.
 */
export interface MeetRoomMemberDocument extends MeetRoomMember, SchemaMigratableDocument {}

/**
 * Type for fields in MeetRoomMemberDocument that are not present in MeetRoomMember domain model.
 */
export type MeetRoomMemberDocumentOnlyField = DocumentOnlyField<MeetRoomMemberDocument, MeetRoomMember>;

/**
 * List of fields that exist only in the MeetRoomMemberDocument and not in the MeetRoomMember domain model.
 * IMPORTANT: Update this list if new document-only fields are added to the MeetRoomMemberDocument interface
 */
export const MEET_ROOM_MEMBER_DOCUMENT_ONLY_FIELDS = [
	'schemaVersion'
] as const satisfies readonly MeetRoomMemberDocumentOnlyField[];

const permissionFields = {
	canRecord: { type: Boolean },
	canRetrieveRecordings: { type: Boolean },
	canDeleteRecordings: { type: Boolean },
	canJoinMeeting: { type: Boolean },
	canShareAccessLinks: { type: Boolean },
	canMakeModerator: { type: Boolean },
	canKickParticipants: { type: Boolean },
	canEndMeeting: { type: Boolean },
	canPublishVideo: { type: Boolean },
	canPublishAudio: { type: Boolean },
	canShareScreen: { type: Boolean },
	canReadChat: { type: Boolean },
	canWriteChat: { type: Boolean },
	canChangeVirtualBackground: { type: Boolean }
};

function createPermissionsSchema(required: boolean) {
	const schemaDefinition: Record<string, unknown> = {};

	for (const key of Object.keys(permissionFields)) {
		schemaDefinition[key] = { ...permissionFields[key as keyof typeof permissionFields], required };
	}

	return new Schema(schemaDefinition, { _id: false });
}

/**
 * Sub-schema for room member permissions.
 */
export const MeetRoomMemberPermissionsSchema = createPermissionsSchema(true);

/**
 * Sub-schema for partial room member permissions.
 */
const MeetRoomMemberPartialPermissionsSchema = createPermissionsSchema(false);

/**
 * Mongoose schema for MeetRoomMember entity.
 * Defines the structure and validation rules for room member documents in MongoDB.
 */
const MeetRoomMemberSchema = new Schema<MeetRoomMemberDocument>(
	{
		schemaVersion: {
			type: Number,
			required: true,
			default: INTERNAL_CONFIG.ROOM_MEMBER_SCHEMA_VERSION
		},
		memberId: {
			type: String,
			required: true
		},
		roomId: {
			type: String,
			required: true
		},
		type: {
			type: String,
			enum: Object.values(MeetRoomMemberType),
			required: true
		},
		name: {
			type: String,
			required: true
		},
		membershipDate: {
			type: Number,
			required: true
		},
		accessUrl: {
			type: String,
			required: true
		},
		baseRole: {
			type: String,
			enum: Object.values(MeetRoomMemberRole),
			required: true
		},
		customPermissions: {
			type: MeetRoomMemberPartialPermissionsSchema,
			required: false
		},
		effectivePermissions: {
			type: MeetRoomMemberPermissionsSchema,
			required: true
		},
		permissionsUpdatedAt: {
			type: Number,
			required: true
		}
	},
	{
		versionKey: false
	}
);

// Create indexes for efficient querying
MeetRoomMemberSchema.index({ roomId: 1, memberId: 1 }, { unique: true });
MeetRoomMemberSchema.index({ roomId: 1, membershipDate: -1, _id: -1 });
MeetRoomMemberSchema.index({ roomId: 1, name: 1, membershipDate: -1, _id: -1 });
MeetRoomMemberSchema.index({ roomId: 1, name: 1, _id: 1 });
MeetRoomMemberSchema.index({ memberId: 1, 'effectivePermissions.canRetrieveRecordings': 1 });

export const meetRoomMemberCollectionName = 'MeetRoomMember';

/**
 * Mongoose model for MeetRoomMember entity.
 */
export const MeetRoomMemberModel = model<MeetRoomMemberDocument>(meetRoomMemberCollectionName, MeetRoomMemberSchema);

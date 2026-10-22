import type { MeetUser } from '@openvidu-meet/typings';
import { MeetUserRole } from '@openvidu-meet/typings';
import { model, Schema } from 'mongoose';
import { INTERNAL_CONFIG } from '../../config/internal-config.js';
import type { DocumentOnlyField } from '../database.model.js';
import type { SchemaMigratableDocument } from '../migration.model.js';

/**
 * Mongoose Document interface for users.
 * Extends the MeetUser interface with schemaVersion for migration tracking.
 */
export interface MeetUserDocument extends MeetUser, SchemaMigratableDocument {}

/**
 * Type for fields in MeetUserDocument that are not present in MeetUser domain model.
 */
export type MeetUserDocumentOnlyField = DocumentOnlyField<MeetUserDocument, MeetUser>;

/**
 * List of fields that exist only in the MeetUserDocument and not in the MeetUser domain model.
 * IMPORTANT: Update this list if new document-only fields are added to the MeetUserDocument interface
 */
export const MEET_USER_DOCUMENT_ONLY_FIELDS = ['schemaVersion'] as const satisfies readonly MeetUserDocumentOnlyField[];

/**
 * Mongoose schema for MeetUser entity.
 * Defines the structure and validation rules for user documents in MongoDB.
 */
const MeetUserSchema = new Schema<MeetUserDocument>(
	{
		schemaVersion: {
			type: Number,
			required: true,
			default: INTERNAL_CONFIG.USER_SCHEMA_VERSION
		},
		userId: {
			type: String,
			required: true
		},
		loginName: { type: String, required: true, lowercase: true, trim: true },
		name: {
			type: String,
			required: true
		},
		email: { type: String, required: false, lowercase: true, trim: true },
		employeeNumber: { type: String, required: false, trim: true },
		registrationDate: {
			type: Number,
			required: true
		},
		role: {
			type: String,
			enum: Object.values(MeetUserRole),
			required: true
		},
		roleUpdatedAt: {
			type: Number,
			required: true
		},
		passwordHash: {
			type: String,
			required: true
		},
		mustChangePassword: {
			type: Boolean,
			required: true
		},
		enabled: { type: Boolean, required: true, default: true, index: true },
		authVersion: { type: Number, required: true, default: 1 },
		identityProviderId: { type: String, required: false, index: true },
		externalSubject: { type: String, required: false },
		lastIdentitySyncAt: { type: Number, required: false, index: true },
		avatarDataUrl: { type: String, required: false },
		preferredLanguage: { type: String, required: false, enum: ['cn', 'en'] },
		notificationsMuted: { type: Boolean, required: false, default: false }
	},
	{
		versionKey: false
	}
);

// Create indexes for efficient querying
MeetUserSchema.index({ userId: 1 }, { unique: true });
MeetUserSchema.index({ loginName: 1 }, { unique: true });
MeetUserSchema.index({ email: 1 }, { unique: true, sparse: true });
MeetUserSchema.index({ employeeNumber: 1 }, { unique: true, sparse: true });
MeetUserSchema.index({ registrationDate: -1, _id: -1 });
MeetUserSchema.index({ name: 1, registrationDate: -1, _id: -1 });
MeetUserSchema.index({ role: 1, registrationDate: -1, _id: -1 });
MeetUserSchema.index({ name: 1, role: 1, _id: 1 });
MeetUserSchema.index({ identityProviderId: 1, externalSubject: 1 }, { unique: true, sparse: true });

export const meetUserCollectionName = 'MeetUser';

/**
 * Mongoose model for MeetUser entity.
 */
export const MeetUserModel = model<MeetUserDocument>(meetUserCollectionName, MeetUserSchema);

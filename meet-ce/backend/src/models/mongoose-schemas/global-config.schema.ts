import type { GlobalConfig} from '@openvidu-meet/typings';
import { DEFAULT_PLATFORM_BRANDING } from '@openvidu-meet/typings';
import { model, Schema } from 'mongoose';
import { INTERNAL_CONFIG } from '../../config/internal-config.js';
import type { DocumentOnlyField } from '../database.model.js';
import type { SchemaMigratableDocument } from '../migration.model.js';
import { MeetAppearanceConfigSchema } from './room.schema.js';

/**
 * Mongoose Document interface for global config.
 * Extends the GlobalConfig interface with schemaVersion for migration tracking.
 */
export interface MeetGlobalConfigDocument extends GlobalConfig, SchemaMigratableDocument {}

/**
 * Type for fields in MeetGlobalConfigDocument that are not present in GlobalConfig domain model.
 */
export type MeetGlobalConfigDocumentOnlyField = DocumentOnlyField<MeetGlobalConfigDocument, GlobalConfig>;

/**
 * List of fields that exist only in the MeetGlobalConfigDocument and not in the GlobalConfig domain model.
 * IMPORTANT: Update this list if new document-only fields are added to the MeetGlobalConfigDocument interface
 */
export const MEET_GLOBAL_CONFIG_DOCUMENT_ONLY_FIELDS = [
	'schemaVersion'
] as const satisfies readonly MeetGlobalConfigDocumentOnlyField[];

/**
 * Sub-schema for platform shell branding（开源版固定默认品牌）.
 */
const PlatformBrandingConfigSchema = new Schema(
	{
		productName: { type: String, required: true, default: DEFAULT_PLATFORM_BRANDING.productName, maxlength: 64 },
		customLogo: { type: Boolean, required: true, default: false },
		logoContentType: { type: String, required: false },
		logoUpdatedAt: { type: Number, required: false }
	},
	{ _id: false }
);

/**
 * Sub-schema for rooms configuration.
 */
const RoomsConfigSchema = new Schema(
	{
		appearance: {
			type: MeetAppearanceConfigSchema,
			required: true
		}
	},
	{ _id: false }
);

/**
 * Mongoose schema for GlobalConfig entity.
 * Defines the structure and validation rules for the global configuration document in MongoDB.
 */
const MeetGlobalConfigSchema = new Schema<MeetGlobalConfigDocument>(
	{
		schemaVersion: {
			type: Number,
			required: true,
			default: INTERNAL_CONFIG.GLOBAL_CONFIG_SCHEMA_VERSION
		},
		projectId: {
			type: String,
			required: true
		},
		platformBranding: {
			type: PlatformBrandingConfigSchema,
			required: true,
			default: () => ({ ...DEFAULT_PLATFORM_BRANDING })
		},
		roomsConfig: {
			type: RoomsConfigSchema,
			required: true
		}
	},
	{
		versionKey: false
	}
);

// Create indexes for efficient querying
MeetGlobalConfigSchema.index({ projectId: 1 }, { unique: true });

export const meetGlobalConfigCollectionName = 'MeetGlobalConfig';

/**
 * Mongoose model for GlobalConfig entity.
 */
export const MeetGlobalConfigModel = model<MeetGlobalConfigDocument>(
	meetGlobalConfigCollectionName,
	MeetGlobalConfigSchema
);

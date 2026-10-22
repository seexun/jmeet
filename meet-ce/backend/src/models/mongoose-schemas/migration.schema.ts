import { model, Schema } from 'mongoose';
import type { MeetMigration} from '../migration.model.js';
import { isSchemaMigrationName, MigrationStatus } from '../migration.model.js';

/**
 * Mongoose Document interface for migrations.
 */
export type MeetMigrationDocument = MeetMigration;

/**
 * Mongoose schema for MeetMigration.
 * Defines the structure and validation rules for migration documents in MongoDB.
 */
const MigrationSchema = new Schema<MeetMigrationDocument>(
	{
		name: {
			type: String,
			required: true,
			validate: {
				validator: (value: string) => isSchemaMigrationName(value),
				message: 'Invalid migration name format'
			}
		},
		status: {
			type: String,
			required: true,
			enum: Object.values(MigrationStatus)
		},
		startedAt: {
			type: Number,
			required: true
		},
		completedAt: {
			type: Number,
			required: false
		},
		error: {
			type: String,
			required: false
		},
		metadata: {
			type: Schema.Types.Mixed,
			required: false
		}
	},
	{
		versionKey: false
	}
);

// Index for efficient lookups
MigrationSchema.index({ name: 1 }, { unique: true });
MigrationSchema.index({ status: 1 });

/**
 * Mongoose model for MeetMigration.
 */
export const MeetMigrationModel = model<MeetMigrationDocument>('MeetMigration', MigrationSchema);

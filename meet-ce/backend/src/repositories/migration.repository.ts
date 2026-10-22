import { inject, injectable } from 'inversify';
import type { MeetMigration, MigrationName } from '../models/migration.model.js';
import { MigrationStatus } from '../models/migration.model.js';
import type { MeetMigrationDocument } from '../models/mongoose-schemas/migration.schema.js';
import { MeetMigrationModel } from '../models/mongoose-schemas/migration.schema.js';
import { LoggerService } from '../services/logger.service.js';
import { BaseRepository } from './base.repository.js';

@injectable()
export class MigrationRepository extends BaseRepository<MeetMigration, MeetMigrationDocument> {
	constructor(@inject(LoggerService) logger: LoggerService) {
		super(logger, MeetMigrationModel);
	}

	protected toDomain(dbObject: MeetMigrationDocument): MeetMigration {
		return dbObject as MeetMigration;
	}

	/**
	 * Mark a migration as started.
	 * Creates a new migration record with RUNNING status, or updates an existing one if it already exists.
	 * This handles cases where a previous migration attempt failed or was interrupted.
	 *
	 * @param name - The name of the migration
	 * @returns The created or updated migration document
	 */
	async markAsStarted(name: MigrationName): Promise<MeetMigration> {
		// Check if migration document already exists
		const existingMigration = await this.findOne({ name });

		if (existingMigration) {
			// Update existing document to RUNNING status
			return this.updatePartialOne(
				{ name },
				{
					$set: {
						status: MigrationStatus.RUNNING,
						startedAt: Date.now()
					},
					$unset: {
						completedAt: '',
						error: ''
					}
				}
			);
		}

		// Create new migration document
		return this.createDocument({
			name,
			status: MigrationStatus.RUNNING,
			startedAt: Date.now()
		});
	}

	/**
	 * Mark a migration as completed successfully.
	 * Updates the migration record with COMPLETED status and completion timestamp.
	 *
	 * @param name - The name of the migration
	 * @param metadata - Optional metadata about the migration execution
	 * @returns The updated migration document
	 */
	markAsCompleted(name: MigrationName, metadata?: Record<string, unknown>): Promise<MeetMigration> {
		return this.updatePartialOne(
			{ name },
			{
				$set: {
					status: MigrationStatus.COMPLETED,
					completedAt: Date.now(),
					...(metadata && { metadata })
				}
			}
		);
	}

	/**
	 * Mark a migration as failed.
	 * Updates the migration record with FAILED status, completion timestamp, and error message.
	 *
	 * @param name - The name of the migration
	 * @param error - Error message describing the failure
	 * @returns The updated migration document
	 */
	markAsFailed(name: MigrationName, error: string): Promise<MeetMigration> {
		return this.updatePartialOne(
			{ name },
			{
				$set: {
					status: MigrationStatus.FAILED,
					completedAt: Date.now(),
					error
				}
			}
		);
	}

	/**
	 * Check if a migration has been completed successfully.
	 *
	 * @param name - The name of the migration to check
	 * @returns true if the migration was completed successfully, false otherwise
	 */
	async isCompleted(name: MigrationName): Promise<boolean> {
		const migration = await this.findOne({ name, status: MigrationStatus.COMPLETED });
		return migration !== null;
	}
}

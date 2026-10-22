import { inject, injectable } from 'inversify';
import type { Model, QueryFilter, Require_id, Types } from 'mongoose';
import ms from 'ms';
import { MeetLock } from '../helpers/redis.helper.js';
import { runtimeMigrationRegistry } from '../migrations/migration-registry.js';
import type {
	CollectionMigrationRegistry,
	MigrationResult,
	SchemaMigratableDocument,
	SchemaMigrationStep,
	SchemaVersion
} from '../models/migration.model.js';
import { generateSchemaMigrationName } from '../models/migration.model.js';
import { MigrationRepository } from '../repositories/migration.repository.js';
import { LoggerService } from './logger.service.js';
import { MutexService } from './mutex.service.js';

@injectable()
export class MigrationService {
	constructor(
		@inject(LoggerService) protected logger: LoggerService,
		@inject(MutexService) protected mutexService: MutexService,
		@inject(MigrationRepository) protected migrationRepository: MigrationRepository
	) {}

	/**
	 * Runs all necessary migrations to update existing data structures.
	 * This method should be called during startup to ensure backwards compatibility.
	 *
	 * Uses distributed locking to ensure only one instance runs migrations in HA mode.
	 *
	 * Migration flow:
	 * 1) Schema/data migrations
	 * 2) Index synchronization (drop obsolete + create missing indexes)
	 */
	async runMigrations(): Promise<void> {
		this.logger.info('Running migrations...');
		const lockKey = MeetLock.getMigrationLock();

		try {
			const executionResult = await this.mutexService.withLock(lockKey, ms('5m'), async () => {
				// Run schema migrations to upgrade document structures
				await this.runSchemaMigrations();

				// Sync collection indexes to match current schema definitions
				await this.runIndexMigrations();

				this.logger.info('All migrations completed successfully');
				return true;
			});

			if (executionResult === null) {
				this.logger.warn('Unable to acquire lock for migrations. May be already running on another instance.');
				return;
			}

			this.logger.info('All migrations completed successfully');
		} catch (error) {
			this.logger.error('Error running migrations:', error);
			throw error;
		}
	}

	/**
	 * Synchronizes MongoDB indexes for all registered collections.
	 * This removes obsolete indexes and creates missing ones according to the current schema definitions.
	 */
	protected async runIndexMigrations(): Promise<void> {
		this.logger.info('Running index migrations...');

		try {
			for (const registry of runtimeMigrationRegistry) {
				await this.syncCollectionIndexes(registry);
			}

			this.logger.info('Index migrations completed successfully');
		} catch (error) {
			this.logger.error('Error running index migrations:', error);
			throw error;
		}
	}

	/**
	 * Synchronizes indexes for a single collection.
	 *
	 * @param registry - The collection migration registry containing model and collection metadata
	 */
	protected async syncCollectionIndexes<TDocument extends SchemaMigratableDocument>(
		registry: CollectionMigrationRegistry<TDocument>
	): Promise<void> {
		this.logger.info(`Syncing indexes for collection: ${registry.collectionName}`);

		await this.ensureCollectionExists(registry);

		const indexesBeforeSync = await registry.model.collection.indexes();
		const indexNamesBeforeSync = new Set(indexesBeforeSync.map((index) => index.name));

		const droppedIndexes = await registry.model.syncIndexes();

		const indexesAfterSync = await registry.model.collection.indexes();
		const indexNamesAfterSync = new Set(indexesAfterSync.map((index) => index.name!));
		const createdIndexes = [...indexNamesAfterSync].filter((indexName) => !indexNamesBeforeSync.has(indexName));

		if (droppedIndexes.length === 0 && createdIndexes.length === 0) {
			this.logger.debug(`No index changes for collection: ${registry.collectionName}`);
			return;
		}

		this.logger.info(
			`Index sync for ${registry.collectionName}: ` +
				`dropped=${droppedIndexes.length} [${droppedIndexes.join(', ')}], ` +
				`created=${createdIndexes.length} [${createdIndexes.join(', ')}]`
		);
	}

	/**
	 * Ensures MongoDB collection exists before running index synchronization.
	 * This avoids NamespaceNotFound errors on fresh databases with no documents.
	 */
	protected async ensureCollectionExists<TDocument extends SchemaMigratableDocument>(
		registry: CollectionMigrationRegistry<TDocument>
	): Promise<void> {
		const nativeDb = registry.model.db.db;

		if (!nativeDb) {
			throw new Error(`MongoDB native connection is not available for ${registry.collectionName}`);
		}

		const collectionName = registry.model.collection.collectionName;
		const collectionExists = await nativeDb.listCollections({ name: collectionName }, { nameOnly: true }).hasNext();

		if (collectionExists) {
			return;
		}

		await registry.model.createCollection();
		this.logger.info(`Created missing collection for index sync: ${registry.collectionName}`);
	}

	/**
	 * Runs all schema migrations to upgrade document structures to the latest version.
	 * Processes each collection in the registry and executes pending migrations.
	 */
	protected async runSchemaMigrations(): Promise<void> {
		this.logger.info('Running schema migrations...');

		try {
			let totalMigrated = 0;

			// Process each collection in the registry
			for (const registry of runtimeMigrationRegistry) {
				totalMigrated += await this.migrateCollectionSchemas(registry);
			}

			this.logger.info(`Schema migrations completed successfully: ${totalMigrated} documents migrated`);
		} catch (error) {
			this.logger.error('Error running schema migrations:', error);
			throw error;
		}
	}

	/**
	 * Migrates documents in a collection through all required schema versions to reach the current version.
	 *
	 * @param registry - The collection migration registry containing migration steps and model
	 * @returns Number of documents migrated in this collection
	 */
	protected async migrateCollectionSchemas<TDocument extends SchemaMigratableDocument>(
		registry: CollectionMigrationRegistry<TDocument>
	): Promise<number> {
		this.logger.info(`Checking schema version for collection: ${registry.collectionName}`);

		const oldestSchemaVersionInDb = await this.getMinSchemaVersion(registry.model);

		if (oldestSchemaVersionInDb === null) {
			this.logger.info(`No documents found in ${registry.collectionName}, skipping migration`);
			return 0;
		}

		const latestSchemaVersionInDb = await this.getMaxSchemaVersion(registry.model);

		if (latestSchemaVersionInDb && latestSchemaVersionInDb > registry.currentVersion) {
			throw new Error(
				`Collection ${registry.collectionName} has schemaVersion ${latestSchemaVersionInDb}, ` +
					`which is higher than expected ${registry.currentVersion}. ` +
					'Startup aborted to prevent inconsistent schema handling.'
			);
		}

		if (oldestSchemaVersionInDb === registry.currentVersion) {
			this.logger.info(
				`Collection ${registry.collectionName} is already at version ${registry.currentVersion}, skipping migration`
			);
			return 0;
		}

		let migratedDocumentsInCollection = 0;

		for (
			let sourceSchemaVersion = oldestSchemaVersionInDb;
			sourceSchemaVersion < registry.currentVersion;
			sourceSchemaVersion++
		) {
			const migrationChain = this.getRequiredMigrationSteps(registry, sourceSchemaVersion);
			migratedDocumentsInCollection += await this.executeMigrationChainForVersion(
				registry,
				sourceSchemaVersion,
				migrationChain
			);
		}

		return migratedDocumentsInCollection;
	}

	/**
	 * Gets the required migration steps to upgrade from the current version in the database to the target version.
	 * Validates that there are no missing migration steps in the chain.
	 *
	 * @param registry - The collection migration registry
	 * @param sourceSchemaVersion - Source schema version whose migration chain must be executed
	 * @returns Array of migration steps that need to be executed in order
	 */
	protected getRequiredMigrationSteps<TDocument extends SchemaMigratableDocument>(
		registry: CollectionMigrationRegistry<TDocument>,
		sourceSchemaVersion: SchemaVersion
	): SchemaMigrationStep<TDocument>[] {
		const migrationSteps = this.findSchemaMigrationSteps(registry, sourceSchemaVersion, registry.currentVersion);

		if (migrationSteps.length === 0) {
			throw new Error(
				`No migration steps found for ${registry.collectionName} ` +
					`(v${sourceSchemaVersion} -> v${registry.currentVersion}). Startup aborted.`
			);
		}

		this.logger.info(
			`Found ${migrationSteps.length} migration steps for ${registry.collectionName} ` +
				`(v${sourceSchemaVersion} -> v${registry.currentVersion})`
		);

		return migrationSteps;
	}

	/**
	 * Executes the migration chain for all documents currently at a specific source schema version.
	 * Handles marking the chain as started, completed, or failed in the migration repository.
	 *
	 * @param registry - The collection migration registry
	 * @param sourceSchemaVersion - Source schema version to migrate from
	 * @param migrationChain - Ordered migration steps from source to current version
	 * @returns Number of migrated documents for this source version
	 */
	protected async executeMigrationChainForVersion<TDocument extends SchemaMigratableDocument>(
		registry: CollectionMigrationRegistry<TDocument>,
		sourceSchemaVersion: SchemaVersion,
		migrationChain: SchemaMigrationStep<TDocument>[]
	): Promise<number> {
		const pendingDocumentsBefore = await this.countDocumentsAtSchemaVersion(registry.model, sourceSchemaVersion);
		const migrationChainExecutionName = generateSchemaMigrationName(
			registry.collectionName,
			sourceSchemaVersion,
			registry.currentVersion
		);

		if (pendingDocumentsBefore === 0) {
			this.logger.info(`Migration ${migrationChainExecutionName} has no pending documents, skipping execution`);
			return 0;
		}

		const isCompleted = await this.migrationRepository.isCompleted(migrationChainExecutionName);

		if (isCompleted) {
			this.logger.warn(
				`Migration ${migrationChainExecutionName} is marked as completed but still has ${pendingDocumentsBefore} pending ` +
					`documents at schemaVersion ${sourceSchemaVersion}. Re-running migration chain.`
			);
		}

		await this.migrationRepository.markAsStarted(migrationChainExecutionName);

		try {
			this.logger.info(`Executing migration: ${migrationChainExecutionName}`);
			const result = await this.migrateDocumentsForSourceVersion(
				registry.model,
				sourceSchemaVersion,
				registry.currentVersion,
				migrationChain
			);
			const pendingDocumentsAfter = await this.countDocumentsAtSchemaVersion(registry.model, sourceSchemaVersion);

			const metadata = {
				collectionName: registry.collectionName,
				fromVersion: sourceSchemaVersion,
				toVersion: registry.currentVersion,
				chainLength: migrationChain.length,
				chainStepNames: migrationChain.map((step) => step.name),
				migratedCount: result.migratedCount,
				failedCount: result.failedCount,
				pendingBefore: pendingDocumentsBefore,
				pendingAfter: pendingDocumentsAfter,
				durationMs: result.durationMs
			};

			if (result.failedCount > 0 || pendingDocumentsAfter > 0) {
				const failureReason =
					`Migration ${migrationChainExecutionName} did not complete successfully. ` +
					`failedCount=${result.failedCount}, pendingAfter=${pendingDocumentsAfter}`;

				await this.migrationRepository.markAsFailed(migrationChainExecutionName, failureReason);
				throw new Error(failureReason);
			}

			await this.migrationRepository.markAsCompleted(migrationChainExecutionName, metadata);

			this.logger.info(
				`Migration ${migrationChainExecutionName} completed: ${result.migratedCount} documents migrated (${result.durationMs}ms)`
			);

			return result.migratedCount;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			await this.migrationRepository.markAsFailed(migrationChainExecutionName, errorMessage);
			throw error;
		}
	}

	/**
	 * Executes a migration chain on all documents that match the source version.
	 * Applies all transforms sequentially and saves each document once at the target version.
	 *
	 * @param model - Mongoose model for the collection being migrated
	 * @param sourceSchemaVersion - The schema version to migrate from
	 * @param targetVersion - The schema version to migrate to
	 * @param migrationChain - Array of migration steps to apply in order
	 * @param batchSize - Number of documents to process in each batch. Default is 50.
	 * @returns Migration result with statistics about the execution
	 */
	protected async migrateDocumentsForSourceVersion<TDocument extends SchemaMigratableDocument>(
		model: Model<TDocument>,
		sourceSchemaVersion: SchemaVersion,
		targetVersion: SchemaVersion,
		migrationChain: SchemaMigrationStep<TDocument>[],
		batchSize = 50
	): Promise<MigrationResult> {
		const startTime = Date.now();
		let migratedCount = 0;
		let failedCount = 0;

		const sourceVersionFilter: QueryFilter<TDocument> = { schemaVersion: sourceSchemaVersion };
		const totalSourceVersionDocuments = await model.countDocuments(sourceVersionFilter).exec();

		if (totalSourceVersionDocuments === 0) {
			return {
				migratedCount,
				failedCount,
				durationMs: Date.now() - startTime
			};
		}

		let processedDocumentsCount = 0;
		let lastProcessedDocumentId: Types.ObjectId | null = null;
		let hasMoreBatches = true;

		while (hasMoreBatches) {
			const batchFilter: QueryFilter<TDocument> =
				lastProcessedDocumentId === null
					? sourceVersionFilter
					: {
							...sourceVersionFilter,
							_id: { $gt: lastProcessedDocumentId }
						};
			const documents = (await model
				.find(batchFilter)
				.sort({ _id: 1 })
				.limit(batchSize)
				.lean()
				.exec()) as Require_id<TDocument>[];

			if (documents.length === 0) {
				break;
			}

			const batchResults = await Promise.allSettled(
				documents.map(async (doc) => {
					const migratedDocument = this.applyTransformChain(doc, migrationChain, targetVersion);
					await model.replaceOne({ _id: doc._id }, migratedDocument).exec();
					return doc._id;
				})
			);

			for (let i = 0; i < batchResults.length; i++) {
				const batchResult = batchResults[i];

				if (batchResult.status === 'fulfilled') {
					migratedCount++;
					continue;
				}

				failedCount++;
				this.logger.error(`Failed to migrate document ${String(documents[i]._id)}:`, batchResult.reason);
			}

			processedDocumentsCount += documents.length;
			lastProcessedDocumentId = documents[documents.length - 1]._id;
			hasMoreBatches = documents.length === batchSize;
			this.logger.debug(`Processed ${processedDocumentsCount}/${totalSourceVersionDocuments} documents`);
		}

		return {
			migratedCount,
			failedCount,
			durationMs: Date.now() - startTime
		};
	}

	/**
	 * Gets the minimum schema version present in the collection.
	 * This is used to detect the oldest pending version of documents.
	 *
	 * @param model - Mongoose model for the collection
	 * @returns Current version or null if collection is empty
	 */
	protected async getMinSchemaVersion<TDocument extends SchemaMigratableDocument>(
		model: Model<TDocument>
	): Promise<SchemaVersion | null> {
		try {
			const sampleDoc = await model.findOne({}).sort({ schemaVersion: 1 }).select('schemaVersion').exec();

			if (!sampleDoc) {
				return null; // Collection is empty
			}

			// If schemaVersion doesn't exist, assume version 1 (initial version)
			return sampleDoc.schemaVersion ?? 1;
		} catch (error) {
			this.logger.error('Error getting current schema version:', error);
			throw error;
		}
	}

	/**
	 * Gets the maximum schema version present in the collection.
	 * This is used to detect if there are any documents above expected version.
	 *
	 * @param model - Mongoose model for the collection
	 * @returns Maximum version or null if collection is empty
	 */
	protected async getMaxSchemaVersion<TDocument extends SchemaMigratableDocument>(
		model: Model<TDocument>
	): Promise<SchemaVersion | null> {
		try {
			const sampleDoc = await model.findOne({}).sort({ schemaVersion: -1 }).select('schemaVersion').exec();

			if (!sampleDoc) {
				return null; // Collection is empty
			}

			return sampleDoc.schemaVersion ?? 1;
		} catch (error) {
			this.logger.error('Error getting max schema version:', error);
			throw error;
		}
	}

	/**
	 * Counts how many documents are at a specific schema version.
	 *
	 * @param model - Mongoose model for the collection
	 * @param schemaVersion - Schema version to count
	 * @returns Number of documents at the specified schema version
	 */
	protected async countDocumentsAtSchemaVersion<TDocument extends SchemaMigratableDocument>(
		model: Model<TDocument>,
		schemaVersion: SchemaVersion
	): Promise<number> {
		return model.countDocuments({ schemaVersion }).exec();
	}

	/**
	 * Finds the schema migration steps needed to upgrade from one version to another.
	 * Returns migrations in the correct order to apply.
	 *
	 * @param registry - Collection migration registry
	 * @param fromVersion - Current version in database
	 * @param toVersion - Target version from application
	 * @returns Array of schema migration steps to execute in order
	 */
	protected findSchemaMigrationSteps<TDocument extends SchemaMigratableDocument>(
		registry: CollectionMigrationRegistry<TDocument>,
		fromVersion: SchemaVersion,
		toVersion: SchemaVersion
	): SchemaMigrationStep<TDocument>[] {
		const steps: SchemaMigrationStep<TDocument>[] = [];

		// Build a chain of migration steps from fromVersion to toVersion
		let currentVersion = fromVersion;

		while (currentVersion < toVersion) {
			const nextVersion = currentVersion + 1;
			const expectedMigrationName = generateSchemaMigrationName(
				registry.collectionName,
				currentVersion,
				nextVersion
			);
			const transform = registry.migrations.get(expectedMigrationName);

			if (!transform) {
				throw new Error(
					`No migration found from version ${currentVersion} to ${nextVersion} for ` +
						`${registry.collectionName}. Migration chain is incomplete.`
				);
			}

			steps.push({
				name: expectedMigrationName,
				fromVersion: currentVersion,
				toVersion: nextVersion,
				transform
			});
			currentVersion = nextVersion;
		}

		return steps;
	}

	/**
	 * Applies a chain of migration transforms to a document sequentially.
	 * Updates the document's schemaVersion to the target version after applying all transforms.
	 *
	 * @param document - The document to transform
	 * @param migrationChain - Array of migration steps to apply in order
	 * @param targetVersion - The final schema version after applying the chain
	 * @returns The transformed document with updated schemaVersion
	 */
	protected applyTransformChain<TDocument extends SchemaMigratableDocument>(
		document: TDocument,
		migrationChain: SchemaMigrationStep<TDocument>[],
		targetVersion: SchemaVersion
	): TDocument {
		let transformedDocument = document;

		for (const migrationStep of migrationChain) {
			transformedDocument = migrationStep.transform(transformedDocument);
		}

		transformedDocument.schemaVersion = targetVersion;
		return transformedDocument;
	}
}

import type { GlobalConfig } from '@openvidu-meet/typings';
import { inject, injectable } from 'inversify';
import { INTERNAL_CONFIG } from '../config/internal-config.js';
import type {
	MeetGlobalConfigDocument,
	MeetGlobalConfigDocumentOnlyField
} from '../models/mongoose-schemas/global-config.schema.js';
import {
	MEET_GLOBAL_CONFIG_DOCUMENT_ONLY_FIELDS,
	MeetGlobalConfigModel
} from '../models/mongoose-schemas/global-config.schema.js';
import { LoggerService } from '../services/logger.service.js';
import { BaseRepository } from './base.repository.js';

/**
 * Repository for managing GlobalConfig in MongoDB.
 *
 * IMPORTANT: This collection should only contain ONE document representing the
 * system-wide global configuration. Methods are designed to work with this singleton pattern.
 */
@injectable()
export class GlobalConfigRepository extends BaseRepository<GlobalConfig, MeetGlobalConfigDocument> {
	constructor(@inject(LoggerService) logger: LoggerService) {
		super(logger, MeetGlobalConfigModel);
	}

	protected toDomain(dbObject: MeetGlobalConfigDocument): GlobalConfig {
		const { schemaVersion, ...globalConfig } = dbObject;
		void schemaVersion;
		return globalConfig as GlobalConfig;
	}

	protected override getDocumentOnlyFields(): readonly MeetGlobalConfigDocumentOnlyField[] {
		return MEET_GLOBAL_CONFIG_DOCUMENT_ONLY_FIELDS;
	}

	/**
	 * Creates the global configuration document.
	 *
	 * WARNING: This should only be called once during system initialization.
	 * If a config already exists, use replace() or updatePartial() instead.
	 *
	 * @param config - The global configuration data to create
	 * @returns The created global configuration
	 */
	create(config: GlobalConfig): Promise<GlobalConfig> {
		const document: MeetGlobalConfigDocument = {
			...config,
			schemaVersion: INTERNAL_CONFIG.GLOBAL_CONFIG_SCHEMA_VERSION
		};
		return this.createDocument(document);
	}

	/**
	 * Replaces the global configuration.
	 *
	 * Since there's only one document, this updates the first (and only) document in the collection.
	 *
	 * @param config - The complete updated global configuration data
	 * @returns The updated global configuration
	 * @throws Error if no config exists
	 */
	replace(config: GlobalConfig): Promise<GlobalConfig> {
		// Update the first document in the collection (there should only be one)
		return this.replaceOne({}, config);
	}

	/**
	 * Partially updates the global configuration.
	 *
	 * Since there's only one document, this updates the first (and only) document in the collection.
	 *
	 * @param fieldsToUpdate - Partial global configuration data to update
	 * @returns The updated global configuration
	 * @throws Error if no config exists
	 */
	updatePartial(fieldsToUpdate: Partial<GlobalConfig>): Promise<GlobalConfig> {
		return this.updatePartialOne({}, fieldsToUpdate);
	}

	/**
	 * Retrieves the global configuration.
	 *
	 * @param fields - Optional array of field names to include in the result
	 * @returns The global configuration or null if not found
	 */
	get(fields?: (keyof GlobalConfig)[]): Promise<GlobalConfig | null> {
		// Get the first (and only) document from the collection
		return this.findOne({}, fields);
	}

	/**
	 * Deletes the global configuration.
	 *
	 * WARNING: This will remove the global config document from the database.
	 * Use with caution.
	 */
	delete(): Promise<void> {
		return this.deleteMany({});
	}
}

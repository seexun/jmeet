import type { SchemaMigrationMap } from '../models/migration.model.js';
import type {
	MeetGlobalConfigDocument
} from '../models/mongoose-schemas/global-config.schema.js';
import {
	meetGlobalConfigCollectionName
} from '../models/mongoose-schemas/global-config.schema.js';

/**
 * Schema migrations for MeetGlobalConfig.
 * 开源版为全新产品线，无历史数据需要迁移；保留空迁移表以维持迁移框架契约。
 * Key format: schema_{collection}_v{from}_to_v{to}
 */
export const globalConfigMigrations: SchemaMigrationMap<MeetGlobalConfigDocument> = new Map([]);
void meetGlobalConfigCollectionName;

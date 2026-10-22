import { INTERNAL_CONFIG } from '../config/internal-config.js';
import type { CollectionMigrationRegistry, SchemaMigratableDocument } from '../models/migration.model.js';
import type {
	MeetGlobalConfigDocument} from '../models/mongoose-schemas/global-config.schema.js';
import {
	meetGlobalConfigCollectionName,
	MeetGlobalConfigModel
} from '../models/mongoose-schemas/global-config.schema.js';
import type {
	MeetRoomMemberDocument} from '../models/mongoose-schemas/room-member.schema.js';
import {
	meetRoomMemberCollectionName,
	MeetRoomMemberModel
} from '../models/mongoose-schemas/room-member.schema.js';
import type { MeetRoomDocument} from '../models/mongoose-schemas/room.schema.js';
import { meetRoomCollectionName, MeetRoomModel } from '../models/mongoose-schemas/room.schema.js';
import type { MeetUserDocument} from '../models/mongoose-schemas/user.schema.js';
import { meetUserCollectionName, MeetUserModel } from '../models/mongoose-schemas/user.schema.js';
import { globalConfigMigrations } from './global-config-migrations.js';
import { roomMemberMigrations } from './room-member-migrations.js';
import { roomMigrations } from './room-migrations.js';
import { userMigrations } from './user-migrations.js';

/**
 * Registry configuration for MeetGlobalConfig collection migrations.
 */
const globalConfigMigrationRegistry: CollectionMigrationRegistry<MeetGlobalConfigDocument> = {
	collectionName: meetGlobalConfigCollectionName,
	model: MeetGlobalConfigModel,
	currentVersion: INTERNAL_CONFIG.GLOBAL_CONFIG_SCHEMA_VERSION,
	migrations: globalConfigMigrations
};

/**
 * Registry configuration for MeetUser collection migrations.
 */
const userMigrationRegistry: CollectionMigrationRegistry<MeetUserDocument> = {
	collectionName: meetUserCollectionName,
	model: MeetUserModel,
	currentVersion: INTERNAL_CONFIG.USER_SCHEMA_VERSION,
	migrations: userMigrations
};

/**
 * Registry configuration for MeetRoom collection migrations.
 */
const roomMigrationRegistry: CollectionMigrationRegistry<MeetRoomDocument> = {
	collectionName: meetRoomCollectionName,
	model: MeetRoomModel,
	currentVersion: INTERNAL_CONFIG.ROOM_SCHEMA_VERSION,
	migrations: roomMigrations
};

/**
 * Registry configuration for MeetRoomMember collection migrations.
 */
const roomMemberMigrationRegistry: CollectionMigrationRegistry<MeetRoomMemberDocument> = {
	collectionName: meetRoomMemberCollectionName,
	model: MeetRoomMemberModel,
	currentVersion: INTERNAL_CONFIG.ROOM_MEMBER_SCHEMA_VERSION,
	migrations: roomMemberMigrations
};

/**
 * Central registry of all collection migrations.
 */
const migrationRegistry = [
	globalConfigMigrationRegistry,
	userMigrationRegistry,
	roomMigrationRegistry,
	roomMemberMigrationRegistry
];

/**
 * Homogeneous runtime view of the migration registry.
 * Used by migration execution code that iterates over all collections.
 */
export const runtimeMigrationRegistry =
	migrationRegistry as unknown as CollectionMigrationRegistry<SchemaMigratableDocument>[];

import { MeetUserRole } from '@openvidu-meet/typings';
import type { SchemaMigrationMap, SchemaTransform } from '../models/migration.model.js';
import { generateSchemaMigrationName } from '../models/migration.model.js';
import type { MeetUserDocument } from '../models/mongoose-schemas/user.schema.js';
import { meetUserCollectionName } from '../models/mongoose-schemas/user.schema.js';

const userMigrationV1ToV2Name = generateSchemaMigrationName(meetUserCollectionName, 1, 2);

const userMigrationV1ToV2Transform: SchemaTransform<MeetUserDocument> = (user: MeetUserDocument) => {
	const legacyUser = user as unknown as {
		username?: string;
		roles?: unknown;
	};

	// NOTE: This migration assumes that there is only one user in the system,
	// which is the root admin user created during the initial setup.
	user.userId = legacyUser.username!;
	user.name = 'Admin';
	const now = Date.now();
	user.registrationDate = now;
	user.roleUpdatedAt = now;
	user.role = MeetUserRole.ADMIN;
	user.mustChangePassword = false;

	delete legacyUser.username;
	delete legacyUser.roles;

	return user;
};

/**
 * Schema migrations for MeetUser.
 * Key format: schema_{collection}_v{from}_to_v{to}
 */
export const userMigrations: SchemaMigrationMap<MeetUserDocument> = new Map([
	[userMigrationV1ToV2Name, userMigrationV1ToV2Transform]
]);

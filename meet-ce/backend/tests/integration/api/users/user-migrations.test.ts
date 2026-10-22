import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { MeetUserRole } from '@openvidu-meet/typings';
import { container } from '../../../../src/config/dependency-injector.config.js';
import { INTERNAL_CONFIG } from '../../../../src/config/internal-config.js';
import { userMigrations } from '../../../../src/migrations/user-migrations.js';
import { generateSchemaMigrationName } from '../../../../src/models/migration.model.js';
import {
	meetUserCollectionName,
	MeetUserDocument,
	MeetUserModel
} from '../../../../src/models/mongoose-schemas/user.schema.js';
import { MigrationService } from '../../../../src/services/migration.service.js';
import { startTestServer } from '../../../helpers/request-helpers.js';

// Legacy document builders used by integration tests.
// When USER_SCHEMA_VERSION increases, add one builder per legacy version that
// must still be migrated to the current one.

const buildLegacyUserV1 = (userId: string) => ({
	schemaVersion: 1,
	username: userId,
	roles: ['admin', 'user'],
	passwordHash: 'password'
});

/**
 * Single assertion function for migrated user documents in integration tests.
 * This ensures all fields are validated consistently across test cases, and serves
 * as a single source of truth for the expected final state of any migrated user
 * document (regardless of the original version).
 * Keep this aligned with the CURRENT user schema (not intermediate versions).
 */
const expectMigratedUserToCurrentVersion = (migratedUser: Record<string, unknown>, userId: string) => {
	expect(migratedUser).toMatchObject({
		schemaVersion: INTERNAL_CONFIG.USER_SCHEMA_VERSION,
		userId,
		name: 'Admin',
		registrationDate: expect.any(Number),
		role: MeetUserRole.ADMIN,
		roleUpdatedAt: expect.any(Number),
		passwordHash: 'password',
		mustChangePassword: false
	});

	expect(migratedUser).not.toHaveProperty('username');
	expect(migratedUser).not.toHaveProperty('roles');
};

describe('User Schema Migrations', () => {
	/**
	 * Unit tests validate each transform independently.
	 * Add one test per user transform function.
	 */
	describe('User Migration Transforms', () => {
		it('should transform user schema from v1 to v2', () => {
			const migrationName = generateSchemaMigrationName(meetUserCollectionName, 1, 2);
			const transform = userMigrations.get(migrationName);
			expect(transform).toBeDefined();

			const userV1 = {
				schemaVersion: 1,
				username: 'user_v1',
				roles: ['admin', 'user'],
				passwordHash: 'password'
			} as unknown as MeetUserDocument;

			const migratedUser = transform!(userV1);
			expect(migratedUser).toMatchObject({
				userId: 'user_v1',
				name: 'Admin',
				registrationDate: expect.any(Number),
				role: MeetUserRole.ADMIN,
				roleUpdatedAt: expect.any(Number),
				passwordHash: 'password',
				mustChangePassword: false
			});
			expect(migratedUser).not.toHaveProperty('username');
			expect(migratedUser).not.toHaveProperty('roles');
		});
	});

	describe('User Migration Integration', () => {
		let migrationService: MigrationService;
		const testUserIds: string[] = [];

		beforeAll(async () => {
			await startTestServer();
			migrationService = container.get(MigrationService);
		});

		afterAll(async () => {
			await MeetUserModel.collection.deleteMany({ userId: { $in: testUserIds } });
		});

		/**
		 * Integration tests validate that any legacy version reaches the CURRENT version.
		 * Keep one case per supported legacy version in this matrix.
		 */
		it.each([{ fromVersion: 1, buildDocument: buildLegacyUserV1 }])(
			'should migrate a legacy user document from v$fromVersion to current version',
			async ({ buildDocument }) => {
				const userId = `legacy_user_${Date.now()}`;
				testUserIds.push(userId);

				await MeetUserModel.collection.insertOne(buildDocument(userId));
				await migrationService.runMigrations();

				const migratedUser = await MeetUserModel.collection.findOne({ userId: userId });
				expect(migratedUser).toBeTruthy();
				expectMigratedUserToCurrentVersion(migratedUser as Record<string, unknown>, userId);
			}
		);
	});
});

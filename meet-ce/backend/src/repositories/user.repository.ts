import type { MeetUser, MeetUserField } from '@openvidu-meet/typings';
import { SortOrder, TextMatchMode } from '@openvidu-meet/typings';
import { inject, injectable } from 'inversify';
import type { QueryFilter } from 'mongoose';
import { INTERNAL_CONFIG } from '../config/internal-config.js';
import type { MeetUserDocument, MeetUserDocumentOnlyField } from '../models/mongoose-schemas/user.schema.js';
import { MEET_USER_DOCUMENT_ONLY_FIELDS, MeetUserModel } from '../models/mongoose-schemas/user.schema.js';
import { LoggerService } from '../services/logger.service.js';
import type {
	MeetUserPage,
	ProjectedMeetUser,
	UserQuery,
	UserQueryWithFields,
	UserQueryWithProjection
} from '../types/user-projection.types.js';
import { buildStringMatchFilter } from '../utils/string-match-filter.utils.js';
import { BaseRepository } from './base.repository.js';

/**
 * Repository for managing MeetUser entities in MongoDB.
 * Provides CRUD operations and specialized queries for user data.
 */
@injectable()
export class UserRepository extends BaseRepository<MeetUser, MeetUserDocument> {
	constructor(@inject(LoggerService) logger: LoggerService) {
		super(logger, MeetUserModel);
	}

	protected toDomain(dbObject: MeetUserDocument): MeetUser {
		const { schemaVersion, ...user } = dbObject;
		void schemaVersion;
		return user as MeetUser;
	}

		/** Self-service profile field update; returns null when the user does not exist. */
	async updateProfileFields(userId: string, patch: Partial<MeetUser>): Promise<MeetUser | null> {
		try {
			return await this.updatePartialOne({ userId }, patch);
		} catch {
			// Not-found surfaces as null so callers can map to their own error responses.
			return null;
		}
	}
protected override getDocumentOnlyFields(): readonly MeetUserDocumentOnlyField[] {
		return MEET_USER_DOCUMENT_ONLY_FIELDS;
	}

	/**
	 * Creates a new user.
	 *
	 * @param user - The user data to create
	 * @returns The created user
	 */
	create(user: MeetUser): Promise<MeetUser> {
		const document: MeetUserDocument = {
			...user,
			schemaVersion: INTERNAL_CONFIG.USER_SCHEMA_VERSION
		};
		return this.createDocument(document);
	}

	/**
	 * Updates specific fields of a user without replacing the entire document.
	 *
	 * @param userId - The user identifier
	 * @param fieldsToUpdate - Partial user data with fields to update
	 * @returns The updated user
	 * @throws Error if user not found
	 */
	updatePartial(userId: string, fieldsToUpdate: Partial<MeetUser>): Promise<MeetUser> {
		return this.updatePartialOne({ userId }, fieldsToUpdate);
	}

	async disableFederatedAccountsMissing(providerId: string, externalSubjects: string[]): Promise<number> {
		if (externalSubjects.length === 0) return 0;
		const result = await MeetUserModel.updateMany(
			{ identityProviderId: providerId, enabled: true, externalSubject: { $nin: externalSubjects } },
			{ $set: { enabled: false }, $inc: { authVersion: 1 } }
		);
		return result.modifiedCount;
	}

	findFederatedAccountsMissing(providerId: string, externalSubjects: string[]): Promise<MeetUser[]> {
		return this.findAll({ identityProviderId: providerId, enabled: true, externalSubject: { $nin: externalSubjects } }) as Promise<MeetUser[]>;
	}

	/**
	 * Replaces an existing user with new data.
	 *
	 * @param user - The complete updated user data
	 * @returns The updated user
	 * @throws Error if user not found
	 */
	replace(user: MeetUser): Promise<MeetUser> {
		return this.replaceOne({ userId: user.userId }, user);
	}

	/**
	 * Finds a user by their userId.
	 *
	 * @param userId - The unique user identifier
	 * @param fields - Array of field names to include in the result
	 * @returns The user or null if not found
	 */
	findByUserId(userId: string): Promise<MeetUser | null>;

	findByUserId<const TFields extends readonly MeetUserField[]>(
		userId: string,
		fields: TFields
	): Promise<ProjectedMeetUser<TFields> | null>;

	findByUserId(userId: string, fields?: readonly MeetUserField[]): Promise<MeetUser | Partial<MeetUser> | null>;

	findByUserId(
		userId: string,
		fields?: readonly MeetUserField[]
	): Promise<MeetUser | Partial<MeetUser> | null> {
		return this.findOne({ userId }, fields as string[]) as Promise<MeetUser | Partial<MeetUser> | null>;
	}

	findByExternalIdentity(identityProviderId: string, externalSubject: string): Promise<MeetUser | null> {
		return this.findOne({ identityProviderId, externalSubject }) as Promise<MeetUser | null>;
	}

	findByLoginName(loginName: string): Promise<MeetUser | null> {
		return this.findOne({ loginName: loginName.toLowerCase() }) as Promise<MeetUser | null>;
	}

	findByEmail(email: string): Promise<MeetUser | null> {
		return this.findOne({ email: email.toLowerCase() }) as Promise<MeetUser | null>;
	}

	/**
	 * Finds users by their userIds.
	 *
	 * @param userIds - Array of user identifiers
	 * @param fields - Optional array of field names to include in the result
	 * @returns Array of found users
	 */
	findByUserIds(userIds: string[]): Promise<MeetUser[]>;

	findByUserIds<const TFields extends readonly MeetUserField[]>(
		userIds: string[],
		fields: TFields
	): Promise<ProjectedMeetUser<TFields>[]>;

	findByUserIds(userIds: string[], fields?: readonly MeetUserField[]): Promise<MeetUser[] | Partial<MeetUser>[]>;

	findByUserIds(
		userIds: string[],
		fields?: readonly MeetUserField[]
	): Promise<MeetUser[] | Partial<MeetUser>[]> {
		return this.findAll({ userId: { $in: userIds } }, fields as string[]) as Promise<
			MeetUser[] | Partial<MeetUser>[]
		>;
	}

	/**
	 * Finds users with optional filtering, pagination, and sorting.
	 */
	private buildQueryFilter(options: Pick<UserQuery, 'userId' | 'name' | 'nameMatchMode' | 'nameCaseInsensitive' | 'role'>): QueryFilter<MeetUserDocument> {
		const {
			userId,
			name,
			nameMatchMode = TextMatchMode.EXACT,
			nameCaseInsensitive = false,
			role
		} = options;

		const filter: QueryFilter<MeetUserDocument> = {};

		if (userId && name) {
			filter.$or = [
				{ userId },
				{ name: buildStringMatchFilter(name, nameMatchMode, nameCaseInsensitive) }
			];
		} else if (userId) {
			filter.userId = userId;
		} else if (name) {
			// 名称过滤同时匹配姓名与登录名（账号）：管理员常用账号搜索成员
			const nameFilter = buildStringMatchFilter(name, nameMatchMode, nameCaseInsensitive);
			filter.$or = [{ name: nameFilter }, { loginName: nameFilter }];
		}

		if (role) {
			filter.role = role;
		}

		return filter;
	}

	countMatching(options: Pick<UserQuery, 'userId' | 'name' | 'nameMatchMode' | 'nameCaseInsensitive' | 'role'>): Promise<number> {
		return this.count(this.buildQueryFilter(options));
	}

	async find(options?: UserQuery): Promise<MeetUserPage<MeetUser>>;

	async find<const TFields extends readonly MeetUserField[]>(
		options: UserQueryWithProjection<TFields>
	): Promise<MeetUserPage<ProjectedMeetUser<TFields>>>;

	async find(options: UserQueryWithFields): Promise<MeetUserPage<MeetUser | Partial<MeetUser>>>;

	async find(options: UserQueryWithFields = {}): Promise<MeetUserPage<MeetUser | Partial<MeetUser>>> {
		const {
			userId,
			name,
			nameMatchMode = TextMatchMode.EXACT,
			nameCaseInsensitive = false,
			role,
			fields,
			maxItems = 100,
			nextPageToken,
			sortField = 'registrationDate',
			sortOrder = SortOrder.DESC
		} = options;

		const filter = this.buildQueryFilter({ userId, name, nameMatchMode, nameCaseInsensitive, role });

		// Use base repository's pagination method
		const result = await this.findMany(
			filter,
			{
				maxItems,
				nextPageToken,
				sortField,
				sortOrder
			},
			fields as string[]
		);

		return {
			users: result.items,
			isTruncated: result.isTruncated,
			nextPageToken: result.nextPageToken
		};
	}

	/**
	 * Deletes a user by their userId.
	 *
	 * @param userId - The unique user identifier
	 * @throws Error if the user was not found or could not be deleted
	 */
	deleteByUserId(userId: string): Promise<void> {
		return this.deleteOne({ userId });
	}

	/**
	 * Deletes multiple users by their userIds.
	 *
	 * @param userIds - Array of user identifiers
	 * @throws Error if no users were found or could not be deleted
	 */
	deleteByUserIds(userIds: string[]): Promise<void> {
		return this.deleteMany({ userId: { $in: userIds } });
	}
}

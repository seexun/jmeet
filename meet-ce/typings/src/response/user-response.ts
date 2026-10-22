import { MeetUser, MeetUserRole } from '../database/user.entity.js';
import { SortAndPagination, SortableFieldKey } from './sort-pagination.js';
import { TextMatchMode } from './text-match.js';

/**
 * Data Transfer Object (DTO) for MeetUser, excluding sensitive fields.
 */
export type MeetUserDTO = Omit<MeetUser, 'passwordHash' | 'mustChangePassword'>;

/**
 * List of all valid fields that can be selected from a MeetUser.
 * IMPORTANT: Update this list if new properties are added to the MeetUser interface.
 */
export const MEET_USER_FIELDS = [
	'userId',
	'loginName',
	'name',
	'email',
	'employeeNumber',
	'registrationDate',
	'role',
	'roleUpdatedAt',
	'passwordHash',
	'mustChangePassword',
	'enabled',
	'authVersion',
	'identityProviderId',
	'externalSubject',
	'lastIdentitySyncAt',
	// avatarDataUrl intentionally excluded: lists stay lean, avatars are served
	// via /me and single-user lookups only.
	'preferredLanguage',
	'notificationsMuted'
] as const satisfies readonly (keyof MeetUser)[];

/**
 * Properties of a {@link MeetUser} that can be included in the API response when fields filtering is applied.
 */
export type MeetUserField = (typeof MEET_USER_FIELDS)[number];

/**
 * User fields that are allowed for sorting in user list queries.
 */
export const MEET_USER_SORT_FIELDS = [
	'name',
	'registrationDate'
] as const satisfies readonly SortableFieldKey<MeetUser>[];

/**
 * Sortable user fields supported by user list queries.
 */
export type MeetUserSortField = (typeof MEET_USER_SORT_FIELDS)[number];

/**
 * Filters for querying Meet users, extending sorting and pagination options.
 */
export interface MeetUserFilters extends SortAndPagination<MeetUserSortField> {
	/** Optional filter by user ID. */
	userId?: string;
	/** Optional filter by user name. */
	name?: string;
	/** Match mode used to apply name filter. Defaults to 'exact'. */
	nameMatchMode?: TextMatchMode;
	/** Whether name matching should ignore case. Defaults to false. */
	nameCaseInsensitive?: boolean;
	/** Optional filter by user role */
	role?: MeetUserRole;
}

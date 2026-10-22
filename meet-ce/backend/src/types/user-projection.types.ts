import type { MeetUser, MeetUserField, MeetUserFilters, ProjectedEntityByFields } from '@openvidu-meet/typings';

/** Base query inputs without the fields selector. */
type UserQueryBase = Omit<MeetUserFilters, 'fields'>;

/** Full users, no projection. */
export type UserQuery = UserQueryBase & { fields?: undefined };

/** Strongly typed field projection. */
export type UserQueryWithProjection<TFields extends readonly MeetUserField[]> = UserQueryBase & {
	fields: TFields;
};

/** Runtime-provided projection, not strongly typed. */
export type UserQueryWithFields = UserQueryBase & {
	fields?: readonly MeetUserField[];
};

/** User entity projected to the requested fields tuple. */
export type ProjectedMeetUser<TFields extends readonly MeetUserField[]> = ProjectedEntityByFields<MeetUser, TFields>;

/** Paginated response returned by user list methods. */
export type MeetUserPage<TItem> = {
	users: TItem[];
	isTruncated: boolean;
	nextPageToken?: string;
};

import { MeetRoomMemberPermissions } from '../database/room-member-permissions.js';
import { MeetRoom, MeetRoomStatus } from '../database/room.entity.js';
import { ExtraFieldKey } from './extra-field.js';
import { ProjectedEntityByFields } from './field-projection.js';
import { SortAndPagination, SortableFieldKey } from './sort-pagination.js';
import { TextMatchMode } from './text-match.js';

/** Room entity projected to the requested fields tuple. */
export type ProjectedMeetRoom<TFields extends readonly MeetRoomField[]> = ProjectedEntityByFields<MeetRoom, TFields>;

/**
 * List of all valid fields that can be selected from a MeetRoom.
 * IMPORTANT: Update this list if new properties are added to the MeetRoom interface.
 */
export const MEET_ROOM_FIELDS = [
	'roomId',
	'meetingCode',
	'roomName',
	'owner',
	'creationDate',
	'schedule',
	'config',
	'roles',
	'access',
	'status',
	'rolesUpdatedAt',
	'meetingEndAction',
	'autoDeletionDate',
	'autoDeletionPolicy'
] as const satisfies readonly (keyof MeetRoom)[];

/**
 * Properties of a {@link MeetRoom} that can be included in the API response when fields filtering is applied.
 */
export type MeetRoomField = (typeof MEET_ROOM_FIELDS)[number];

/**
 * Properties of a {@link MeetRoom} that can be included as extra fields in the API response.
 * These fields are not included by default and must be explicitly requested via extraFields parameter.
 */
export const MEET_ROOM_EXTRA_FIELDS = ['config', 'roles'] as const satisfies readonly ExtraFieldKey<MeetRoom>[];

/**
 * Properties of a room that can be requested as extra fields in the API response.
 */
export type MeetRoomExtraField = (typeof MEET_ROOM_EXTRA_FIELDS)[number];

/**
 * Room fields that are allowed for sorting in room list queries.
 */
export const MEET_ROOM_SORT_FIELDS = [
	'creationDate',
	'roomName',
	'autoDeletionDate'
] as const satisfies readonly SortableFieldKey<MeetRoom>[];

/**
 * Sortable room fields supported by room list queries.
 */
export type MeetRoomSortField = (typeof MEET_ROOM_SORT_FIELDS)[number];

/**
 * Sensitive fields of a MeetRoom that require specific permissions to be viewed.
 */
export type MeetRoomSensitiveFieldPath =
	| MeetRoomField
	| 'access.anonymous.moderator.url'
	| 'access.anonymous.speaker.url'
	| 'access.anonymous.recording.url';

const SENSITIVE_ROOM_FIELDS_BY_PERMISSION: Partial<
	Record<keyof MeetRoomMemberPermissions, MeetRoomSensitiveFieldPath[]>
> = {
	canShareAccessLinks: [
		'access.anonymous.moderator.url',
		'access.anonymous.speaker.url',
		'access.anonymous.recording.url'
	]
};

export const SENSITIVE_ROOM_FIELDS_ENTRIES = Object.entries(SENSITIVE_ROOM_FIELDS_BY_PERMISSION) as ReadonlyArray<
	[keyof MeetRoomMemberPermissions, MeetRoomSensitiveFieldPath[]]
>;

/**
 * Filters for querying rooms with pagination, sorting, field selection, and extra fields support.
 */
export interface MeetRoomFilters extends SortAndPagination<MeetRoomSortField> {
	/**
	 * Filter rooms by name. The match behavior can be customized with roomNameMatchMode.
	 */
	roomName?: string;
	/**
	 * Match mode used to apply roomName filter.
	 * Defaults to 'exact'.
	 */
	roomNameMatchMode?: TextMatchMode;
	/**
	 * Whether roomName matching should ignore case.
	 * Defaults to false.
	 */
	roomNameCaseInsensitive?: boolean;
	/**
	 * Filter rooms by owner user ID.
	 */
	owner?: string;
	/**
	 * Filter rooms where the given user ID is a member.
	 */
	member?: string;
	/**
	 * Include rooms with user access enabled.
	 */
	userAccess?: boolean;
	/**
	 * Filter rooms by status
	 */
	status?: MeetRoomStatus;
	/**
	 * Array of fields to include in the response
	 */
	fields?: MeetRoomField[];
	/**
	 * Extra fields to include in the response (fields not included by default)
	 */
	extraFields?: MeetRoomExtraField[];
}

/**
 * Successs codes returned after successfully deleting a room, indicating the outcome of the deletion operation.
 */
export enum MeetRoomDeletionSuccessCode {
	ROOM_DELETED = 'room_deleted',
	ROOM_WITH_ACTIVE_MEETING_DELETED = 'room_with_active_meeting_deleted',
	ROOM_WITH_ACTIVE_MEETING_SCHEDULED_TO_BE_DELETED = 'room_with_active_meeting_scheduled_to_be_deleted',
	ROOM_AND_RECORDINGS_DELETED = 'room_and_recordings_deleted',
	ROOM_CLOSED = 'room_closed',
	ROOM_WITH_ACTIVE_MEETING_AND_RECORDINGS_DELETED = 'room_with_active_meeting_and_recordings_deleted',
	ROOM_WITH_ACTIVE_MEETING_CLOSED = 'room_with_active_meeting_closed',
	ROOM_WITH_ACTIVE_MEETING_AND_RECORDINGS_SCHEDULED_TO_BE_DELETED = 'room_with_active_meeting_and_recordings_scheduled_to_be_deleted',
	ROOM_WITH_ACTIVE_MEETING_SCHEDULED_TO_BE_CLOSED = 'room_with_active_meeting_scheduled_to_be_closed'
}

/**
 * Error codes that can be returned when attempting to delete a room, indicating why the deletion operation failed.
 */
export enum MeetRoomDeletionErrorCode {
	ROOM_HAS_ACTIVE_MEETING = 'room_has_active_meeting',
	ROOM_HAS_RECORDINGS = 'room_has_recordings',
	ROOM_WITH_ACTIVE_MEETING_HAS_RECORDINGS = 'room_with_active_meeting_has_recordings',
	ROOM_WITH_ACTIVE_MEETING_HAS_RECORDINGS_CANNOT_SCHEDULE_DELETION = 'room_with_active_meeting_has_recordings_cannot_schedule_deletion',
	ROOM_WITH_RECORDINGS_HAS_ACTIVE_MEETING = 'room_with_recordings_has_active_meeting'
}

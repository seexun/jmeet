import { MeetRecordingInfo, MeetRecordingStatus } from '../database/recording.entity.js';
import { SortAndPagination, SortableFieldKey } from './sort-pagination.js';
import { TextMatchMode } from './text-match.js';

/**
 * List of all valid fields that can be selected from a MeetRecordingInfo.
 * IMPORTANT: Update this list if new properties are added to the MeetRecordingInfo interface.
 */
export const MEET_RECORDING_FIELDS = [
	'recordingId',
	'roomId',
	'roomName',
	'status',
	'layout',
	'encoding',
	'filename',
	'startDate',
	'endDate',
	'duration',
	'size',
	'errorCode',
	'error',
	'details'
] as const satisfies readonly (keyof MeetRecordingInfo)[];

/**
 * Properties of a {@link MeetRecordingInfo} that can be included in the API response when fields filtering is applied.
 */
export type MeetRecordingField = (typeof MEET_RECORDING_FIELDS)[number];

/**
 * Recording fields that are allowed for sorting in recording list queries.
 */
export const MEET_RECORDING_SORT_FIELDS = [
	'startDate',
	'roomName',
	'duration',
	'size'
] as const satisfies readonly SortableFieldKey<MeetRecordingInfo>[];

/**
 * Sortable recording fields supported by recording list queries.
 */
export type MeetRecordingSortField = (typeof MEET_RECORDING_SORT_FIELDS)[number];

/**
 * Filters for querying recordings with pagination, sorting and field selection.
 */
export interface MeetRecordingFilters extends SortAndPagination<MeetRecordingSortField> {
	/**
	 * Filter recordings by room ID (exact match)
	 */
	roomId?: string;
	/**
	 * Filter recordings by room name.
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
	 * Filter recordings by status
	 */
	status?: MeetRecordingStatus;
	/**
	 * Array of fields to include in the response
	 */
	fields?: MeetRecordingField[];
}

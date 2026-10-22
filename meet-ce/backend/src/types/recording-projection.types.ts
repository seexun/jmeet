import type {
	MeetRecordingField,
	MeetRecordingFilters,
	MeetRecordingInfo,
	ProjectedEntityByFields
} from '@openvidu-meet/typings';

/** Base query inputs without the fields selector. */
type RecordingQueryBase = Omit<MeetRecordingFilters, 'fields'>;

/** Base repository query inputs with internal access-control scope. */
type RecordingRepositoryQueryBase = RecordingQueryBase & {
	roomOwner?: string;
	roomMember?: string;
	roomUserAccess?: boolean;
};

/** Full recordings, no projection. */
export type RecordingQuery = RecordingRepositoryQueryBase & { fields?: undefined };

/** Strongly typed field projection. */
export type RecordingQueryWithProjection<TFields extends readonly MeetRecordingField[]> =
	RecordingRepositoryQueryBase & {
		fields: TFields;
	};

/** Runtime-provided projection, not strongly typed. */
export type RecordingQueryWithFields = RecordingRepositoryQueryBase & {
	fields?: readonly MeetRecordingField[];
};

/** Recording entity projected to the requested fields tuple. */
export type ProjectedRecording<TFields extends readonly MeetRecordingField[]> = ProjectedEntityByFields<
	MeetRecordingInfo,
	TFields
>;

/** Paginated response returned by recording list methods. */
export type MeetRecordingPage<TItem> = {
	recordings: TItem[];
	isTruncated: boolean;
	nextPageToken?: string;
};

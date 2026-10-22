import type { MeetRoomField, MeetRoomFilters } from '@openvidu-meet/typings';

/** Base query inputs without the fields selector. */
type RoomQueryBase = Omit<MeetRoomFilters, 'fields'>;

/** Full rooms, no projection. */
export type RoomQuery = RoomQueryBase & { fields?: undefined };

/** Strongly typed field projection. */
export type RoomQueryWithProjection<TFields extends readonly MeetRoomField[]> = RoomQueryBase & {
	fields: TFields;
};

/** Runtime-provided projection, not strongly typed. */
export type RoomQueryWithFields = RoomQueryBase & {
	fields?: readonly MeetRoomField[];
};

/** Paginated response returned by room list methods. */
export type MeetRoomPage<TItem> = {
	rooms: TItem[];
	isTruncated: boolean;
	nextPageToken?: string;
};

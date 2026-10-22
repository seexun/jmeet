import type { MeetRoomField } from '@openvidu-meet/typings';
import type { MeetRoomClientResponseOptions } from '../models/room-request';

/** Client query options requiring an explicit fields tuple. */
export type MeetRoomQueryOptionsWithFields<TFields extends readonly [MeetRoomField, ...MeetRoomField[]]> = {
	fields: TFields;
	extraFields?: MeetRoomClientResponseOptions['extraFields'];
};

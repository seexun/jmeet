import type { MeetRoomMemberField } from '@openvidu-meet/typings';
import type { MeetRoomMemberClientResponseOptions } from '../models/room-member-request';

/** Client query options requiring an explicit fields tuple. */
export type MeetRoomMemberQueryOptionsWithFields<
	TFields extends readonly [MeetRoomMemberField, ...MeetRoomMemberField[]]
> = {
	fields: TFields;
	extraFields?: MeetRoomMemberClientResponseOptions['extraFields'];
};

import { MeetRoomMemberExtraField, MeetRoomMemberField } from '@openvidu-meet/typings';

/**
 * Options for configuring the response MeetRoomMember REST API object
 */
export interface MeetRoomMemberClientResponseOptions {
	/**
	 * Array of fields to include in the response.
	 * If not specified, all fields are included.
	 */
	fields?: readonly MeetRoomMemberField[];
	/**
	 * Array of extra properties to include in the response.
	 * These are not included by default.
	 */
	extraFields?: readonly MeetRoomMemberExtraField[];
}

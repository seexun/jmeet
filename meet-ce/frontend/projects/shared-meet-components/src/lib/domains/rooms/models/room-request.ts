import { MeetRoomExtraField, MeetRoomField } from '@openvidu-meet/typings';

/**
 * Options for configuring the response MeetRoom REST API object
 */
export interface MeetRoomClientResponseOptions {
	/**
	 * Array of fields to include in the response.
	 * If not specified, all fields are included.
	 */
	fields?: readonly MeetRoomField[];
	/**
	 * Array of extra properties to include in the response.
	 * These are not included by default.
	 */
	extraFields?: readonly MeetRoomExtraField[];
}

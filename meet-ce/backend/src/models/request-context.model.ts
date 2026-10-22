import type {
	MeetRoomDeletionPolicyWithMeeting,
	MeetRoomDeletionPolicyWithRecordings,
	MeetRoomField,
	MeetRoomMemberTokenMetadata,
	MeetUser
} from '@openvidu-meet/typings';

/**
 * Context information stored per HTTP request.
 */
export interface RequestContext {
	user?: MeetUser;
	roomMember?: MeetRoomMemberTokenMetadata & { participantIdentity?: string };
}

/**
 * Options for room deletion operations.
 */
export interface MeetRoomDeletionOptions {
	/** Policy for handling rooms with active meetings */
	withMeeting?: MeetRoomDeletionPolicyWithMeeting;
	/** Policy for handling rooms with recordings */
	withRecordings?: MeetRoomDeletionPolicyWithRecordings;
	/** Array of base fields to include in the response (for HTTP field filtering) */
	fields?: MeetRoomField[];
}

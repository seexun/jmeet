import { MeetRoomConfig } from './room-config.js';
import { MeetRoomMemberPermissions } from './room-member-permissions.js';

/**
 * Interface representing a meeting room in the system.
 */
export interface MeetRoom {
	/**
	 * Unique identifier of the room
	 */
	roomId: string;
	/**
	 * Human-friendly numeric meeting code (10 digits) for join-by-code entry.
	 * Immutable once assigned; the random roomId remains the internal primary key everywhere.
	 */
	meetingCode: string;
	/**
	 * Name of the room
	 */
	roomName: string;
	/**
	 * User ID of the Meet user who owns this room
	 */
	owner: string;
	/**
	 * Timestamp in milliseconds since epoch when the room was created
	 */
	creationDate: number;
	/**
	 * Optional scheduling metadata. Rooms without it remain immediately available,
	 * preserving backwards compatibility with existing persistent rooms.
	 */
	schedule?: MeetRoomSchedule;
	/**
	 * Timestamp in milliseconds since epoch when the room will be automatically deleted
	 */
	autoDeletionDate?: number;
	/**
	 * Configuration for automatic deletion behavior of the room. See {@link MeetRoomAutoDeletionPolicy} for details.
	 */
	autoDeletionPolicy?: MeetRoomAutoDeletionPolicy;
	/**
	 * Configuration of the room. See {@link MeetRoomConfig} for details.
	 */
	config: MeetRoomConfig;
	/**
	 * Roles configuration for the room. See {@link MeetRoomRoles} for details.
	 */
	roles: MeetRoomRoles;
	/**
	 * Access configuration for the room. See {@link MeetRoomAccess} for details.
	 */
	access: MeetRoomAccess;
	/**
	 * Status of the room. See {@link MeetRoomStatus} for details.
	 */
	status: MeetRoomStatus;
	/**
	 * Timestamp in milliseconds since epoch of the last time the room's role permissions or access configuration were updated
	 */
	rolesUpdatedAt: number;
	/**
	 * Action to take on the room when the meeting ends. See {@link MeetingEndAction} for details.
	 */
	meetingEndAction: MeetingEndAction;
}

export type MeetRoomRecurrence = 'none' | 'daily' | 'weekly';

export interface MeetRoomSchedule {
	/** Scheduled start timestamp in milliseconds since epoch. */
	startDate: number;
	/** Expected duration in minutes. */
	durationMinutes: number;
	/** IANA timezone identifier used when the meeting was scheduled. */
	timezone: string;
	/** Simple recurrence rule for the meeting. */
	recurrence: MeetRoomRecurrence;
	/** How many minutes before the start participants may join. */
	allowEarlyJoinMinutes: number;
}

/**
 * Roles configuration for a room.
 * Defines the complete permissions for moderator and speaker roles.
 */
export interface MeetRoomRoles {
	moderator: {
		permissions: MeetRoomMemberPermissions;
	};
	speaker: {
		permissions: MeetRoomMemberPermissions;
	};
}

/**
 * Access configuration for a room.
 */
export interface MeetRoomAccess {
	/**
	 * Anonymous users access configuration for the room. See {@link MeetRoomAnonymousUsers} for details.
	 */
	anonymous: MeetRoomAnonymousUsers;
	/**
	 * Users access configuration for the room. See {@link MeetRoomUsers} for details.
	 */
	user: MeetRoomUsers;
}

/**
 * Access configuration for users in a room.
 */
export interface MeetRoomUsers {
	/**
	 * Indicates if all users can access the room.
	 * When enabled, any user can join, including non-members.
	 * Room owners and administrators always have access regardless of this setting.
	 */
	enabled: boolean;
	/**
	 * General access URL for users with access to the room.
	 */
	url: string;
}

/**
 * Access configuration for anonymous users in a room.
 * Defines which roles have anonymous access enabled and their access URLs.
 */
export interface MeetRoomAnonymousUsers {
	/**
	 * Indicates if anonymous access is enabled for the moderator role in the room.
	 * If true, anonymous users with moderator permissions can access the room using the provided URL.
	 */
	moderator: {
		enabled: boolean;
		url: string;
	};
	/**
	 * Indicates if anonymous access is enabled for the speaker role in the room.
	 * If true, anonymous users with speaker permissions can access the room using the provided URL.
	 */
	speaker: {
		enabled: boolean;
		url: string;
	};
	/**
	 * Indicates if anonymous access is enabled for recordings of the room.
	 * If true, anonymous users can access the recordings using the provided URL.
	 */
	recording: {
		enabled: boolean;
		url: string;
	};
}

/**
 * Represents the current status of a meeting room.
 */
export enum MeetRoomStatus {
	/**
	 * Room is open and available to host a meeting.
	 */
	OPEN = 'open',
	/**
	 * There is an ongoing meeting in the room.
	 */
	ACTIVE_MEETING = 'active_meeting',
	/**
	 * Room is closed to hosting new meetings.
	 */
	CLOSED = 'closed'
}

/**
 * Defines the action to take when a meeting ends.
 */
export enum MeetingEndAction {
	/**
	 * No action is taken when the meeting ends.
	 */
	NONE = 'none',
	/**
	 * The room will be closed when the meeting ends.
	 */
	CLOSE = 'close',
	/**
	 * The room (and its recordings, if any) will be deleted
	 * when the meeting ends.
	 */
	DELETE = 'delete'
}

/**
 * Configuration for automatic deletion behavior of a meeting room.
 */
export interface MeetRoomAutoDeletionPolicy {
	/**
	 * Deletion policy when there is an active meeting.
	 */
	withMeeting: MeetRoomDeletionPolicyWithMeeting;
	/**
	 * Deletion policy when recordings exist.
	 */
	withRecordings: MeetRoomDeletionPolicyWithRecordings;
}

/**
 * Defines how room deletion behaves when a meeting is active.
 */
export enum MeetRoomDeletionPolicyWithMeeting {
	/**
	 * Force deletion even if there is an active meeting.
	 */
	FORCE = 'force',
	/**
	 * Delete the room when the meeting ends.
	 */
	WHEN_MEETING_ENDS = 'when_meeting_ends',
	/**
	 * Fail the deletion if there is an active meeting.
	 */
	FAIL = 'fail'
}

/**
 * Defines how room deletion behaves when recordings exist.
 */
export enum MeetRoomDeletionPolicyWithRecordings {
	/**
	 * Force deletion even if there are ongoing or previous recordings.
	 */
	FORCE = 'force',
	/**
	 * Close the room and keep recordings.
	 */
	CLOSE = 'close',
	/**
	 * Fail the deletion if there are ongoing or previous recordings.
	 */
	FAIL = 'fail'
}

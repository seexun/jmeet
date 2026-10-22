/**
 * List of permissions for a room member.
 */
export interface MeetRoomMemberPermissions {
	/**
	 * Can start/stop recording the meeting.
	 */
	canRecord: boolean;
	/**
	 * Can list and play recordings.
	 */
	canRetrieveRecordings: boolean;
	/**
	 * Can delete recordings.
	 */
	canDeleteRecordings: boolean;
	/**
	 * Can join the meeting.
	 */
	canJoinMeeting: boolean;
	/**
	 * Can share access links to invite others.
	 */
	canShareAccessLinks: boolean;
	/**
	 * Can promote other participants to moderator role.
	 */
	canMakeModerator: boolean;
	/**
	 * Can remove other participants from the meeting.
	 */
	canKickParticipants: boolean;
	/**
	 * Can end the meeting for all participants.
	 */
	canEndMeeting: boolean;
	/**
	 * Can publish video in the meeting.
	 */
	canPublishVideo: boolean;
	/**
	 * Can publish audio in the meeting.
	 */
	canPublishAudio: boolean;
	/**
	 * Can share screen in the meeting.
	 */
	canShareScreen: boolean;
	/**
	 * Can read chat messages in the meeting.
	 */
	canReadChat: boolean;
	/**
	 * Can send chat messages in the meeting.
	 */
	canWriteChat: boolean;
	/**
	 * Can change the virtual background.
	 */
	canChangeVirtualBackground: boolean;
}

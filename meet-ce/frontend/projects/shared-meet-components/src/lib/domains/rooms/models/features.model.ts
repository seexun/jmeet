/**
 * Status of captions feature based on room and global configuration
 */
export type CaptionsStatus = 'HIDDEN' | 'ENABLED' | 'DISABLED_WITH_WARNING';

/**
 * Interface that defines all available features in the application
 */
export interface RoomFeatures {
	/**
	 * Indicates if video track is enabled in the room (mutued or unmuted)
	 */
	videoEnabled: boolean;
	/**
	 * Indicates if audio track is enabled in the room (muted or unmuted)
	 */
	audioEnabled: boolean;

	/**
	 * Indicates if camera control is shown in the UI
	 */
	showCamera: boolean;
	/**
	 * Indicates if microphone control is shown in the UI
	 */
	showMicrophone: boolean;
	/**
	 * Indicates if screen share control is shown in the UI
	 */
	showScreenShare: boolean;

	/**
	 * Indicates if the recording controls is shown in the UI
	 */
	showStartStopRecording: boolean;
	/**
	 * Indicates if the view recordings controls is shown in the UI
	 */
	showViewRecordings: boolean;

	/**
	 * Indicates if the fullscreen control is shown in the UI
	 */
	showFullscreen: boolean;
	/**
	 * Indicates if the virtual backgrounds feature is shown in the UI
	 */
	showBackgrounds: boolean;
	/**
	 * Indicates if the captions controls (like toggle captions button) is shown in the UI
	 */
	showCaptionsControls: boolean;
	/**
	 * Indicates if the captions controls are shown but disabled in the UI, with a warning that captions are globally disabled
	 */
	showCaptionsControlsDisabled: boolean;

	/**
	 * Indicates if the chat panel is shown in the UI
	 */
	showChat: boolean;
	/**
	 * Indicates if the participant list is shown in the UI
	 */
	showParticipantList: boolean;

	/**
	 * Indicates if the settings panel is shown in the UI
	 */
	showSettings: boolean;
	/**
	 * Indicates if the theme selector is shown in the UI
	 */
	showThemeSelector: boolean;
	/**
	 * Indicates if the flag for allowing smart layout is enabled.
	 *
	 * It's changed manually (not based on permissions or room config).
	 */
	showLayoutSelector: boolean;

	/**
	 * Indicates if the share access links controls is shown in the UI
	 */
	showShareAccessLinks: boolean;
	/**
	 * Indicates if the end meeting controls is shown in the UI
	 */
	showEndMeeting: boolean;
	/**
	 * Indicates if the make moderator controls is shown in the UI
	 */
	showMakeModerator: boolean;
	/**
	 * Indicates if the kick participants controls is shown in the UI
	 */
	showKickParticipants: boolean;

	/**
	 * Indicates if the join meeting controls is shown in the UI
	 */
	showJoinMeeting: boolean;
}

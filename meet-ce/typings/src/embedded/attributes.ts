/**
 * Enum representing the embedded (HTML attribute) properties of the JMeet application.
 */
export enum EmbeddedAttribute {
	/**
	 * The JMeet room URL to access to.
	 * @required This attribute is required unless `recording-url` is provided.
	 */
	ROOM_URL = 'room-url',
	/**
	 * The URL of a recording to view.
	 * @required This attribute is required unless `room-url` is provided.
	 */
	RECORDING_URL = 'recording-url',
	/**
	 * Display name for the local participant.
	 */
	PARTICIPANT_NAME = 'participant-name',
	/**
	 * Secret key for end-to-end encryption (E2EE).
	 * If provided, the participant will join the meeting using E2EE key.
	 */
	E2EE_KEY = 'e2ee-key',
	/**
	 * URL to redirect to when leaving JMeet.
	 * Redirection occurs after the **`CLOSED` event** fires.
	 */
	LEAVE_REDIRECT_URL = 'leave-redirect-url',
	/**
	 * Whether to show only recordings instead of live meetings.
	 */
	SHOW_ONLY_RECORDINGS = 'show-only-recordings',
	/**
	 * Identifier of the recording to display.
	 * When provided along with `room-url`, the app redirects to the recording view.
	 */
	SHOW_RECORDING = 'show-recording'
}

/**
 * Value shape of the JMeet web component properties, keyed by the camelCase
 * JS property names (the DOM-attribute aliases are listed in {@link EmbeddedAttribute}).
 */
export interface WebComponentPropertyValues {
	/** The JMeet room URL to access to. Required unless `recordingUrl` is provided. */
	roomUrl?: string;
	/** URL of a recording to view. When provided, `roomUrl` is not required. */
	recordingUrl?: string;
	/** Display name for the local participant. */
	participantName?: string;
	/** Secret key for end-to-end encryption (E2EE). When provided the participant joins using E2EE. */
	e2eeKey?: string;
	/** URL to redirect to after the `CLOSED` event fires when leaving JMeet. */
	leaveRedirectUrl?: string;
	/** When true, shows only recordings instead of live meetings. */
	showOnlyRecordings?: boolean;
	/** Identifier of the recording to display. When provided along with `room-url`, the app redirects to the recording view. */
	showRecording?: string;
}

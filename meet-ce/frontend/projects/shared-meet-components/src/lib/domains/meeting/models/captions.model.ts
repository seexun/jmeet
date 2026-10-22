/**
 * Represents a single caption entry with participant information
 */
export interface Caption {
	/**
	 * Unique identifier for the caption
	 */
	id: string;

	/**
	 * Participant's identity (unique identifier)
	 */
	participantIdentity: string;

	/**
	 * Participant's display name
	 */
	participantName: string;

	/**
	 * Participant's color profile for visual representation
	 */
	participantColor: string;

	/**
	 * The transcribed text content
	 */
	text: string;

	/**
	 * Whether this is a final transcription or interim
	 */
	isFinal: boolean;

	/**
	 * The track ID being transcribed
	 */
	trackId: string;

	/**
	 * Timestamp when the caption was created
	 */
	timestamp: number;
}

/**
 * Configuration options for the captions display
 */
export interface CaptionsConfig {
	/**
	 * Maximum number of captions to display simultaneously
	 * @default 3
	 */
	maxVisibleCaptions?: number;

	/**
	 * Time in milliseconds before a final caption auto-expires
	 * @default 5000
	 */
	finalCaptionDuration?: number;

	/**
	 * Time in milliseconds before an interim caption auto-expires
	 * @default 3000
	 */
	interimCaptionDuration?: number;

	/**
	 * Whether to show interim transcriptions (partial results)
	 * @default true
	 */
	showInterimTranscriptions?: boolean;
}

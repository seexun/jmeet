/**
 * Interface representing a recording of a meeting room.
 */
export interface MeetRecordingInfo {
	/** Unique identifier for the recording */
	recordingId: string;
	/** Identifier of the room being recorded */
	roomId: string;
	/** Name of the room being recorded */
	roomName: string;
	/**
	 * Numeric meeting code of the recorded room (from the room entity).
	 * Enriched on list responses for display; not persisted on the recording document.
	 */
	meetingCode?: string;
	// outputMode: MeetRecordingOutputMode;
	/** Current status of the recording. See {@link MeetRecordingStatus} for details */
	status: MeetRecordingStatus;
	/** Layout used for the recording. See {@link MeetRecordingLayout} for details */
	layout?: MeetRecordingLayout;
	/**
	 * Encoding options used for the recording.
	 * Can be a preset from {@link MeetRecordingEncodingPreset} or
	 * custom options defined in {@link MeetRecordingEncodingOptions}.
	 */
	encoding?: MeetRecordingEncodingPreset | MeetRecordingEncodingOptions;
	/** Filename of the recording file (if available) */
	filename?: string;
	/** Timestamp in milliseconds since epoch when the recording started (if available) */
	startDate?: number;
	/** Timestamp in milliseconds since epoch when the recording ended (if available) */
	endDate?: number;
	/** Duration in seconds of the recording (if available) */
	duration?: number;
	/** Size in bytes of the recording file (if available) */
	size?: number;
	/** Error code if the recording failed (if available) */
	errorCode?: number;
	/** Error message if the recording failed (if available) */
	error?: string;
	/** Additional details about the recording status or errors (if available) */
	details?: string;
}

/**
 * Possible statuses for a recording.
 */
export enum MeetRecordingStatus {
	/** Recording is being prepared and will start soon */
	STARTING = 'starting',
	/** Recording is currently in progress */
	ACTIVE = 'active',
	/** Recording is being finalized and will be available soon */
	ENDING = 'ending',
	/** Recording completed successfully and is available */
	COMPLETE = 'complete',
	/** Recording failed due to an error */
	FAILED = 'failed',
	/** Recording was aborted by the system */
	ABORTED = 'aborted',
	/** Recording could not finish because the system limit was reached */
	LIMIT_REACHED = 'limit_reached'
}

/**
 * Layout options for recordings.
 */
export enum MeetRecordingLayout {
	/** Grid layout showing all participants equally */
	GRID = 'grid',
	/** Layout focusing on the active speaker */
	SPEAKER = 'speaker',
	/** Layout showing only the dominant speaker */
	SINGLE_SPEAKER = 'single-speaker'
	// GRID_LIGHT = 'grid-light',
	// SPEAKER_LIGHT = 'speaker-light',
	// SINGLE_SPEAKER_LIGHT = 'single-speaker-light'
}

/**
 * Encoding presets for recordings.
 */
export enum MeetRecordingEncodingPreset {
	/**
	 * 1280x720, 30fps, 3000kbps. Recommended for most cases.
	 */
	H264_720P_30 = 'H264_720P_30',
	/**
	 * 1280x720, 60fps, ~4500 kbps. Smooth motion for fast action.
	 */
	H264_720P_60 = 'H264_720P_60',
	/**
	 * 1920x1080, 30fps, ~4500 kbps. High visual quality for detailed content.
	 */
	H264_1080P_30 = 'H264_1080P_30',
	/**
	 * 1920x1080, 60fps, ~6000 kbps. Premium quality with very smooth motion.
	 */
	H264_1080P_60 = 'H264_1080P_60',
	/**
	 * Portrait 720x1280, 30fps. Vertical video optimized for mobile/portrait use.
	 */
	PORTRAIT_H264_720P_30 = 'PORTRAIT_H264_720P_30',
	/**
	 * Portrait 720x1280, 60fps. Vertical video with smoother motion.
	 */
	PORTRAIT_H264_720P_60 = 'PORTRAIT_H264_720P_60',
	/**
	 * Portrait 1080x1920, 30fps. High-quality vertical recording.
	 */
	PORTRAIT_H264_1080P_30 = 'PORTRAIT_H264_1080P_30',
	/**
	 * Portrait 1080x1920, 60fps. Premium vertical recording with smooth motion.
	 */
	PORTRAIT_H264_1080P_60 = 'PORTRAIT_H264_1080P_60'
}

/**
 * Advanced encoding options for recordings.
 * Use presets for common scenarios; use this for fine-grained control.
 * Both video and audio configurations are required when using advanced options.
 */
export interface MeetRecordingEncodingOptions {
	/** Video encoding configuration */
	video: {
		/** Video width in pixels */
		width: number;
		/** Video height in pixels */
		height: number;
		/** Frame rate in fps */
		framerate: number;
		/** Video codec */
		codec: MeetRecordingVideoCodec;
		/** Video bitrate in kbps */
		bitrate: number;
		/** Keyframe interval in seconds */
		keyFrameInterval: number;
		/** Video depth (pixel format) in bits */
		depth: number;
	};

	/**
	 * Audio encoding configuration
	 */
	audio: {
		/** Audio codec */
		codec: MeetRecordingAudioCodec;
		/** Audio bitrate in kbps */
		bitrate: number;
		/** Audio sample rate in Hz */
		frequency: number;
	};
}

/**
 * Video encoding configuration
 */
export enum MeetRecordingVideoCodec {
	DEFAULT_VC = 'DEFAULT_VC',
	H264_BASELINE = 'H264_BASELINE',
	H264_MAIN = 'H264_MAIN',
	H264_HIGH = 'H264_HIGH',
	VP8 = 'VP8'
}

/**
 * Audio encoding configuration
 */
export enum MeetRecordingAudioCodec {
	DEFAULT_AC = 'DEFAULT_AC',
	OPUS = 'OPUS',
	AAC = 'AAC',
	AC_MP3 = 'AC_MP3'
}

// export enum MeetRecordingOutputMode {
// 	COMPOSED = 'composed',
// }

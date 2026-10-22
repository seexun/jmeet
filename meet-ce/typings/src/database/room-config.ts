import { MeetRecordingEncodingOptions, MeetRecordingEncodingPreset, MeetRecordingLayout } from './recording.entity.js';

/**
 * Interface representing the config for a room.
 */
export interface MeetRoomConfig {
	/** Security and moderation policy applied while joining and during the meeting. */
	security: MeetMeetingSecurityConfig;
	/**
	 * Configuration for chat feature. See {@link MeetChatConfig} for details.
	 */
	chat: MeetChatConfig;
	/**
	 * Configuration for recording feature. See {@link MeetRecordingConfig} for details.
	 */
	recording: MeetRecordingConfig;
	/**
	 * Configuration for virtual backgrounds feature. See {@link MeetVirtualBackgroundConfig} for details.
	 */
	virtualBackground: MeetVirtualBackgroundConfig;
	/**
	 * Configuration for end-to-end encryption feature. See {@link MeetE2EEConfig} for details.
	 */
	e2ee: MeetE2EEConfig;
	/**
	 * Configuration for captions feature. See {@link MeetRoomCaptionsConfig} for details.
	 */
	captions: MeetRoomCaptionsConfig;
	// appearance: MeetAppearanceConfig;
}

export type MeetMeetingAccessScope = 'invited_and_internal' | 'internal_only' | 'anyone_with_link';
export type MeetScreenSharePolicy = 'moderators_only' | 'all_participants';
export type MeetMeetingSecurityLevel = 'standard' | 'internal' | 'confidential';

/**
 * Commercial meeting policy. These settings are deliberately independent from role permissions:
 * roles describe what a member may do, while this policy describes the current meeting-wide rules.
 */
export interface MeetMeetingSecurityConfig {
	/** Policy preset. Optional on legacy payloads; the server normalizes it to standard. */
	securityLevel?: MeetMeetingSecurityLevel;
	waitingRoomEnabled: boolean;
	locked: boolean;
	accessScope: MeetMeetingAccessScope;
	allowJoinBeforeHost: boolean;
	muteOnEntry: boolean;
	allowSelfUnmute: boolean;
	screenSharePolicy: MeetScreenSharePolicy;
	allowParticipantRename: boolean;
	allowMultipleDevices: boolean;
	watermarkEnabled: boolean;
}

export const DEFAULT_MEETING_SECURITY_CONFIG: MeetMeetingSecurityConfig = {
	securityLevel: 'standard',
	waitingRoomEnabled: false,
	locked: false,
	accessScope: 'anyone_with_link',
	allowJoinBeforeHost: true,
	muteOnEntry: true,
	allowSelfUnmute: true,
	screenSharePolicy: 'all_participants',
	allowParticipantRename: true,
	allowMultipleDevices: false,
	watermarkEnabled: false
};

/**
 * Interface representing the config for recordings in a room.
 */
export interface MeetRecordingConfig {
	/**
	 * Indicates if recording is enabled in the room
	 */
	enabled: boolean;
	/**
	 * Layout used for recordings in the room. See {@link MeetRecordingLayout} for details.
	 */
	layout?: MeetRecordingLayout;
	/**
	 * Encoding configuration: use a preset string for common scenarios,
	 * or provide detailed options for fine-grained control.
	 */
	encoding?: MeetRecordingEncodingPreset | MeetRecordingEncodingOptions;
}

/**
 * Interface representing the config for chat in a room.
 */
export interface MeetChatConfig {
	/**
	 * Indicates if chat is enabled in the room
	 */
	enabled: boolean;
}

/**
 * Interface representing the config for virtual backgrounds in a room.
 */
export interface MeetVirtualBackgroundConfig {
	/**
	 * Indicates if virtual backgrounds are enabled in the room
	 */
	enabled: boolean;
}

/**
 * Interface representing the config for end-to-end encryption in a room.
 */
export interface MeetE2EEConfig {
	/**
	 * Indicates if end-to-end encryption is enabled in the room
	 */
	enabled: boolean;
}

/**
 * Interface representing the config for captions in a room.
 */
export interface MeetRoomCaptionsConfig {
	/**
	 * Indicates if captions are enabled in the room
	 */
	enabled: boolean;
}

/**
 * Interface representing the appearance configuration for a room.
 */
export interface MeetAppearanceConfig {
	/**
	 * List of themes available in the room
	 */
	themes: MeetRoomTheme[];
}

/**
 * Interface representing a theme for a room's appearance.
 */
export interface MeetRoomTheme {
	/** Name of the theme */
	name: string;
	/** Indicates if the theme is enabled in the room */
	enabled: boolean;
	/** Base theme mode (light or dark) */
	baseTheme: MeetRoomThemeMode;
	/** Optional custom background color */
	backgroundColor?: string;
	/** Optional custom primary color */
	primaryColor?: string;
	/** Optional custom secondary color */
	secondaryColor?: string;
	/** Optional custom accent color */
	accentColor?: string;
	/** Optional custom surface color */
	surfaceColor?: string;
}

/**
 * Enum representing the base theme mode for a room's appearance.
 */
export enum MeetRoomThemeMode {
	/** Light mode theme */
	LIGHT = 'light',
	/** Dark mode theme */
	DARK = 'dark'
}

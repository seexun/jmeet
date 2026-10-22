import { MeetAppearanceConfig } from './room-config.js';

/** Default platform branding shown before any admin customization. */
export const DEFAULT_PLATFORM_BRANDING: PlatformBrandingConfig = {
	productName: 'JMeet',
	customLogo: false
};

/** Shell-level branding for login, admin chrome, and browser title. */
export interface PlatformBrandingConfig {
	/** Full product name shown across the platform shell. */
	productName: string;
	/** Whether a custom logo is stored for the platform shell. */
	customLogo: boolean;
	/** MIME type of the uploaded custom logo, when present. */
	logoContentType?: string;
	/** Timestamp of the last logo upload, used for cache busting. */
	logoUpdatedAt?: number;
}

/**
 * Represents global config for JMeet.
 */
export interface GlobalConfig {
	/** The projectId is used to identify the project in which the JMeet instance is running. */
	projectId: string;
	/** Platform shell branding (login, admin chrome, document title). */
	platformBranding: PlatformBrandingConfig;
	/** Rooms configuration. See {@link MeetAppearanceConfig} for details. */
	roomsConfig: {
		appearance: MeetAppearanceConfig;
	};
}

/**
 * Represents a user in the Meet application.
 */
export interface MeetUser {
	/** System-generated immutable identifier. Never entered or changed by an operator. */
	userId: string;
	/** Unique account name used for local login and directory display. */
	loginName: string;
	/** Name of the user */
	name: string;
	/** Normalized enterprise email, when supplied by the identity provider. */
	email?: string;
	/** Optional employee number assigned by the enterprise HR directory. */
	employeeNumber?: string;
	/** Timestamp in milliseconds since epoch when the user was registered */
	registrationDate: number;
	/** Role of the user. See {@link MeetUserRole} for details. */
	role: MeetUserRole;
	/** Timestamp in milliseconds since epoch when the user's role was last updated */
	roleUpdatedAt: number;
	/** Hashed password for the user */
	passwordHash: string;
	/** Indicates whether the user must change their password on next login */
	mustChangePassword: boolean;
	/** Whether authentication is permitted for this account. */
	enabled: boolean;
	/** Incremented to invalidate every previously issued application token. */
	authVersion: number;
	identityProviderId?: string;
	externalSubject?: string;
	lastIdentitySyncAt?: number;
	/** Inline avatar as a data URL (client-downscaled to ≤256px). Excluded from list endpoints. */
	avatarDataUrl?: string;
	/** Preferred UI language ('cn' | 'en'). */
	preferredLanguage?: 'cn' | 'en';
	/** When true, the client mutes in-app notification badges and toasts. */
	notificationsMuted?: boolean;
}

/**
 * Defines the possible roles for a Meet user.
 */
export enum MeetUserRole {
	/** Represents a user with administrative privileges (can manage all rooms and users) */
	ADMIN = 'admin',
	/** Represents a room manager (can manage own rooms and access rooms where they are members) */
	ROOM_MANAGER = 'room_manager',
	/** Represents a user with permissions limited to specific rooms (can only access rooms where they are members) */
	ROOM_MEMBER = 'room_member'
}

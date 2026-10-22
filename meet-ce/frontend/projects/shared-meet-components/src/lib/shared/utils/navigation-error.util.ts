import { NavigationErrorReason } from '../models/navigation.model';

/**
 * Translation keys for the user-friendly title and message of a technical navigation error reason.
 * Resolve them with the `translate` pipe (or {@link TranslateService}) at the call site; the keys
 * live in the shared translation bundle under the `NAVIGATION_ERROR` namespace.
 */
export interface NavigationErrorDescription {
	titleKey: string;
	messageKey: string;
}

const NAVIGATION_ERROR_KEYS: Record<NavigationErrorReason, NavigationErrorDescription> = {
	[NavigationErrorReason.CLOSED_ROOM]: {
		titleKey: 'NAVIGATION_ERROR.CLOSED_ROOM.TITLE',
		messageKey: 'NAVIGATION_ERROR.CLOSED_ROOM.MESSAGE'
	},
	[NavigationErrorReason.ANONYMOUS_ACCESS_DISABLED]: {
		titleKey: 'NAVIGATION_ERROR.ANONYMOUS_ACCESS_DISABLED.TITLE',
		messageKey: 'NAVIGATION_ERROR.ANONYMOUS_ACCESS_DISABLED.MESSAGE'
	},
	[NavigationErrorReason.ANONYMOUS_RECORDING_ACCESS_DISABLED]: {
		titleKey: 'NAVIGATION_ERROR.ANONYMOUS_RECORDING_ACCESS_DISABLED.TITLE',
		messageKey: 'NAVIGATION_ERROR.ANONYMOUS_RECORDING_ACCESS_DISABLED.MESSAGE'
	},
	[NavigationErrorReason.INVALID_ROOM_SECRET]: {
		titleKey: 'NAVIGATION_ERROR.INVALID_ROOM_SECRET.TITLE',
		messageKey: 'NAVIGATION_ERROR.INVALID_ROOM_SECRET.MESSAGE'
	},
	[NavigationErrorReason.INVALID_RECORDING_SECRET]: {
		titleKey: 'NAVIGATION_ERROR.INVALID_RECORDING_SECRET.TITLE',
		messageKey: 'NAVIGATION_ERROR.INVALID_RECORDING_SECRET.MESSAGE'
	},
	[NavigationErrorReason.INVALID_ROOM]: {
		titleKey: 'NAVIGATION_ERROR.INVALID_ROOM.TITLE',
		messageKey: 'NAVIGATION_ERROR.INVALID_ROOM.MESSAGE'
	},
	[NavigationErrorReason.INVALID_RECORDING]: {
		titleKey: 'NAVIGATION_ERROR.INVALID_RECORDING.TITLE',
		messageKey: 'NAVIGATION_ERROR.INVALID_RECORDING.MESSAGE'
	},
	[NavigationErrorReason.INVALID_MEMBER]: {
		titleKey: 'NAVIGATION_ERROR.INVALID_MEMBER.TITLE',
		messageKey: 'NAVIGATION_ERROR.INVALID_MEMBER.MESSAGE'
	},
	[NavigationErrorReason.FORBIDDEN_ROOM_ACCESS]: {
		titleKey: 'NAVIGATION_ERROR.FORBIDDEN_ROOM_ACCESS.TITLE',
		messageKey: 'NAVIGATION_ERROR.FORBIDDEN_ROOM_ACCESS.MESSAGE'
	},
	[NavigationErrorReason.FORBIDDEN_ROOM_RECORDINGS_ACCESS]: {
		titleKey: 'NAVIGATION_ERROR.FORBIDDEN_ROOM_RECORDINGS_ACCESS.TITLE',
		messageKey: 'NAVIGATION_ERROR.FORBIDDEN_ROOM_RECORDINGS_ACCESS.MESSAGE'
	},
	[NavigationErrorReason.FORBIDDEN_RECORDING_ACCESS]: {
		titleKey: 'NAVIGATION_ERROR.FORBIDDEN_RECORDING_ACCESS.TITLE',
		messageKey: 'NAVIGATION_ERROR.FORBIDDEN_RECORDING_ACCESS.MESSAGE'
	},
	[NavigationErrorReason.ROOM_ACCESS_REVOKED]: {
		titleKey: 'NAVIGATION_ERROR.ROOM_ACCESS_REVOKED.TITLE',
		messageKey: 'NAVIGATION_ERROR.ROOM_ACCESS_REVOKED.MESSAGE'
	},
	[NavigationErrorReason.TOO_MANY_REQUESTS]: {
		titleKey: 'NAVIGATION_ERROR.TOO_MANY_REQUESTS.TITLE',
		messageKey: 'NAVIGATION_ERROR.TOO_MANY_REQUESTS.MESSAGE'
	},
	[NavigationErrorReason.EMBEDDED_ERROR]: {
		titleKey: 'NAVIGATION_ERROR.EMBEDDED_ERROR.TITLE',
		messageKey: 'NAVIGATION_ERROR.EMBEDDED_ERROR.MESSAGE'
	},
	[NavigationErrorReason.INTERNAL_ERROR]: {
		titleKey: 'NAVIGATION_ERROR.INTERNAL_ERROR.TITLE',
		messageKey: 'NAVIGATION_ERROR.INTERNAL_ERROR.MESSAGE'
	}
};

/**
 * Maps a technical navigation error reason to the translation keys for its user-friendly title and
 * message. Unknown/unrecognized reasons fall back to the generic internal-error description. The
 * returned keys must be resolved through the translation layer at the call site.
 */
export function describeNavigationError(reason: string | NavigationErrorReason): NavigationErrorDescription {
	const normalized = Object.values(NavigationErrorReason).find((value) => value === reason);
	return NAVIGATION_ERROR_KEYS[normalized ?? NavigationErrorReason.INTERNAL_ERROR];
}

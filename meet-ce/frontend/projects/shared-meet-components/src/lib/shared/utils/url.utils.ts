import { EmbeddedAttribute } from '@openvidu-meet/typings';

/**
 * Extracts the server base URL up to (but not including) the marker segment.
 * @example computeServerUrl('http://localhost:6080/meet/room/my-room', '/room/') → 'http://localhost:6080/meet'
 */
export const computeServerUrl = (rawUrl: string, marker: string): string | null => {
	if (!rawUrl) {
		return null;
	}

	try {
		const parsed = new URL(rawUrl);
		const idx = parsed.pathname.indexOf(marker);

		if (idx === -1) {
			return null;
		}

		return `${parsed.origin}${parsed.pathname.slice(0, idx)}`;
	} catch {
		return null;
	}
};

/**
 * Returns the last non-empty path segment of a URL, or `null` if it can't be parsed.
 * @example lastPathSegment('https://demo.openvidu.io/room/my-room') → 'my-room'
 */
export const lastPathSegment = (rawUrl: string): string | null => {
	try {
		const segments = new URL(rawUrl).pathname.split('/').filter(Boolean);
		return segments[segments.length - 1] ?? null;
	} catch {
		return null;
	}
};

/** Returns the value of a query parameter from a URL, or `null` if absent or invalid. */
export const queryParam = (rawUrl: string, name: string): string | null => {
	try {
		return new URL(rawUrl).searchParams.get(name);
	} catch {
		return null;
	}
};

/**
 * Extracts the meeting/recording entry parameters from a route snapshot's `params` + `queryParams`.
 */
export const extractParams = (route: {
	params: Record<string, string>;
	queryParams: Record<string, string | undefined>;
}) => {
	const { params, queryParams } = route;
	return {
		roomId: params['room-id'],
		secret: queryParams['secret'],
		participantName: queryParams[EmbeddedAttribute.PARTICIPANT_NAME],
		leaveRedirectUrl: queryParams[EmbeddedAttribute.LEAVE_REDIRECT_URL],
		showOnlyRecordings: queryParams[EmbeddedAttribute.SHOW_ONLY_RECORDINGS] || 'false',
		showRecording: queryParams[EmbeddedAttribute.SHOW_RECORDING],
		e2eeKey: queryParams[EmbeddedAttribute.E2EE_KEY]
	};
};

/** Appends the defined query params to a path; omits the `?` entirely when none are present. */
export const appendQuery = (path: string, params: Record<string, string | undefined>): string => {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value) {
			search.set(key, value);
		}
	}
	const query = search.toString();
	return query ? `${path}?${query}` : path;
};

/** True when `url` is a well-formed absolute URL. */
export const isValidUrl = (url: string): boolean => {
	try {
		new URL(url);
		return true;
	} catch {
		return false;
	}
};

/**
 * Origin of `document.referrer` (the host page that loaded the iframe), or `null` when there is no
 * referrer or it cannot be parsed. Used to resolve relative `leave-redirect-url` values against the
 * host in the iframe integration.
 */
export const getReferrerOrigin = (): string | null => {
	try {
		if (!document.referrer) {
			return null;
		}
		return new URL(document.referrer).origin;
	} catch (error) {
		console.warn('Could not read referrer origin:', error);
		return null;
	}
};

/**
 * Auto-detects a leave-redirect URL when the user arrived from another origin: returns the full
 * `document.referrer` if its origin differs from the current page, otherwise `null` (same-origin
 * navigation, bookmark, or direct URL entry).
 */
export const getAutoRedirectUrl = (): string | null => {
	try {
		const referrer = document.referrer;

		// No referrer means the user typed the URL directly or came from a bookmark.
		if (!referrer) {
			return null;
		}

		const referrerUrl = new URL(referrer);
		const currentUrl = new URL(window.location.href);

		if (referrerUrl.origin !== currentUrl.origin) {
			return referrer;
		}

		return null;
	} catch (error) {
		console.warn('Error detecting auto redirect URL:', error);
		return null;
	}
};

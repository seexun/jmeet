import { type Page, type Route } from '@playwright/test';

/**
 * Simulated token-expiry controller for exercising the HTTP interceptor's refresh cascade.
 *
 * The mechanism is a single header-inspecting `page.route` over the Meet API paths. Tokens are not
 * really expired server-side (that would require waiting or shrinking backend TTLs); instead, a
 * *normal* API request is answered with a simulated 401 when it carries a token value the test has
 * marked expired. The token-mint (`…/members/token`) and access-refresh (`…/auth/refresh`) endpoints
 * are always let through so the interceptor's recovery genuinely mints fresh (non-expired) tokens
 * that then pass — except in the refresh-token-expired scenario, where `…/auth/refresh` is 401'd to
 * force the logout branch.
 *
 * Assertions read the counters (`authRefreshCount`, `rmtMintCount`, `blocked401Count`) rather than
 * relying on timing, which keeps the tests deterministic under `retries: 0`.
 */
export interface TokenExpiryController {
	/** Snapshots the current access token from storage and marks it expired. */
	expireAccessToken(): Promise<void>;
	/** Snapshots the current refresh token and makes `POST …/auth/refresh` 401 while it carries it. */
	expireRefreshToken(): Promise<void>;
	/** Marks the last-seen room member token expired, and arms "expire the next RMT seen". */
	expireRoomMemberToken(): void;
	/** Forces the RMT mint endpoint itself to 401 (room-access-revoked scenario). */
	revokeRoomMemberAccess(): void;
	/** Clears all expiry state. */
	reviveAll(): void;
	/** Removes the route handler. Safe to call in a `finally`/`afterEach`. */
	dispose(): Promise<void>;

	/** Number of `POST …/auth/refresh` requests observed. */
	authRefreshCount(): number;
	/** Number of `POST …/members/token` (mint) requests observed. */
	rmtMintCount(): number;
	/** Number of `POST …/members/token/refresh` (proactive scheduler) requests observed. */
	rmtRefreshCount(): number;
	/** Number of simulated 401s emitted (proves the mock actually engaged). */
	blocked401Count(): number;
}

const bearer = (value?: string): string | undefined => value?.replace(/^Bearer\s+/i, '').trim() || undefined;

const API_PATH_MATCHER = /\/(api|internal-api)\/v1\//;

/**
 * Installs the token-expiry route handler on the page and returns a {@link TokenExpiryController}.
 * Call once, after the page is created and before the navigation whose requests should be affected.
 */
export const installTokenExpiryController = async (page: Page): Promise<TokenExpiryController> => {
	const expired = new Set<string>(); // access + RMT values treated as expired
	const refreshExpired = new Set<string>(); // refresh token values treated as expired
	let lastSeenRmt: string | undefined;
	let captureNextRmt = false;
	let rmtMintRevoked = false;

	let authRefreshes = 0;
	let rmtMints = 0;
	let rmtRefreshes = 0;
	let blocked = 0;

	const fulfill401 = (route: Route): Promise<void> =>
		route.fulfill({
			status: 401,
			contentType: 'application/json',
			body: JSON.stringify({ error: 'Unauthorized', message: 'Simulated token expiry' })
		});

	const handler = async (route: Route): Promise<void> => {
		const request = route.request();
		const path = new URL(request.url()).pathname;
		const headers = request.headers(); // header names are lower-cased

		const access = bearer(headers['authorization']);
		const rmt = bearer(headers['x-room-member-token']);
		const refresh = bearer(headers['x-refresh-token']);
		const skipRecovery = headers['x-ov-skip-auth-recovery'] === 'true';

		if (rmt) {
			lastSeenRmt = rmt;

			if (captureNextRmt) {
				expired.add(rmt);
				captureNextRmt = false;
			}
		}

		// Access-token refresh: only 401 when its refresh token is marked expired (logout scenario).
		if (path.endsWith('/auth/refresh')) {
			authRefreshes++;

			if (refresh && refreshExpired.has(refresh)) {
				blocked++;
				return fulfill401(route);
			}

			return route.continue();
		}

		// RMT mint / proactive refresh endpoints: let recovery genuinely mint fresh tokens.
		if (/\/members\/token\/refresh$/.test(path)) {
			rmtRefreshes++;
			return route.continue();
		}

		if (/\/members\/token$/.test(path)) {
			rmtMints++;

			if (rmtMintRevoked) {
				blocked++;
				return fulfill401(route);
			}

			return route.continue();
		}

		// The profile endpoint is excluded from interceptor recovery, and the logout endpoint must
		// always succeed so a failed refresh can complete logout (clear tokens + redirect to login).
		if (path.endsWith('/users/me') || path.endsWith('/auth/logout')) {
			return route.continue();
		}

		// A normal API request: 401 it when it carries an expired token and did not opt out of recovery.
		if (!skipRecovery && ((access && expired.has(access)) || (rmt && expired.has(rmt)))) {
			blocked++;
			return fulfill401(route);
		}

		return route.continue();
	};

	await page.route(API_PATH_MATCHER, handler);

	return {
		expireAccessToken: async () => {
			const token = await page.evaluate(() => localStorage.getItem('ovMeet-accessToken'));

			if (token) {
				expired.add(token);
			}
		},
		expireRefreshToken: async () => {
			const token = await page.evaluate(() => localStorage.getItem('ovMeet-refreshToken'));

			if (token) {
				refreshExpired.add(token);
			}
		},
		expireRoomMemberToken: () => {
			// If an RMT has already been observed (e.g. the page has loaded), mark just that value
			// expired so the freshly-minted replacement is not re-expired. Otherwise (armed before
			// navigation) capture the first RMT that appears — the one the triggering request will use.
			if (lastSeenRmt) {
				expired.add(lastSeenRmt);
			} else {
				captureNextRmt = true;
			}
		},
		revokeRoomMemberAccess: () => {
			rmtMintRevoked = true;
		},
		reviveAll: () => {
			expired.clear();
			refreshExpired.clear();
			captureNextRmt = false;
			rmtMintRevoked = false;
		},
		dispose: async () => {
			await page.unroute(API_PATH_MATCHER, handler);
		},
		authRefreshCount: () => authRefreshes,
		rmtMintCount: () => rmtMints,
		rmtRefreshCount: () => rmtRefreshes,
		blocked401Count: () => blocked
	};
};

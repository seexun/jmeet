import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn } from '@angular/router';
import { TokenStorageService } from '../services/token-storage.service';

/** Query parameter carrying the access token across origins. */
export const ACCESS_TOKEN_QUERY_PARAM = 'accessToken';
/** Query parameter carrying the refresh token across origins. */
export const REFRESH_TOKEN_QUERY_PARAM = 'refreshToken';

/**
 * Guard that persists authentication tokens received as query params into
 * {@link TokenStorageService} (localStorage).
 *
 * Used when a page is opened on the Meet server origin from a cross-origin
 * embedder (the webcomponent), which cannot share localStorage with the new
 * tab. The embedder forwards its `accessToken`/`refreshToken` as query params;
 * this guard copies them into the tab's own storage so subsequent API requests
 * are authenticated as the same user. The params are then stripped from the URL
 * by {@link removeQueryParamsGuard}, mirroring how the room secret is handled.
 *
 * In every other case (SPA navigation, no token params) the guard is a no-op.
 */
export const storeTokensFromQueryParamsGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
	const tokenStorageService = inject(TokenStorageService);

	const accessToken = route.queryParams[ACCESS_TOKEN_QUERY_PARAM] as string | undefined;
	if (accessToken) {
		tokenStorageService.setAccessToken(accessToken);
	}

	const refreshToken = route.queryParams[REFRESH_TOKEN_QUERY_PARAM] as string | undefined;
	if (refreshToken) {
		tokenStorageService.setRefreshToken(refreshToken);
	}

	return true;
};

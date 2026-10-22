import { HttpErrorResponse, HttpEvent } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, from, switchMap, throwError } from 'rxjs';
import { HTTP_HEADERS } from '../../../shared/constants/http-headers.constants';
import {
	HttpErrorContext,
	HttpErrorHandler,
	HttpErrorNotifierService
} from '../../../shared/services/http-error-notifier.service';
import { TokenStorageService } from '../../../shared/services/token-storage.service';
import { AuthService } from '../services/auth.service';
import { AuthHeaderProviderService } from './auth-header-provider.service';

/**
 * Handler for authentication-related HTTP errors.
 * Registers itself with HttpErrorNotifierService to autonomously handle access token refresh.
 * The interceptor doesn't know about this service - it discovers itself via registration.
 */
@Injectable({
	providedIn: 'root'
})
export class AuthInterceptorErrorHandlerService implements HttpErrorHandler {
	private readonly authService = inject(AuthService);
	private readonly tokenStorageService = inject(TokenStorageService);
	private readonly httpErrorNotifier = inject(HttpErrorNotifierService);
	private readonly authHeaderProvider = inject(AuthHeaderProviderService);

	/**
	 * Registers this handler with the error notifier service
	 */
	init(): void {
		this.httpErrorNotifier.register(this);
	}

	/**
	 * Determines if this handler can handle the given error context
	 */
	canHandle(context: HttpErrorContext): boolean {
		const { error, pageUrl } = context;

		// Handle 403 "Password change required"
		if (
			error.status === 403 &&
			!pageUrl.startsWith('/login') &&
			error.error?.message?.includes('Password change required')
		) {
			return true;
		}

		// Only handle 401 errors
		if (error.status !== 401) {
			return false;
		}

		// Don't handle if it's already a token refresh endpoint error (avoid infinite loop)
		if (error.url?.includes('/auth/refresh')) {
			return false;
		}

		// Handle if not on login page OR if there's a refresh token available
		return !pageUrl.startsWith('/login') || !!this.tokenStorageService.getRefreshToken();
	}

	/**
	 * Handles the error and returns a recovery Observable
	 */
	handle(context: HttpErrorContext): Observable<HttpEvent<unknown>> {
		const { error, pageUrl } = context;

		// Special case: password change required
		if (error.status === 403) {
			// Logout so user must re-authenticate and change password
			console.warn('Password change required. Logging out...');
			return from(this.authService.logout(pageUrl)).pipe(switchMap(() => throwError(() => error)));
		}

		return this.refreshAccessToken(context);
	}

	/**
	 * Refreshes the access token and retries the original request
	 */
	private refreshAccessToken(context: HttpErrorContext): Observable<HttpEvent<unknown>> {
		const { request: originalRequest, error: originalError, pageUrl, next } = context;

		return from(this.authService.refreshToken()).pipe(
			switchMap(() => {
				// Update the request with the new token
				const headers = this.authHeaderProvider.provideHeaders();
				const updatedRequest = headers ? originalRequest.clone({ setHeaders: headers }) : originalRequest;

				return next(updatedRequest);
			}),
			catchError(async (error: HttpErrorResponse) => {
				if (error.url?.includes('/auth/refresh')) {
					console.error('Error refreshing access token');

					// If the original request was not to the profile endpoint and does not have the skip-auth-recovery header,
					// logout and redirect to the login page
					if (
						!originalRequest.url.includes('/users/me') &&
						originalRequest.headers.get(HTTP_HEADERS.SKIP_AUTH_RECOVERY) !== 'true'
					) {
						await this.authService.logout(pageUrl);

						// Add a flag to the error to indicate that the auth redirect has been handled
						const handledError = originalError as HttpErrorResponse & {
							authRedirectHandled?: boolean;
						};
						handledError.authRedirectHandled = true;
						throw handledError;
					}

					throw originalError;
				}

				throw error;
			})
		);
	}
}

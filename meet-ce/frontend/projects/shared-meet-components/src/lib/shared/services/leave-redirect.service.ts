import { inject, Injectable } from '@angular/core';
import { getAutoRedirectUrl, getReferrerOrigin, isValidUrl } from '../utils/url.utils';
import { RuntimeConfigService } from './runtime-config.service';
import { SessionStorageService } from './session-storage.service';

/**
 * Owns the "leave-redirect URL" — where the user is sent after leaving/closing a meeting. It
 * resolves the URL per embedding mode (SPA / iframe / webcomponent) and persists it in session
 * storage so it survives reloads and the lobby can pre-fill it. Performing the actual redirect is
 * {@link NavigationService}'s job; this service only owns the resolved destination.
 */
@Injectable({ providedIn: 'root' })
export class LeaveRedirectService {
	private readonly sessionStorageService = inject(SessionStorageService);
	private readonly runtimeConfigService = inject(RuntimeConfigService);

	private leaveRedirectUrl?: string;

	/**
	 * Retrieves the leave-redirect URL, checking both the in-memory value and session storage.
	 *
	 * @returns The leave-redirect URL if set, otherwise `undefined`.
	 */
	getLeaveRedirectURL(): string | undefined {
		const storedRedirectUrl = this.sessionStorageService.getRedirectUrl();
		if (!this.leaveRedirectUrl && storedRedirectUrl) {
			this.leaveRedirectUrl = storedRedirectUrl;
		}

		return this.leaveRedirectUrl;
	}

	/**
	 * Resolves and stores the leave-redirect URL with automatic referrer detection.
	 *
	 * @param leaveRedirectUrl - The URL to set as the leave-redirect destination.
	 */
	handleLeaveRedirectUrl(leaveRedirectUrl: string | undefined): void {
		const isWebcomponentMode = this.runtimeConfigService.isWebcomponentMode();
		const isIframeMode = this.runtimeConfigService.isIframeMode();

		// Explicit valid URL provided - use as is
		if (leaveRedirectUrl && isValidUrl(leaveRedirectUrl)) {
			this.setLeaveRedirectUrl(leaveRedirectUrl);
			return;
		}

		// Relative path while embedded — resolve it against the HOST page's origin.
		if (leaveRedirectUrl?.startsWith('/')) {
			// Webcomponent: the Angular Elements element runs in the host's window,
			// so `window.location.origin` IS the host origin.
			if (isWebcomponentMode) {
				this.setLeaveRedirectUrl(window.location.origin + leaveRedirectUrl);
				return;
			}

			// Iframe: the app runs on the Meet server origin, so the host origin is
			// reconstructed from the referrer (the parent page that loaded the iframe).
			if (isIframeMode) {
				const hostOrigin = getReferrerOrigin();
				if (hostOrigin) {
					this.setLeaveRedirectUrl(hostOrigin + leaveRedirectUrl);
				}
				return;
			}
		}

		// Auto-detect from referrer (only when running standalone and no explicit URL provided)
		if (!leaveRedirectUrl && !isWebcomponentMode && !isIframeMode) {
			const autoRedirectUrl = getAutoRedirectUrl();
			if (autoRedirectUrl) {
				this.setLeaveRedirectUrl(autoRedirectUrl);
			}
		}
	}

	private setLeaveRedirectUrl(leaveRedirectUrl: string): void {
		this.leaveRedirectUrl = leaveRedirectUrl;
		this.sessionStorageService.setRedirectUrl(leaveRedirectUrl);
	}
}

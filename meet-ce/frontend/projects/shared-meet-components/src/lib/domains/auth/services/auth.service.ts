import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { MeetUserDTO, MeetUserRole } from '@openvidu-meet/typings';
import { HTTP_HEADERS } from '../../../shared/constants/http-headers.constants';
import { HttpService } from '../../../shared/services/http.service';
import { NavigationService } from '../../../shared/services/navigation.service';
import { SessionStorageService } from '../../../shared/services/session-storage.service';
import { TokenStorageService } from '../../../shared/services/token-storage.service';
import { UserService } from '../../users/services/user.service';

@Injectable({
	providedIn: 'root'
})
export class AuthService {
	protected httpService = inject(HttpService);
	protected userService = inject(UserService);
	protected tokenStorageService = inject(TokenStorageService);
	protected navigationService = inject(NavigationService);
	protected sessionStorageService = inject(SessionStorageService);

	protected readonly AUTH_API = `${HttpService.INTERNAL_API_PATH_PREFIX}/auth`;

	protected hasCheckAuth = false;
	protected user: MeetUserDTO | null = null;

	async getAuthenticationOptions(): Promise<{ localLoginEnabled: boolean; identityProviders: Array<{ id: string; type: string; displayName: string }> }> {
		return this.httpService.getRequest(`${this.AUTH_API}/options`);
	}

	/** 构造企业登录跳转地址（供直接跳转与探测式跳转共用）。 */
	startEnterpriseLoginUrl(providerId: string, redirectTo: string): string {
		const base = document.querySelector('base')?.getAttribute('href') ?? '/';
		return `${base.replace(/\/$/, '')}/${this.AUTH_API}/sso/${encodeURIComponent(providerId)}/start?redirectTo=${encodeURIComponent(redirectTo)}`;
	}

	startEnterpriseLogin(providerId: string, redirectTo: string): void {
		window.location.assign(this.startEnterpriseLoginUrl(providerId, redirectTo));
	}

	async completeEnterpriseLogin(accessToken: string, refreshToken: string): Promise<void> {
		this.tokenStorageService.setAccessToken(accessToken);
		this.tokenStorageService.setRefreshToken(refreshToken);
		await this.getAuthenticatedUser(true);
	}

	async exchangeEnterpriseTicket(ticket: string): Promise<void> {
		const response = await this.httpService.postRequest<{ accessToken: string; refreshToken: string }>(`${this.AUTH_API}/sso/exchange`, { ticket });
		await this.completeEnterpriseLogin(response.accessToken, response.refreshToken);
	}

	async loginWithDirectory(providerId: string, userId: string, password: string): Promise<void> {
		const response = await this.httpService.postRequest<{ accessToken: string; refreshToken: string }>(
			`${this.AUTH_API}/directory/${encodeURIComponent(providerId)}/login`,
			{ userId, password }
		);
		this.tokenStorageService.setAccessToken(response.accessToken);
		this.tokenStorageService.setRefreshToken(response.refreshToken);
		await this.getAuthenticatedUser(true);
	}

	async beginMfaSetup(): Promise<{ secret: string; uri: string }> {
		return this.httpService.postRequest(`${this.AUTH_API}/mfa/setup`, {});
	}

	async enableMfa(token: string): Promise<{ recoveryCodes: string[] }> {
		return this.httpService.postRequest(`${this.AUTH_API}/mfa/enable`, { token });
	}

	async disableMfa(token: string): Promise<void> {
		await this.httpService.postRequest(`${this.AUTH_API}/mfa/disable`, { token });
	}

	async listSessions(): Promise<{ sessions: Array<{ sessionId: string; createdAt: number; lastSeenAt: number; ipAddress?: string; userAgent?: string }> }> {
		return this.httpService.getRequest(`${this.AUTH_API}/sessions`);
	}

	async revokeSession(sessionId: string): Promise<void> {
		await this.httpService.deleteRequest(`${this.AUTH_API}/sessions/${encodeURIComponent(sessionId)}`);
	}

	/**
	 * Logs in a user with the provided credentials.
	 *
	 * @param userId - The unique identifier of the user
	 * @param password - The user's password
	 * @returns A promise that resolves with login metadata
	 */
	async login(userId: string, password: string, otp?: string): Promise<{ mustChangePassword: boolean; mfaRequired?: boolean }> {
		try {
			const path = `${this.AUTH_API}/login`;
			const body = { loginName: userId, password, ...(otp ? { otp } : {}) };
			const response = await this.httpService.postRequest<{
				message: string;
				accessToken: string;
				refreshToken?: string;
				mustChangePassword?: boolean;
				mfaRequired?: boolean;
			}>(path, body);
			if (response.mfaRequired) return { mustChangePassword: false, mfaRequired: true };

			// Save tokens in localStorage
			this.tokenStorageService.setAccessToken(response.accessToken);
			if (response.refreshToken) {
				this.tokenStorageService.setRefreshToken(response.refreshToken);
			}

			const mustChangePassword = response.mustChangePassword ?? false;
			if (mustChangePassword) {
				this.sessionStorageService.setMustChangePasswordRequired(true);
			}

			await this.getAuthenticatedUser(true);
			return { mustChangePassword };
		} catch (err) {
			const error = err as HttpErrorResponse;
			console.error(error.error.message || error.error);
			throw error;
		}
	}

	/**
	 * Refreshes the access token using the refresh token.
	 *
	 * @returns A promise that resolves to the response from the refresh endpoint
	 */
	async refreshToken() {
		const path = `${this.AUTH_API}/refresh`;
		const refreshToken = this.tokenStorageService.getRefreshToken();

		// Add refresh token header if in header mode
		let headers: Record<string, string> | undefined;
		if (refreshToken) {
			headers = {};
			headers[HTTP_HEADERS.REFRESH_TOKEN] = `Bearer ${refreshToken}`;
		}

		const response = await this.httpService.postRequest<{
			message: string;
			accessToken: string;
			refreshToken?: string;
		}>(path, {}, headers);

		// Update tokens in localStorage
		this.tokenStorageService.setAccessToken(response.accessToken);
		if (response.refreshToken) {
			this.tokenStorageService.setRefreshToken(response.refreshToken);
		}

		return response;
	}

	/**
	 * Logs out the currently authenticated user and clears authentication tokens.
	 * Redirects to the login page after logout, optionally with a query parameter to redirect back after login.
	 *
	 * @param redirectToAfterLogin - Optional path to redirect to after login
	 * @returns A promise that resolves when the logout is successful
	 */
	async logout(redirectToAfterLogin?: string) {
		try {
			const path = `${this.AUTH_API}/logout`;
			const refreshToken = this.tokenStorageService.getRefreshToken();
			const headers = refreshToken ? { [HTTP_HEADERS.REFRESH_TOKEN]: `Bearer ${refreshToken}` } : undefined;
			const response = await this.httpService.postRequest<{ logoutUrl?: string }>(path, {}, headers);
			this.user = null;

			// Clear tokens from localStorage if in header mode
			this.tokenStorageService.clearAccessAndRefreshTokens();
			this.sessionStorageService.removeMustChangePasswordRequired();

			// Drop any cached list-page instances so the next user starts clean
			this.navigationService.clearCachedRoutes();

			// Redirect to login page with a query parameter if provided
			// to redirect to the original page after login
			if (response.logoutUrl) window.location.assign(response.logoutUrl);
			else this.navigationService.redirectToLoginPage(redirectToAfterLogin, true);
		} catch (error) {
			console.error((error as HttpErrorResponse).error.message);
		}
	}

	/**
	 * Checks if the user is authenticated by attempting to retrieve the authenticated user's information.
	 *
	 * @return A promise that resolves to true if the user is authenticated, false otherwise
	 */
	async isUserAuthenticated(): Promise<boolean> {
		await this.getAuthenticatedUser();
		return !!this.user;
	}

	/**
	 * Retrieves the authenticated user's ID.
	 *
	 * @return A promise that resolves to the user's ID if authenticated, undefined otherwise
	 */
	async getUserId(): Promise<string | undefined> {
		await this.getAuthenticatedUser();
		return this.user?.userId;
	}

	/**
	 * Retrieves the authenticated user's name.
	 *
	 * @return A promise that resolves to the user's name if authenticated, undefined otherwise
	 */
	async getUserName(): Promise<string | undefined> {
		await this.getAuthenticatedUser();
		return this.user?.name;
	}

	/**
	 * Retrieves the authenticated user's role.
	 *
	 * @return A promise that resolves to the user's role if authenticated, undefined otherwise
	 */
	async getUserRole(): Promise<MeetUserRole | undefined> {
		await this.getAuthenticatedUser();
		return this.user?.role;
	}

	/**
	 * Checks if the authenticated user has an admin role.
	 *
	 * @return A promise that resolves to true if the user is an admin, false otherwise
	 */
	async isAdmin(): Promise<boolean> {
		const role = await this.getUserRole();
		return role === MeetUserRole.ADMIN;
	}

	/**
	 * Retrieves the authenticated user's information and caches it in the service.
	 * If the user information is already cached and force is not true, it returns immediately.
	 * If force is true, it will attempt to fetch the user information again from the server.
	 *
	 * @param force - If true, forces a refresh of the user information from the server
	 */
	private async getAuthenticatedUser(force = false) {
		if (force || (!this.user && !this.hasCheckAuth)) {
			try {
				const user = await this.userService.getMe();
				this.user = user;
			} catch (error) {
				this.user = null;
			}
		}

		this.hasCheckAuth = true;
	}
}

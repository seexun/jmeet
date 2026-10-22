import { Injectable } from '@angular/core';

/**
 * Service to manage JWT token storage for authentication
 */
@Injectable({
	providedIn: 'root'
})
export class TokenStorageService {
	private readonly ACCESS_TOKEN_KEY = 'ovMeet-accessToken';
	private readonly REFRESH_TOKEN_KEY = 'ovMeet-refreshToken';

	// Saves the access token to localStorage
	setAccessToken(token: string): void {
		localStorage.setItem(this.ACCESS_TOKEN_KEY, token);
	}

	// Retrieves the access token from localStorage
	getAccessToken(): string | null {
		return localStorage.getItem(this.ACCESS_TOKEN_KEY);
	}

	// Saves the refresh token to localStorage
	setRefreshToken(token: string): void {
		localStorage.setItem(this.REFRESH_TOKEN_KEY, token);
	}

	// Retrieves the refresh token from localStorage
	getRefreshToken(): string | null {
		return localStorage.getItem(this.REFRESH_TOKEN_KEY);
	}

	// Clears access and refresh tokens from localStorage
	clearAccessAndRefreshTokens(): void {
		localStorage.removeItem(this.ACCESS_TOKEN_KEY);
		localStorage.removeItem(this.REFRESH_TOKEN_KEY);
	}
}

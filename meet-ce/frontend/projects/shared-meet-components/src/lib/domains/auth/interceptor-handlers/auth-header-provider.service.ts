import { Injectable, inject } from '@angular/core';
import { HTTP_HEADERS } from '../../../shared/constants/http-headers.constants';
import {
	HttpHeaderContext,
	HttpHeaderProvider,
	HttpHeaderProviderService
} from '../../../shared/services/http-header-provider.service';
import { TokenStorageService } from '../../../shared/services/token-storage.service';

/**
 * Provider for authentication headers.
 * Adds the access token to all requests if available.
 */
@Injectable({
	providedIn: 'root'
})
export class AuthHeaderProviderService implements HttpHeaderProvider {
	private readonly tokenStorageService = inject(TokenStorageService);
	private readonly headerProviderService = inject(HttpHeaderProviderService);

	/**
	 * Registers this provider with the header provider service
	 */
	init(): void {
		this.headerProviderService.register(this);
	}

	/**
	 * Determines if this provider should add headers for the given context
	 */
	canProvide(_context: HttpHeaderContext): boolean {
		// Always provide if access token exists
		return !!this.tokenStorageService.getAccessToken();
	}

	/**
	 * Provides the authorization header with the access token
	 */
	provideHeaders(): Record<string, string> | null {
		const accessToken = this.tokenStorageService.getAccessToken();
		if (!accessToken) {
			return null;
		}

		return {
			[HTTP_HEADERS.AUTHORIZATION]: `Bearer ${accessToken}`
		};
	}
}

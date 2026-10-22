import { HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';

/**
 * Context information for adding headers to an HTTP request
 */
export interface HttpHeaderContext {
	/** The HTTP request to add headers to */
	request: HttpRequest<unknown>;
	/** The current page URL */
	pageUrl: string;
}

/**
 * Interface for services that provide HTTP headers
 */
export interface HttpHeaderProvider {
	/**
	 * Determines if this provider should add headers for the given context
	 */
	canProvide(context: HttpHeaderContext): boolean;

	/**
	 * Provides headers to add to the request
	 * @returns An object with header key-value pairs, or null if no headers to add
	 */
	provideHeaders(): Record<string, string> | null;
}

/**
 * Service responsible for coordinating HTTP header providers across domains.
 * This allows the interceptor to remain completely agnostic of domain logic.
 *
 * Domain providers register themselves and provide headers when applicable.
 */
@Injectable({
	providedIn: 'root'
})
export class HttpHeaderProviderService {
	private providers: HttpHeaderProvider[] = [];

	/**
	 * Registers a new HTTP header provider
	 *
	 * @param provider The header provider to register
	 */
	public register(provider: HttpHeaderProvider): void {
		this.providers.push(provider);
	}

	/**
	 * Collects all headers from registered providers for the given context
	 *
	 * @param context The header context
	 * @returns An object with all headers to add, or null if no headers
	 */
	public collectHeaders(context: HttpHeaderContext): Record<string, string> | null {
		const headers: Record<string, string> = {};

		for (const provider of this.providers) {
			if (provider.canProvide(context)) {
				const providerHeaders = provider.provideHeaders();
				if (providerHeaders) {
					Object.assign(headers, providerHeaders);
				}
			}
		}

		return Object.keys(headers).length > 0 ? headers : null;
	}
}

import { container } from '../config/dependency-injector.config.js';
import { MEET_ENV } from '../environment.js';
import { BaseUrlService } from '../services/base-url.service.js';
import { getBasePath } from './html-dynamic-base-path.utils.js';

/**
 * Returns the base URL for the application, including the configured base path.
 *
 * If the global `BASE_URL` variable is defined, it returns its value,
 * ensuring there is no trailing slash and removing default ports (443 for HTTPS, 80 for HTTP).
 * Otherwise, it retrieves the base URL from the `HttpContextService` instance.
 *
 * The configured BASE_PATH is appended to the URL (without trailing slash).
 *
 * @returns The base URL as a string (e.g., 'https://example.com/meet').
 */
export const getBaseUrl = (): string => {
	let hostUrl: string;

	if (MEET_ENV.BASE_URL) {
		hostUrl = MEET_ENV.BASE_URL.endsWith('/') ? MEET_ENV.BASE_URL.slice(0, -1) : MEET_ENV.BASE_URL;

		// Remove default port 443 for HTTPS URLs
		if (hostUrl.startsWith('https://') && hostUrl.includes(':443')) {
			hostUrl = hostUrl.replace(':443', '');
		}

		// Remove default port 80 for HTTP URLs
		if (hostUrl.startsWith('http://') && hostUrl.includes(':80')) {
			hostUrl = hostUrl.replace(':80', '');
		}
	} else {
		const baseUrlService = container.get(BaseUrlService);
		hostUrl = baseUrlService.getBaseUrl();
	}

	// Append the base path (without trailing slash)
	const basePath = getBasePath();

	if (basePath === '/') {
		return hostUrl;
	}

	// Remove trailing slash from base path for the final URL
	return `${hostUrl}${basePath.slice(0, -1)}`;
};

/**
 * Combines the base URL (including the configured base path) with the provided path,
 * ensuring there is exactly one slash between them.
 *
 * @param path - The path to append to the base URL (e.g., '/api/endpoint')
 * @returns  The full URL as a string (e.g., 'https://example.com/meet/api/endpoint')
 */
export const addBaseUrlToPath = (path: string): string => {
	const baseUrl = getBaseUrl();
	return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
};

/**
 * Extracts the path from a URL, removing the configured basePath when present.
 * If the input is a relative path, it is returned with the basePath stripped if applicable.
 * 
 * @param url - The full URL or absolute path to extract the path from
 * @return The extracted path with the basePath removed if it was present
 */
export const extractPathFromUrl = (url: string): string => {
	// If the URL is an absolute path, strip basePath and return
	if (url.startsWith('/')) {
		return stripBasePath(url);
	}

	try {
		const urlObject = new URL(url);
		const pathname = stripBasePath(urlObject.pathname);
		return pathname + urlObject.search + urlObject.hash;
	} catch {
		// If URL parsing fails, preserve the original value.
		return url;
	}
};

/**
 * Strips the configured basePath from a given absolute path when present.
 * 
 * @param path - The absolute path to strip the basePath from
 * @return The path with the basePath removed if it was present, otherwise the original path
 */
export const stripBasePath = (path: string): string => {
	const basePath = getBasePath();
	const basePathWithoutTrailingSlash = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;

	if (basePathWithoutTrailingSlash && path.startsWith(basePathWithoutTrailingSlash)) {
		return path.slice(basePathWithoutTrailingSlash.length) || '/';
	}

	return path;
};

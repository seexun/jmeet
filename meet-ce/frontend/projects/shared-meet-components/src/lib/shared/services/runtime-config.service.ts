import { computed, Injectable, signal } from '@angular/core';

declare global {
	interface Window {
		__OPENVIDU_MEET_CONFIG__?: {
			basePath: string;
		};
	}
}

/**
 * Service responsible for managing runtime configuration such as base paths for assets.
 * It reads from a global configuration object injected at runtime (e.g., by the server or hosting environment) and provides utility methods to resolve asset paths.
 * This allows the application to be flexible in different deployment contexts (e.g., served from root, subpath, or embedded in an iframe).
 */
@Injectable({
	providedIn: 'root'
})
export class RuntimeConfigService {
	/**
	 * Deployment base path under which Meet is mounted (e.g. `/meet`), or `/` when
	 * served from the root. Resolved once at construction from the injected config,
	 * the document `<base href>`, or `/` as a last resort.
	 */
	private _deploymentBasePath: string;

	/**
	 * Base URL of the JMeet backend server, already including the deployment
	 * base path (e.g. `https://host/meet`). Empty string means “same origin” (relative
	 * requests). Set reactively via `setServerBaseUrl()` when embedded as a
	 * webcomponent; stays empty in a regular SPA context.
	 */
	private readonly _serverBaseUrl = signal<string>('');

	/**
	 * True once the service is in webcomponent mode (i.e. `enableWebcomponentMode()`
	 * or `setServerBaseUrl()` has been called at least once). In a regular SPA context
	 * this never becomes true, which means `isReadyForRequests` is immediately true.
	 */
	private readonly _webcomponentMode = signal(false);

	/**
	 * Emits true when it is safe to make API requests:
	 * - Regular SPA: immediately true (not in webcomponent mode).
	 * - Webcomponent: true once `setServerBaseUrl()` has been called (which enables mode and sets the URL).
	 */
	readonly isReadyForRequests = computed(() => {
		// In SPA mode (not webcomponent), always ready
		if (!this._webcomponentMode()) return true;

		// In webcomponent mode, only ready once the server base URL is set
		return !!this._serverBaseUrl();
	});

	readonly serverBaseUrl = this._serverBaseUrl.asReadonly();
	readonly isWebcomponentMode = this._webcomponentMode.asReadonly();

	/** Whether the document is running inside a cross-document `<iframe>`. Resolved once at construction. */
	private readonly _inIframe = this.detectInIframe();

	/**
	 * True when Meet runs inside a cross-document `<iframe>`
	 */
	readonly isIframeMode = computed(() => this._inIframe && !this._webcomponentMode());

	/**
	 * True when Meet runs embedded inside a host application — either as the inline
	 * webcomponent or inside a cross-document `<iframe>`.
	 */
	readonly isEmbeddedMode = computed(() => this._webcomponentMode() || this.isIframeMode());

	constructor() {
		// Read from injected config, fallback to document base element, then to '/'
		this._deploymentBasePath = window.__OPENVIDU_MEET_CONFIG__?.basePath || this.readBaseHrefFromDocument() || '/';
	}

	get basePath(): string {
		return this._deploymentBasePath;
	}

	/**
	 * Enables webcomponent mode. Once enabled, `isReadyForRequests` will only be true
	 * once `setServerBaseUrl()` has been called with a value.
	 * Should be called by the webcomponent as early as possible.
	 */
	enableWebcomponentMode(): void {
		this._webcomponentMode.set(true);
	}

	/**
	 * Overrides the server base URL at runtime and enables webcomponent mode.
	 * Called by the webcomponent when the server URL is determined.
	 */
	setServerBaseUrl(url: string): void {
		this._webcomponentMode.set(true);
		this._serverBaseUrl.set(url.endsWith('/') ? url.slice(0, -1) : url);
	}

	/**
	 * Resolves an app-relative path to a URL that respects the deployment base path
	 * (e.g. `/meet`) and, when embedded as a webcomponent, the remote Meet server origin.
	 *
	 * - Fully-qualified URLs (http/https) are returned unchanged.
	 * - Webcomponent mode: prefixed with the server base URL, which already carries the
	 *   base path (derived from the room URL, e.g. `https://host/meet`).
	 * - SPA mode: prefixed with the configured base path. Without this, absolute inputs
	 *   like `/assets/...` bypass `<base href>` and 404 when Meet is mounted under a subpath.
	 *
	 * @example resolveUrl('/assets/sounds/x.mp3') // SPA at /meet → '/meet/assets/sounds/x.mp3'
	 * @example resolveUrl('assets/sounds/x.mp3')  // WC → 'https://host/meet/assets/sounds/x.mp3'
	 */
	resolveUrl(path: string): string {
		if (path.startsWith('http://') || path.startsWith('https://')) {
			return path;
		}

		// In webcomponent mode the server base URL already includes the deployment base path;
		// in SPA mode it is empty, so fall back to the configured base path.
		const prefix = this.serverBaseUrl() || this.normalizedBasePath();
		const cleanPath = path.startsWith('/') ? path : `/${path}`;

		// Idempotent: leave the path untouched when it already carries the prefix, so
		// resolving an already-resolved path does not duplicate it (e.g. '/meet/meet/...').
		if (!prefix || cleanPath === prefix || cleanPath.startsWith(`${prefix}/`)) {
			return cleanPath;
		}

		return `${prefix}${cleanPath}`;
	}

	/**
	 * Removes the configured deployment base path prefix from an internal URL path.
	 * Inverse of the SPA-mode prefixing done by {@link resolveUrl}; used before
	 * handing a URL to the Angular router, which operates relative to `<base href>`.
	 *
	 * @param url - The internal URL path to strip the base path from
	 * @return The URL with the base path stripped, if a base path is configured; otherwise, the original URL
	 */
	stripBasePath(url: string): string {
		const basePathPrefix = this.normalizedBasePath();
		if (!basePathPrefix || !url.startsWith(basePathPrefix)) {
			return url;
		}

		return url.slice(basePathPrefix.length) || '/';
	}

	/** Configured deployment base path without a trailing slash; '' when mounted at root ('/'). */
	private normalizedBasePath(): string {
		if (!this._deploymentBasePath || this._deploymentBasePath === '/') {
			return '';
		}

		return this._deploymentBasePath.endsWith('/')
			? this._deploymentBasePath.slice(0, -1)
			: this._deploymentBasePath;
	}

	/**
	 * Detects whether the document is running inside an iframe. A cross-origin parent
	 * makes `window.top` access throw a `SecurityError`, which itself confirms embedding.
	 */
	private detectInIframe(): boolean {
		try {
			return window.self !== window.top;
		} catch {
			return true;
		}
	}

	private readBaseHrefFromDocument(): string | null {
		try {
			const baseElement = document.querySelector('base');
			if (baseElement) {
				return baseElement.getAttribute('href') || null;
			}
		} catch (e) {
			console.warn('Could not read base element:', e);
		}
		return null;
	}
}

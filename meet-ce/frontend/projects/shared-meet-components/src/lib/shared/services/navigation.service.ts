import { inject, Injectable } from '@angular/core';
import { NavigationStart, Params, Router, UrlTree } from '@angular/router';
import { LeftEventReason } from '@openvidu-meet/typings';
import { NavigationErrorReason } from '../models/navigation.model';
import { LeaveRedirectService } from './leave-redirect.service';
import { ListStateCacheService } from './list-state-cache.service';
import { RuntimeConfigService } from './runtime-config.service';

@Injectable({
	providedIn: 'root'
})
export class NavigationService {
	private readonly router = inject(Router);
	private readonly runtimeConfigService = inject(RuntimeConfigService);
	private readonly listStateCacheService = inject(ListStateCacheService);
	private readonly leaveRedirect = inject(LeaveRedirectService);

	/** Trigger of the most recently started navigation (tracked from NavigationStart). */
	private lastNavigationTrigger: 'imperative' | 'popstate' | 'hashchange' = 'imperative';

	constructor() {
		// getCurrentNavigation() is null by the time a lazy component's ngOnInit runs,
		// so capture the trigger when each navigation starts instead.
		this.router.events.subscribe((event) => {
			if (event instanceof NavigationStart) {
				this.lastNavigationTrigger = event.navigationTrigger ?? 'imperative';
			}
		});
	}

	/**
	 * Redirects the user to the leave redirect URL if set and valid.
	 */
	async redirectToLeaveUrl() {
		const url = this.leaveRedirect.getLeaveRedirectURL();
		if (!url) {
			console.warn('No leave redirect URL set');
			return;
		}

		const isExternalURL = /^https?:\/\//.test(url);
		if (!isExternalURL) {
			console.error('Leave redirect URL is not a valid external URL:', url);
			return;
		}

		this.redirectWindow(url);
	}

	/**
	 * Navigate to `url`. `window.top` is the host window when embedded in an iframe — so the
	 * whole page redirects, not just the iframe — and is `window` itself in the SPA,
	 * so a single assignment covers every mode (no iframe check needed). Falls
	 * back to the current window if a sandboxed iframe blocks top-level navigation.
	 */
	private redirectWindow(url: string): void {
		try {
			(window.top ?? window).location.href = url;
		} catch (error) {
			console.warn('Could not navigate the top window; redirecting within the iframe instead:', error);
			window.location.href = url;
		}
	}

	/**
	 * Navigates to a specific route
	 *
	 * @param route - The route to navigate to
	 * @param queryParams - Optional query parameters to include in the navigation
	 * @param replaceUrl - If true, replaces the current URL in the browser history
	 */
	async navigateTo(route: string, queryParams?: Params, replaceUrl: boolean = false): Promise<void> {
		try {
			route = this.normalizePortalPath(route);
			await this.router.navigate([route], {
				queryParams,
				replaceUrl
			});
		} catch (error) {
			console.error('Error navigating to route:', error);
		}
	}

	/**
	 * Opens an internal app path in a new browser tab.
	 *
	 * @param path - The internal app path to open
	 * @param _secret - Unused in SPA mode (kept for API compatibility)
	 * @param features - Optional `window.open` features string (e.g. `noopener,noreferrer`)
	 */
	openInNewTab(path: string, _secret?: string, features?: string): void {
		const url = this.runtimeConfigService.resolveUrl(this.normalizePortalPath(path));
		window.open(url, '_blank', features);
	}

	/**
	 * Invalidates a cached reusable route so it reloads fresh on next attach, then
	 * navigates to a route. Used after mutations (create/edit/delete) performed from
	 * a detail or wizard page so the affected list reflects the change on return.
	 *
	 * @param route - The route to navigate to
	 * @param pathToInvalidate - The cached route key to invalidate (e.g. 'rooms', 'rooms/<roomId>')
	 * @param queryParams - Optional query parameters to include in the navigation
	 * @param replaceUrl - If true, replaces the current URL in the browser history
	 */
	async navigateToAndInvalidate(
		route: string,
		pathToInvalidate: string,
		queryParams?: Params,
		replaceUrl: boolean = false
	): Promise<void> {
		this.listStateCacheService.invalidate(pathToInvalidate);
		await this.navigateTo(route, queryParams, replaceUrl);
	}

	/**
	 * Invalidates a cached reusable route (and any routes nested under it) so it
	 * reloads fresh on next attach. Use when a mutation succeeds but navigation does
	 * not go straight to the affected list (e.g. redirecting into a meeting).
	 *
	 * @param path - The cached route key to invalidate (e.g. 'rooms', 'rooms/<roomId>')
	 */
	invalidateCachedRoute(path: string): void {
		this.listStateCacheService.invalidate(path);
	}

	/**
	 * Clears all cached reusable route instances. Call on logout so a different user
	 * never sees the previous user's cached lists and detached components are destroyed.
	 */
	clearCachedRoutes(): void {
		this.listStateCacheService.clearAll();
	}

	/**
	 * Whether the in-progress navigation was triggered by the browser back/forward
	 * gesture (popstate) rather than an explicit in-app navigation (clicking a link,
	 * menu item or row). Used so list pages restore their cached state only when the
	 * user navigates *back* to them, and load fresh data when they navigate *to* them.
	 *
	 * Read it synchronously at the start of a component's `ngOnInit` (before any
	 * `await`), so a later navigation cannot overwrite the value first.
	 */
	isPopStateNavigation(): boolean {
		return this.lastNavigationTrigger === 'popstate';
	}

	/**
	 * Redirects to internal URL
	 *
	 * @param url - The URL to redirect to
	 * @param replaceUrl - If true, replaces the current URL in the browser history
	 */
	async redirectTo(url: string, replaceUrl: boolean = true): Promise<void> {
		try {
			// Strip basePath prefix if present, since Angular router operates relative to <base href>
			url = this.runtimeConfigService.stripBasePath(url);
			url = this.normalizePortalPath(url || '/app');

			const urlTree = this.router.parseUrl(url);
			await this.router.navigateByUrl(urlTree, { replaceUrl });
		} catch (error) {
			console.error('Error navigating to internal route:', error);
		}
	}

	/**
	 * Creates a URL tree for redirecting to a specific route
	 *
	 * @param route - The route to navigate to
	 * @param queryParams - Optional query parameters to include in the URL
	 * @returns A UrlTree representing the redirection
	 */
	createRedirectionTo(route: string, queryParams?: Params): UrlTree {
		return this.router.createUrlTree([this.normalizePortalPath(route)], { queryParams });
	}

	/**
	 * Converts the original single-console paths into their owning portal. Keeping
	 * this compatibility boundary in one place lets existing domain components
	 * remain reusable without leaking `/app` and `/admin` decisions into services.
	 */
	private normalizePortalPath(path: string): string {
		if (!path) return path;

		const mappings: Array<[RegExp, string]> = [
			[/^\/rooms(?=\/|\?|#|$)/, '/app/rooms'],
			[/^\/profile(?=\/|\?|#|$)/, '/app/profile'],
			[/^\/users(?=\/|\?|#|$)/, '/admin/users']
		];

		for (const [pattern, replacement] of mappings) {
			if (pattern.test(path)) return path.replace(pattern, replacement);
		}

		return path;
	}

	/**
	 * Creates a UrlTree for the error page with specific reason and optionally navigates to it.
	 *
	 * @param reason - The error reason to include as a query parameter
	 * @param navigate - If true, navigates to the generated UrlTree
	 * @returns The UrlTree for the error page
	 */
	async redirectToErrorPage(reason: NavigationErrorReason, navigate = false): Promise<UrlTree> {
		const urlTree = this.createRedirectionTo('/error', { reason });

		if (navigate) {
			try {
				await this.router.navigateByUrl(urlTree);
			} catch (error) {
				console.error('Error redirecting to error page:', error);
			}
		}

		return urlTree;
	}

	/**
	 * Creates a UrlTree for the login page with a `redirectTo` query parameter and optionally navigates to it.
	 *
	 * @param redirectTo - The URL to redirect to after login
	 * @param navigate - If true, navigates to the generated UrlTree
	 * @returns The UrlTree for the login page
	 */
	async redirectToLoginPage(redirectTo?: string, navigate = false): Promise<UrlTree> {
		return this.redirectToAuthPage('/login', redirectTo, navigate);
	}

	/**
	 * Creates a UrlTree for the mandatory password change page with a `redirectTo`
	 * query parameter and optionally navigates to it.
	 *
	 * @param redirectTo - The URL to redirect to after the password change
	 * @param navigate - If true, navigates to the generated UrlTree
	 * @returns The UrlTree for the change-password page
	 */
	async redirectToChangePasswordPage(redirectTo?: string, navigate = false): Promise<UrlTree> {
		return this.redirectToAuthPage('/change-password-required', redirectTo, navigate);
	}

	/**
	 * Removes a specific query parameter from the URL
	 *
	 * @param queryParams - The current query parameters
	 * @param param - The parameter to remove
	 */
	async removeQueryParamFromUrl(queryParams: Params, param: string): Promise<void> {
		await this.removeQueryParamsFromUrl(queryParams, [param]);
	}

	/**
	 * Removes multiple query parameters from the URL in a single navigation operation.
	 * This is more efficient than removing params one by one, as it only triggers one navigation.
	 *
	 * @param queryParams - The current query parameters
	 * @param params - Array of parameter names to remove
	 */
	async removeQueryParamsFromUrl(queryParams: Params, params: string[]): Promise<void> {
		if (!params || params.length === 0) {
			return;
		}

		const updatedParams = { ...queryParams };
		params.forEach((param) => {
			delete updatedParams[param];
		});

		await this.router.navigate([], {
			queryParams: updatedParams,
			replaceUrl: true,
			queryParamsHandling: 'replace'
		});
	}

	/**
	 * Back-navigation from the meeting lobby / disconnected / error screens.
	 *
	 * @param fallbackRoute SPA route when no leave-redirect URL is set. Defaults to the user workspace.
	 * @param replaceUrl Replace the current history entry when navigating to it.
	 */
	async goBackFromMeeting(fallbackRoute = '/app/rooms', replaceUrl = false): Promise<void> {
		await this.closeOrLeave(fallbackRoute, replaceUrl);
	}

	/**
	 * Transition to the post-leave view: navigate to the in-app `/disconnected` screen.
	 */
	async goToDisconnected(reason: LeftEventReason): Promise<void> {
		await this.navigateTo('/disconnected', { reason }, true);
	}

	/**
	 * End the current flow. Embedded iframe setups redirect when a leave-redirect URL
	 * is configured; otherwise the SPA navigates to `fallbackRoute` if given.
	 */
	private async closeOrLeave(fallbackRoute?: string, replaceUrl = false): Promise<void> {
		const leaveRedirectUrl = this.leaveRedirect.getLeaveRedirectURL();
		if (leaveRedirectUrl) {
			await this.redirectToLeaveUrl();
			return;
		}

		if (fallbackRoute) {
			await this.navigateTo(fallbackRoute, undefined, replaceUrl);
		}
	}

	/**
	 * Shared implementation for the auth pages (`/login`, `/change-password-required`).
	 *
	 * These are router routes carrying an optional `redirectTo` query param.
	 *
	 * @param route - The SPA route for the page
	 * @param redirectTo - The URL to redirect to after the auth step completes
	 * @param navigate - If true, navigates to the generated UrlTree
	 * @returns The UrlTree for the page (consumed by SPA route guards)
	 */
	private async redirectToAuthPage(route: string, redirectTo?: string, navigate = false): Promise<UrlTree> {
		const queryParams = redirectTo ? { redirectTo } : undefined;
		const urlTree = this.createRedirectionTo(route, queryParams);

		if (navigate) {
			try {
				await this.router.navigateByUrl(urlTree);
			} catch (error) {
				console.error(`Error redirecting to ${route}:`, error);
			}
		}

		return urlTree;
	}
}

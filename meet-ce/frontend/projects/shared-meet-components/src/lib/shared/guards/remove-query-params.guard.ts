import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, NavigationEnd, Router } from '@angular/router';
import { filter, take } from 'rxjs';
import { NavigationService } from '../services';

/**
 * Guard that removes specified query parameters from the URL after the navigation completes.
 *
 * @param params - Array of query parameter names to remove from the URL
 * @returns A guard function that schedules removal of the specified query parameters after navigation
 *
 */
export const removeQueryParamsGuard = (params: string[]): CanActivateFn => {
	return (route: ActivatedRouteSnapshot) => {
		const router = inject(Router);
		const navigationService = inject(NavigationService);

		// Only proceed if there are params to remove
		if (!params || params.length === 0) {
			return true;
		}

		// Check if any of the specified params exist in the current query params
		const hasParamsToRemove = params.some((param) => route.queryParams[param] !== undefined);

		if (!hasParamsToRemove) {
			// No params to remove, continue navigation immediately
			return true;
		}

		// Schedule param removal AFTER navigation completes
		// This prevents conflicts with the ongoing navigation
		router.events
			.pipe(
				filter((event) => event instanceof NavigationEnd),
				take(1)
			)
			.subscribe(async () => {
				try {
					await navigationService.removeQueryParamsFromUrl(route.queryParams, params);
				} catch (error) {
					console.error('Error removing query params:', error);
				}
			});

		// Allow the current navigation to proceed
		return true;
	};
};

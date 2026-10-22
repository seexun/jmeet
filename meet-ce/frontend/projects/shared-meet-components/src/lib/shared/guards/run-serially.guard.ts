import { EnvironmentInjector, inject, runInInjectionContext } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, GuardResult, RouterStateSnapshot } from '@angular/router';
import { isObservable, lastValueFrom } from 'rxjs';

/**
 * This guard is used to run multiple guards serially.
 *
 * @param guards List of guards to run serially.
 * @returns A guard that runs the provided guards serially.
 */
export const runGuardsSerially = (...guards: CanActivateFn[]): CanActivateFn => {
	return async (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
		const injector = inject(EnvironmentInjector);

		for (const guard of guards) {
			const result = runInInjectionContext(injector, () => guard(route, state));
			let resolvedResult: GuardResult;

			if (result instanceof Promise) {
				resolvedResult = await result;
			} else if (isObservable(result)) {
				resolvedResult = await lastValueFrom(result);
			} else {
				resolvedResult = result;
			}

			if (typeof resolvedResult === 'boolean' && !resolvedResult) {
				return false;
			} else if (typeof resolvedResult !== 'boolean') {
				return resolvedResult;
			}
		}

		return true;
	};
};

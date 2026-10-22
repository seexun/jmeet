import { DomainRouteConfig } from '../../../shared/models/domain-routes.model';
import {
	checkPasswordChangeRequiredGuard,
	checkUserAuthenticatedGuard,
	checkUserNotAuthenticatedGuard
} from '../guards/auth.guard';

/**
 * Auth domain route configurations
 */
export const authDomainRoutes: DomainRouteConfig[] = [
	{
		route: {
			path: 'login',
			loadComponent: () => import('../pages/login/login.component').then((m) => m.LoginComponent),
			canActivate: [checkUserNotAuthenticatedGuard]
		}
	},
	{
		route: {
			path: 'change-password-required',
			loadComponent: () =>
				import('../pages/change-password-required/change-password-required.component').then(
					(m) => m.ChangePasswordRequiredComponent
				),
			canActivate: [checkUserAuthenticatedGuard, checkPasswordChangeRequiredGuard]
		}
	}
];

import { Routes } from '@angular/router';
import { authDomainRoutes } from '../../domains/auth/routes/auth.routes';
import { consoleDomainRoutes } from '../../domains/console/routes/console.routes';
import { meetingDomainRoutes } from '../../domains/meeting/routes/meeting.routes';
import { roomsDomainRoutes } from '../../domains/rooms/routes/rooms.routes';
import { usersDomainRoutes } from '../../domains/users/routes/users.routes';

export const baseRoutes: Routes = [
	// Auth domain routes
	...authDomainRoutes.map((config) => config.route),

	// Meeting domain routes
	...meetingDomainRoutes.map((config) => config.route),

	// Rooms domain public routes
	...roomsDomainRoutes.map((config) => config.route),

	// Users domain public routes
	...usersDomainRoutes.map((config) => config.route),

	// Shared error page (reachable at `/error` from any domain). Must precede the console
	// routes below, whose empty-path shell would otherwise greedily match and redirect away.
	{
		path: 'error',
		loadComponent: () => import('../components/error/error.component').then((m) => m.ErrorComponent)
	},
	{
		path: 'forbidden',
		loadComponent: () =>
			import('../components/forbidden/forbidden.component').then((m) => m.ForbiddenComponent)
	},

	// Console domain routes (includes console child routes)
	...consoleDomainRoutes,

	// Redirect all other routes to the workspace. A deterministic concrete target avoids the
	// old `redirectTo: ''` chain, whose role-dependent guards could end on a blank page.
	{ path: '**', redirectTo: 'app/rooms' }
];

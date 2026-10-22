import { Route } from '@angular/router';
import { MeetUserRole } from '@openvidu-meet/typings';
import { DomainRouteConfig } from '../../../shared/models/domain-routes.model';
import {
	checkPasswordChangeNotRequiredGuard,
	checkRoleGuard,
	checkRoleMatchGuard,
	checkUserAuthenticatedGuard
} from '../../auth/guards/auth.guard';
import { roomMembersConsoleRoutes } from '../../room-members/routes/room-members.routes';
import { roomsConsoleRoutes } from '../../rooms/routes/rooms.routes';
import { usersConsoleRoutes } from '../../users/routes/users.routes';
import { clearMeetingContextGuard } from '../guards/clear-room-session.guard';

/**
 * @deprecated Kept for consumers of the original shared ConsoleComponent.
 * New application code should use the dedicated `/app` and `/admin` shells.
 */
export const consoleChildRoutes: DomainRouteConfig[] = [
	...roomsConsoleRoutes,
	...roomMembersConsoleRoutes,
	...usersConsoleRoutes
];

const authenticatedShellGuards = [
	checkUserAuthenticatedGuard,
	checkPasswordChangeNotRequiredGuard,
	clearMeetingContextGuard
];

const workspaceChildren: Route[] = [
	{ path: '', redirectTo: 'rooms', pathMatch: 'full' },
	...roomsConsoleRoutes.map((config) => config.route),
	...roomMembersConsoleRoutes.map((config) => config.route),
	...usersConsoleRoutes.filter((config) => config.route.path === 'profile').map((config) => config.route),
	{ path: '**', redirectTo: 'rooms' }
];

const adminChildren: Route[] = [
	{ path: '', redirectTo: 'users', pathMatch: 'full' },
	...usersConsoleRoutes.filter((config) => config.route.path !== 'profile').map((config) => config.route),
	{ path: '**', redirectTo: 'users' }
];

/**
 * Authenticated application entry points. The workspace and administration
 * console deliberately use separate shells while continuing to share domain
 * components and backend services.
 */
export const consoleDomainRoutes: Route[] = [
	{
		path: 'app',
		loadComponent: () =>
			import('../pages/workspace-shell/workspace-shell.component').then((m) => m.WorkspaceShellComponent),
		canActivate: authenticatedShellGuards,
		children: workspaceChildren
	},
	{
		path: 'admin',
		canMatch: [checkRoleMatchGuard([MeetUserRole.ADMIN])],
		loadComponent: () => import('../pages/admin-shell/admin-shell.component').then((m) => m.AdminShellComponent),
		canActivate: [...authenticatedShellGuards, checkRoleGuard([MeetUserRole.ADMIN])],
		children: adminChildren
	},

	// Compatibility redirects for bookmarks and the existing domain components.
	{ path: '', redirectTo: 'app', pathMatch: 'full' },
	{ path: 'users', redirectTo: 'admin/users', pathMatch: 'full' },
	{ path: 'users/new', redirectTo: 'admin/users/new', pathMatch: 'full' },
	{ path: 'users/:user-id', redirectTo: 'admin/users/:user-id', pathMatch: 'full' },
	{ path: 'profile', redirectTo: 'app/profile', pathMatch: 'full' },
	{ path: 'rooms', redirectTo: 'app/rooms', pathMatch: 'full' },
	{ path: 'rooms/new', redirectTo: 'app/rooms/new', pathMatch: 'full' },
	{ path: 'rooms/:room-id/edit', redirectTo: 'app/rooms/:room-id/edit', pathMatch: 'full' },
	{ path: 'rooms/:room-id/members/new', redirectTo: 'app/rooms/:room-id/members/new', pathMatch: 'full' },
	{
		path: 'rooms/:room-id/members/:member-id/edit',
		redirectTo: 'app/rooms/:room-id/members/:member-id/edit',
		pathMatch: 'full'
	},
	{ path: 'rooms/:room-id', redirectTo: 'app/rooms/:room-id', pathMatch: 'full' }
];

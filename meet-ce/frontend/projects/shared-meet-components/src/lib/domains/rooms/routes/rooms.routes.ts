import { MeetUserRole } from '@openvidu-meet/typings';
import { runGuardsSerially } from '../../../shared/guards/run-serially.guard';
import { DomainRouteConfig } from '../../../shared/models/domain-routes.model';
import { checkRoleGuard } from '../../auth/guards/auth.guard';
import { checkRoomAccessGuard, checkRoomManageGuard } from '../guards/room-access.guard';
import { checkEditableRoomGuard } from '../guards/room-edit-check.guard';

/**
 * Rooms domain route configurations
 */
export const roomsDomainRoutes: DomainRouteConfig[] = [];

/**
 * Console child routes for rooms domain
 */
export const roomsConsoleRoutes: DomainRouteConfig[] = [
	{
		route: {
			path: 'rooms',
			loadComponent: () => import('../pages/rooms/rooms.component').then((m) => m.RoomsComponent)
		},
		navMetadata: {
			label: 'NAV.ROOMS',
			route: 'rooms',
			icon: 'videocam',
			iconClass: 'ov-room-icon',
			order: 2,
			allowedRoles: [MeetUserRole.ADMIN, MeetUserRole.ROOM_MANAGER, MeetUserRole.ROOM_MEMBER]
		}
	},
	{
		route: {
			path: 'rooms/new',
			loadComponent: () =>
				import('../pages/room-wizard/room-wizard.component').then((m) => m.RoomWizardComponent),
			canActivate: [checkRoleGuard([MeetUserRole.ADMIN, MeetUserRole.ROOM_MANAGER])]
		}
	},
	{
		route: {
			path: 'rooms/:room-id/edit',
			loadComponent: () =>
				import('../pages/room-wizard/room-wizard.component').then((m) => m.RoomWizardComponent),
			canActivate: [
				runGuardsSerially(
					checkRoleGuard([MeetUserRole.ADMIN, MeetUserRole.ROOM_MANAGER]),
					checkRoomManageGuard,
					checkEditableRoomGuard
				)
			]
		}
	},
	{
		route: {
			path: 'rooms/:room-id',
			loadComponent: () =>
				import('../pages/room-detail/room-detail.component').then((m) => m.RoomDetailComponent),
			canActivate: [checkRoomAccessGuard]
		}
	}
];

import { MeetUserRole } from '@openvidu-meet/typings';
import { runGuardsSerially } from '../../../shared/guards/run-serially.guard';
import { DomainRouteConfig } from '../../../shared/models/domain-routes.model';
import { checkRoleGuard } from '../../auth/guards/auth.guard';
import { checkRoomManageGuard } from '../../rooms/guards/room-access.guard';

/**
 * Room Members domain route configurations
 */
export const roomMembersDomainRoutes: DomainRouteConfig[] = [];

/**
 * Console child routes for room members domain
 */
export const roomMembersConsoleRoutes: DomainRouteConfig[] = [
	{
		route: {
			path: 'rooms/:room-id/members/new',
			loadComponent: () =>
				import('../pages/add-room-member/add-room-member.component').then((m) => m.AddRoomMemberComponent),
			canActivate: [
				runGuardsSerially(checkRoleGuard([MeetUserRole.ADMIN, MeetUserRole.ROOM_MANAGER]), checkRoomManageGuard)
			]
		}
	},
	{
		route: {
			path: 'rooms/:room-id/members/:member-id/edit',
			loadComponent: () =>
				import('../pages/add-room-member/add-room-member.component').then((m) => m.AddRoomMemberComponent),
			canActivate: [
				runGuardsSerially(checkRoleGuard([MeetUserRole.ADMIN, MeetUserRole.ROOM_MANAGER]), checkRoomManageGuard)
			]
		}
	}
];

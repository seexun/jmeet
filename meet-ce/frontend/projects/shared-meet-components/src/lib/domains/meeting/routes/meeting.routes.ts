import { EmbeddedAttribute } from '@openvidu-meet/typings';
import { removeQueryParamsGuard } from '../../../shared/guards/remove-query-params.guard';
import { runGuardsSerially } from '../../../shared/guards/run-serially.guard';
import { DomainRouteConfig } from '../../../shared/models/domain-routes.model';
import { extractRoomMeetingParamsGuard } from '../guards/extract-room-meeting-params.guard';
import { validateRoomMeetingAccessGuard } from '../guards/validate-room-meeting-access.guard';

/**
 * Meeting domain route configurations
 */
export const meetingDomainRoutes: DomainRouteConfig[] = [
	{
		route: {
			path: 'room/:room-id',
			loadComponent: () => import('../pages/meeting/meeting.component').then((m) => m.MeetingComponent),
			canActivate: [
				runGuardsSerially(
					extractRoomMeetingParamsGuard,
					validateRoomMeetingAccessGuard,
					removeQueryParamsGuard(['secret', EmbeddedAttribute.E2EE_KEY])
				)
			]
		}
	},
	{
		route: {
			path: 'disconnected',
			loadComponent: () => import('../pages/end-meeting/end-meeting.component').then((m) => m.EndMeetingComponent)
		}
	}
];

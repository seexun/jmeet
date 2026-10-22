import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, RouterStateSnapshot } from '@angular/router';
import { NavigationService } from '../../../shared/services/navigation.service';
import { RoomAccessService } from '../../rooms/services/room-access.service';

/**
 * Guard to validate access to a meeting room by generating a room member token.
 */
export const validateRoomMeetingAccessGuard: CanActivateFn = async (
	_route: ActivatedRouteSnapshot,
	_state: RouterStateSnapshot
) => {
	const roomAccessService = inject(RoomAccessService);
	const navigationService = inject(NavigationService);

	const result = await roomAccessService.validateAccess();
	if (result.allowed) {
		return true;
	}

	return navigationService.redirectToErrorPage(result.reason!);
};

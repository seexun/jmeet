import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { MeetUserRole } from '@openvidu-meet/typings';
import { NavigationService } from '../../../shared/services/navigation.service';
import { AuthService } from '../../auth/services/auth.service';
import { RoomService } from '../services/room.service';

/**
 * Guard that checks the authenticated user can access a room.
 * Attempts to retrieve the room; if the request fails (e.g. 403/404), redirects to /rooms.
 */
export const checkRoomAccessGuard: CanActivateFn = async (route) => {
	const roomService = inject(RoomService);
	const navigationService = inject(NavigationService);

	const roomId = route.paramMap.get('room-id');
	if (!roomId) {
		return navigationService.createRedirectionTo('/rooms');
	}

	try {
		await roomService.getRoom(roomId, { fields: ['roomId'] });
		return true;
	} catch {
		return navigationService.createRedirectionTo('/rooms');
	}
};

/**
 * Guard that checks the authenticated user can manage a room (create/edit members, edit room config).
 * ADMIN users always pass. ROOM_MANAGER users pass only if they own the room.
 * Redirects to /rooms if the check fails.
 */
export const checkRoomManageGuard: CanActivateFn = async (route) => {
	const roomService = inject(RoomService);
	const authService = inject(AuthService);
	const navigationService = inject(NavigationService);

	const roomId = route.paramMap.get('room-id');
	if (!roomId) {
		return navigationService.createRedirectionTo('/rooms');
	}

	// If user is ADMIN, allow access without further checks
	const role = await authService.getUserRole();
	if (role === MeetUserRole.ADMIN) {
		return true;
	}

	// If user is not ROOM_MANAGER or ADMIN, deny access
	if (role !== MeetUserRole.ROOM_MANAGER) {
		return navigationService.createRedirectionTo('/rooms');
	}

	try {
		// For ROOM_MANAGER role, check if they are the owner of the room
		const userId = await authService.getUserId();
		const { owner } = await roomService.getRoom(roomId, { fields: ['owner'] });
		if (owner === userId) {
			return true;
		}

		return navigationService.createRedirectionTo('/rooms');
	} catch {
		return navigationService.createRedirectionTo('/rooms');
	}
};

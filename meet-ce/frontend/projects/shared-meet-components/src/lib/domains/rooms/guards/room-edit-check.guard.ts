import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { MeetRoomStatus } from '@openvidu-meet/typings';
import { RoomService } from '../services';
import { NavigationService } from '../../../shared/services/navigation.service';

/**
 * Guard that prevents editing a room when there's an active meeting.
 * Redirects to /rooms if the room has an active meeting.
 */
export const checkEditableRoomGuard: CanActivateFn = async (route) => {
	const roomService = inject(RoomService);
	const navigationService = inject(NavigationService);

	const roomId = route.paramMap.get('room-id');

	if (!roomId) {
		console.warn('No roomId provided in route params');
		navigationService.navigateTo('/rooms');
		return false;
	}

	try {
		const room = await roomService.getRoom(roomId, {
			fields: ['status']
		});

		if (room.status === MeetRoomStatus.ACTIVE_MEETING) {
			console.warn(`Cannot edit room ${roomId} - active meeting in progress`);
			navigationService.navigateTo('/rooms');
			return false;
		}

		return true;
	} catch (error) {
		console.error(`Error checking room status for ${roomId}:`, error);
		navigationService.navigateTo('/rooms');
		return false;
	}
};

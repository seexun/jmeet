import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { MeetingContextService } from '../../meeting/services/meeting-context.service';

/**
 * Guard that clears meeting-related data when entering console routes.
 * This ensures session storage data, and room member and meeting context are only removed when navigating to console,
 * not when leaving a meeting to go to other non-console pages (like disconnected, room recordings, etc.)
 */
export const clearMeetingContextGuard: CanActivateFn = () => {
	inject(MeetingContextService).clearMeetingContext();

	return true;
};

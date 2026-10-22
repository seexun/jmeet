import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn } from '@angular/router';
import { NavigationService } from '../../../shared/services/navigation.service';
import { extractParams } from '../../../shared/utils/url.utils';
import { MeetingEntryService } from '../services/meeting-entry.service';

/**
 * Adapter guard: extracts meeting params from the route and delegates the actual
 * context-seeding to {@link MeetingEntryService.prepare}. That same use case
 * is reused by non-router callers (the Angular Elements Web Component).
 */
export const extractRoomMeetingParamsGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
	const meetingEntry = inject(MeetingEntryService);
	const navigation = inject(NavigationService);

	const {
		roomId,
		secret,
		participantName,
		leaveRedirectUrl,
		showOnlyRecordings,
		showRecording,
		e2eeKey
	} = extractParams(route);

	const decision = meetingEntry.prepare({
		roomId,
		secret,
		leaveRedirectUrl,
		e2eeKey,
		participantName,
		showRecording,
		showOnlyRecordings: showOnlyRecordings === 'true'
	});

	if (decision.kind === 'redirect') {
		return navigation.createRedirectionTo(decision.to);
	}

	return true;
};

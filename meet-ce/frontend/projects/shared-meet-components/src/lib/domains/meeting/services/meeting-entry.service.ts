import { Injectable, inject } from '@angular/core';
import { NavigationErrorReason } from '../../../shared/models/navigation.model';
import { LeaveRedirectService } from '../../../shared/services/leave-redirect.service';
import { RoomMemberContextService } from '../../room-members/services/room-member-context.service';
import { RoomAccessService } from '../../rooms/services/room-access.service';
import { MeetingContextService } from './meeting-context.service';

/**
 * Route-agnostic parameters describing an attempt to enter a meeting room.
 *
 * Callers (SPA route guards, the Angular Elements Web Component, future
 * embeddings) are responsible for extracting these values from their own
 * input source — an `ActivatedRouteSnapshot`, custom element attributes,
 * session storage, etc. — and handing the resulting object to this service.
 */
export interface MeetingEntryParams {
	/** The room identifier. */
	roomId: string;
	/** Room access secret (typically from `?secret=` or an equivalent input). */
	secret?: string;
	/** Optional E2EE key. */
	e2eeKey?: string;
	/** Optional participant display name. */
	participantName?: string;
	/** Optional leave-redirect URL passed to {@link LeaveRedirectService}. */
	leaveRedirectUrl?: string;
	/** Request a redirect to `/recording/<id>` instead of the meeting. */
	showRecording?: string;
	/** Request a redirect to `/room/<id>/recordings` instead of the meeting. */
	showOnlyRecordings?: boolean;
}

/**
 * Verdict returned by {@link MeetingEntryService.prepare}: either continue
 * with entry, or short-circuit to a different route.
 */
export type MeetingEntryDecision = { kind: 'proceed' } | { kind: 'redirect'; to: string };

/**
 * Outcome of {@link MeetingEntryService.attempt}: the user can enter, must
 * be redirected, or was denied with a specific reason.
 */
export type MeetingEntryOutcome =
	| { kind: 'ready' }
	| { kind: 'redirect'; to: string }
	| { kind: 'error'; reason: NavigationErrorReason };

/**
 * Use-case service that gates entry to a meeting room: seeds the meeting and
 * room-member context from caller-supplied params, then (optionally) validates
 * room access by generating a preliminary room member token.
 *
 * Single source of truth shared by:
 * - {@link extractRoomMeetingParamsGuard} + {@link validateRoomMeetingAccessGuard} (SPA route guards)
 * - The Angular Elements Web Component (no router; seeds context from custom element inputs)
 */
@Injectable({ providedIn: 'root' })
export class MeetingEntryService {
	private readonly meetingContextService = inject(MeetingContextService);
	private readonly roomMemberContextService = inject(RoomMemberContextService);
	private readonly roomAccessService = inject(RoomAccessService);
	private readonly leaveRedirect = inject(LeaveRedirectService);

	/**
	 * Populates meeting/room-member context from the supplied params and returns
	 * the entry decision (proceed, or short-circuit redirect for
	 * {@link MeetingEntryParams.showRecording} / {@link MeetingEntryParams.showOnlyRecordings}).
	 * Performs no network I/O.
	 *
	 * The room secret, E2EE key and participant name fall back to previously-stored
	 * values when the caller didn't supply them. This fallback is identical in every
	 * mode (SPA/iframe route guard and Web Component), so it lives here in the use
	 * case rather than being duplicated in each adapter.
	 */
	prepare({
		leaveRedirectUrl,
		roomId,
		secret,
		showRecording,
		showOnlyRecordings,
		e2eeKey,
		participantName
	}: MeetingEntryParams): MeetingEntryDecision {
		this.leaveRedirect.handleLeaveRedirectUrl(leaveRedirectUrl);

		this.meetingContextService.setRoomId(roomId);
		// Prefer the caller-supplied secret (URL/input); otherwise restore the one
		// persisted on this origin. Keeping the fallback here means every adapter
		// (route guard, Web Component) shares it without re-implementing it.
		if (secret) {
			this.meetingContextService.setRoomSecret(secret, true);
		} else {
			this.meetingContextService.loadRoomSecretFromStorage();
		}

		if (showRecording) {
			return { kind: 'redirect', to: `/recording/${showRecording}` };
		}
		if (showOnlyRecordings) {
			return { kind: 'redirect', to: `/room/${roomId}/recordings` };
		}

		// Prefer the caller-supplied value (URL/input); otherwise restore the last one
		// stored on this origin so the lobby pre-fills it.
		if (e2eeKey) {
			this.meetingContextService.setE2eeKey(e2eeKey, true);
		} else {
			this.meetingContextService.loadE2eeKeyFromStorage();
		}

		if (participantName) {
			this.roomMemberContextService.setParticipantName(participantName, true);
		} else {
			this.roomMemberContextService.loadParticipantNameFromStorage();
		}

		return { kind: 'proceed' };
	}

	/**
	 * One-shot orchestrator equivalent to the SPA guard chain
	 * `extractRoomMeetingParamsGuard` → `validateRoomMeetingAccessGuard`:
	 * prepares the entry, then validates room access. Intended for non-router
	 * callers (Web Component embedding) that need a single awaitable call.
	 */
	async attempt(params: MeetingEntryParams): Promise<MeetingEntryOutcome> {
		const decision = this.prepare(params);
		if (decision.kind === 'redirect') {
			return decision;
		}

		const access = await this.roomAccessService.validateAccess();
		if (access.allowed) {
			return { kind: 'ready' };
		}
		return { kind: 'error', reason: access.reason ?? NavigationErrorReason.INTERNAL_ERROR };
	}
}

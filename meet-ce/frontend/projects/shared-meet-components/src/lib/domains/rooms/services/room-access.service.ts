import { Injectable, inject } from '@angular/core';
import { HTTP_HEADERS } from '../../../shared/constants/http-headers.constants';
import { NavigationErrorReason } from '../../../shared/models/navigation.model';
import { MeetingContextService } from '../../meeting/services/meeting-context.service';
import { RoomMemberContextService } from '../../room-members/services/room-member-context.service';

export interface RoomAccessValidationResult {
	allowed: boolean;
	reason?: NavigationErrorReason;
}

@Injectable({
	providedIn: 'root'
})
export class RoomAccessService {
	private readonly roomMemberContextService = inject(RoomMemberContextService);
	private readonly meetingContextService = inject(MeetingContextService);

	/**
	 * Validates access to the current room by attempting to generate a room member token.
	 *
	 * @param options Validation options:
	 * - requireRecordingsPermission: if true, also checks that the generated token has permission to retrieve recordings
	 * - skipAuthRecoveryOn401: if true, adds a header to skip auth recovery in case of a 401 response (useful when validating access for recording secrets)
	 * @returns An object indicating whether access is allowed and, if not, the reason for denial
	 */
	async validateAccess(options?: {
		requireRecordingsPermission?: boolean;
		skipAuthRecoveryOn401?: boolean;
	}): Promise<RoomAccessValidationResult> {
		const { requireRecordingsPermission = false, skipAuthRecoveryOn401 = false } = options || {};

		const roomId = this.meetingContextService.roomId();
		if (!roomId) {
			console.error('Cannot validate room access: room ID is undefined');
			return { allowed: false, reason: NavigationErrorReason.INVALID_ROOM };
		}

		const secret = this.meetingContextService.roomSecret();
		const headers = skipAuthRecoveryOn401 ? { [HTTP_HEADERS.SKIP_AUTH_RECOVERY]: 'true' } : undefined;

		try {
			await this.roomMemberContextService.generateToken(
				roomId,
				{
					secret,
					joinMeeting: false
				},
				undefined,
				headers
			);

			// If recordings permission is required, check it explicitly as token generation may succeed without it
			if (requireRecordingsPermission && !this.roomMemberContextService.hasPermission('canRetrieveRecordings')) {
				return { allowed: false, reason: NavigationErrorReason.FORBIDDEN_ROOM_RECORDINGS_ACCESS };
			}

			return { allowed: true };
		} catch (error: any) {
			console.error('Error generating room member token:', error);
			const message = error?.error?.message || error.message || 'Unknown error';

			switch (error.status) {
				case 400:
					return { allowed: false, reason: NavigationErrorReason.INVALID_ROOM_SECRET };
				case 403:
					if (message.includes('Anonymous access')) {
						return { allowed: false, reason: NavigationErrorReason.ANONYMOUS_ACCESS_DISABLED };
					}
					return { allowed: false, reason: NavigationErrorReason.FORBIDDEN_ROOM_ACCESS };
				case 404:
					if (message.includes('Room member')) {
						return { allowed: false, reason: NavigationErrorReason.INVALID_MEMBER };
					}
					return { allowed: false, reason: NavigationErrorReason.INVALID_ROOM };
				case 429:
					return { allowed: false, reason: NavigationErrorReason.TOO_MANY_REQUESTS };
				default:
					return { allowed: false, reason: NavigationErrorReason.INTERNAL_ERROR };
			}
		}
	}
}

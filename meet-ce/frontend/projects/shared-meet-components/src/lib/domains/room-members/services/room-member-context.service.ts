import { computed, inject, Injectable, signal } from '@angular/core';
import {
	MeetRoomMember,
	MeetRoomMemberPermissions,
	MeetRoomMemberTokenOptions,
	MeetRoomMemberUIBadge
} from '@openvidu-meet/typings';
import { NavigationErrorReason } from '../../../shared/models/navigation.model';
import { NavigationService } from '../../../shared/services/navigation.service';
import { decodeToken } from '../../../shared/utils/token.utils';
import { AuthService } from '../../auth/services/auth.service';
import { E2eeService, LoggerService } from '../../meeting/openvidu-components';
import { RoomMemberService } from './room-member.service';

@Injectable({
	providedIn: 'root'
})
export class RoomMemberContextService {
	protected roomMemberService = inject(RoomMemberService);
	protected navigationService = inject(NavigationService);
	protected authService = inject(AuthService);
	protected e2eeService = inject(E2eeService);
	protected loggerService = inject(LoggerService);
	protected log = this.loggerService.get('JMeet - RoomMemberContextService');

	protected readonly PARTICIPANT_NAME_KEY = 'ovMeet-participantName';

	protected readonly TOKEN_REFRESH_BUFFER_MS = 60 * 1000;
	protected readonly TOKEN_REFRESH_MIN_DELAY_MS = 5 * 1000;
	protected readonly TOKEN_REFRESH_JITTER_MS = 10 * 1000;
	private tokenRefreshTimeoutId?: ReturnType<typeof setTimeout>;

	/**
	 * Individual signals for room member context
	 */
	private readonly _roomMemberToken = signal<string | undefined>(undefined);
	private readonly _roomId = signal<string | undefined>(undefined);
	private readonly _participantName = signal<string | undefined>(undefined);
	private readonly _isParticipantNameFromUrl = signal<boolean>(false);
	private readonly _memberBadge = signal<MeetRoomMemberUIBadge>(MeetRoomMemberUIBadge.OTHER);
	private readonly _permissions = signal<MeetRoomMemberPermissions | undefined>(undefined);
	private readonly _member = signal<MeetRoomMember | undefined>(undefined);

	/** Readonly signal for the room member token */
	readonly roomMemberToken = this._roomMemberToken.asReadonly();
	/** Readonly signal for the room identifier embedded in the token */
	readonly roomId = this._roomId.asReadonly();
	/** Readonly signal for the participant name */
	readonly participantName = this._participantName.asReadonly();
	/** Readonly signal for whether the participant name came from a URL parameter */
	readonly isParticipantNameFromUrl = this._isParticipantNameFromUrl.asReadonly();
	/** Readonly signal for the room member permissions */
	readonly permissions = this._permissions.asReadonly();
	/** Readonly signal for the room member info (when memberId is set) */
	readonly member = this._member.asReadonly();
	/** Computed signal for the room member's display name */
	readonly memberName = computed(() => this._member()?.name);
	/** Readonly signal for the room member's UI badge */
	readonly memberBadge = this._memberBadge.asReadonly();

	/**
	 * Sets the participant's display name.
	 *
	 * @param participantName - The display name of the participant
	 * @param fromUrl - Whether the name came from a URL parameter
	 */
	setParticipantName(participantName: string, fromUrl = false) {
		this._participantName.set(participantName);
		this._isParticipantNameFromUrl.set(fromUrl);
	}

	/**
	 * Saves the participant name to localStorage
	 *
	 * @param participantName - The display name of the participant to save
	 */
	saveParticipantNameToStorage(participantName: string) {
		localStorage.setItem(this.PARTICIPANT_NAME_KEY, participantName);
	}

	/**
	 * Loads the participant name from localStorage
	 */
	loadParticipantNameFromStorage() {
		const storedName = localStorage.getItem(this.PARTICIPANT_NAME_KEY);
		if (storedName) {
			this._participantName.set(storedName);
			this._isParticipantNameFromUrl.set(false);
		}
	}

	/**
	 * Checks if the current room member has a specific permission.
	 *
	 * @param permission - The permission to check
	 * @returns True if the member has the permission, false otherwise
	 */
	hasPermission(permission: keyof MeetRoomMemberPermissions): boolean {
		return this._permissions()?.[permission] ?? false;
	}

	/**
	 * Generates a room member token and updates the context with role and permissions.
	 *
	 * @param roomId - The unique identifier of the room
	 * @param tokenOptions - The options for the token generation
	 * @param e2eeKey - Optional E2EE encryption key
	 * @param headers - Optional additional headers to include in the token generation request
	 * @return A promise that resolves to the room member token
	 */
	async generateToken(
		roomId: string,
		tokenOptions: MeetRoomMemberTokenOptions,
		e2eeKey?: string,
		headers?: Record<string, string>
	): Promise<string> {
		// Best effort: keep access token fresh for authenticated users before generating room member tokens.
		const isAuthenticated = await this.authService.isUserAuthenticated();
		if (isAuthenticated) {
			try {
				await this.authService.refreshToken();
			} catch {
				// Ignore refresh failures here. Generation can still succeed for anonymous/secret-based flows.
			}
		}

		if (tokenOptions.participantName && e2eeKey) {
			// Assign E2EE key and encrypt participant name
			await this.e2eeService.setE2EEKey(e2eeKey);
			const encryptedName = await this.e2eeService.encrypt(tokenOptions.participantName);
			tokenOptions.participantName = encryptedName;
		}

		const { token } = await this.roomMemberService.generateRoomMemberToken(roomId, tokenOptions, headers);
		this._roomMemberToken.set(token);
		await this.updateContextFromToken(token);
		return token;
	}

	/**
	 * Refreshes the current room member token for a participant already inside a meeting
	 * and updates the context with new role and permissions.
	 *
	 * @param roomId - The unique identifier of the room
	 * @return A promise that resolves to the refreshed room member token
	 */
	async refreshToken(roomId: string): Promise<string> {
		const previousToken = this._roomMemberToken();

		if (!previousToken) {
			throw new Error('Cannot refresh room member token: previous token not found');
		}

		const { token } = await this.roomMemberService.refreshRoomMemberToken(roomId);
		this._roomMemberToken.set(token);
		await this.updateContextFromToken(token);
		return token;
	}

	/**
	 * Updates the room member context based on the provided token.
	 *
	 * @param token - The room member token
	 * @throws Error if the token is invalid or expired.
	 */
	protected async updateContextFromToken(token: string): Promise<void> {
		try {
			const decodedToken = decodeToken(token);
			const tokenMetadata = decodedToken.metadata;

			// Schedule automatic token refresh if token contains sub (participant identity) claim,
			// i.e. it's a token for a participant already inside the meeting, not a pre-join token without sub claim
			if (decodedToken.sub && decodedToken.exp) {
				const expirationMs = decodedToken.exp * 1000;
				this.scheduleTokenRefresh(tokenMetadata.roomId, expirationMs);
			}

			this._roomId.set(tokenMetadata.roomId);
			this._permissions.set(tokenMetadata.permissions);
			this._memberBadge.set(tokenMetadata.badge);

			// If token contains memberId, fetch and store member info
			if (tokenMetadata.memberId) {
				try {
					const member = await this.roomMemberService.getRoomMember(
						tokenMetadata.roomId,
						tokenMetadata.memberId
					);
					this._member.set(member);
				} catch (error) {
					this.log.w('Could not fetch member info:', error);
				}
			}
		} catch (error) {
			this.log.e('Error decoding room member token:', error);
			throw new Error('Invalid room member token');
		}
	}

	/**
	 * Schedules an automatic token refresh before the token expires, with added jitter to avoid thundering herd issues.
	 *
	 * @param roomId - The unique identifier of the room
	 * @param expirationMs - The timestamp when the token expires
	 */
	private scheduleTokenRefresh(roomId: string, expirationMs: number): void {
		this.clearTokenRefreshTimeout();

		const jitterMs = Math.floor(Math.random() * this.TOKEN_REFRESH_JITTER_MS);
		const refreshAtMs = expirationMs - this.TOKEN_REFRESH_BUFFER_MS - jitterMs;
		const delayMs = Math.max(this.TOKEN_REFRESH_MIN_DELAY_MS, refreshAtMs - Date.now());

		this.tokenRefreshTimeoutId = setTimeout(async () => {
			try {
				await this.refreshToken(roomId);
			} catch (error) {
				this.log.e('Error refreshing room member token automatically:', error);
				await this.navigationService.redirectToErrorPage(NavigationErrorReason.ROOM_ACCESS_REVOKED, true);
			}
		}, delayMs);
	}

	/**
	 * Clears the scheduled token refresh timeout if it exists.
	 */
	private clearTokenRefreshTimeout(): void {
		if (this.tokenRefreshTimeoutId) {
			clearTimeout(this.tokenRefreshTimeoutId);
			this.tokenRefreshTimeoutId = undefined;
		}
	}

	/**
	 * Clears the room member context.
	 */
	clearContext(): void {
		this.clearTokenRefreshTimeout();
		this._roomMemberToken.set(undefined);
		this._roomId.set(undefined);
		this._participantName.set(undefined);
		this._isParticipantNameFromUrl.set(false);
		this._permissions.set(undefined);
		this._memberBadge.set(MeetRoomMemberUIBadge.OTHER);
		this._member.set(undefined);
	}
}

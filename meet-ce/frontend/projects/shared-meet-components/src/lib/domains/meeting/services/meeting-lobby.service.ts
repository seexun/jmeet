import { computed, inject, Injectable, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MeetRoom, MeetRoomMemberUIBadge, MeetRoomStatus } from '@openvidu-meet/typings';
import { NavigationErrorReason } from '../../../shared/models/navigation.model';
import { LeaveRedirectService } from '../../../shared/services/leave-redirect.service';
import { NavigationService } from '../../../shared/services/navigation.service';
import { RuntimeConfigService } from '../../../shared/services/runtime-config.service';
import { AuthService } from '../../auth/services/auth.service';
import { RoomMemberContextService } from '../../room-members/services/room-member-context.service';
import { RoomService } from '../../rooms/services/room.service';
import { LoggerService } from '../openvidu-components';
import { MeetingContextService } from './meeting-context.service';
import { MeetingService } from './meeting.service';
import { RoomAccessLinkService } from './room-access-link.service';

/**
 * Service that manages the meeting lobby phase state and operations.
 * This service is ONLY responsible for the LOBBY PHASE - the period before a participant joins the meeting.
 */
@Injectable()
export class MeetingLobbyService {
	protected roomService = inject(RoomService);
	protected accessLinkService = inject(RoomAccessLinkService);
	protected meetingContextService = inject(MeetingContextService);
	protected authService = inject(AuthService);
	protected roomMemberContextService = inject(RoomMemberContextService);
	protected navigationService = inject(NavigationService);
	protected leaveRedirect = inject(LeaveRedirectService);
	protected runtimeConfigService = inject(RuntimeConfigService);
	protected loggerService = inject(LoggerService);
	protected meetingService = inject(MeetingService);
	protected log = this.loggerService.get('JMeet - MeetingLobbyService');

	/**
	 * Individual signals for lobby state.
	 * This state is only relevant during the lobby phase - before a participant joins the meeting.
	 */
	private readonly _roomId = signal<string | undefined>(undefined);
	private readonly _room = signal<Partial<MeetRoom> | undefined>(undefined);
	private readonly _showBackButton = signal<boolean>(true);
	private readonly _backButtonText = signal<string>('Back');
	private readonly _roomMemberToken = signal<string | undefined>(undefined);
	private readonly _participantForm = signal<FormGroup>(
		new FormGroup({
			name: new FormControl('', [Validators.required]),
			e2eeKey: new FormControl('')
		})
	);

	/** Readonly signal for room name */
	readonly roomName = computed(() => this._room()?.roomName);
	readonly roomSchedule = computed(() => this._room()?.schedule);
	readonly scheduledJoinAllowed = computed(() => {
		if (this.roomMemberContextService.memberBadge() !== MeetRoomMemberUIBadge.OTHER) return true;
		const schedule = this.roomSchedule();
		if (!schedule) return true;
		return Date.now() >= schedule.startDate - schedule.allowEarlyJoinMinutes * 60_000;
	});
	/** Computed signal for whether the current user has permission to join the meeting */
	readonly canJoinMeeting = computed(
		() => this.meetingContextService.meetingUI().showJoinMeeting && this.scheduledJoinAllowed()
	);
	/** Readonly signal for whether the room is closed */
	readonly roomClosed = computed(() => this._room()?.status === MeetRoomStatus.CLOSED);
	/** Readonly signal for whether E2EE is enabled in the room */
	readonly hasRoomE2EEEnabled = computed(() => this._room()?.config?.e2ee?.enabled ?? false);
	/**
	 * Computed signal to determine if the E2EE key input should be shown.
	 * When E2EE key is provided via URL query param, the control is disabled and should not be displayed.
	 */
	readonly showE2EEKeyInput = computed(() => {
		const form = this._participantForm();
		const e2eeKeyControl = form.get('e2eeKey');
		return this.hasRoomE2EEEnabled() && e2eeKeyControl?.enabled;
	});

	/** Readonly signal for whether to show the back button */
	readonly showBackButton = this._showBackButton.asReadonly();
	/** Readonly signal for the back button text */
	readonly backButtonText = this._backButtonText.asReadonly();

	/**
	 * Computed signal to determine if the share link option should be shown.
	 * The share link is shown only if the room is not closed and the user has permissions to moderate the room
	 */
	readonly showShareLink = computed(() => {
		return (
			!this.roomClosed() &&
			!this.runtimeConfigService.isEmbeddedMode() &&
			!!this.accessLinkService.speakerPublicLink() &&
			this.meetingContextService.meetingUI().showShareAccessLinks
		);
	});
	/** Computed signal for room access URL derived from MeetingContextService */
	readonly roomAccessUrl = computed(() => this.accessLinkService.speakerPublicLink() ?? '');

	/** Readonly signal for the room member token */
	readonly roomMemberToken = this._roomMemberToken.asReadonly();

	/** Readonly signal for the participant form */
	readonly participantForm = this._participantForm.asReadonly();

	/**
	 * Computed signal to determine if the participant name input should be disabled
	 * Name is disabled when: from URL, member exists, or user is authenticated
	 */
	readonly isParticipantNameDisabled = computed(() => {
		const form = this._participantForm();
		const nameControl = form.get('name');
		return nameControl?.disabled ?? false;
	});

	/**
	 * Setter for participant name
	 */
	setParticipantName(name: string): void {
		this._participantForm().get('name')?.setValue(name);
	}

	/**
	 * Computed signal for participant name - optimized to avoid repeated form access
	 * Uses getRawValue() to get the value even when the control is disabled (e.g., when set from URL param or member/authenticated user)
	 */
	readonly participantName = computed(() => {
		const form = this._participantForm();
		const rawValue = form.getRawValue();
		if (form.invalid || !rawValue.name?.trim()) {
			return '';
		}
		return rawValue.name.trim();
	});

	/**
	 * Setter for E2EE key
	 */
	setE2eeKey(key: string): void {
		this._participantForm().get('e2eeKey')?.setValue(key);
	}

	/**
	 * Computed signal for E2EE key - optimized to avoid repeated form access
	 * Uses getRawValue() to get the value even when the control is disabled (e.g., when set from URL param)
	 */
	readonly e2eeKeyValue = computed(() => {
		const form = this._participantForm();
		const rawValue = form.getRawValue();
		if (form.invalid || !rawValue.e2eeKey?.trim()) {
			return '';
		}
		return rawValue.e2eeKey.trim();
	});

	/**
	 * Initializes the lobby state by fetching room data and configuring UI
	 */
	async initialize(): Promise<void> {
		try {
			const roomId = this.meetingContextService.roomId();
			if (!roomId) throw new Error('Room ID is not set in Meeting Context');

			this._roomId.set(roomId);

			// Non-critical tasks should not block lobby rendering.
			void this.setBackButtonText().catch((error) => {
				this.log.w('Error setting back button text:', error);
			});
			void this.initializeParticipantName().catch((error) => {
				this.log.w('Error initializing participant name:', error);
			});

			const room = await this.withTimeout(
				this.roomService.getRoom(roomId, {
					fields: ['roomId', 'roomName', 'status', 'config', 'schedule'],
					extraFields: ['config']
				}),
				12000,
				'Timeout loading room data'
			);
			this._room.set(room);

			if (this.hasRoomE2EEEnabled()) {
				// If E2EE is enabled, make the e2eeKey form control required
				const form = this._participantForm();
				form.get('e2eeKey')?.setValidators([Validators.required]);
				const contextE2eeKey = this.meetingContextService.e2eeKey();
				if (contextE2eeKey) {
					this.setE2eeKey(contextE2eeKey);
					// Disable input only if the E2EE key was originally provided via URL parameter
					if (this.meetingContextService.isE2eeKeyFromUrl()) {
						form.get('e2eeKey')?.disable();
					}
				}
				form.get('e2eeKey')?.updateValueAndValidity();
			}
		} catch (error) {
			this.clearLobbyState();
			throw error;
		}
	}

	private withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
		let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
		const timeoutPromise = new Promise<T>((_, reject) => {
			timeoutHandle = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
		});

		return Promise.race([promise, timeoutPromise]).finally(() => {
			if (timeoutHandle) {
				clearTimeout(timeoutHandle);
			}
		});
	}

	/**
	 * Copies the room access link to clipboard
	 *
	 * @returns Whether the link was copied successfully
	 */
	async copyRoomAccessLink(): Promise<boolean> {
		return this.accessLinkService.copyRoomAccessLink();
	}

	/**
	 * Back-button handler. Defers WC-vs-SPA branching to
	 * {@link NavigationService.goBackFromMeeting}.
	 */
	async goBack() {
		try {
			await this.navigationService.goBackFromMeeting();
		} catch (error) {
			this.log.e('Error handling back navigation:', error);
		}
	}

	async submitAccess(): Promise<void> {
		const name = this.participantName();
		if (!name) {
			this.log.e('Participant form is invalid. Cannot join meeting.');
			throw new Error('Participant form is invalid');
		}

		// For E2EE rooms, validate passkey and set it in MeetingContextService if not already set
		const hasRoomE2EEEnabled = this.hasRoomE2EEEnabled();
		if (hasRoomE2EEEnabled && !this.meetingContextService.isE2eeKeyFromUrl()) {
			const e2eeKey = this.e2eeKeyValue();
			if (!e2eeKey) {
				this.log.w('E2EE key is required for encrypted rooms.');
				return;
			}
			this.meetingContextService.setE2eeKey(e2eeKey);
		}

		await this.generateRoomMemberToken();
		await this.roomService.loadRoomConfig(this._roomId()!);
	}

	/**
	 * Sets the back button text based on the application mode and user authentication
	 */
	protected async setBackButtonText(): Promise<void> {
		const isStandaloneMode = !this.runtimeConfigService.isWebcomponentMode();
		const redirection = this.leaveRedirect.getLeaveRedirectURL();
		const isAuthenticated = await this.authService.isUserAuthenticated();

		// If in standalone mode without redirection and user is not authenticated,
		// hide back button (user has no where to go back to)
		if (isStandaloneMode && !redirection && !isAuthenticated) {
			this._showBackButton.set(false);
			return;
		}

		const backButtonText =
			isStandaloneMode && !redirection && isAuthenticated ? 'LOBBY.BACK_TO_ROOMS' : 'LOBBY.BACK';
		this._showBackButton.set(true);
		this._backButtonText.set(backButtonText);
	}

	/**
	 * Initializes the participant name in the form control.
	 *
	 * Priority order:
	 * 1. If room member exists - use their name and disable input
	 * 2. If user is authenticated - use their name and disable input
	 * 3. If participant name is from URL - use that and disable input
	 * 4. If participant name exists in context - use it and enable input
	 * 5. Otherwise leave input empty and enabled
	 *
	 * @returns A promise that resolves when the participant name has been initialized
	 */
	protected async initializeParticipantName(): Promise<void> {
		const form = this._participantForm();
		const nameControl = form.get('name');
		if (!nameControl) return;

		const memberName = this.roomMemberContextService.memberName();
		const userName = await this.authService.getUserName();
		const isNameFromUrl = this.roomMemberContextService.isParticipantNameFromUrl();
		const contextName = this.roomMemberContextService.participantName();

		// Get name by priority: member > authenticated user > URL param > stored context
		const name = memberName || userName || contextName;
		if (name) {
			this.setParticipantName(name);
		}

		// Disable input if name comes from: member, authenticated user or URL param
		const shouldDisable = !!(memberName || userName || (isNameFromUrl && contextName));
		if (shouldDisable) {
			nameControl.disable();
		}
	}

	/**
	 * Generates a room member token for joining a meeting.
	 *
	 * @returns Promise that resolves when token is generated
	 */
	protected async generateRoomMemberToken() {
		try {
			const roomId = this._roomId();
			const roomSecret = this.meetingContextService.roomSecret();
			const participantName = this.participantName();

			const roomMemberToken = await this.roomMemberContextService.generateToken(
				roomId!,
				{
					secret: roomSecret,
					joinMeeting: true,
					participantName
				},
				this.e2eeKeyValue()
			);

			// Save participant name to storage only if it was chosen freely by the user
			if (!this.isParticipantNameDisabled()) {
				this.roomMemberContextService.saveParticipantNameToStorage(participantName);
			}

			this._roomMemberToken.set(roomMemberToken);
			this.meetingContextService.setIsActiveMeeting(true);
		} catch (error: any) {
			this.log.e('Error generating room member token for joining meeting:', error);
			const message = error?.error?.message || error.message || 'Unknown error';
			switch (error.status) {
				case 400:
					// Invalid secret
					await this.navigationService.redirectToErrorPage(NavigationErrorReason.INVALID_ROOM_SECRET, true);
					break;
				case 403:
					// Insufficient permissions or anonymous access disabled
					if (message.includes('Anonymous access')) {
						await this.navigationService.redirectToErrorPage(
							NavigationErrorReason.ANONYMOUS_ACCESS_DISABLED,
							true
						);
					} else {
						await this.navigationService.redirectToErrorPage(
							NavigationErrorReason.FORBIDDEN_ROOM_ACCESS,
							true
						);
					}
					break;
				case 404:
					// Room or member not found
					if (message.includes('Room member')) {
						await this.navigationService.redirectToErrorPage(NavigationErrorReason.INVALID_MEMBER, true);
					} else {
						await this.navigationService.redirectToErrorPage(NavigationErrorReason.INVALID_ROOM, true);
					}
					break;
				case 409:
					// Room is closed
					await this.navigationService.redirectToErrorPage(NavigationErrorReason.CLOSED_ROOM, true);
					break;
				case 429:
					// Too many requests (rate limited)
					await this.navigationService.redirectToErrorPage(NavigationErrorReason.TOO_MANY_REQUESTS, true);
					break;
				default:
					await this.navigationService.redirectToErrorPage(NavigationErrorReason.INTERNAL_ERROR, true);
			}

			throw new Error('Error generating room member token');
		}
	}

	protected clearLobbyState() {
		this._room.set(undefined);
		this._roomId.set(undefined);
		this._showBackButton.set(true);
		this._backButtonText.set('LOBBY.BACK');
		this._roomMemberToken.set(undefined);
		this._participantForm.set(
			new FormGroup({
				name: new FormControl('', [Validators.required]),
				e2eeKey: new FormControl('')
			})
		);
	}
}

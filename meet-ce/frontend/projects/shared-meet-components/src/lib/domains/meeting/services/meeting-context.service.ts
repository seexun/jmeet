import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { GlobalConfigService } from '../../../shared/services/global-config.service';
import { SessionStorageService } from '../../../shared/services/session-storage.service';
import { RoomMemberContextService } from '../../room-members/services/room-member-context.service';
import { RoomFeatureService } from '../../rooms/services/room-feature.service';
import { CustomParticipantModel } from '../models';
import { ParticipantService, Room, ViewportService } from '../openvidu-components';
import { RoomAccessLinkService } from './room-access-link.service';

/**
 * Central service for managing meeting context and state during the MEETING PHASE.
 *
 * This service is the SINGLE SOURCE OF TRUTH for all meeting-related state once a participant has joined.
 */
@Injectable({
	providedIn: 'root'
})
export class MeetingContextService {
	private readonly ovParticipantService = inject(ParticipantService);
	private readonly roomFeatureService = inject(RoomFeatureService);
	private readonly globalConfigService = inject(GlobalConfigService);
	private readonly viewportService = inject(ViewportService);
	private readonly sessionStorageService = inject(SessionStorageService);
	private readonly roomAccessLinkService = inject(RoomAccessLinkService);
	private readonly roomMemberContextService = inject(RoomMemberContextService);

	private readonly _roomId = signal<string | undefined>(undefined);
	private readonly _roomSecret = signal<string | undefined>(undefined);
	private readonly _e2eeKey = signal<string>('');
	private readonly _isE2eeKeyFromUrl = signal<boolean>(false);
	private readonly _hasRecordings = signal<boolean>(false);
	private readonly _isActiveMeeting = signal<boolean>(false);
	private readonly _meetingEndedBy = signal<'self' | 'other' | null>(null);
	private readonly _lkRoom = signal<Room | undefined>(undefined);
	private readonly _localParticipant = signal<CustomParticipantModel | undefined>(undefined);
	private readonly _remoteParticipants = signal<CustomParticipantModel[]>([]);
	private readonly _primaryHostIdentity = signal<string | undefined>(undefined);
	private readonly _raisedHandIdentities = signal<ReadonlySet<string>>(new Set());
	private readonly _hostUnavailableEndsAt = signal<number | undefined>(undefined);
	private readonly _spotlightIdentity = signal<string | undefined>(undefined);

	/** Readonly signal for the current room ID */
	readonly roomId = this._roomId.asReadonly();

	/** Readonly signal for the room secret (if any) */
	readonly roomSecret = this._roomSecret.asReadonly();
	/** Readonly signal for the stored E2EE key (if any) */
	readonly e2eeKey = this._e2eeKey.asReadonly();
	/** Readonly signal for whether the E2EE key came from a URL parameter */
	readonly isE2eeKeyFromUrl = this._isE2eeKeyFromUrl.asReadonly();

	/** Readonly signal for whether the room has recordings */
	readonly hasRecordings = this._hasRecordings.asReadonly();
	/** Readonly signal for who ended the meeting ('self', 'other', or null) */
	readonly meetingEndedBy = this._meetingEndedBy.asReadonly();
	/** Readonly signal for whether the meeting is active */
	readonly isActiveMeeting = this._isActiveMeeting.asReadonly();

	/** Readonly signal for the current LiveKit room */
	readonly lkRoom = this._lkRoom.asReadonly();
	/** Readonly signal for the local participant */
	readonly localParticipant = this._localParticipant.asReadonly();
	/** Readonly signal for the remote participants */
	readonly remoteParticipants = this._remoteParticipants.asReadonly();
	readonly primaryHostIdentity = this._primaryHostIdentity.asReadonly();
	readonly isPrimaryHost = computed(
		() => Boolean(this._localParticipant()?.identity) && this._localParticipant()?.identity === this._primaryHostIdentity()
	);
	readonly raisedHandIdentities = this._raisedHandIdentities.asReadonly();
	readonly hostUnavailableEndsAt = this._hostUnavailableEndsAt.asReadonly();
	readonly isLocalHandRaised = computed(() => {
		const identity = this._localParticipant()?.identity;
		return Boolean(identity && this._raisedHandIdentities().has(identity));
	});
	/** 主持人设定的全局焦点参会者 identity（全员视角统一大图展示），未设定为 undefined */
	readonly spotlightIdentity = this._spotlightIdentity.asReadonly();
	/** Computed signal that combines local and remote participants */
	readonly allParticipants = computed(() => {
		const local = this._localParticipant();
		const remotes = this._remoteParticipants();
		return local ? [local, ...remotes] : remotes;
	});
	/** Computed signal for whether the local participant is alone (no remote participants yet) */
	readonly isAlone = computed(() => this._remoteParticipants().length === 0);

	/** Readonly signal for meeting features */
	readonly meetingUI = this.roomFeatureService.features;
	/** Readonly signal for room appearance configuration from global settings */
	readonly meetingAppearance = this.globalConfigService.roomAppearanceConfig;

	/** Readonly signal for whether the device is mobile */
	readonly isMobile = this.viewportService.isMobile;

	constructor() {
		// Setup automatic synchronization with ParticipantService signals
		this.setupParticipantSynchronization();
	}

	/**
	 * Sets the room ID in context
	 * @param roomId The room ID
	 */
	setRoomId(roomId: string): void {
		this._roomId.set(roomId);
	}

	/**
	 * Sets the room secret in context
	 * @param secret The room secret
	 * @param updateStorage Whether to persist in SessionStorage (default: false)
	 */
	setRoomSecret(secret: string, updateStorage = false): void {
		if (updateStorage) {
			this.sessionStorageService.setRoomSecret(secret);
		}

		this._roomSecret.set(secret);
	}

	/**
	 * Loads the room secret from session storage into context, if one was
	 * previously persisted (e.g. by an earlier URL visit carrying `?secret=`).
	 */
	loadRoomSecretFromStorage(): void {
		const secret = this.sessionStorageService.getRoomSecret();
		if (secret) {
			this._roomSecret.set(secret);
		}
	}

	/**
	 * Stores the E2EE key in context
	 * @param key The E2EE key
	 * @param fromUrl Whether the key came from a URL parameter (default: false)
	 */
	setE2eeKey(key: string, fromUrl = false): void {
		this.sessionStorageService.setE2EEData(key, fromUrl);
		this._e2eeKey.set(key);
		this._isE2eeKeyFromUrl.set(fromUrl);
	}

	/**
	 * Loads the E2EE key data from session storage
	 */
	loadE2eeKeyFromStorage(): void {
		const e2eeData = this.sessionStorageService.getE2EEData();
		if (e2eeData) {
			this._e2eeKey.set(e2eeData.key);
			this._isE2eeKeyFromUrl.set(e2eeData.fromUrl);
		}
	}

	/**
	 * Updates whether the room has recordings
	 * @param hasRecordings True if recordings exist
	 */
	setHasRecordings(hasRecordings: boolean): void {
		this._hasRecordings.set(hasRecordings);
	}

	/**
	 * Sets whether the meeting is active
	 * @param isActive True if the meeting is active, false otherwise
	 */
	setIsActiveMeeting(isActive: boolean): void {
		this._isActiveMeeting.set(isActive);
	}

	/**
	 * Sets who ended the meeting
	 * @param by 'self' if ended by this user, 'other' if ended by someone else
	 */
	setMeetingEndedBy(by: 'self' | 'other' | null): void {
		this._meetingEndedBy.set(by);
	}

	/**
	 * Sets the LiveKit Room instance in context
	 * @param room
	 */
	setLkRoom(room: Room) {
		this._lkRoom.set(room);
	}

	setPrimaryHostIdentity(identity: string | undefined): void {
		this._primaryHostIdentity.set(identity);
		if (identity) this._hostUnavailableEndsAt.set(undefined);
	}

	setHostUnavailable(endsAt: number): void {
		this._primaryHostIdentity.set(undefined);
		this._hostUnavailableEndsAt.set(endsAt);
	}

	setHandRaised(participantIdentity: string, raised: boolean): void {
		const next = new Set(this._raisedHandIdentities());
		raised ? next.add(participantIdentity) : next.delete(participantIdentity);
		this._raisedHandIdentities.set(next);
	}

	isHandRaised(participantIdentity: string): boolean {
		return this._raisedHandIdentities().has(participantIdentity);
	}

	/** 由 MeetingSpotlightService 在焦点变化时同步（含晚加入者初始化与焦点者离会清理） */
	setSpotlightIdentity(identity: string | undefined): void {
		this._spotlightIdentity.set(identity || undefined);
	}

	/**
	 * Synchronizes participants from OpenVidu Components ParticipantService using signals.
	 * Effects are automatically cleaned up when the service is destroyed.
	 */
	private setupParticipantSynchronization(): void {
		// Sync local participant signal
		effect(() => {
			const localParticipant = this.ovParticipantService.localParticipant();
			this._localParticipant.set(localParticipant as CustomParticipantModel);
		});

		// Sync remote participants signal
		effect(() => {
			const remoteParticipants = this.ovParticipantService.remoteParticipants();
			this._remoteParticipants.set(remoteParticipants as CustomParticipantModel[]);
		});
	}

	/**
	 * Clears all meeting-scoped state:
	 * - room member context
	 * - meeting context
	 * - meeting-related session storage (optional).
	 *
	 * @param clearSessionStorage Whether to also clear meeting data from SessionStorage (default: true)
	 */
	clearMeetingContext(clearSessionStorage = true): void {
		this.roomMemberContextService.clearContext();
		this.clearContext();

		if (clearSessionStorage) {
			this.sessionStorageService.clearMeetingData();
		}
	}

	/**
	 * Clears the meeting context
	 */
	private clearContext(): void {
		this._roomId.set(undefined);
		this.roomAccessLinkService.clear();
		this._roomSecret.set(undefined);
		this._e2eeKey.set('');
		this._isE2eeKeyFromUrl.set(false);
		this._hasRecordings.set(false);
		this._isActiveMeeting.set(false);
		this._meetingEndedBy.set(null);
		this._lkRoom.set(undefined);
		this._localParticipant.set(undefined);
		this._remoteParticipants.set([]);
		this._primaryHostIdentity.set(undefined);
		this._raisedHandIdentities.set(new Set());
		this._spotlightIdentity.set(undefined);
	}
}

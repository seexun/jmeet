import { Injectable, inject } from '@angular/core';
import {
	LeftEventReason,
	MeetHostChangedPayload,
	MeetHostUnavailablePayload,
	MeetHandStateChangedPayload,
	MeetScreenShareRequestPayload,
	MeetScreenShareGrantedPayload,
	MeetUnmuteRequestedPayload,
	MeetParticipantPermissionsUpdatedPayload,
	MeetParticipantRoleUpdatedPayload,
	MeetRoomConfigUpdatedPayload,
	MeetRoomMemberTokenMetadata,
	MeetRoomMemberTokenOptions,
	MeetRoomMemberUIBadge,
	MeetSignalType
} from '@openvidu-meet/typings';
import { NavigationErrorReason } from '../../../shared/models/navigation.model';
import { NavigationService } from '../../../shared/services/navigation.service';
import { NotificationService } from '../../../shared/services/notification.service';
import { RuntimeConfigService } from '../../../shared/services/runtime-config.service';
import { SoundService } from '../../../shared/services/sound.service';
import { RoomMemberContextService } from '../../room-members/services/room-member-context.service';
import { RoomFeatureService } from '../../rooms/services/room-feature.service';
import type {
	DataPacket_Kind,
	LocalParticipant,
	ParticipantLeftEvent,
	ParticipantModel,
	RemoteParticipant,
	Room
} from '../openvidu-components';
import { ParticipantLeftReason, ParticipantService, RoomEvent } from '../openvidu-components';
import { MeetingContextService } from './meeting-context.service';
import { MeetingService } from './meeting.service';

/**
 * Service that handles all LiveKit/OpenVidu room events.
 *
 * This service encapsulates all event handling logic and updates the MeetingContextService
 * as the single source of truth for meeting state.
 */
@Injectable()
export class MeetingEventHandlerService {
	protected meetingContext = inject(MeetingContextService);
	protected roomFeatureService = inject(RoomFeatureService);
	protected roomMemberContextService = inject(RoomMemberContextService);
	protected navigationService = inject(NavigationService);
	protected notificationService = inject(NotificationService);
	protected soundService = inject(SoundService);
	private readonly participantService = inject(ParticipantService);
	private readonly meetingService = inject(MeetingService);
	protected runtimeConfigService = inject(RuntimeConfigService);

	// ============================================
	// PUBLIC METHODS - Room Event Handlers
	// ============================================

	/**
	 * Sets up all room event listeners when room is created.
	 * This is the main entry point for room event handling.
	 *
	 * @param room The LiveKit Room instance
	 */
	setupRoomListeners(room: Room): void {
		room.on(RoomEvent.Reconnected, () => void this.restoreBusinessState());
		room.on(
			RoomEvent.DataReceived,
			async (payload: Uint8Array, _participant?: RemoteParticipant, _kind?: DataPacket_Kind, topic?: string) => {
				// Only process topics that this handler is responsible for
				const relevantTopics: string[] = [
					MeetSignalType.MEET_PARTICIPANT_ROLE_UPDATED,
					MeetSignalType.MEET_PARTICIPANT_PERMISSIONS_UPDATED,
					MeetSignalType.MEET_ROOM_CONFIG_UPDATED,
					MeetSignalType.MEET_HOST_CHANGED,
					MeetSignalType.MEET_HOST_UNAVAILABLE,
					MeetSignalType.MEET_UNMUTE_REQUESTED,
					MeetSignalType.MEET_HAND_STATE_CHANGED,
					MeetSignalType.MEET_SCREEN_SHARE_REQUESTED,
					MeetSignalType.MEET_SCREEN_SHARE_GRANTED
				];

				if (!topic || !relevantTopics.includes(topic)) {
					return;
				}

				try {
					const event = JSON.parse(new TextDecoder().decode(payload));

					switch (topic) {
						case MeetSignalType.MEET_PARTICIPANT_ROLE_UPDATED:
							const roleUpdateEvent = event as MeetParticipantRoleUpdatedPayload;
							await this.handleParticipantRoleUpdated(roleUpdateEvent);
							break;

						case MeetSignalType.MEET_PARTICIPANT_PERMISSIONS_UPDATED:
							const permissionsUpdateEvent = event as MeetParticipantPermissionsUpdatedPayload;
							await this.handleParticipantPermissionsUpdated(permissionsUpdateEvent);
							break;

						case MeetSignalType.MEET_ROOM_CONFIG_UPDATED:
							await this.handleRoomConfigUpdated(event as MeetRoomConfigUpdatedPayload);
							break;

						case MeetSignalType.MEET_HOST_CHANGED:
							this.handleHostChanged(event as MeetHostChangedPayload);
							break;

						case MeetSignalType.MEET_HOST_UNAVAILABLE:
							this.handleHostUnavailable(event as MeetHostUnavailablePayload);
							break;

						case MeetSignalType.MEET_UNMUTE_REQUESTED:
							this.handleUnmuteRequested(event as MeetUnmuteRequestedPayload);
							break;

						case MeetSignalType.MEET_HAND_STATE_CHANGED:
							this.handleHandStateChanged(event as MeetHandStateChangedPayload);
							break;

						case MeetSignalType.MEET_SCREEN_SHARE_REQUESTED:
							this.handleScreenShareRequested(event as MeetScreenShareRequestPayload);
							break;

						case MeetSignalType.MEET_SCREEN_SHARE_GRANTED:
							this.handleScreenShareGranted(event as MeetScreenShareGrantedPayload);
							break;
					}
				} catch (error) {
					console.warn(`Failed to parse data message for topic: ${topic}`, error);
				}
			}
		);

		room.on(
			RoomEvent.ParticipantMetadataChanged,
			(_prevMetadata: string | undefined, participant: LocalParticipant | RemoteParticipant) => {
				this.handleParticipantMetadataChanged(participant.identity, participant.metadata);
			}
		);

		room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
			this.meetingContext.setHandRaised(participant.identity, false);
		});
	}

	private async restoreBusinessState(): Promise<void> {
		try {
			await this.roomMemberContextService.refreshToken(this.meetingContext.roomId()!);
			this.notificationService.showSnackbar('网络已恢复，会议状态已同步');
		} catch {
			this.notificationService.showSnackbar('网络已恢复，部分会议状态同步失败，请重新进入会议');
		}
	}

	/** Kept for the upstream event wiring contract; embedded-only forwarding is an enterprise capability. */
	onParticipantConnected = (_event: ParticipantModel): void => {};

	/**
	 * Maps the technical leave reason to a {@link LeftEventReason}, clears context,
	 * and delegates the post-leave view transition to {@link NavigationService.goToDisconnected}.
	 */
	onParticipantLeft = async (event: ParticipantLeftEvent): Promise<void> => {
		let leftReason = this.mapLeftReason(event.reason);

		// If meeting was ended by local user, update reason
		const meetingEndedBySelf = this.meetingContext.meetingEndedBy() === 'self';
		if (leftReason === LeftEventReason.MEETING_ENDED && meetingEndedBySelf) {
			leftReason = LeftEventReason.MEETING_ENDED_BY_SELF;
		}

		// Clear meeting context but keep session storage intact
		this.meetingContext.clearMeetingContext(false);

		await this.navigationService.goToDisconnected(leftReason);
	};

	/** Kept for the upstream event wiring contract; recording is an enterprise capability. */
	onRecordingStartRequested = async (_event: unknown): Promise<void> => {};

	/** Kept for the upstream event wiring contract; recording is an enterprise capability. */
	onRecordingStopRequested = async (_event: unknown): Promise<void> => {};

	// ============================================
	// PRIVATE METHODS - Event Handlers
	// ============================================

	/**
	 * Handles role updated event for the local participant by refreshing the room member token to get updated permissions.
	 * Also shows a notification to the user about their new role.
	 *
	 * @param event Participant role updated event payload
	 */
	private async handleParticipantRoleUpdated(event: MeetParticipantRoleUpdatedPayload): Promise<void> {
		const { roomId, participantIdentity, newBadge } = event;
		const local = this.meetingContext.localParticipant();

		if (!roomId || !local || local.identity !== participantIdentity) {
			return;
		}

		try {
			// Refresh room member token to get updated permissions based on new role
			await this.roomMemberContextService.refreshToken(roomId);

			const isPromotedModerator = newBadge === MeetRoomMemberUIBadge.MODERATOR;
			this.showParticipantRoleUpdatedNotification(isPromotedModerator);
		} catch (error) {
			console.error('Error refreshing room member token after role update:', error);
			await this.navigationService.redirectToErrorPage(NavigationErrorReason.ROOM_ACCESS_REVOKED, true);
		}
	}

	private handleHostChanged(event: MeetHostChangedPayload): void {
		if (event.roomId !== this.meetingContext.roomId()) return;
		const wasPrimaryHost = this.meetingContext.isPrimaryHost();
		this.meetingContext.setPrimaryHostIdentity(event.hostIdentity);
		const localIdentity = this.meetingContext.localParticipant()?.identity;
		if (localIdentity === event.hostIdentity && !wasPrimaryHost) {
			this.notificationService.showSnackbar('您已成为会议主持人');
		} else if (wasPrimaryHost && localIdentity !== event.hostIdentity) {
			this.notificationService.showSnackbar('主持人权限已成功移交');
		}
	}

	private handleHostUnavailable(event: MeetHostUnavailablePayload): void {
		if (event.roomId !== this.meetingContext.roomId()) return;
		this.meetingContext.setHostUnavailable(event.endsAt);
		this.notificationService.showSnackbar('主持人已离线，会议暂时保留，可由主持人接管');
	}

	private handleUnmuteRequested(event: MeetUnmuteRequestedPayload): void {
		const local = this.meetingContext.localParticipant();
		if (event.roomId !== this.meetingContext.roomId() || local?.identity !== event.participantIdentity) return;
		if (local.isMicrophoneEnabled) return;
		this.notificationService.showDialog({
			title: '主持人邀请您发言',
			icon: 'mic',
			message: '是否打开麦克风？麦克风只会在您确认后开启。',
			confirmText: '打开麦克风',
			cancelText: '暂不开启',
			confirmCallback: () => void this.participantService.setMicrophoneEnabled(true)
		});
	}

	private handleHandStateChanged(event: MeetHandStateChangedPayload): void {
		if (event.roomId !== this.meetingContext.roomId()) return;
		this.meetingContext.setHandRaised(event.participantIdentity, event.raised);
		const local = this.meetingContext.localParticipant();
		if (event.raised && this.meetingContext.isPrimaryHost() && local?.identity !== event.participantIdentity) {
			const participant = this.meetingContext.remoteParticipants().find(
				(item) => item.identity === event.participantIdentity
			);
			this.notificationService.showSnackbar(`${participant?.name ?? '有成员'} 已举手`);
		}
	}

	private handleScreenShareRequested(event: MeetScreenShareRequestPayload): void {
		if (event.roomId !== this.meetingContext.roomId() || !this.meetingContext.isPrimaryHost()) return;
		this.notificationService.showDialog({
			title: '成员申请共享屏幕',
			icon: 'present_to_all',
			message: `${event.participantName ?? '一位成员'} 希望共享屏幕，是否允许？`,
			confirmText: '允许共享',
			cancelText: '暂不允许',
			confirmCallback: () => void this.approveScreenShare(event)
		});
	}

	private async approveScreenShare(event: MeetScreenShareRequestPayload): Promise<void> {
		try {
			await this.meetingService.grantScreenShare(event.roomId, event.participantIdentity);
			this.notificationService.showSnackbar('已允许该成员共享屏幕');
		} catch (error) {
			console.error('Error granting screen sharing:', error);
			this.notificationService.showSnackbar('共享审批失败，请稍后重试');
		}
	}

	private handleScreenShareGranted(event: MeetScreenShareGrantedPayload): void {
		const local = this.meetingContext.localParticipant();
		if (event.roomId !== this.meetingContext.roomId() || local?.identity !== event.participantIdentity) return;
		this.notificationService.showDialog({
			title: '主持人已允许共享',
			icon: 'present_to_all',
			message: '是否现在选择窗口或屏幕开始共享？共享只会在您确认后开始。',
			confirmText: '开始共享',
			cancelText: '稍后',
			confirmCallback: () => void this.participantService.setScreenShareEnabled(true)
		});
	}

	private async handleRoomConfigUpdated(event: MeetRoomConfigUpdatedPayload): Promise<void> {
		const roomId = this.meetingContext.roomId();
		if (!roomId || event.roomId !== roomId) return;
		this.roomFeatureService.setRoomConfig(event.config);
		try {
			await this.roomMemberContextService.refreshToken(roomId);
			this.notificationService.showSnackbar('会议安全策略已更新');
		} catch (error) {
			console.error('Error refreshing token after meeting security update:', error);
		}
	}

	/**
	 * Handles permissions updated event for the local participant by regenerating the room member token to get updated permissions.
	 *
	 * @param event Participant permissions updated event payload
	 */
	private async handleParticipantPermissionsUpdated(event: MeetParticipantPermissionsUpdatedPayload): Promise<void> {
		const { participantIdentity } = event;
		const roomId = this.meetingContext.roomId();
		const local = this.meetingContext.localParticipant();

		if (!roomId || !local || local.identity !== participantIdentity) {
			return;
		}

		try {
			const roomSecret = this.meetingContext.roomSecret();
			const tokenOptions: MeetRoomMemberTokenOptions = {
				secret: roomSecret,
				joinMeeting: true
			};
			await this.roomMemberContextService.generateToken(roomId, tokenOptions);

			this.notificationService.showSnackbar('Your permissions have been updated');
		} catch (error) {
			console.error('Error regenerating room member token after permissions update:', error);
			await this.navigationService.redirectToErrorPage(NavigationErrorReason.ROOM_ACCESS_REVOKED, true);
		}
	}

	/**
	 * Handles LiveKit participant metadata updates to synchronize participant badge and moderation state.
	 * This is necessary to reflect role changes (e.g. promoted to moderator) in the UI based on metadata updates from the backend.
	 *
	 * @param participantIdentity - The identity of the participant whose metadata changed
	 * @param metadata - The new metadata string, expected to be a JSON string containing badge and promotedModerator properties
	 */
	private handleParticipantMetadataChanged(participantIdentity: string, metadata: string | undefined): void {
		const parsedMetadata = this.parseParticipantMetadata(metadata);
		if (!parsedMetadata) {
			return;
		}

		const local = this.meetingContext.localParticipant();
		if (local && local.identity === participantIdentity) {
			local.badge = parsedMetadata.badge;
			local.promotedModerator = Boolean(parsedMetadata.isPromotedModerator);
			return;
		}

		const remoteParticipants = this.meetingContext.remoteParticipants();
		const participant = remoteParticipants.find((p) => p.identity === participantIdentity);
		if (participant) {
			participant.badge = parsedMetadata.badge;
			participant.promotedModerator = Boolean(parsedMetadata.isPromotedModerator);
		}
	}

	private parseParticipantMetadata(metadata: string | undefined): MeetRoomMemberTokenMetadata | undefined {
		if (!metadata) {
			return undefined;
		}

		try {
			const parsed = JSON.parse(metadata) as Partial<MeetRoomMemberTokenMetadata>;
			if (
				!parsed.badge ||
				(parsed.isPromotedModerator !== undefined && typeof parsed.isPromotedModerator !== 'boolean')
			) {
				return undefined;
			}

			return parsed as MeetRoomMemberTokenMetadata;
		} catch (error) {
			console.warn('Failed to parse participant metadata', error);
			return undefined;
		}
	}

	private showParticipantRoleUpdatedNotification(isPromotedModerator: boolean): void {
		const message = isPromotedModerator
			? 'You have been promoted to moderator'
			: 'Your moderator role has been removed';
		this.notificationService.showSnackbar(message);

		if (isPromotedModerator) {
			this.soundService.playParticipantRoleUpgradedSound();
		} else {
			this.soundService.playParticipantRoleDowngradedSound();
		}
	}

	/**
	 * Maps technical ParticipantLeftReason to user-friendly LeftEventReason.
	 * This provides better messaging to users about why they left the room.
	 */
	private mapLeftReason(reason: ParticipantLeftReason): LeftEventReason {
		const reasonMap: Record<ParticipantLeftReason, LeftEventReason> = {
			[ParticipantLeftReason.LEAVE]: LeftEventReason.VOLUNTARY_LEAVE,
			[ParticipantLeftReason.BROWSER_UNLOAD]: LeftEventReason.VOLUNTARY_LEAVE,
			[ParticipantLeftReason.NETWORK_DISCONNECT]: LeftEventReason.NETWORK_DISCONNECT,
			[ParticipantLeftReason.SIGNAL_CLOSE]: LeftEventReason.NETWORK_DISCONNECT,
			[ParticipantLeftReason.SERVER_SHUTDOWN]: LeftEventReason.SERVER_SHUTDOWN,
			[ParticipantLeftReason.PARTICIPANT_REMOVED]: LeftEventReason.PARTICIPANT_KICKED,
			[ParticipantLeftReason.ROOM_DELETED]: LeftEventReason.MEETING_ENDED,
			[ParticipantLeftReason.DUPLICATE_IDENTITY]: LeftEventReason.DUPLICATE_IDENTITY,
			[ParticipantLeftReason.OTHER]: LeftEventReason.UNKNOWN
		};
		return reasonMap[reason] ?? LeftEventReason.UNKNOWN;
	}
}

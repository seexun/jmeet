import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzIconTypePipe } from '../../../../shared/pipes/nz-icon-type.pipe';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { MeetParticipantModerationAction } from '@openvidu-meet/typings';
import { RoomMemberContextService } from '../../../room-members/services/room-member-context.service';
import { RoomMemberUiUtils } from '../../../room-members/utils/ui';
import { CustomParticipantModel, ParticipantDisplayProperties } from '../../models/custom-participant.model';
import { LoggerService, OpenViduComponentsUiModule, OpenViduService } from '../../openvidu-components';
import { MeetingContextService } from '../../services/meeting-context.service';
import { MeetingService } from '../../services/meeting.service';
import { MeetingSpotlightService } from '../../services/meeting-spotlight.service';
import { MeetingRenameService } from '../../services/meeting-rename.service';
import { NotificationService } from '../../../../shared/services/notification.service';

/**
 * Renders a single participant panel item — the role badge and the moderation controls
 * (make/unmake moderator, kick) — for one participant.
 */
@Component({
	selector: 'ov-meeting-participant-item-content',
	templateUrl: './meeting-participant-item-content.component.html',
	styleUrls: ['./meeting-participant-item-content.component.scss'],
	imports: [NzIconTypePipe, NzIconModule, NzDropDownModule, NzTooltipModule, OpenViduComponentsUiModule, NzMenuModule],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class MeetingParticipantItemContentComponent {
	readonly participant = input.required<CustomParticipantModel>();

	protected meetingService = inject(MeetingService);
	protected meetingContextService = inject(MeetingContextService);
	protected roomMemberContextService = inject(RoomMemberContextService);
	protected loggerService = inject(LoggerService);
	protected readonly spotlightService = inject(MeetingSpotlightService);
	private readonly renameService = inject(MeetingRenameService);
	private readonly notificationService = inject(NotificationService);
	private readonly openviduService = inject(OpenViduService);
	readonly mutePending = signal(false);
	readonly mediaPending = signal(false);
	readonly renamePending = signal(false);
	readonly spotlightPending = signal(false);
	protected log = this.loggerService.get('JMeet - MeetingParticipantItemContent');

	/** 该参会者是否正处于全局焦点 */
	readonly isSpotlighted = computed(() => this.meetingContextService.spotlightIdentity() === this.participant().identity);
	/** 是否可管理焦点/改名(主主持人或联席主持人) */
	readonly canManageSpotlight = this.spotlightService.canManageSpotlight;

	protected readonly RoomMemberUiUtils = RoomMemberUiUtils;

	/**
	 * Reactive display properties for this participant. Reads the participant's signal-backed
	 * moderation state (badge, promotedModerator) and the signal-backed room member permissions,
	 * so it recomputes automatically and only when a real dependency changes.
	 */
	readonly displayProperties = computed<ParticipantDisplayProperties>(() => {
		const participant = this.participant();
		const hasBadge = participant.hasBadge();
		const displayProperties: ParticipantDisplayProperties = {
			showBadge: hasBadge,
			showVerifiedIdentity: participant.isVerifiedIdentity() && !hasBadge,
			showModerationControls: false,
			showMakeModeratorButton: false,
			showUnmakeModeratorButton: false,
			showKickButton: false,
			showMuteButton: false,
			showRequestUnmuteButton: false,
			showStopCameraButton: false,
			showStopScreenShareButton: false,
			showTransferHostButton: false
		};

		// Moderation controls are only shown for remote participants, never for the current user.
		if (participant.isLocal) {
			return displayProperties;
		}

		const canMakeModerator = this.roomMemberContextService.hasPermission('canMakeModerator');
		const canKickParticipants = this.roomMemberContextService.hasPermission('canKickParticipants');
		displayProperties.showMuteButton = canKickParticipants && participant.isMicrophoneEnabled;
		displayProperties.showRequestUnmuteButton = canKickParticipants && !participant.isMicrophoneEnabled;
		displayProperties.showStopCameraButton = canKickParticipants && participant.isCameraEnabled;
		displayProperties.showStopScreenShareButton = canKickParticipants && participant.isScreenShareEnabled;

		// If the user doesn't have any moderation permissions, no need to compute further.
		if (!canMakeModerator && !canKickParticipants) {
			return displayProperties;
		}

		if (participant.isPromotedModerator()) {
			// Show unmake-moderator and/or kick buttons if the user has the permission and this
			// participant is a promoted moderator (an original moderator cannot be kicked or demoted).
			displayProperties.showUnmakeModeratorButton = canMakeModerator;
			displayProperties.showKickButton = canKickParticipants;
		} else {
			// Show make-moderator and/or kick buttons if the user has the permission and this
			// participant doesn't have any badge (is not owner/admin/moderator).
			displayProperties.showMakeModeratorButton = canMakeModerator && !hasBadge;
			displayProperties.showTransferHostButton = canMakeModerator && this.meetingContextService.isPrimaryHost();
			displayProperties.showKickButton = canKickParticipants && !hasBadge;
		}

		// Show the moderation controls container if any of the buttons should be shown.
		displayProperties.showModerationControls =
			displayProperties.showMakeModeratorButton ||
			displayProperties.showUnmakeModeratorButton ||
			displayProperties.showKickButton ||
			displayProperties.showMuteButton ||
			displayProperties.showRequestUnmuteButton;
		displayProperties.showModerationControls ||=
			displayProperties.showStopCameraButton || displayProperties.showStopScreenShareButton;
		displayProperties.showModerationControls ||= displayProperties.showTransferHostButton;
		return displayProperties;
	});

	async onMakeModeratorClick(): Promise<void> {
		if (!this.roomMemberContextService.hasPermission('canMakeModerator')) return;

		const roomId = this.meetingContextService.roomId();
		if (!roomId) {
			this.log.e('Cannot change participant role: room ID is undefined');
			return;
		}

		try {
			await this.meetingService.changeParticipantRole(
				roomId,
				this.participant().identity,
				MeetParticipantModerationAction.UPGRADE
			);
			this.log.d('Moderator assigned successfully');
		} catch (error) {
			this.log.e('Error assigning moderator:', error);
		}
	}

	onTransferHostClick(): void {
		const target = this.participant();
		this.notificationService.showDialog({
			title: `将主持人移交给 ${target.name}？`,
			icon: 'switch_account',
			message: '对方将成为唯一主主持人，您仍保留联席主持人权限。移交成功后您将离开会议。',
			confirmText: '移交并离开',
			cancelText: '取消',
			confirmCallback: () => void this.transferHostAndLeave()
		});
	}

	private async transferHostAndLeave(): Promise<void> {
		const roomId = this.meetingContextService.roomId();
		if (!roomId) return;
		try {
			const result = await this.meetingService.transferMeetingHost(roomId, this.participant().identity);
			this.meetingContextService.setPrimaryHostIdentity(result.hostIdentity);
			await this.openviduService.disconnectRoom();
		} catch (error) {
			this.log.e('Error transferring primary host:', error);
			this.notificationService.showSnackbar('主持人移交失败，请稍后重试');
		}
	}

	async onStopCameraClick(): Promise<void> {
		await this.runMediaAction('camera');
	}

	async onStopScreenShareClick(): Promise<void> {
		await this.runMediaAction('screen');
	}

	private async runMediaAction(kind: 'camera' | 'screen'): Promise<void> {
		if (!this.roomMemberContextService.hasPermission('canKickParticipants') || this.mediaPending()) return;
		const roomId = this.meetingContextService.roomId();
		if (!roomId) return;
		this.mediaPending.set(true);
		try {
			if (kind === 'camera') await this.meetingService.stopParticipantCamera(roomId, this.participant().identity);
			else await this.meetingService.stopParticipantScreenShare(roomId, this.participant().identity);
			this.notificationService.showSnackbar(kind === 'camera' ? '已关闭成员摄像头' : '已停止成员共享');
		} finally { this.mediaPending.set(false); }
	}

	async onMuteParticipantClick(): Promise<void> {
		if (!this.roomMemberContextService.hasPermission('canKickParticipants') || this.mutePending()) return;
		const roomId = this.meetingContextService.roomId();
		if (!roomId) return;
		this.mutePending.set(true);
		try {
			const result = await this.meetingService.muteParticipant(roomId, this.participant().identity);
			this.notificationService.showSnackbar(
				result.mutedTracks > 0 ? `已将 ${this.participant().name} 静音` : '该成员当前已静音'
			);
		} catch (error) {
			this.log.e('Error muting participant:', error);
			this.notificationService.showSnackbar('静音失败，请稍后重试');
		} finally {
			this.mutePending.set(false);
		}
	}

	async onRequestUnmuteClick(): Promise<void> {
		if (!this.roomMemberContextService.hasPermission('canKickParticipants') || this.mutePending()) return;
		const roomId = this.meetingContextService.roomId();
		if (!roomId) return;
		this.mutePending.set(true);
		try {
			await this.meetingService.requestParticipantUnmute(roomId, this.participant().identity);
			this.notificationService.showSnackbar(`已邀请 ${this.participant().name} 发言`);
		} catch (error) {
			this.log.e('Error requesting participant to unmute:', error);
			this.notificationService.showSnackbar('发言邀请发送失败，请稍后重试');
		} finally {
			this.mutePending.set(false);
		}
	}

	async onUnmakeModeratorClick(): Promise<void> {
		if (!this.roomMemberContextService.hasPermission('canMakeModerator')) return;

		const roomId = this.meetingContextService.roomId();
		if (!roomId) {
			this.log.e('Cannot change participant role: room ID is undefined');
			return;
		}

		try {
			await this.meetingService.changeParticipantRole(
				roomId,
				this.participant().identity,
				MeetParticipantModerationAction.DOWNGRADE
			);
			this.log.d('Moderator unassigned successfully');
		} catch (error) {
			this.log.e('Error unassigning moderator:', error);
		}
	}

	async onKickParticipantClick(): Promise<void> {
		if (!this.roomMemberContextService.hasPermission('canKickParticipants')) return;

		const roomId = this.meetingContextService.roomId();
		if (!roomId) {
			this.log.e('Cannot kick participant: room ID is undefined');
			return;
		}

		try {
			await this.meetingService.kickParticipant(roomId, this.participant().identity);
			this.log.d('Participant kicked successfully');
		} catch (error) {
			this.log.e('Error kicking participant:', error);
		}
	}

	async onBlockParticipantClick(): Promise<void> {
		if (!this.roomMemberContextService.hasPermission('canKickParticipants')) return;
		const roomId = this.meetingContextService.roomId();
		if (!roomId) return;
		await this.meetingService.kickParticipant(roomId, this.participant().identity, true);
		this.notificationService.showSnackbar('成员已移出会议并禁止重新加入');
	}

	/** 设为/取消全局焦点(全员视角统一大图) */
	async onToggleSpotlightClick(): Promise<void> {
		if (!this.spotlightService.canManageSpotlight() || this.spotlightPending()) return;
		this.spotlightPending.set(true);
		try {
			const target = this.isSpotlighted() ? undefined : this.participant().identity;
			await this.spotlightService.setSpotlight(target);
			this.notificationService.showSnackbar(target ? `已将 ${this.participant().name} 设为全场焦点` : '已取消全场焦点');
		} finally {
			this.spotlightPending.set(false);
		}
	}

	/** 主持人请求该参会者改名(对方确认后服务端生效,全员可见) */
	async onRenameClick(): Promise<void> {
		const roomId = this.meetingContextService.roomId();
		if (!roomId || !this.spotlightService.canManageSpotlight() || this.renamePending()) return;
		const newName = await this.notificationService.prompt({
			message: `为「${this.participant().name}」设置新的会议昵称`,
			value: this.participant().name ?? '',
			minLength: 1
		});
		if (!newName || newName === this.participant().name) return;
		this.renamePending.set(true);
		try {
			const sent = await this.renameService.requestRename(roomId, this.participant().identity, newName);
			this.notificationService.showSnackbar(
				sent ? '改名请求已发送，等待对方确认' : '改名请求发送失败，请稍后重试'
			);
		} finally {
			this.renamePending.set(false);
		}
	}
}

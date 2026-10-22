import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzIconTypePipe } from '../../../../shared/pipes/nz-icon-type.pipe';
import { MenuService, NzIsMenuInsideDropdownToken, NzMenuModule } from 'ng-zorro-antd/menu';
import { DEFAULT_MEETING_SECURITY_CONFIG } from '@openvidu-meet/typings';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { NotificationService } from '../../../../shared/services/notification.service';
import { RoomFeatureService } from '../../../rooms/services/room-feature.service';
import { LoggerService } from '../../openvidu-components';
import { MeetingContextService } from '../../services/meeting-context.service';
import { MeetingService } from '../../services/meeting.service';
import { MeetingShortcutsService } from '../../services/meeting-shortcuts.service';
import { MeetingPipService } from '../../services/meeting-pip.service';

/**
 * Extra meeting actions for the toolbar "More options" menu: personal preferences,
 * participant actions, and host controls.
 */
@Component({
	selector: 'ov-meeting-toolbar-extra-buttons',
	// 菜单项被 ng-content 投影进工具栏 more-options 菜单，声明视图内没有
	// [nz-menu]/nz-dropdown-menu 的元素级 providers，这里自带一份供 NzMenuItemComponent 注入
	providers: [MenuService, { provide: NzIsMenuInsideDropdownToken, useValue: true }],
	templateUrl: './meeting-toolbar-extra-buttons.component.html',
	styleUrls: ['./meeting-toolbar-extra-buttons.component.scss'],
	imports: [NzIconTypePipe, NzIconModule, NzMenuModule, TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class MeetingToolbarExtraButtonsComponent {
	protected meetingContextService = inject(MeetingContextService);
	protected loggerService = inject(LoggerService);
	protected readonly shortcutsService = inject(MeetingShortcutsService);
	protected readonly pipService = inject(MeetingPipService);
	private readonly meetingService = inject(MeetingService);
	private readonly notificationService = inject(NotificationService);
	private readonly roomFeatureService = inject(RoomFeatureService);
	protected log = this.loggerService.get('JMeet - MeetingToolbarExtraButtons');

	protected readonly isPipOpen = this.pipService.isOpen;

	showHostControls = computed(() => this.meetingContextService.meetingUI().showEndMeeting);
	readonly isMuteAllPending = signal(false);
	readonly isSecurityPending = signal(false);
	readonly isHandPending = signal(false);
	readonly isShareRequestPending = signal(false);
	readonly isHandRaised = this.meetingContextService.isLocalHandRaised;
	readonly isMeetingLocked = computed(() => this.roomFeatureService.currentRoomConfig()?.security?.locked ?? false);
	readonly isSelfUnmuteAllowed = computed(
		() => this.roomFeatureService.currentRoomConfig()?.security?.allowSelfUnmute ?? true
	);
	readonly showScreenShareRequest = computed(
		() =>
			!this.showHostControls() &&
			!this.meetingContextService.meetingUI().showScreenShare &&
			this.roomFeatureService.currentRoomConfig()?.security?.screenSharePolicy === 'moderators_only'
	);

	async onToggleHand(): Promise<void> {
		const roomId = this.meetingContextService.roomId();
		const localIdentity = this.meetingContextService.localParticipant()?.identity;
		if (!roomId || !localIdentity || this.isHandPending()) return;
		const raised = !this.isHandRaised();
		this.isHandPending.set(true);
		try {
			await this.meetingService.updateHandState(roomId, raised);
			this.meetingContextService.setHandRaised(localIdentity, raised);
			this.notificationService.showSnackbar(raised ? '已举手，等待主持人邀请发言' : '已取消举手');
		} catch (error) {
			this.log.e('Error updating hand state:', error);
			this.notificationService.showSnackbar('举手状态更新失败，请稍后重试');
		} finally {
			this.isHandPending.set(false);
		}
	}

	async onRequestScreenShare(): Promise<void> {
		const roomId = this.meetingContextService.roomId();
		if (!roomId || this.isShareRequestPending()) return;
		this.isShareRequestPending.set(true);
		try {
			await this.meetingService.requestScreenShare(roomId);
			this.notificationService.showSnackbar('共享申请已发送，等待主持人处理');
		} catch (error) {
			this.log.e('Error requesting screen share:', error);
			this.notificationService.showSnackbar('共享申请发送失败，请稍后重试');
		} finally {
			this.isShareRequestPending.set(false);
		}
	}

	onMuteAllClick(): void {
		this.notificationService.showDialog({
			title: '将所有成员静音？',
			icon: 'mic_off',
			message: '当前已开启麦克风的参会成员将立即静音。之后成员仍可自行解除静音。',
			confirmText: '全体静音',
			cancelText: '取消',
			confirmCallback: () => void this.muteAllParticipants()
		});
	}

	private async muteAllParticipants(): Promise<void> {
		const roomId = this.meetingContextService.roomId();
		if (!roomId || this.isMuteAllPending()) return;
		this.isMuteAllPending.set(true);
		try {
			const result = await this.meetingService.muteAllParticipants(roomId);
			this.notificationService.showSnackbar(
				result.mutedTracks > 0 ? `已将 ${result.mutedTracks} 位成员静音` : '当前没有需要静音的成员'
			);
		} catch (error) {
			this.log.e('Error muting all participants:', error);
			this.notificationService.showSnackbar('全体静音失败，请稍后重试');
		} finally {
			this.isMuteAllPending.set(false);
		}
	}

	async onToggleMeetingLock(): Promise<void> {
		const roomId = this.meetingContextService.roomId();
		if (!roomId || this.isSecurityPending()) return;
		const current = this.roomFeatureService.currentRoomConfig()?.security ?? DEFAULT_MEETING_SECURITY_CONFIG;
		this.isSecurityPending.set(true);
		try {
			const result = await this.meetingService.updateMeetingSecurity(roomId, { ...current, locked: !current.locked });
			this.roomFeatureService.setRoomConfig({
				...this.roomFeatureService.currentRoomConfig()!,
				security: result.security
			});
			this.notificationService.showSnackbar(result.security.locked ? '会议已锁定，新成员将无法加入' : '会议已解除锁定');
		} catch (error) {
			this.log.e('Error updating meeting lock:', error);
			this.notificationService.showSnackbar('会议安全设置更新失败，请稍后重试');
		} finally {
			this.isSecurityPending.set(false);
		}
	}

	async onToggleSelfUnmute(): Promise<void> {
		const roomId = this.meetingContextService.roomId();
		if (!roomId || this.isSecurityPending()) return;
		const roomConfig = this.roomFeatureService.currentRoomConfig();
		if (!roomConfig) return;
		const current = roomConfig.security ?? DEFAULT_MEETING_SECURITY_CONFIG;
		this.isSecurityPending.set(true);
		try {
			const result = await this.meetingService.updateMeetingSecurity(roomId, {
				...current,
				allowSelfUnmute: !current.allowSelfUnmute
			});
			this.roomFeatureService.setRoomConfig({ ...roomConfig, security: result.security });
			this.notificationService.showSnackbar(
				result.security.allowSelfUnmute ? '成员可以自行解除静音' : '已禁止成员自行解除静音'
			);
		} finally {
			this.isSecurityPending.set(false);
		}
	}

	/** 打开/关闭画中画小窗 */
	togglePip(): void {
		void this.pipService.toggle();
	}

	/** 快捷键帮助弹窗 */
	showShortcutsHelp(): void {
		this.shortcutsService.showHelp();
	}
}

import { inject, Injectable, OnDestroy } from '@angular/core';
import { DocumentService, LoggerService, PanelService, PanelType, ParticipantService } from '../openvidu-components';
import { NotificationService } from '../../../shared/services/notification.service';
import { MeetingContextService } from './meeting-context.service';
import { MeetingService } from './meeting.service';

/** 快捷键定义（顺序即帮助弹窗展示顺序） */
export const MEETING_SHORTCUTS: readonly { combo: string; label: string }[] = [
	{ combo: 'Alt + A', label: '开启 / 关闭麦克风' },
	{ combo: 'Alt + V', label: '开启 / 关闭摄像头' },
	{ combo: 'Alt + S', label: '开始 / 停止屏幕共享' },
	{ combo: 'Alt + H', label: '举手 / 取消举手' },
	{ combo: 'Alt + C', label: '打开 / 收起聊天' },
	{ combo: 'Alt + P', label: '打开 / 收起参会人列表' },
	{ combo: 'Alt + F', label: '全屏 / 退出全屏' },
	{ combo: 'Shift + /', label: '查看快捷键帮助' }
];

/**
 * 会中键盘快捷键（Zoom 风格 Alt 组合键）。
 * 仅在会议视图激活且焦点不在输入控件时响应；F11 全屏保持工具栏原有处理。
 */
@Injectable({ providedIn: 'root' })
export class MeetingShortcutsService implements OnDestroy {
	private readonly participantService = inject(ParticipantService);
	private readonly panelService = inject(PanelService);
	private readonly documentService = inject(DocumentService);
	private readonly meetingContext = inject(MeetingContextService);
	private readonly meetingService = inject(MeetingService);
	private readonly notificationService = inject(NotificationService);
	private readonly loggerService = inject(LoggerService);
	private log = this.loggerService.get('JMeet - MeetingShortcuts');

	private enabled = false;
	private readonly handler = (event: KeyboardEvent): void => this.onKeyDown(event);

	/** 进入会议视图时启用（见 MeetingComponent） */
	enable(): void {
		if (this.enabled) return;
		this.enabled = true;
		document.addEventListener('keydown', this.handler);
	}

	disable(): void {
		if (!this.enabled) return;
		this.enabled = false;
		document.removeEventListener('keydown', this.handler);
	}

	ngOnDestroy(): void {
		this.disable();
	}

	private onKeyDown(event: KeyboardEvent): void {
		if (this.isTypingTarget(event)) return;

		if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
			switch (event.key.toLowerCase()) {
				case 'a':
					event.preventDefault();
					void this.toggleMicrophone();
					return;
				case 'v':
					event.preventDefault();
					void this.toggleCamera();
					return;
				case 's':
					event.preventDefault();
					void this.toggleScreenShare();
					return;
				case 'h':
					event.preventDefault();
					void this.toggleHand();
					return;
				case 'c':
					event.preventDefault();
					this.panelService.togglePanel(PanelType.CHAT);
					return;
				case 'p':
					event.preventDefault();
					this.panelService.togglePanel(PanelType.PARTICIPANTS);
					return;
				case 'f':
					event.preventDefault();
					this.documentService.toggleFullscreen('session-container');
					return;
			}
			return;
		}

		// Shift + / (即 "?") 打开快捷键帮助
		if (event.key === '?' || (event.shiftKey && event.key === '/')) {
			event.preventDefault();
			this.showHelp();
		}
	}

	/** 焦点在输入类控件上时不劫持按键（Enter 发送等由控件自己处理） */
	private isTypingTarget(event: KeyboardEvent): boolean {
		const target = event.target as HTMLElement | null;
		if (!target) return false;
		const tag = target.tagName?.toLowerCase();
		return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
	}

	private async toggleMicrophone(): Promise<void> {
		try {
			await this.participantService.setMicrophoneEnabled(!this.participantService.isMyMicrophoneEnabled());
		} catch (error) {
			this.log.e('Shortcut: toggle microphone failed', error);
		}
	}

	private async toggleCamera(): Promise<void> {
		try {
			const enabled = this.participantService.isMyCameraEnabled();
			await this.participantService.setCameraEnabled(!enabled);
		} catch (error) {
			this.log.e('Shortcut: toggle camera failed', error);
		}
	}

	private async toggleScreenShare(): Promise<void> {
		try {
			await this.participantService.setScreenShareEnabled(!this.participantService.isMyScreenShareEnabled());
		} catch (error) {
			this.log.e('Shortcut: toggle screenshare failed', error);
		}
	}

	private async toggleHand(): Promise<void> {
		const roomId = this.meetingContext.roomId();
		const localIdentity = this.meetingContext.localParticipant()?.identity;
		if (!roomId || !localIdentity) return;
		const raised = !this.meetingContext.isLocalHandRaised;
		try {
			await this.meetingService.updateHandState(roomId, raised);
			this.meetingContext.setHandRaised(localIdentity, raised);
			this.notificationService.showSnackbar(raised ? '已举手，等待主持人邀请发言' : '已取消举手');
		} catch (error) {
			this.log.e('Shortcut: toggle hand failed', error);
		}
	}

	showHelp(): void {
		// dialog message 经 innerHTML 渲染,<br> 可安全通过 Angular 默认净化器
		const lines = MEETING_SHORTCUTS.map((s) => `<b>${s.combo}</b>　${s.label}`).join('<br>');
		this.notificationService.showDialog({
			title: '键盘快捷键',
			icon: 'question-circle',
			message: lines,
			showCancelButton: false,
			confirmText: '知道了'
		});
	}
}

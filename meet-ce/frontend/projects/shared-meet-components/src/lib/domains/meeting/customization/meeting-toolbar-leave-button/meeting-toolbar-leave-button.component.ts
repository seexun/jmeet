import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { LoggerService, OpenViduService } from '../../openvidu-components';
import { MeetingContextService } from '../../services/meeting-context.service';
import { MeetingService } from '../../services/meeting.service';
import { NotificationService } from '../../../../shared/services/notification.service';

/**
 * Reusable component for meeting toolbar Leave button.
 */
@Component({
	selector: 'ov-meeting-toolbar-leave-button',
	templateUrl: './meeting-toolbar-leave-button.component.html',
	styleUrls: ['./meeting-toolbar-leave-button.component.scss'],
	imports: [NzIconModule, NzDropDownModule, NzTooltipModule, TranslatePipe, NzMenuModule],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class MeetingToolbarLeaveButtonComponent {
	protected meetingContextService = inject(MeetingContextService);
	protected meetingService = inject(MeetingService);
	private readonly notificationService = inject(NotificationService);
	protected openviduService = inject(OpenViduService);
	protected loggerService = inject(LoggerService);
	protected log = this.loggerService.get('JMeet - MeetingToolbarLeaveButtons');

	showLeaveMenu = computed(() => this.meetingContextService.meetingUI().showEndMeeting);
	isMobile = this.meetingContextService.isMobile;

	async onLeaveMeetingClick(): Promise<void> {
		if (!this.meetingContextService.isPrimaryHost() || this.meetingContextService.isAlone()) {
			await this.openviduService.disconnectRoom();
			return;
		}

		const target = this.meetingContextService.remoteParticipants()[0];
		if (!target) return;
		this.notificationService.showDialog({
			title: '移交主持人后离开？',
			icon: 'switch_account',
			message: `会议中还有其他成员。系统将把主持人移交给 ${target.name}，移交成功后您再离开会议。`,
			confirmText: '移交并离开',
			cancelText: '暂不离开',
			confirmCallback: () => void this.transferAndLeave(target.identity)
		});
	}

	private async transferAndLeave(targetIdentity: string): Promise<void> {
		const roomId = this.meetingContextService.roomId();
		if (!roomId) return;
		try {
			await this.meetingService.prepareHostLeave(roomId, targetIdentity);
			this.meetingContextService.setPrimaryHostIdentity(targetIdentity);
			await this.openviduService.disconnectRoom();
		} catch (error) {
			this.log.e('Cannot transfer host before leaving:', error);
			this.notificationService.showSnackbar('主持人移交失败，您仍在会议中');
		}
	}

	onEndMeetingClick(): void {
		this.notificationService.showDialog({
			title: '为所有人结束会议？',
			icon: 'no_meeting_room',
			message: '会议将立即结束，所有参会成员都会离开，且无法撤销此操作。',
			confirmText: '结束会议',
			cancelText: '取消',
			confirmDanger: true,
			showWarningBox: true,
			warningTitle: '请确认会议已完成',
			warningMessage: '如需暂时离开但保留会议，请选择“离开会议”。',
			warningIcon: 'info',
			confirmCallback: () => void this.endMeetingForEveryone()
		});
	}

	private async endMeetingForEveryone(): Promise<void> {
		const roomId = this.meetingContextService.roomId();
		if (!roomId) {
			this.log.e('Cannot end meeting: room ID is undefined');
			return;
		}

		this.meetingContextService.setMeetingEndedBy('self');
		await this.meetingService.endMeeting(roomId);
	}
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzIconTypePipe } from '../../../../shared/pipes/nz-icon-type.pipe';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { TranslateService } from '../../../../shared/services/i18n/translate.service';
import { NotificationService } from '../../../../shared/services/notification.service';
import { MeetingLobbyService } from '../../services/meeting-lobby.service';

/**
 * Reusable component for the meeting lobby page.
 * Displays the form to join the meeting.
 */
@Component({
	selector: 'ov-meeting-lobby',
	templateUrl: './meeting-lobby.component.html',
	styleUrls: ['./meeting-lobby.component.scss'],
	imports: [
		FormsModule,
		ReactiveFormsModule,
		NzIconModule, NzIconTypePipe,
		NzTooltipModule,
		TranslatePipe
	],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class MeetingLobbyComponent {
	protected lobbyService = inject(MeetingLobbyService);
	protected notificationService = inject(NotificationService);
	protected translateService = inject(TranslateService);

	protected roomName = this.lobbyService.roomName;
	protected roomSchedule = this.lobbyService.roomSchedule;
	protected roomClosed = this.lobbyService.roomClosed;
	protected canJoinMeeting = this.lobbyService.canJoinMeeting;
	protected isE2EEEnabled = this.lobbyService.hasRoomE2EEEnabled;

	protected participantForm = this.lobbyService.participantForm;
	protected showE2EEKeyInput = this.lobbyService.showE2EEKeyInput;

	protected showShareLink = this.lobbyService.showShareLink;
	protected roomAccessUrl = this.lobbyService.roomAccessUrl;
	protected showBackButton = this.lobbyService.showBackButton;
	protected backButtonText = this.lobbyService.backButtonText;

	async onFormSubmit(): Promise<void> {
		await this.lobbyService.submitAccess();
	}

	async onBackClick(): Promise<void> {
		await this.lobbyService.goBack();
	}

	/**
	 * Copies the invite link. Success feedback (snackbar) is owned by RoomAccessLinkService —
	 * the same toast the participants-panel invite button shows; failure surfaces an error toast here.
	 */
	async onCopyLinkClick(): Promise<void> {
		const copied = await this.lobbyService.copyRoomAccessLink();
		if (!copied) {
			this.notificationService.showSnackbar(this.translateService.translate('LOBBY.COPY_INVITE_FAILED'), 3000, 'error');
		}
	}
}

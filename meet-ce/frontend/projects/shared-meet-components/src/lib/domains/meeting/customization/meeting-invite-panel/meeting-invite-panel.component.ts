import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ShareRoomAccessLinkComponent } from '../../components/share-room-access-link/share-room-access-link.component';
import { RoomAccessLinkService } from '../../services/room-access-link.service';
import { MeetingContextService } from '../../services/meeting-context.service';

/**
 * Reusable component for displaying the share room access link panel
 * inside the participants panel.
 */
@Component({
	selector: 'ov-meeting-invite-panel',
	templateUrl: './meeting-invite-panel.component.html',
	styleUrls: ['./meeting-invite-panel.component.scss'],
	imports: [ShareRoomAccessLinkComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class MeetingInvitePanelComponent {
	protected meetingContextService = inject(MeetingContextService);
	protected roomAccessLinkService = inject(RoomAccessLinkService);

	showShareLink = computed(() => this.meetingContextService.meetingUI().showShareAccessLinks);
	roomAccessUrl = this.roomAccessLinkService.speakerPublicLink;

	onCopyClicked(): void {
		this.roomAccessLinkService.copyRoomAccessLink();
	}
}

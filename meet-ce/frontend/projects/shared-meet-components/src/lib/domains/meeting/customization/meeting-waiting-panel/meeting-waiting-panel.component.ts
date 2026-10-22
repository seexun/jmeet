import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

/**
 * Panel shown while the local participant is alone in the meeting.
 *
 * Used in webcomponent mode in place of the share/copy link UI
 * (MeetingInvitePanelComponent / share link overlay), where sharing the meeting
 * link is handled by the host application rather than by Meet itself. The copy
 * is configurable so it can be tailored per context (participants panel list vs.
 * the main layout overlay).
 */
@Component({
	selector: 'ov-meeting-waiting-panel',
	templateUrl: './meeting-waiting-panel.component.html',
	styleUrls: ['./meeting-waiting-panel.component.scss'],
	imports: [TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class MeetingWaitingPanelComponent {
	title = input<string>();
	subtitle = input<string>();
}

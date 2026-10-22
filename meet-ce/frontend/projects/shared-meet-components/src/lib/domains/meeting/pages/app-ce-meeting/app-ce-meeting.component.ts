import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MeetingCustomLayoutComponent } from '../../customization/meeting-custom-layout/meeting-custom-layout.component';
import { MeetingInvitePanelComponent } from '../../customization/meeting-invite-panel/meeting-invite-panel.component';
import { MeetingParticipantItemComponent } from '../../customization/meeting-participant-item/meeting-participant-item.component';
import { MeetingSettingsExtensionsComponent } from '../../customization/meeting-settings-extensions/meeting-settings-extensions.component';
import { MeetingToolbarExtraButtonsComponent } from '../../customization/meeting-toolbar-extra-buttons/meeting-toolbar-extra-buttons.component';
import { MeetingToolbarLeaveButtonComponent } from '../../customization/meeting-toolbar-leave-button/meeting-toolbar-leave-button.component';
import { MeetingParticipantsPanelComponent } from '../../customization/meeting-participants-panel/meeting-participants-panel.component';
import { MeetingWaitingPanelComponent } from '../../customization/meeting-waiting-panel/meeting-waiting-panel.component';
import { MeetingComponent } from '../meeting/meeting.component';

@Component({
	selector: 'app-ce-ov-meeting',
	imports: [
		MeetingComponent,
		MeetingToolbarLeaveButtonComponent,
		MeetingToolbarExtraButtonsComponent,
		MeetingInvitePanelComponent,
		MeetingWaitingPanelComponent,
		MeetingParticipantItemComponent,
		MeetingCustomLayoutComponent,
		MeetingSettingsExtensionsComponent
	],
	template: `
		<ov-meeting>
			<ov-meeting-toolbar-leave-button />
			<ov-meeting-toolbar-extra-buttons />
			<ov-meeting-invite-panel />
			<ov-meeting-waiting-panel />
			<ov-meeting-participant-item />
			<ov-meeting-settings-extensions />
			<ov-meeting-custom-layout />
		</ov-meeting>
	`,
	styles: '',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppCeMeetingComponent {}

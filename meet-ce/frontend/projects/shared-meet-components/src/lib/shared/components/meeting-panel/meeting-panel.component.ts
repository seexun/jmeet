import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../../domains/meeting/openvidu-components/pipes/translate.pipe';

@Component({
	selector: 'jmeet-meeting-panel',
	imports: [TranslatePipe],
	templateUrl: './meeting-panel.component.html',
	styleUrl: './meeting-panel.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class JmeetMeetingPanelComponent {
	title = input<string | undefined>();
	closed = output<void>();
}

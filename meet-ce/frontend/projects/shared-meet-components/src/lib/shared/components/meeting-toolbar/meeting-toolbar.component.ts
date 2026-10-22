import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
	selector: 'jmeet-meeting-toolbar',
	templateUrl: './meeting-toolbar.component.html',
	styleUrl: './meeting-toolbar.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class JmeetMeetingToolbarComponent {}

import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
	selector: 'jmeet-meeting-shell',
	templateUrl: './meeting-shell.component.html',
	styleUrl: './meeting-shell.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class JmeetMeetingShellComponent {}

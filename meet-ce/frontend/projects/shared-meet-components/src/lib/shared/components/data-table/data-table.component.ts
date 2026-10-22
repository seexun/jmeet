import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
	selector: 'jmeet-data-table',
	templateUrl: './data-table.component.html',
	styleUrl: './data-table.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class JmeetDataTableComponent {}

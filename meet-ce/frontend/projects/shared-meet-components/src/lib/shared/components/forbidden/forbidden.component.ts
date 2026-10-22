import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { RouterLink } from '@angular/router';

@Component({
	selector: 'ov-forbidden',
	imports: [NzIconModule, RouterLink],
	templateUrl: './forbidden.component.html',
	styleUrl: './forbidden.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ForbiddenComponent {}

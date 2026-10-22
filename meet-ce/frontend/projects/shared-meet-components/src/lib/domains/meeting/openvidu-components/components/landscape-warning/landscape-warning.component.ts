import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { TranslatePipe } from '../../pipes/translate.pipe';

/**
 * Component to display a landscape orientation warning on mobile devices.
 * @internal
 */
@Component({
	selector: 'ov-landscape-warning',
	imports: [NzIconModule, TranslatePipe],
	templateUrl: './landscape-warning.component.html',
	styleUrl: './landscape-warning.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true
})
export class LandscapeWarningComponent {}

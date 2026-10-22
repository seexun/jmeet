import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
    selector: 'ov-share-room-access-link',
    imports: [ NzIconModule, NzTooltipModule, TranslatePipe],
    templateUrl: './share-room-access-link.component.html',
    styleUrl: './share-room-access-link.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShareRoomAccessLinkComponent {
	roomAccessUrl = input.required<string>();
	// Undefined by default so the template can resolve the localized fallback reactively via the
	// translate pipe (an imperative translate() here would capture the language loaded at construction
	// and never react to lazy locale loads or language switches).
	title = input<string>();
	titleSize = input<'sm' | 'md' | 'lg' | 'xl'>('sm');
	titleWeight = input<'light' | 'semibold' | 'bold' | 'normal'>('normal');
	subtitle = input<string | undefined>(undefined);
	additionalInfo = input<string | undefined>(undefined);
	showLink = input(true);
	showStatus = input(true);
	copyClicked = output<void>();
}

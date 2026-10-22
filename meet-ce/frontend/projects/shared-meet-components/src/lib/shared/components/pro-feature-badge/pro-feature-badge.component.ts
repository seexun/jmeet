import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzIconTypePipe } from '../../pipes/nz-icon-type.pipe';

@Component({
    selector: 'ov-pro-feature-badge',
    imports: [NzIconTypePipe, NzIconModule],
    templateUrl: './pro-feature-badge.component.html',
    styleUrl: './pro-feature-badge.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProFeatureBadgeComponent {
    badgeIcon = input<string>('crown'); // Default icon
    badgeText = input<string>('Pro Feature'); // Default text
}

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzIconTypePipe } from '../../pipes/nz-icon-type.pipe';

export type StatCardTone = 'neutral' | 'success' | 'warning' | 'danger';

@Component({
	selector: 'jmeet-stat-card',
	imports: [NzIconTypePipe, NzIconModule],
	templateUrl: './stat-card.component.html',
	styleUrl: './stat-card.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { '[class]': '"tone-" + tone()' }
})
export class JmeetStatCardComponent {
	readonly label = input.required<string>();
	readonly value = input.required<string | number>();
	readonly icon = input<string>('');
	/** 语义色：指标带状态含义时用（danger=异常、warning=告警、success=良好），默认中性蓝 */
	readonly tone = input<StatCardTone>('neutral');
}

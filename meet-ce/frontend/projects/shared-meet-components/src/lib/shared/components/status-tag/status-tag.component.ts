import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzIconTypePipe } from '../../pipes/nz-icon-type.pipe';

/**
 * 状态标签（标准 §17）：浅色底 + 深色文字，24px 高、6px 圆角、12px 字号。
 *
 * 五种语义变体（success/processing/warning/error/default），
 * 颜色映射统一在 styles/components/_tags.scss，禁止页面自行改色。
 *
 * 用法：<jmeet-status-tag label="进行中" variant="processing" [icon]="'play_circle'" />
 * 注意：状态不能只靠颜色表达（§33），必要时配合 icon 或文字。
 */


export type JmeetStatusTagVariant = 'success' | 'processing' | 'warning' | 'error' | 'default';

@Component({
	selector: 'jmeet-status-tag',
	imports: [NzIconTypePipe, NzIconModule],
	templateUrl: './status-tag.component.html',
	styleUrl: './status-tag.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class JmeetStatusTagComponent {
/** 标签文案（通常接 translate 管道）。 */
	label = input.required<string>();
/** 语义变体，决定浅底深字的配色组合。 */
	variant = input<JmeetStatusTagVariant>('default');
	/** Optional leading Material icon name (standard §33: status must not rely on color alone). */
	icon = input<string | undefined>();
	/** 前置圆点（取 variant 文字色，currentcolor 自动跟随）。 */
	showDot = input(false, { transform: booleanAttribute });
}

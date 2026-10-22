import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';

/**
 * 行内提示图标：感叹号 + tooltip。
 *
 * 用于替代页面上直接平铺的说明文字（表单行/小节的次要描述）——把长提示
 * 收进 tooltip，标题/标签旁只保留一个不喧宾夺主的图标。取值方传入纯文本
 * （通常是 `translate` 管道的输出），悬停/聚焦展示完整内容。
 */
@Component({
	selector: 'jmeet-hint-tooltip',
	standalone: true,
	imports: [NzIconModule, NzTooltipModule],
	template: `
		<span
			class="jmeet-hint-tooltip"
			tabindex="0"
			role="note"
			[attr.aria-label]="text()"
			nz-tooltip
			[nzTooltipTitle]="text()"
			nzTooltipPlacement="top"
			[nzTooltipMouseEnterDelay]="0.15"
		>
			<nz-icon nzType="exclamation-circle" />
		</span>
	`,
	styles: `
		:host {
			display: inline-flex;
			vertical-align: middle;
			margin-inline-start: 6px;
		}

		.jmeet-hint-tooltip {
			display: inline-flex;
			align-items: center;
			color: var(--jmeet-color-text-tertiary);
			cursor: help;
			transition: color 160ms ease;
		}

		.jmeet-hint-tooltip:hover,
		.jmeet-hint-tooltip:focus-visible {
			color: var(--jmeet-color-text-secondary);
		}

		.jmeet-hint-tooltip:focus-visible {
			outline: 2px solid var(--jmeet-color-action-primary);
			outline-offset: 2px;
			border-radius: 2px;
		}

		.jmeet-hint-tooltip nz-icon {
			font-size: 14px;
			width: 14px;
			height: 14px;
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class JmeetHintTooltipComponent {
	/** 提示全文（通常为 translate 管道输出）。 */
	readonly text = input.required<string>();
}

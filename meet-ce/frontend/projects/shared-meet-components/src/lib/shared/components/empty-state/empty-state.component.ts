import { booleanAttribute, ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * 空状态（标准 §23）：图标 + 标题 + 描述 + 可选动作按钮。
 *
 * 两档尺寸：
 *  - 默认：页面级空态（大内边距、居中）；
 *  - compact：面板/分节内嵌空态（小尺寸、弱化图标底色）。
 *
 * 图标通过 empty-icon 插槽注入；主要动作用 [actionLabel] + (action)，
 * 附加动作按钮用 empty-actions 插槽。
 *
 * 用法：
 * <jmeet-empty-state compact [title]="..." [actionLabel]="..." (action)="go()">
 *   <nz-icon nzType="inbox" empty-icon />
 * </jmeet-empty-state>
 */

import { NzIconModule } from 'ng-zorro-antd/icon';

@Component({
	selector: 'jmeet-empty-state',
	imports: [NzIconModule],
	templateUrl: './empty-state.component.html',
	styleUrl: './empty-state.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class JmeetEmptyStateComponent {
	/** 空态标题：说明「为什么为空」（§23 要求）。 */
	title = input.required<string>();
	/** 补充说明：告知用户下一步该做什么。 */
	description = input<string | undefined>();
	/** 紧凑模式：分节/表格内的小型空态。 */
	compact = input(false, { transform: booleanAttribute });
	/** 主动作文案；设置后组件渲染主色按钮并触发 action 事件。 */
	actionLabel = input<string | undefined>();
	/** 主动作点击事件。 */
	action = output<void>();
}

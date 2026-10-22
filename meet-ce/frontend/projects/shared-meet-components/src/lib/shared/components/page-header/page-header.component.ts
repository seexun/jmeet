import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

/**
 * 页面页头（页头出卡，规格 §3.2）：标题簇（22px/800 主标题 + 统计 meta 副行）
 * 与右侧动作区同一行，下缘 1px divider，与内容区间距 16px。
 *
 * 每个页面保留唯一 H1，嵌套的选项卡页使用 level="2"。
 * 内容通过内容投影插槽注入：
 *   <span page-title>标题</span>
 *   [description]="描述文案"（或 <div page-description> 统计 meta/自定义节点，作标题副行）
 *   <div page-actions>右侧按钮/标签</div>
 *
 * 结构样式归 layout/_page.scss：出卡节奏用宿主元素后代选择器锚定组件实例，
 * .jmeet-page-header 系列类同时被若干页面用作独立分区头（不经组件），语义保持不变。
 */


@Component({
	selector: 'jmeet-page-header',
	imports: [NgTemplateOutlet],
	templateUrl: './page-header.component.html',
	styleUrl: './page-header.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class JmeetPageHeaderComponent {
	/** Nested tab pages use a section heading beneath the shell's page title. */
	level = input<1 | 2>(1);
	/** 一行式描述文案；如需富文本/多行，请改用 page-description 插槽。 */
	description = input<string | undefined>();
}

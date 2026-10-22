import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * 筛选条容器（标准 §20，批次2 同面工具条形态）：搜索/筛选控件经 ng-content 投影
 * 到单行工具行（.jmeet-filter-bar__tools），底部 1px 分隔与下方表格相连；
 * 白面由外层列表卡供给。
 *
 * 只负责布局与间距，筛选控件通过 ng-content 投影；
 * 子项使用 .jmeet-filter-field 获得统一的标签-控件纵向结构。
 * Reset 行为、高级筛选折叠由各页面自行实现。
 */


@Component({
	selector: 'jmeet-filter-bar',
	templateUrl: './filter-bar.component.html',
	styleUrl: './filter-bar.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class JmeetFilterBarComponent {}

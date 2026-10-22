import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * 加载骨架（标准 §24）：列表/卡片优先用骨架而非全屏 Spinner。
 *
 * 三种变体：
 *  - list：多行文字条（默认 4 行）
 *  - card：120px 高的卡片块
 *  - stat：4 列指标块（配合 jmeet-kpi-row）
 *
 * 无障碍：根节点自带 role="status" + aria-live="polite"。
 * 用法：<jmeet-loading-skeleton variant="list" [rows]="6" />
 */


@Component({
	selector: 'jmeet-loading-skeleton',
	templateUrl: './loading-skeleton.component.html',
	styleUrl: './loading-skeleton.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class JmeetLoadingSkeletonComponent {
	/** 骨架形态，对应三种典型占位结构。 */
	variant = input<'list' | 'card' | 'stat'>('list');
	/** 行/块数量（stat 变体固定 4 列网格，rows 决定块数）。 */
	rows = input(4);
	protected readonly lines = computed(() => Array.from({ length: this.rows() }, (_, index) => index));
}

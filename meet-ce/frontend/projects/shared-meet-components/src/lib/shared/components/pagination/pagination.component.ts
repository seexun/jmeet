import { booleanAttribute, ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { TranslatePipe } from '../../pipes/translate.pipe';

/**
 * 分页条（nz-pagination 封装）：总条数 · 每页条数 · 页码（带省略号）· 跳页。
 * 对外 API 与旧自研实现保持一致：pageIndex 零起始，pageChange 输出 { pageIndex, pageSize }。
 */
@Component({
	selector: 'jmeet-pagination',
	imports: [NzPaginationModule, TranslatePipe],
	templateUrl: './pagination.component.html',
	styleUrl: './pagination.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class JmeetPaginationComponent {
	length = input.required<number>();
	/** 零起始页码。 */
	pageIndex = input.required<number>();
	pageSize = input.required<number>();
	pageSizeOptions = input<number[]>([10, 20, 50]);
	disabled = input(false, { transform: booleanAttribute });

	pageChange = output<{ pageIndex: number; pageSize: number }>();

	protected onPageIndexChange(oneBasedPage: number): void {
		this.pageChange.emit({ pageIndex: oneBasedPage - 1, pageSize: this.pageSize() });
	}

	// 与旧实现语义一致：切换每页条数后回到第一页。
	protected onPageSizeChange(size: number): void {
		if (size !== this.pageSize()) {
			this.pageChange.emit({ pageIndex: 0, pageSize: size });
		}
	}
}

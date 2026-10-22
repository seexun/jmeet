import { Component, input } from '@angular/core';
import { ChangeDetectionStrategy } from '@angular/core';

/** 面包屑项：label 必填；route 或 action 二选一决定点击行为。 */
export interface BreadcrumbItem {
	label: string;
	route?: string;
	action?: () => void | Promise<void>;
}

/**
 * Reusable breadcrumb navigation component.
 *
 * Features:
 * - Display hierarchical navigation path
 * - Support for route-based or action-based navigation
 * - Responsive design
 * - Consistent styling with design tokens
 *
 * @example
 * ```html
 * <ov-breadcrumb [items]="breadcrumbItems"></ov-breadcrumb>
 * ```
 *
 * @example
 * ```typescript
 * breadcrumbItems: BreadcrumbItem[] = [
 *   { label: 'Home', route: '/home' },
 *   { label: 'Users', action: () => this.navigateToUsers() },
 *   { label: 'John Doe' }
 * ];
 * ```
 */
@Component({
	selector: 'ov-breadcrumb',
	templateUrl: './breadcrumb.component.html',
	styleUrl: './breadcrumb.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class BreadcrumbComponent {
	/**
	 * Array of breadcrumb items to display.
	 * The last item is automatically treated as the current page (non-clickable).
	 */
	/** 面包屑数组；最后一项自动渲染为不可点的当前页。 */
	items = input.required<BreadcrumbItem[]>();

	/**
	 * Checks if an item is the last item in the breadcrumb
	 */
	isLastItem(index: number): boolean {
		return index === this.items().length - 1;
	}

	/**
	 * Handles click on a breadcrumb item
	 */
	async onItemClick(item: BreadcrumbItem): Promise<void> {
		if (item.action) {
			await item.action();
		}
	}
}

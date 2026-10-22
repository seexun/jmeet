import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzIconTypePipe } from '../../pipes/nz-icon-type.pipe';
import { ProFeatureBadgeComponent } from '../pro-feature-badge/pro-feature-badge.component';

/**
 * Interface for selectable card option data
 */
export interface SelectableCardOption {
	id: string;
	title: string;
	description: string;
	icon?: string;
	imageUrl?: string; // Optional image URL for visual layouts
	recommended?: boolean;
	isPro?: boolean;
	disabled?: boolean;
	badge?: string;
}

/**
 * Event emitted when an option is selected
 */
export interface SelectionCardEvent {
	optionId: string;
	option: SelectableCardOption;
	previousSelection?: string | string[];
}

@Component({
    selector: 'ov-selectable-card',
	imports: [NgClass, NzIconModule, NzIconTypePipe, ProFeatureBadgeComponent],
    templateUrl: './selectable-card.component.html',
    styleUrl: './selectable-card.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelectableCardComponent {
	/**
	 * The option data to display in the card
	 */
	option = input.required<SelectableCardOption>();

	/**
	 * Currently selected value(s)
	 * Can be a string (single select) or string[] (multi select)
	 */
	selectedValue = input<string | string[] | undefined>(undefined);

	/**
	 * Whether multiple options can be selected simultaneously
	 * @default false
	 */
	allowMultiSelect = input(false);

	/**
	 * Whether to show the selection indicator (radio button)
	 * @default true
	 */
	showSelectionIndicator = input(true);

	/**
	 * Whether to show the PRO badge for premium features
	 * @default true
	 */
	showProBadge = input(true);

	/**
	 * Custom icon for the PRO badge
	 * @default 'crown'
	 */
	proBadgeIcon = input('crown');

	/**
	 * Custom text for the PRO badge
	 * @default 'PRO'
	 */
	proBadgeText = input('PRO');

	/**
	 * Whether to show the recommended badge
	 * @default true
	 */
	showRecommendedBadge = input(true);

	/**
	 * Whether to show image instead of icon (when imageUrl is provided)
	 * @default false
	 */
	showImage = input(false);

	/**
	 * Whether to show both image and icon (when both are provided)
	 * @default false
	 */
	showImageAndIcon = input(false);

	/**
	 * Image aspect ratio for layout control
	 * @default '16/9'
	 */
	imageAspectRatio = input('16/9');

	/**
	 * Whether the card should show hover effects.
	 *
	 * 现实语义（遗留清扫·快赢⑧核对）：本 input 当前唯一作用是门控 `cardHover` output
	 * 的发射——卡片 hover 视觉由 scss `:hover` 承担，不受本 input 控制；docstring 原文
	 * "show hover effects" 失真，按事实修正。有真实消费方（room-wizard recording-trigger
	 * 传 `!option.disabled`），保留不移除。
	 *
	 * @default true
	 */
	enableHover = input(true);

	/**
	 * Whether the card should show selection animations
	 * @default true
	 */
	enableAnimations = input(true);

	/**
	 * Custom CSS classes to apply to the card
	 */
	customClasses = input('');

	/**
	 * Event emitted when an option is selected
	 */
	optionSelected = output<SelectionCardEvent>();

	/**
	 * Event emitted when the card is hovered.
	 *
	 * @deprecated 遗留清扫·快赢⑧留档：全库零消费（模板与 TS 均无绑定）。不删除的原因：
	 * 删除 output 须连带拆除 `onMouseEnter/onMouseLeave` 两处发射与模板 mouseenter/
	 * mouseleave 绑定，会使仍被 recording-trigger 消费的 `enableHover` input 沦为空转
	 * （波及其语义）——按控制者裁定保留并标注 deprecated；若未来确认无 hover 事件诉求，
	 * 应将 output、两处发射、模板绑定与 enableHover 一并移除。
	 */
	cardHover = output<{ option: SelectableCardOption; isHovering: boolean }>();

	/**
	 * Check if the current option is selected
	 */
	isOptionSelected(optionId: string): boolean {
		const selectedValue = this.selectedValue();
		if (!selectedValue) {
			return false;
		}

		if (Array.isArray(selectedValue)) {
			return selectedValue.includes(optionId);
		}

		return selectedValue === optionId;
	}

	/**
	 * Handle option selection click
	 */
	onOptionSelect(optionId: string): void {
		const option = this.option();
		// Don't allow selection if option is disabled
		if (option.disabled) {
			return;
		}

		const wasSelected = this.isOptionSelected(optionId);
		if (!this.allowMultiSelect() && wasSelected) {
			return; // No change if already selected
		}

		// Emit selection event
		const selectionEvent: SelectionCardEvent = {
			optionId,
			option,
			previousSelection: this.selectedValue()
		};
		this.optionSelected.emit(selectionEvent);
	}

	/**
	 * Handle mouse enter event
	 */
	onMouseEnter(): void {
		if (this.enableHover()) {
			this.cardHover.emit({ option: this.option(), isHovering: true });
		}
	}

	/**
	 * Handle mouse leave event
	 */
	onMouseLeave(): void {
		if (this.enableHover()) {
			this.cardHover.emit({ option: this.option(), isHovering: false });
		}
	}

	/**
	 * Get dynamic CSS classes for the card
	 */
	getCardClasses(): string {
		const option = this.option();
		const classes = ['option-card'];

		if (this.isOptionSelected(option.id)) {
			classes.push('selected');
		}
		if (option.recommended && this.showRecommendedBadge()) {
			classes.push('recommended');
		}
		if (option.isPro && this.showProBadge()) {
			classes.push('pro-feature');
		}
		if (option.disabled) {
			classes.push('disabled');
		}
		if (!this.enableAnimations()) {
			classes.push('no-animations');
		}
		if (this.customClasses()) {
			classes.push(this.customClasses());
		}

		return classes.join(' ');
	}

	/**
	 * Get the selection icon based on current state
	 */
	getSelectionIcon(): string {
		const option = this.option();
		if (this.allowMultiSelect()) {
			return this.isOptionSelected(option.id) ? 'check_box' : 'check_box_outline_blank';
		} else {
			return this.isOptionSelected(option.id) ? 'radio_button_checked' : 'radio_button_unchecked';
		}
	}

	/**
	 * Get aria-label for accessibility
	 */
	getAriaLabel(): string {
		const option = this.option();
		const baseLabel = `${option.title}. ${option.description}`;
		const statusParts = [];

		if (option.recommended) {
			statusParts.push('Recommended');
		}
		if (option.isPro) {
			statusParts.push('PRO feature');
		}
		if (option.disabled) {
			statusParts.push('Disabled');
		}
		if (this.isOptionSelected(option.id)) {
			statusParts.push('Selected');
		}

		const statusLabel = statusParts.length > 0 ? `. ${statusParts.join(', ')}` : '';
		return `${baseLabel}${statusLabel}`;
	}

	/**
	 * Check if should show image
	 */
	shouldShowImage(): boolean {
		const option = this.option();
		return this.showImage() && !!option.imageUrl;
	}

	/**
	 * Check if should show icon
	 */
	shouldShowIcon(): boolean {
		const option = this.option();
		if (this.showImageAndIcon()) {
			return !!option.icon;
		}
		return !this.shouldShowImage() && !!option.icon;
	}
}

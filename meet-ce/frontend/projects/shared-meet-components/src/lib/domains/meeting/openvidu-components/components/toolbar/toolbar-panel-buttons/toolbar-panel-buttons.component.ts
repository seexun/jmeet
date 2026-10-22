import { CommonModule } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	ElementRef,
	TemplateRef,
	afterNextRender,
	computed,
	inject,
	input,
	output,
	signal
} from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { ViewportService } from '../../../services/viewport/viewport.service';

@Component({
	selector: 'ov-toolbar-panel-buttons',
	imports: [CommonModule, NzIconModule, NzBadgeModule, NzDropDownModule, NzTooltipModule, TranslatePipe, NzMenuModule],
	templateUrl: './toolbar-panel-buttons.component.html',
	styleUrl: './toolbar-panel-buttons.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true
})
export class ToolbarPanelButtonsComponent {
	// Signal inputs from toolbar
	isConnectionLost = input<boolean>(false);
	isActivitiesOpened = input<boolean>(false);
	isParticipantsOpened = input<boolean>(false);
	isChatOpened = input<boolean>(false);
	unreadMessages = input<number>(0);
	showActivitiesPanelButton = input<boolean>(true);
	showParticipantsPanelButton = input<boolean>(true);
	showChatPanelButton = input<boolean>(true);
	recordingStatus = input<any>();
	toolbarAdditionalPanelButtonsTemplate = input<TemplateRef<any> | undefined>();
	totalParticipants = input<number>(0);

	/** Open state of the collapsed panels dropdown (drives the chevron rotation). */
	panelsMenuOpen = false;

	// Signal outputs back to toolbar
	toggleActivitiesPanel = output<string | undefined>();
	toggleParticipantsPanel = output<void>();
	toggleChatPanel = output<void>();

	// Computed signals
	visibleButtonsCount = computed(() => {
		let count = 0;
		if (this.showActivitiesPanelButton()) count++;
		if (this.showParticipantsPanelButton()) count++;
		if (this.showChatPanelButton()) count++;
		return count;
	});

	isAnyPanelOpened = computed(() => {
		return this.isActivitiesOpened() || this.isParticipantsOpened() || this.isChatOpened();
	});

	readonly viewportService = inject(ViewportService);

	// Observe the meeting, rather than the browser, for embedded toolbars.
	private readonly containerWidth = signal<number | null>(null);
	// 启用实时字幕等动作会触发容器重排/重测；实测中一次瞬时误报（如 0 或
	// 骤变值）会让 shouldShowCollapsed 抖动，进而整组按钮短暂消失。加防抖：
	// 连续两次采样一致才应用，且首帧前保持上一次状态。
	private readonly collapsedDebounce = signal<number | null>(null);
	readonly shouldShowCollapsed = computed(() => {
		const width = this.collapsedDebounce();
		return width === null ? this.viewportService.isMobileView() : width <= 768;
	});

	constructor() {
		const element = inject(ElementRef<HTMLElement>);
		const destroyRef = inject(DestroyRef);
		afterNextRender(() => {
			const container = element.nativeElement.closest('#vc-container');
			if (!container) return;
			const observer = new ResizeObserver(([entry]) => {
				const width = Math.round(entry.contentRect.width);
				const previous = this.collapsedDebounce();
				// 忽略无效样本与亚像素抖动；连续同值才提交，吸收单帧竞态
				if (width <= 0) return;
				if (previous !== null && Math.abs(previous - width) < 2) return;
				this.containerWidth.set(width);
				this.collapsedDebounce.set(width);
			});
			observer.observe(container);
			destroyRef.onDestroy(() => observer.disconnect());
		});
	}

	// Local methods that emit events
	// nzDisabled 只负责置灰，模板绑定的 (click) 仍会触发，断连时按同一条件拦截
	onToggleActivities(expand?: string) {
		if (this.isConnectionLost()) return;
		this.toggleActivitiesPanel.emit(expand);
	}

	onToggleParticipants() {
		if (this.isConnectionLost()) return;
		this.toggleParticipantsPanel.emit();
	}

	onToggleChat() {
		if (this.isConnectionLost()) return;
		this.toggleChatPanel.emit();
	}
}

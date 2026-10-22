import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, Signal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzIconTypePipe } from '../../../../../../shared/pipes/nz-icon-type.pipe';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { BackgroundCategory, BackgroundEffect, EffectType } from '../../../models/background-effect.model';
import { PanelType } from '../../../models/panel.model';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { PanelService } from '../../../services/panel/panel.service';
import { VirtualBackgroundService } from '../../../services/virtual-background/virtual-background.service';

/**
 * @internal
 */
@Component({
	selector: 'ov-background-effects-panel',
	imports: [CommonModule, FormsModule, NzIconTypePipe, NzIconModule, NzTooltipModule, TranslatePipe],
	templateUrl: './background-effects-panel.component.html',
	styleUrls: ['../panel.component.scss', './background-effects-panel.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true
})
export class BackgroundEffectsPanelComponent implements OnInit {
	mode = input<'prejoin' | 'meeting'>('meeting');
	onClose = output<void>();

	/**
	 * @internal
	 * @param panelService
	 * @param backgroundService
	 * @param cd
	 */
	private panelService = inject(PanelService);
	private backgroundService = inject(VirtualBackgroundService);

	readonly backgroundSelectedId = this.backgroundService.backgroundIdSelected;
	readonly customBackgrounds = this.backgroundService.customBackgrounds;
	readonly uploadPending = signal(false);
	effectType = EffectType;
	noEffectAndBlurredBackground: BackgroundEffect[] = [];
	/**
	 * Background images grouped by category, in the order they are displayed in the panel.
	 * Categories with no images are filtered out.
	 */
	imageCategories: { category: BackgroundCategory; titleKey: string; images: BackgroundEffect[] }[] = [];
	private backgrounds: BackgroundEffect[] = [];

	private readonly categoryTitleKeys: Record<BackgroundCategory, string> = {
		[BackgroundCategory.PROFESSIONAL]: 'PANEL.BACKGROUND.CATEGORY_PROFESSIONAL',
		[BackgroundCategory.HOME_OFFICE]: 'PANEL.BACKGROUND.CATEGORY_HOME_OFFICE',
		[BackgroundCategory.CREATIVE]: 'PANEL.BACKGROUND.CATEGORY_CREATIVE',
		[BackgroundCategory.CUSTOM]: 'PANEL.BACKGROUND.CATEGORY_CUSTOM'
	};

	/**
	 * Computed signal that reactively tracks if virtual background is supported.
	 * Updates automatically when browser support changes.
	 */
	readonly isVirtualBackgroundSupported: Signal<boolean> = computed(() =>
		this.backgroundService.isVirtualBackgroundSupported()
	);

	ngOnInit(): void {
		this.backgrounds = this.backgroundService.getBackgrounds();
		this.noEffectAndBlurredBackground = this.backgrounds.filter((f) => f.type === EffectType.BLUR || f.type === EffectType.NONE);

		// 自定义分组实时跟随上传/删除,不随组件初始化定格
		this.imageCategories = [
			...(Object.keys(this.categoryTitleKeys) as BackgroundCategory[])
				.filter((category) => category !== BackgroundCategory.CUSTOM)
				.map((category) => ({
					category,
					titleKey: this.categoryTitleKeys[category],
					images: this.backgrounds.filter((img) => img.category === category)
				}))
		].filter((group) => group.images.length > 0);
	}

	close() {
		if (this.mode() === 'prejoin') {
			this.onClose.emit();
		} else {
			this.panelService.togglePanel(PanelType.BACKGROUND_EFFECTS);
		}
	}

	async applyBackground(effect: BackgroundEffect) {
		await this.backgroundService.applyBackground(effect);
	}

	async onCustomBackgroundSelected(event: Event): Promise<void> {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		this.uploadPending.set(true);
		try {
			const effect = await this.backgroundService.addCustomBackground(file);
			await this.applyBackground(effect);
		} catch (error) {
			console.warn('Failed to add custom background:', error);
		} finally {
			this.uploadPending.set(false);
		}
	}

	async removeCustomBackground(event: Event, id: string): Promise<void> {
		event.stopPropagation();
		await this.backgroundService.removeCustomBackground(id);
	}
}

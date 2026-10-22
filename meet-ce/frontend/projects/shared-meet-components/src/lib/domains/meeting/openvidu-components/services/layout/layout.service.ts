import { effect, inject, Injectable } from '@angular/core';
import { LayoutAlignment, LayoutClass, OpenViduLayout, OpenViduLayoutOptions } from '../../models/layout/layout.model';
import { ILogger } from '../../models/logger.model';
import { LoggerService } from '../logger/logger.service';
import { ViewportService } from '../viewport/viewport.service';

/**
 * @internal
 */
@Injectable({
	providedIn: 'root'
})
export class BaseLayoutService {
	private readonly viewportSrv = inject(ViewportService);

	layoutContainer: HTMLElement | undefined = undefined;
	protected openviduLayout: OpenViduLayout | undefined;
	protected openviduLayoutOptions!: OpenViduLayoutOptions;
	protected log: ILogger = inject(LoggerService).get('BaseLayoutService');

	private _layoutUpdateEffect = effect(() => {
		// Setup reactive viewport listener
		const viewportInfo = this.viewportSrv.viewportInfo();
		const isMobile = this.viewportSrv.isMobile();
		const orientation = this.viewportSrv.orientation();
		this.updateLayoutOptions();
	});

	constructor() {
		this.openviduLayoutOptions = this.getOptions();
	}

	initialize(container: HTMLElement) {
		this.layoutContainer = container;
		this.openviduLayout = new OpenViduLayout();
		this.openviduLayoutOptions = this.getOptions();
		if (this.layoutContainer) {
			this.openviduLayout.initLayoutContainer(this.layoutContainer, this.openviduLayoutOptions);
		}
	}

	update() {
		if (!this.openviduLayout || !this.layoutContainer) return;
		this.openviduLayoutOptions = this.getOptions();
		this.openviduLayout.updateLayout(this.layoutContainer, this.openviduLayoutOptions);
	}

	updateResponsive() {
		this.updateLayoutOptions();
	}

	getLayout() {
		return this.openviduLayout;
	}

	clear() {
		this.openviduLayout?.destroy();
		this.openviduLayout = undefined;
	}

	/**
	 * Get layout options adjusted to the current viewport
	 * @returns Layout options adjusted to the current viewport
	 */
	protected getOptions(): OpenViduLayoutOptions {
		const ratios = this.getResponsiveRatios();
		const percentages = this.getResponsivePercentages();

		return {
			maxRatio: ratios.maxRatio,
			minRatio: ratios.minRatio,
			fixedRatio: false,
			bigClass: LayoutClass.BIG_ELEMENT,
			smallClass: LayoutClass.SMALL_ELEMENT,
			ignoredClass: LayoutClass.IGNORED_ELEMENT,
			bigPercentage: percentages.bigPercentage,
			minBigPercentage: percentages.minBigPercentage,
			bigFixedRatio: false,
			bigMaxRatio: ratios.bigMaxRatio,
			bigMinRatio: ratios.bigMinRatio,
			bigFirst: true,
			animate: true,
			alignItems: LayoutAlignment.CENTER,
			bigAlignItems: LayoutAlignment.CENTER,
			smallAlignItems: LayoutAlignment.CENTER,
			maxWidth: Infinity,
			maxHeight: Infinity,
			smallMaxWidth: Infinity,
			smallMaxHeight: 80,
			bigMaxWidth: Infinity,
			bigMaxHeight: Infinity,
			scaleLastRow: true,
			bigScaleLastRow: true
		};
	}

	protected getResponsiveRatios() {
		const isMobile = this.viewportSrv.isMobile();
		const isTablet = this.viewportSrv.isTablet();
		const isPortrait = this.viewportSrv.isPortrait();

		if (isMobile && isPortrait) {
			return {
				maxRatio: 5 / 4,
				minRatio: 4 / 5,
				bigMaxRatio: 5 / 4,
				bigMinRatio: 3 / 4
			};
		}

		if (isMobile) {
			return {
				maxRatio: 16 / 9,
				minRatio: 3 / 4,
				bigMaxRatio: 16 / 9,
				bigMinRatio: 4 / 3
			};
		}

		if (isTablet && isPortrait) {
			return {
				maxRatio: 4 / 3,
				minRatio: 3 / 5,
				bigMaxRatio: 4 / 3,
				bigMinRatio: 9 / 16
			};
		}

		if (isTablet) {
			return {
				maxRatio: 16 / 9,
				minRatio: 2 / 3,
				bigMaxRatio: 16 / 9,
				bigMinRatio: 9 / 16
			};
		}

		return {
			maxRatio: 16 / 9,
			minRatio: 9 / 16,
			bigMaxRatio: 16 / 9,
			bigMinRatio: 9 / 16
		};
	}

	protected getResponsivePercentages() {
		const isMobile = this.viewportSrv.isMobile();
		const isTablet = this.viewportSrv.isTablet();
		const isPortrait = this.viewportSrv.isPortrait();

		if (isMobile && isPortrait) {
			return {
				bigPercentage: 0.85,
				minBigPercentage: 0.7
			};
		}

		if (isMobile) {
			return {
				bigPercentage: 0.82,
				minBigPercentage: 0.65
			};
		}

		if (isTablet && isPortrait) {
			return {
				bigPercentage: 0.83,
				minBigPercentage: 0.6
			};
		}

		if (isTablet) {
			return {
				bigPercentage: 0.81,
				minBigPercentage: 0.55
			};
		}

		return {
			bigPercentage: 0.8,
			minBigPercentage: 0.5
		};
	}

	protected updateLayoutOptions(): void {
		const newOptions = this.getOptions();

		if (this.hasSignificantChanges(this.openviduLayoutOptions, newOptions)) {
			this.openviduLayoutOptions = newOptions;

			if (this.openviduLayout && this.layoutContainer) {
				this.openviduLayout.updateLayout(this.layoutContainer, this.openviduLayoutOptions);
			}
		}
	}

	protected hasSignificantChanges(oldOptions: OpenViduLayoutOptions, newOptions: OpenViduLayoutOptions): boolean {
		if (!oldOptions) return true;

		const significantProps: (keyof OpenViduLayoutOptions)[] = [
			'maxRatio',
			'minRatio',
			'bigMaxRatio',
			'bigMinRatio',
			'bigPercentage',
			'alignItems',
			'bigAlignItems'
		];

		return significantProps.some(
			(prop) =>
				Math.abs((oldOptions[prop] as number) - (newOptions[prop] as number)) > 0.01 ||
				oldOptions[prop] !== newOptions[prop]
		);
	}
}

// Re-export all public types and constants for backward compatibility
export { LAYOUT_CONSTANTS, LayoutAlignment, LayoutClass, SidenavMode } from './layout-types.model';
export type {
	BestDimensions,
	BigFirstOption,
	ElementDimensions,
	ExtendedLayoutOptions,
	LayoutArea,
	LayoutBox,
	LayoutRow,
	OpenViduLayoutOptions
} from './layout-types.model';

import { LayoutCalculator } from './layout-calculator.model';
import { LayoutDimensionsCache } from './layout-dimensions-cache.model';
import { elementHeight, elementWidth, readStyle, readStyleNumber } from './layout-dom.util';
import { LayoutRenderer } from './layout-renderer.model';
import { ElementDimensions, ExtendedLayoutOptions, LAYOUT_CONSTANTS, LayoutClass, OpenViduLayoutOptions } from './layout-types.model';

/**
 * OpenViduLayout orchestrates layout calculation and rendering.
 * Maintains backward compatibility with existing API while delegating to specialized classes.
 *
 * @internal
 */
export class OpenViduLayout {
	private layoutContainer!: HTMLElement;
	private opts!: OpenViduLayoutOptions;

	private dimensionsCache: LayoutDimensionsCache;
	private calculator: LayoutCalculator;
	private renderer: LayoutRenderer;

	/**
	 * Pending animation-frame handle. Coalesces bursts of updateLayout calls (resize, mutation,
	 * sidenav animation, signal-driven re-renders) into a single layout pass per frame.
	 */
	private pendingFrame: number | null = null;

	constructor() {
		this.dimensionsCache = new LayoutDimensionsCache();
		this.calculator = new LayoutCalculator(this.dimensionsCache);
		this.renderer = new LayoutRenderer();
	}

	updateLayout(container: HTMLElement, opts: OpenViduLayoutOptions): void {
		this.layoutContainer = container;
		this.opts = opts;
		this.scheduleLayout();
	}

	initLayoutContainer(container: HTMLElement, opts: OpenViduLayoutOptions): void {
		this.updateLayout(container, opts);
	}

	getLayoutContainer(): HTMLElement {
		return this.layoutContainer;
	}

	clearCache(): void {
		this.dimensionsCache.clear();
	}

	/**
	 * Cancel any pending layout pass. Safe to call multiple times.
	 */
	destroy(): void {
		if (this.pendingFrame !== null) {
			cancelAnimationFrame(this.pendingFrame);
			this.pendingFrame = null;
		}
		this.dimensionsCache.clear();
	}

	/**
	 * Schedules the actual layout for the next animation frame. By the time the rAF callback
	 * fires the browser has computed style and layout for any synchronous DOM mutations, so
	 * `offsetWidth`/`offsetHeight` reads are accurate — replacing the prior 50ms guess.
	 */
	private scheduleLayout(): void {
		if (this.pendingFrame !== null) return;
		this.pendingFrame = requestAnimationFrame(() => {
			this.pendingFrame = null;
			this.applyLayout();
		});
	}

	private applyLayout(): void {
		if (!this.layoutContainer) return;
		if (readStyle(this.layoutContainer, 'display') === 'none') return;

		if (!this.layoutContainer.id) {
			this.layoutContainer.id = `OV_${this.cheapUUID()}`;
		}

		const containerWidth =
			elementWidth(this.layoutContainer) -
			readStyleNumber(this.layoutContainer, 'border-left') -
			readStyleNumber(this.layoutContainer, 'border-right');
		const containerHeight =
			elementHeight(this.layoutContainer) -
			readStyleNumber(this.layoutContainer, 'border-top') -
			readStyleNumber(this.layoutContainer, 'border-bottom');

		// If the container hasn't been laid out yet (e.g. just attached and still display:none on
		// an ancestor), skip silently — the next caller will re-schedule once it has size.
		if (containerWidth <= 0 || containerHeight <= 0) return;

		const extendedOpts: ExtendedLayoutOptions = { ...this.opts, containerWidth, containerHeight };
		const selector = `#${this.layoutContainer.id}>*:not(.${LayoutClass.IGNORED_ELEMENT}):not(.${LayoutClass.FLOATING_ELEMENT})`;
		const children = Array.from(this.layoutContainer.querySelectorAll<HTMLElement>(selector));
		const elements = children.map((element) => this.describeElement(element));

		const layout = this.calculator.calculateLayout(extendedOpts, elements);
		this.renderer.renderLayout(this.layoutContainer, layout.boxes, children, this.opts.animate);
	}

	private describeElement(element: HTMLElement): ElementDimensions {
		const dims = this.getChildDims(element);
		dims.big = element.classList.contains(this.opts.bigClass);
		dims.small = element.classList.contains(LayoutClass.SMALL_ELEMENT);
		dims.topBar = element.classList.contains(LayoutClass.TOP_BAR_ELEMENT);
		return dims;
	}

	private getChildDims(child: HTMLElement): ElementDimensions {
		const video =
			child instanceof HTMLVideoElement
				? child
				: (child.querySelector('video') as HTMLVideoElement | null);

		if (video && video.videoHeight && video.videoWidth) {
			return { height: video.videoHeight, width: video.videoWidth };
		}
		return {
			height: LAYOUT_CONSTANTS.DEFAULT_VIDEO_HEIGHT,
			width: LAYOUT_CONSTANTS.DEFAULT_VIDEO_WIDTH
		};
	}

	private cheapUUID(): string {
		if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
			return crypto.randomUUID();
		}
		return Math.floor(Math.random() * 100000000).toString();
	}
}

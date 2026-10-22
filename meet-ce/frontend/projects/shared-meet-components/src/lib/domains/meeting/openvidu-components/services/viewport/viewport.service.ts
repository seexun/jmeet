import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { DeviceOrientation, ViewportInfo, ViewportSize } from '../../models/viewport.model';
import { PlatformService } from '../platform/platform.service';

/**
 * Service for responsive viewport detection and device type identification.
 * Provides reactive signals and utilities for building responsive interfaces.
 * @internal
 */
@Injectable({
	providedIn: 'root'
})
export class ViewportService {
	// Design system breakpoints
	private readonly BREAKPOINTS = {
		mobile: 480,
		tablet: 768,
		desktop: 1024,
		wide: 1200
	} as const;

	// Reactive signals
	private readonly _width = signal(this.getCurrentWidth());
	private readonly _height = signal(this.getCurrentHeight());

	// Cleanup
	private readonly destroyRef = inject(DestroyRef);
	private readonly platform = inject(PlatformService);

	constructor() {
		this.initializeResizeListener();
	}

	/**
	 * Current viewport size category
	 */
	readonly viewportSize = computed<ViewportSize>(() => {
		const width = this._width();
		if (width >= this.BREAKPOINTS.wide) return 'wide';
		if (width >= this.BREAKPOINTS.desktop) return 'desktop';
		if (width >= this.BREAKPOINTS.tablet) return 'tablet';
		return 'mobile';
	});

	/**
	 * Device orientation (computed)
	 */
	readonly orientation = computed<DeviceOrientation>(() => {
		return this._width() > this._height() ? 'landscape' : 'portrait';
	});

	/**
	 * Whether current viewport is mobile size (legacy method)
	 * For landscape warnings, use isPhysicalMobile instead
	 */
	readonly isMobile = computed(() => this.viewportSize() === 'mobile' && this.platform.isTouchDevice());

	/**
	 * Whether current viewport is tablet size
	 */
	readonly isTablet = computed(() => this.viewportSize() === 'tablet' && this.platform.isTouchDevice());

	/**
	 * Whether device should show mobile landscape warning
	 * This is orientation-independent and hardware-based detection
	 */
	readonly shouldShowLandscapeWarning = computed(() =>
		this.platform.isPhysicalMobileDevice() && this.orientation() === 'landscape'
	);

	/**
	 * Whether current viewport is desktop size
	 */
	readonly isDesktop = computed(() => this.viewportSize() === 'desktop');

	/**
	 * Whether current viewport is wide desktop size
	 */
	readonly isWide = computed(() => this.viewportSize() === 'wide');

	/**
	 * Whether current viewport is mobile or smaller
	 */
	readonly isMobileView = computed(() => this._width() < this.BREAKPOINTS.tablet);

	/**
	 * Whether current viewport is tablet or smaller
	 */
	readonly isTabletDown = computed(() => this._width() < this.BREAKPOINTS.desktop);


	/**
	 * Complete viewport information
	 */
	readonly viewportInfo = computed<ViewportInfo>(() => ({
		width: this._width(),
		height: this._height(),
		size: this.viewportSize(),
		orientation: this.orientation(),
		isMobile: this.isMobile(),
		isTablet: this.isTablet(),
		isDesktop: this.isDesktop(),
		isWide: this.isWide(),
		isTouchDevice: this.platform.isTouchDevice(),
		isPhysicalMobile: this.platform.isPhysicalMobileDevice(),
		isPhysicalTablet: this.platform.isPhysicalTablet(),
		shouldShowLandscapeWarning: this.shouldShowLandscapeWarning()
	}));

	/**
	 * Check if device is in portrait mode
	 */
	isPortrait(): boolean {
		return this.orientation() === 'portrait';
	}

	// ==== PRIVATE METHODS ====

	private getCurrentWidth(): number {
		return typeof window !== 'undefined' ? window.innerWidth : 1024;
	}

	private getCurrentHeight(): number {
		return typeof window !== 'undefined' ? window.innerHeight : 768;
	}

	private initializeResizeListener(): void {
		if (typeof window === 'undefined') return;

		fromEvent(window, 'resize')
			.pipe(
				debounceTime(150), // Debounce for performance
				distinctUntilChanged(),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe(() => {
				this._width.set(this.getCurrentWidth());
				this._height.set(this.getCurrentHeight());
			});
	}
}

import { afterNextRender, Directive, ElementRef, inject, input, NgZone } from '@angular/core';

/**
 * Persists and restores the scroll position of the element it is placed on.
 *
 * The console list pages scroll their own `.ov-page-container` element, which lives
 * inside the routed component. Because that element is torn down with the component,
 * its `scrollTop` cannot be read in `ngOnDestroy`. This directive instead tracks the
 * scroll position continuously (via a passive listener attached outside Angular, so
 * it does not trigger change detection) and exposes the last value through
 * {@link scrollTop}, which the host component reads when caching its state.
 *
 * On creation it restores the position passed via the `ovScrollPersist` input.
 *
 * Usage:
 * ```html
 * <div class="ov-page-container" [ovScrollPersist]="scrollToRestore">…</div>
 * ```
 * ```ts
 * private readonly scroller = viewChild(ScrollPersistDirective);
 * // save:    this.scroller()?.scrollTop ?? 0
 * // restore: set `scrollToRestore` before the element renders
 * ```
 */
@Directive({
	selector: '[ovScrollPersist]'
})
export class ScrollPersistDirective {
	private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
	private readonly ngZone = inject(NgZone);

	/** Scroll position to restore once the element is rendered (0 = none). */
	readonly restoreTo = input(0, { alias: 'ovScrollPersist' });

	private lastScrollTop = 0;

	/** The most recent scroll position; safe to read during `ngOnDestroy`. */
	get scrollTop(): number {
		return this.lastScrollTop;
	}

	constructor() {
		afterNextRender(() => {
			const element = this.elementRef.nativeElement;
			this.lastScrollTop = element.scrollTop;

			// Track scroll outside Angular to avoid change detection on every scroll event.
			this.ngZone.runOutsideAngular(() => {
				element.addEventListener('scroll', () => (this.lastScrollTop = element.scrollTop), {
					passive: true
				});
			});

			// Restore the cached position after the content (e.g. table rows) has laid out.
			const target = this.restoreTo();
			if (target > 0) {
				requestAnimationFrame(() => {
					element.scrollTop = target;
					this.lastScrollTop = element.scrollTop;
				});
			}
		});
	}
}

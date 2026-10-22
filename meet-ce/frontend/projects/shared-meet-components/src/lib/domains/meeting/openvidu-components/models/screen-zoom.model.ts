import { Signal, signal } from '@angular/core';

/** Pan offset expressed as a fraction in [-1, 1] of the maximum pannable distance on each axis. */
export interface ScreenZoomPan {
	x: number;
	y: number;
}

/**
 * Per-viewer zoom/pan state for a single screen-share stream.
 *
 * This is a framework-light, DOM-agnostic state holder: it owns the zoom level and a
 * **normalized** pan offset (each axis a fraction in [-1, 1] of the maximum pannable
 * distance at the current zoom). It deliberately knows nothing about pixels or the
 * rendered element size — the view layer maps the normalized pan to pixels. Keeping all
 * zoom rules (bounds, step, pan clamping) in this one place follows the Single
 * Responsibility Principle and lets components depend on a small, stable abstraction
 * rather than re-implementing the mechanics.
 *
 * Zoom is purely local view state (like Google Meet): it never mutates the participant's
 * tracks nor triggers a layout recomputation, so it lives outside the participant
 * revision counter and carries its own reactivity via signals.
 */
export class ScreenZoomState {
	/** Minimum zoom factor (no zoom). */
	static readonly MIN_LEVEL = 1;
	/** Maximum zoom factor. */
	static readonly MAX_LEVEL = 3;
	/** Increment applied by a single zoom-in/zoom-out action. */
	static readonly LEVEL_STEP = 0.25;

	private readonly _level = signal(ScreenZoomState.MIN_LEVEL);
	private readonly _pan = signal<ScreenZoomPan>({ x: 0, y: 0 });

	/** Current zoom factor (>= {@link MIN_LEVEL}). */
	readonly level: Signal<number> = this._level.asReadonly();
	/** Current normalized pan offset; each axis in [-1, 1]. */
	readonly pan: Signal<ScreenZoomPan> = this._pan.asReadonly();

	/** Whether the stream is currently zoomed past 1x. */
	get isZoomed(): boolean {
		return this._level() > ScreenZoomState.MIN_LEVEL;
	}

	/** Whether the zoom can still be increased. */
	get canZoomIn(): boolean {
		return this._level() < ScreenZoomState.MAX_LEVEL;
	}

	/** Whether the zoom can still be decreased. */
	get canZoomOut(): boolean {
		return this._level() > ScreenZoomState.MIN_LEVEL;
	}

	/** Increases the zoom by one step, capped at {@link MAX_LEVEL}. */
	zoomIn(): void {
		this.setLevel(this._level() + ScreenZoomState.LEVEL_STEP);
	}

	/** Decreases the zoom by one step, floored at {@link MIN_LEVEL}. */
	zoomOut(): void {
		this.setLevel(this._level() - ScreenZoomState.LEVEL_STEP);
	}

	/** Resets the zoom back to 1x and recenters the pan. */
	reset(): void {
		this.setLevel(ScreenZoomState.MIN_LEVEL);
	}

	/**
	 * Sets the normalized pan offset, clamping each axis to [-1, 1] so the scaled video
	 * always covers its container. Recenters when the stream is not zoomed.
	 */
	setPan(x: number, y: number): void {
		if (!this.isZoomed) {
			this._pan.set({ x: 0, y: 0 });
			return;
		}
		this._pan.set({ x: ScreenZoomState.clampAxis(x), y: ScreenZoomState.clampAxis(y) });
	}

	private setLevel(level: number): void {
		const clamped = Math.min(ScreenZoomState.MAX_LEVEL, Math.max(ScreenZoomState.MIN_LEVEL, level));
		this._level.set(clamped);
		// Recenter once fully zoomed out — there is nothing to pan at 1x.
		if (clamped === ScreenZoomState.MIN_LEVEL) {
			this._pan.set({ x: 0, y: 0 });
		}
	}

	private static clampAxis(value: number): number {
		return Math.min(1, Math.max(-1, value));
	}
}

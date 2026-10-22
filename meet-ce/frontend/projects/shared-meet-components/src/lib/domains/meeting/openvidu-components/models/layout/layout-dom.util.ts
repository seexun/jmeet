/**
 * Small DOM helpers shared by the layout calculator and renderer.
 * Kept as plain functions so they can be tree-shaken and reused without instantiating a class.
 *
 * @internal
 */

export function readStyle(el: HTMLElement, prop: string): string {
	const value = window.getComputedStyle(el).getPropertyValue(prop);
	return value !== '' ? value : (el.style as Record<string, any>)[prop] ?? '';
}

export function readStyleNumber(el: HTMLElement, prop: string): number {
	const raw = readStyle(el, prop);
	return raw ? parseInt(raw, 10) : 0;
}

export function writeStyle(el: HTMLElement, prop: string, value: string): void {
	(el.style as Record<string, any>)[prop] = value;
}

export function writeStyles(el: HTMLElement, styles: Record<string, string>): void {
	const target = el.style as Record<string, any>;
	for (const key in styles) {
		target[key] = styles[key];
	}
}

export function elementWidth(el: HTMLElement): number {
	const { offsetWidth } = el;
	return offsetWidth > 0 ? offsetWidth : readStyleNumber(el, 'width');
}

export function elementHeight(el: HTMLElement): number {
	const { offsetHeight } = el;
	return offsetHeight > 0 ? offsetHeight : readStyleNumber(el, 'height');
}

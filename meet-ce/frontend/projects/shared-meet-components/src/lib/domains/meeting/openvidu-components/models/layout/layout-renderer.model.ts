import { writeStyles } from './layout-dom.util';
import { LAYOUT_CONSTANTS, LayoutBox, LayoutClass } from './layout-types.model';

interface ElementPosition extends Record<string, string> {
	left: string;
	top: string;
	width: string;
	height: string;
}

const BOX_PROPS = [
	'margin-left',
	'margin-right',
	'margin-top',
	'margin-bottom',
	'padding-left',
	'padding-right',
	'padding-top',
	'padding-bottom',
	'border-left',
	'border-right',
	'border-top',
	'border-bottom'
] as const;

/**
 * Handles DOM manipulation and rendering for layout elements.
 *
 * @internal
 */
export class LayoutRenderer {
	renderLayout(container: HTMLElement, boxes: LayoutBox[], elements: HTMLElement[], animate: boolean): void {
		boxes.forEach((box, idx) => {
			const elem = elements[idx];
			if (!elem) return;

			elem.style.position = 'absolute';

			const actual = this.calculateActualDimensions(elem, box);
			this.positionElement(elem, box.left, box.top, actual.width, actual.height, animate);
		});
	}

	/**
	 * Subtract margin, padding and border from the box so the element renders inside `box`.
	 * Reads computed style once per element to avoid repeated getComputedStyle calls.
	 */
	private calculateActualDimensions(elem: HTMLElement, box: LayoutBox): { width: number; height: number } {
		const cs = window.getComputedStyle(elem);
		const px = (prop: string): number => parseInt(cs.getPropertyValue(prop), 10) || 0;
		const includesPaddingAndBorder = cs.getPropertyValue('box-sizing') === 'border-box';

		// Cache reads so the same computed value isn't pulled twice.
		const m: Record<string, number> = {};
		for (const p of BOX_PROPS) m[p] = px(p);

		const inset = includesPaddingAndBorder
			? { x: 0, y: 0 }
			: {
					x: m['padding-left'] + m['padding-right'] + m['border-left'] + m['border-right'],
					y: m['padding-top'] + m['padding-bottom'] + m['border-top'] + m['border-bottom']
			  };

		return {
			width: box.width - m['margin-left'] - m['margin-right'] - inset.x,
			height: box.height - m['margin-top'] - m['margin-bottom'] - inset.y
		};
	}

	private positionElement(
		elem: HTMLElement,
		x: number,
		y: number,
		width: number,
		height: number,
		animate: boolean
	): void {
		const targetPosition: ElementPosition = {
			left: `${x}px`,
			top: `${y}px`,
			width: `${width}px`,
			height: `${height}px`
		};

		if (animate) {
			setTimeout(() => {
				this.animateElement(elem, targetPosition);
				this.fixAspectRatio(elem, width);
			}, 10);
		} else {
			writeStyles(elem, targetPosition);
			elem.classList.add(LayoutClass.CLASS_NAME);
		}

		this.fixAspectRatio(elem, width);
	}

	private animateElement(elem: HTMLElement, targetPosition: ElementPosition): void {
		elem.style.transition = `all ${LAYOUT_CONSTANTS.ANIMATION_DURATION} ${LAYOUT_CONSTANTS.ANIMATION_EASING}`;
		writeStyles(elem, targetPosition);
	}

	/**
	 * Force the publisher/subscriber's mutation observer to re-run by toggling width on
	 * the inner .OV_root element.
	 */
	private fixAspectRatio(elem: HTMLElement, width: number): void {
		const sub = elem.querySelector<HTMLElement>('.OV_root');
		if (!sub) return;
		const oldWidth = sub.style.width;
		sub.style.width = `${width}px`;
		sub.style.width = oldWidth || '';
	}
}

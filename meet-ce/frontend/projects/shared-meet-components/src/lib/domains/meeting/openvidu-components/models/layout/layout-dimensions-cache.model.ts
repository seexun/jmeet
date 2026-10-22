import { BestDimensions } from './layout-types.model';

const DEFAULT_MAX_ENTRIES = 256;

/**
 * Memoizes layout dimension calculations to avoid recomputing the same layout repeatedly.
 * Bounded with an LRU policy so long sessions or aggressive resizing don't grow the map unbounded.
 *
 * @internal
 */
export class LayoutDimensionsCache {
	private cache = new Map<string, BestDimensions>();

	constructor(private readonly maxEntries: number = DEFAULT_MAX_ENTRIES) {}

	get(key: string): BestDimensions | undefined {
		const value = this.cache.get(key);
		if (value !== undefined) {
			// Move to most-recently-used position by reinserting.
			this.cache.delete(key);
			this.cache.set(key, value);
		}
		return value;
	}

	set(key: string, value: BestDimensions): void {
		if (this.cache.has(key)) {
			this.cache.delete(key);
		} else if (this.cache.size >= this.maxEntries) {
			// Map preserves insertion order — first key is the least-recently-used.
			const oldest = this.cache.keys().next().value;
			if (oldest !== undefined) {
				this.cache.delete(oldest);
			}
		}
		this.cache.set(key, value);
	}

	clear(): void {
		this.cache.clear();
	}

	size(): number {
		return this.cache.size;
	}

	has(key: string): boolean {
		return this.cache.has(key);
	}

	static generateKey(
		minRatio: number,
		maxRatio: number,
		width: number,
		height: number,
		count: number,
		maxWidth: number,
		maxHeight: number
	): string {
		return `${minRatio}_${maxRatio}_${width}_${height}_${count}_${maxWidth}_${maxHeight}`;
	}
}

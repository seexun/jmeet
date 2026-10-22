import { Injectable } from '@angular/core';

/**
 * In-memory cache of list-page UI state, used to restore filters, sort, loaded
 * pages (token pagination) and scroll position when the user navigates from a
 * list to a detail page and back.
 *
 * Unlike a RouteReuseStrategy, the components are still destroyed and recreated
 * normally (so Angular Material views render correctly); only their state is
 * preserved here and re-applied on init.
 *
 * Keys are route-like paths: 'rooms', 'recordings', 'users', and per-room detail
 * state under 'rooms/<roomId>'. {@link invalidate} clears a key and anything
 * nested under it, so `invalidate('rooms')` also drops cached `rooms/<roomId>`.
 */
@Injectable({
	providedIn: 'root'
})
export class ListStateCacheService {
	private readonly cache = new Map<string, unknown>();

	get<T>(key: string): T | undefined {
		return this.cache.get(key) as T | undefined;
	}

	set<T>(key: string, state: T): void {
		this.cache.set(key, state);
	}

	/** Removes the entry for `key` and any entries nested under `key/`. */
	invalidate(key: string): void {
		for (const existing of [...this.cache.keys()]) {
			if (existing === key || existing.startsWith(`${key}/`)) {
				this.cache.delete(existing);
			}
		}
	}

	/** Clears every cached entry (e.g. on logout). */
	clearAll(): void {
		this.cache.clear();
	}
}

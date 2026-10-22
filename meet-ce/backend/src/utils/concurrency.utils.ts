import { PromisePool } from '@supercharge/promise-pool';
import { INTERNAL_CONFIG } from '../config/internal-config.js';

export interface RunConcurrentlyOptions {
	concurrency?: number;
	failFast: true;
}

export interface RunConcurrentlySettledOptions {
	concurrency?: number;
	failFast?: false;
}

/**
 * Executes async tasks with bounded concurrency.
 *
 * The function supports two modes:
 * - `failFast: true` (Promise.all-like): rejects on the first error and returns `R[]` on success.
 * - `failFast: false` or omitted (Promise.allSettled-like): never throws and returns
 *   `PromiseSettledResult<R>[]`, preserving one result per input item.
 *
 * @typeParam T - Type of each input item.
 * @typeParam R - Type returned by the worker function when fulfilled.
 * @param items - Source items to process.
 * @param workerFn - Async worker invoked as `(item, index)` for each source item.
 * @param options - Concurrency and mode configuration.
 * @param options.concurrency - Maximum parallel tasks (defaults to `INTERNAL_CONFIG.DEFAULT_CONCURRENCY`).
 * @param options.failFast - Mode selector. Use `true` for fail-fast semantics.
 * @returns `Promise<R[]>` in fail-fast mode, otherwise `Promise<PromiseSettledResult<R>[]>`.
 *
 * @example
 * // Promise.all-like: throws if any task fails
 * const users = await runConcurrently(userIds, (id) => getUser(id), {
 *   concurrency: 20,
 *   failFast: true
 * });
 *
 * @example
 * // Promise.allSettled-like: never throws, each item has fulfilled/rejected status
 * const settled = await runConcurrently(userIds, (id) => getUser(id), {
 *   concurrency: 20
 * });
 */
export function runConcurrently<T, R>(
	items: T[],
	workerFn: (item: T, index: number) => Promise<R>,
	options: RunConcurrentlyOptions
): Promise<R[]>;

export function runConcurrently<T, R>(
	items: T[],
	workerFn: (item: T, index: number) => Promise<R>,
	options?: RunConcurrentlySettledOptions
): Promise<PromiseSettledResult<R>[]>;

export async function runConcurrently<T, R>(
	items: T[],
	workerFn: (item: T, index: number) => Promise<R>,
	options: RunConcurrentlyOptions | RunConcurrentlySettledOptions = {}
): Promise<R[] | PromiseSettledResult<R>[]> {
	const { concurrency = INTERNAL_CONFIG.DEFAULT_CONCURRENCY, failFast = false } = options;

	if (items.length === 0) {
		return [];
	}

	if (failFast) {
		const { results } = await PromisePool.for(items)
			.withConcurrency(concurrency)
			.useCorrespondingResults()
			.handleError(async (error) => {
				throw error;
			})
			.process(workerFn);

		return results;
	}

	const { results } = await PromisePool.for(items)
		.withConcurrency(concurrency)
		.useCorrespondingResults()
		.process(async (item, index) => {
			try {
				const value = await workerFn(item, index);
				return { status: 'fulfilled', value } as PromiseFulfilledResult<R>;
			} catch (reason) {
				return { status: 'rejected', reason } as PromiseRejectedResult;
			}
		});

	return results as PromiseSettledResult<R>[];
}

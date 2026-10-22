/**
 * Common sorting and pagination options for list responses.
 */
export interface SortAndPagination<TSortField extends string = string> {
	/**
	 * Maximum number of items to include in the current page.
	 */
	maxItems?: number;
	/**
	 * Token used to request the next page of results.
	 */
	nextPageToken?: string;
	/**
	 * Field name used to sort the result list.
	 */
	sortField?: TSortField;
	/**
	 * Sorting direction applied to the result list. See {@link SortOrder} for details.
	 */
	sortOrder?: SortOrder;
}

/**
 * Supported sorting directions for list responses.
 */
export enum SortOrder {
	/**
	 * Sorts results in ascending order.
	 */
	ASC = 'asc',
	/**
	 * Sorts results in descending order.
	 */
	DESC = 'desc'
}

/**
 * Scalar values that can be safely used for sorting.
 */
export type SortableValue = string | number | boolean | null | undefined;

/**
 * Keys of T whose values are sortable scalar types.
 */
export type SortableFieldKey<T> = {
	[K in keyof T]: T[K] extends SortableValue ? K : never;
}[keyof T];

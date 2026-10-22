/**
 * Type for fields that exist only in the persistence document and not in the domain model.
 */
export type DocumentOnlyField<TDocument extends TDomain, TDomain> = Exclude<keyof TDocument, keyof TDomain>;

/**
 * Result of a paginated find operation.
 */
export interface PaginatedResult<T> {
	items: T[];
	isTruncated: boolean;
	nextPageToken?: string;
}

/**
 * Pagination cursor structure.
 */
export interface PaginationCursor {
	fieldValue: unknown;
	id: string;
}

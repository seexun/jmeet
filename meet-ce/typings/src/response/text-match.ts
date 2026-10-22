/**
 * Generic string matching modes for text-based filters.
 */
export enum TextMatchMode {
	/** Match values exactly (default) */
	EXACT = 'exact',
	/** Match values that start with the provided text */
	PREFIX = 'prefix',
	/** Match values that contain the provided text */
	PARTIAL = 'partial',
	/** Match values using a regular expression */
	REGEX = 'regex'
}

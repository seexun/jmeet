/**
 * Splits an array into smaller arrays (chunks) of a specified size.
 *
 * @template T - The type of elements in the array
 * @param array - The array to be split into chunks
 * @param size - The maximum size of each chunk
 * @returns An array of arrays, where each sub-array contains at most `size` elements
 *
 * @example
 * ```typescript
 * const numbers = [1, 2, 3, 4, 5, 6, 7];
 * const chunks = chunkArray(numbers, 3);
 * // Result: [[1, 2, 3], [4, 5, 6], [7]]
 * ```
 */
export const chunkArray = <T>(array: T[], size: number): T[][] => {
	const chunks: T[][] = [];

	for (let i = 0; i < array.length; i += size) {
		chunks.push(array.slice(i, i + size));
	}

	return chunks;
};

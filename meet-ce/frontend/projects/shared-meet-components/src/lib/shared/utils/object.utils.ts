type PlainObject = Record<string, unknown>;

export const isPlainObject = (value: unknown): value is PlainObject => {
	if (value === null || typeof value !== 'object') return false;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
};

/**
 * Recursively merges own enumerable properties of `source` into `target`,
 * mutating and returning `target`. Mirrors the subset of `lodash.merge`
 * semantics relied on across the app: plain objects are merged deeply (and
 * cloned when absent from the target), `undefined` source values are ignored,
 * and any other value (primitives, arrays, Date, …) overwrites the target value.
 */
export const deepMerge = <T>(target: T, source: unknown): T => {
	if (!isPlainObject(source)) return target;
	const out = (isPlainObject(target) ? target : {}) as PlainObject;
	for (const key of Object.keys(source)) {
		const sourceValue = source[key];
		if (sourceValue === undefined) continue;
		if (isPlainObject(sourceValue)) {
			out[key] = deepMerge(isPlainObject(out[key]) ? out[key] : {}, sourceValue);
		} else {
			out[key] = sourceValue;
		}
	}
	return out as T;
};

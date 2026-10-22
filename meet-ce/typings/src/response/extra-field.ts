/**
 * Utility type to extract keys of T that are objects, used to define which fields can be extraFields.
 */
export type ExtraFieldKey<T> = {
	[K in keyof T]: T[K] extends object ? K : never;
}[keyof T];

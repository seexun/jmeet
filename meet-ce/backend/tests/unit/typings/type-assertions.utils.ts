/**
 * Returns the set of union members that are missing in the provided readonly array.
 */
export type MissingUnionMembers<TUnion, TArray extends readonly TUnion[]> = Exclude<TUnion, TArray[number]>;

/**
 * Compile-time assertion that a readonly array fully covers a union.
 * If members are missing, TypeScript includes them in the error type.
 */
export type AssertReadonlyArrayCoversUnion<TUnion, TArray extends readonly TUnion[]> =
	MissingUnionMembers<TUnion, TArray> extends never
		? true
		: ['Missing union members', MissingUnionMembers<TUnion, TArray>];

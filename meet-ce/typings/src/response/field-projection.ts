/**
 * Resolves the projected shape of an entity based on selected fields.
 *
 * - `undefined` fields means full entity.
 * - Tuple fields (for example `['status', 'owner']`) produce an exact Pick.
 * - Dynamic arrays (for example `MeetRoomField[]`) produce a Partial Pick
 *   because compile-time cannot know which specific fields are included.
 */
export type ProjectedEntityByFields<
	TEntity,
	TFields extends readonly (keyof TEntity)[] | undefined
> = TFields extends readonly (keyof TEntity)[]
	? number extends TFields['length']
		? Partial<Pick<TEntity, TFields[number]>>
		: Pick<TEntity, TFields[number]>
	: TEntity;

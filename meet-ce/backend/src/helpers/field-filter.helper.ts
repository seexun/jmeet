/**
 * Generic helper for managing field filtering in a two-layer approach:
 * 1. Database query optimization (what fields to retrieve from DB)
 * 2. HTTP response filtering (what fields to include in the API response)
 *
 * This helper is designed to be reusable across different entities (Room, Recording, User, etc.)
 *
 * Key concepts:
 * - Base fields: Standard fields included by default
 * - Extra fields: Fields excluded by default, must be explicitly requested via extraFields parameter
 * - Union logic: Final fields = fields ∪ extraFields
 */

/**
 * Calculates the optimal set of fields to request from the database.
 * This minimizes data transfer and processing by excluding unnecessary extra fields.
 *
 * Logic:
 * - If `fields` is specified: return fields ∪ extraFields (explicit selection)
 * - If only `extraFields` is specified: return all base fields + requested extra fields
 * - If neither is specified: return all base fields (exclude all extra fields from DB query)
 *
 * @param fields - Explicitly requested fields (e.g., ['roomId', 'roomName'])
 * @param extraFields - Extra fields to include (e.g., ['config'])
 * @param allFields - Complete list of all possible fields for this entity
 * @param extraFieldsList - List of fields that are considered "extra" (excluded by default)
 * @returns Array of fields to request from database, or undefined if all fields should be retrieved
 *
 * @example
 * ```typescript
 * // No filters → retrieve all base fields only (efficient!)
 * buildFieldsForDbQuery(undefined, undefined, MEET_ROOM_FIELDS, MEET_ROOM_EXTRA_FIELDS)
 * // Returns: ['roomId', 'roomName', 'owner', ...] (without 'config')
 *
 * // Only extraFields → retrieve base fields + requested extras
 * buildFieldsForDbQuery(undefined, ['config'], MEET_ROOM_FIELDS, MEET_ROOM_EXTRA_FIELDS)
 * // Returns: ['roomId', 'roomName', 'owner', ..., 'config']
 *
 * // Both fields and extraFields → retrieve union
 * buildFieldsForDbQuery(['roomId'], ['config'], MEET_ROOM_FIELDS, MEET_ROOM_EXTRA_FIELDS)
 * // Returns: ['roomId', 'config']
 * ```
 */
export function buildFieldsForDbQuery<TField extends string, TExtraField extends TField>(
	fields: readonly TField[] | undefined,
	extraFields: readonly TExtraField[] | undefined,
	allFields: readonly TField[],
	extraFieldsList: readonly TExtraField[]
): TField[] | undefined {
	// Case 1: fields is explicitly specified
	// Return the union of fields and extraFields for precise DB query
	if (fields && fields.length > 0) {
		const union = new Set<TField>([...fields, ...(extraFields || [])]);
		return Array.from(union);
	}

	// Case 2: Only extraFields specified (no fields)
	// Include all base fields + requested extra fields
	if (extraFields && extraFields.length > 0) {
		// All fields except extra fields that are NOT requested
		const baseFields = allFields.filter((field) => !extraFieldsList.includes(field as TExtraField));
		const union = new Set<TField>([...baseFields, ...extraFields]);
		return Array.from(union);
	}

	// Case 3: Neither fields nor extraFields specified
	// Return only base fields (exclude all extra fields)
	const baseFields = allFields.filter((field) => !extraFieldsList.includes(field as TExtraField));
	return baseFields as TField[];
}

/**
 * Applies HTTP-level field filtering to an entity object.
 * This is the final transformation before sending the response to the client.
 *
 * The logic follows the union principle: final allowed fields = fields ∪ extraFields
 *
 * Behavior:
 * - If neither fields nor extraFields are specified: removes all extra fields from the response
 * - If only fields is specified: includes only those fields (removing extra fields unless in the list)
 * - If only extraFields is specified: includes all base fields + specified extra fields
 * - If both are specified: includes the union of both sets (fields ∪ extraFields)
 *
 * This unified approach prevents bugs from chaining destructive filters on the same object.
 *
 * @param entity - The entity object to filter
 * @param fields - Optional array of field names to include
 * @param extraFields - Optional array of extra field names to include
 * @param extraFieldsList - List of fields that are considered "extra" (excluded by default)
 * @returns The filtered entity object
 *
 * @example
 * ```typescript
 * // No filters - removes extra fields only:
 * applyHttpFieldFiltering(room, undefined, undefined, MEET_ROOM_EXTRA_FIELDS)
 * // Result: room without 'config' property
 *
 * // Only fields specified - includes only those fields:
 * applyHttpFieldFiltering(room, ['roomId', 'roomName'], undefined, MEET_ROOM_EXTRA_FIELDS)
 * // Result: { roomId: '123', roomName: 'My Room' }
 *
 * // Only extraFields specified - includes base fields + extra fields:
 * applyHttpFieldFiltering(room, undefined, ['config'], MEET_ROOM_EXTRA_FIELDS)
 * // Result: room with all base fields and 'config' property
 *
 * // Both specified - includes union of both:
 * applyHttpFieldFiltering(room, ['roomId'], ['config'], MEET_ROOM_EXTRA_FIELDS)
 * // Result: { roomId: '123', config: {...} }
 * ```
 */
export function applyHttpFieldFiltering<TEntity, TExtraField extends string>(
	entity: TEntity,
	fields: readonly string[] | undefined,
	extraFields: readonly TExtraField[] | undefined,
	extraFieldsList: readonly TExtraField[]
): TEntity {
	if (!entity) {
		return entity;
	}

	// Case 1: No filters specified - remove extra fields only
	if ((!fields || fields.length === 0) && (!extraFields || extraFields.length === 0)) {
		const processedEntity = { ...entity } as Record<string, unknown>;
		extraFieldsList.forEach((field) => {
			delete processedEntity[field];
		});
		return processedEntity as TEntity;
	}

	// Case 2: Only extraFields specified - include all base fields + specified extra fields
	if (!fields || fields.length === 0) {
		const processedEntity = { ...entity } as Record<string, unknown>;
		// Remove extra fields that are NOT in the extraFields list
		extraFieldsList.forEach((field) => {
			if (!extraFields!.includes(field)) {
				delete processedEntity[field];
			}
		});
		return processedEntity as TEntity;
	}

	// Case 3: fields is specified (with or without extraFields)
	// Create the union: fields ∪ extraFields
	const allowedFields = new Set<string>([...fields, ...(extraFields || [])]);

	const filteredEntity = {} as Record<string, unknown>;
	const entityAsRecord = entity as Record<string, unknown>;

	for (const key of Object.keys(entityAsRecord)) {
		if (allowedFields.has(key)) {
			filteredEntity[key] = entityAsRecord[key];
		}
	}

	return filteredEntity as TEntity;
}

/**
 * Adds metadata to the response indicating which extra fields are available.
 * This allows API consumers to discover available extra fields without consulting documentation.
 *
 * @param obj - The object to enhance with metadata (can be a single entity or a response object)
 * @param extraFieldsList - List of available extra fields
 * @returns The object with _extraFields metadata added
 *
 * @example
 * ```typescript
 * // Single entity
 * addResponseMetadata(room, MEET_ROOM_EXTRA_FIELDS)
 * // Result: { ...room, _extraFields: ['config'] }
 *
 * // Response object
 * addResponseMetadata({ rooms: [...] }, MEET_ROOM_EXTRA_FIELDS)
 * // Result: { rooms: [...], _extraFields: ['config'] }
 * ```
 */
export function addHttpResponseMetadata<T, TExtraField extends string>(
	obj: T,
	extraFieldsList: readonly TExtraField[]
): T & { _extraFields: TExtraField[] } {
	return {
		...obj,
		_extraFields: [...extraFieldsList]
	};
}

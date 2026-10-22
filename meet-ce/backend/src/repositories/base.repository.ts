import type { SortAndPagination } from '@openvidu-meet/typings';
import { SortOrder } from '@openvidu-meet/typings';
import { inject, injectable, unmanaged } from 'inversify';
import type { Model, QueryFilter, Require_id, UpdateQuery } from 'mongoose';
import type { DocumentOnlyField, PaginatedResult, PaginationCursor } from '../models/database.model.js';
import { LoggerService } from '../services/logger.service.js';

/**
 * Base repository providing common CRUD operations for MongoDB entities.
 * This class is meant to be extended by specific entity repositories.
 *
 * @template TDomain - The domain interface type
 * @template TDocument - The persisted model shape used in MongoDB (extends TDomain)
 */
@injectable()
export abstract class BaseRepository<TDomain, TDocument extends TDomain = TDomain> {
	constructor(
		@inject(LoggerService) protected logger: LoggerService,
		@unmanaged() protected model: Model<TDocument>
	) {}

	/**
	 * Transforms a persisted object into a domain object.
	 * Must be implemented by each concrete repository to apply entity-specific transformations.
	 *
	 * @param dbObject - The persisted object to transform
	 * @returns The domain object
	 */
	protected abstract toDomain(dbObject: TDocument): TDomain;

	/**
	 * Returns the list of fields that exist only in the persistence model (TDocument)
	 * and are not part of the domain contract (TDomain).
	 */
	protected getDocumentOnlyFields(): readonly DocumentOnlyField<TDocument, TDomain>[] {
		return [];
	}

	/**
	 * Returns document paths that must be updated atomically.
	 *
	 * Paths listed here are treated as leaf values during partial updates,
	 * so nested properties are not flattened into dot notation.
	 */
	protected getAtomicUpdatePaths(): readonly string[] {
		return [];
	}

	/**
	 * Creates a new document.
	 *
	 * @param data - The data to create
	 * @returns The created domain object
	 */
	protected async createDocument(data: TDocument): Promise<TDomain> {
		try {
			const document = await this.model.create(data);
			this.logger.debug(`Document created with ID: ${document._id}`);
			return this.toDomain(this.stripMetadataFromDocument(document.toObject()));
		} catch (error) {
			this.logger.error('Error creating document:', error);
			throw error;
		}
	}

	/**
	 * Finds a single document matching the given filter.
	 *
	 * @param filter - MongoDB query filter
	 * @param fields - Optional array of field names to select from database
	 * @returns The domain object or null if not found
	 */
	protected async findOne(filter: QueryFilter<TDocument>, fields?: string[]): Promise<TDomain | null> {
		try {
			const projection = this.buildProjection(fields);
			const document = (await this.model.findOne(filter, projection).lean().exec()) as TDocument | null;
			return document ? this.toDomain(document) : null;
		} catch (error) {
			this.logger.error('Error finding document with filter:', filter, error);
			throw error;
		}
	}

	/**
	 * Finds all documents matching the given filter without pagination.
	 * WARNING: Use with caution on large collections. Consider using findMany() with pagination instead.
	 *
	 * @param filter - Base MongoDB query filter
	 * @param fields - Optional array of field names to select from database
	 * @returns Array of domain objects matching the filter
	 */
	protected async findAll(filter: QueryFilter<TDocument> = {}, fields?: string[]): Promise<TDomain[]> {
		try {
			const projection = this.buildProjection(fields);
			const documents = (await this.model.find(filter, projection).lean().exec()) as TDocument[];
			return documents.map((doc) => this.toDomain(doc));
		} catch (error) {
			this.logger.error('Error finding all documents with filter:', filter, error);
			throw error;
		}
	}

	/**
	 * Finds all documents matching the given filter with optional pagination and sorting.
	 *
	 * @param filter - Base MongoDB query filter
	 * @param options - Pagination options
	 * @param options.maxItems - Maximum number of results to return (default: 100)
	 * @param options.nextPageToken - Token for pagination (encoded cursor)
	 * @param options.sortField - Field to sort by (default: '_id')
	 * @param options.sortOrder - Sort order: 'asc' or 'desc' (default: 'desc')
	 * @param fields - Optional array of field names to select from database
	 * @returns Paginated result with items, truncation flag, and optional next token
	 */
	protected async findMany(
		filter: QueryFilter<TDocument> = {},
		options: SortAndPagination = {},
		fields?: string[]
	): Promise<PaginatedResult<TDomain>> {
		const { maxItems = 100, nextPageToken, sortField = '_id', sortOrder = SortOrder.DESC } = options;

		// Parse and apply pagination cursor if provided
		if (nextPageToken) {
			const cursor = this.decodeCursor(nextPageToken);
			this.applyCursorToFilter(filter, cursor, sortField, sortOrder);
		}

		// Convert sort order to MongoDB format
		const mongoSortOrder: 1 | -1 = sortOrder === SortOrder.ASC ? 1 : -1;

		// Build compound sort: primary field + _id
		const sort: Record<string, 1 | -1> = {
			[sortField]: mongoSortOrder,
			_id: mongoSortOrder // Always sort by _id as secondary to ensure deterministic ordering
		};

		// Fetch one more than requested to check if there are more results
		const limit = maxItems + 1;

		const projection = this.buildProjection(fields, true);
		const documents = (await this.model.find(filter, projection).sort(sort).limit(limit).lean().exec()) as Array<
			Require_id<TDocument> & { __v?: number }
		>;

		// Check if there are more results
		const hasMore = documents.length > maxItems;
		const resultDocuments = hasMore ? documents.slice(0, maxItems) : documents;

		// Transform documents to domain objects
		const items = resultDocuments.map((doc) => this.toDomain(this.stripMetadataFromDocument(doc)));

		// Generate next page token (encode last document's sort field value and _id)
		const nextToken =
			hasMore && resultDocuments.length > 0
				? this.encodeCursor(resultDocuments[resultDocuments.length - 1], sortField)
				: undefined;

		return {
			items,
			isTruncated: hasMore,
			nextPageToken: nextToken
		};
	}

	/**
	 * Updates specific fields of a document using MongoDB operators.
	 *
	 * @param filter - MongoDB query filter
	 * @param update - Partial update operators, or a partial object to be converted into operators
	 * @returns The updated domain object
	 * @throws Error if document not found or update fails
	 */
	protected async updatePartialOne(
		filter: QueryFilter<TDocument>,
		update: UpdateQuery<TDocument> | Partial<TDocument>
	): Promise<TDomain> {
		try {
			const isUpdateQuery = Object.keys(update).some((key) => key.startsWith('$'));
			const safeUpdate = isUpdateQuery
				? (update as UpdateQuery<TDocument>)
				: this.buildUpdateQuery(update as Partial<TDocument>);

			if (!safeUpdate.$set && !safeUpdate.$unset) {
				throw new Error('Partial update requires at least one field to set or unset');
			}

			const document = (await this.model
				.findOneAndUpdate(filter, safeUpdate, {
					returnDocument: 'after', // Return the document after replacement
					runValidators: true, // Ensure update data is validated against schema
					lean: true, // Return plain JavaScript object instead of Mongoose document
					projection: { _id: 0, __v: 0 }, // Exclude persistence-only metadata fields
					upsert: false // Do not create a new document if none matches the filter
				})
				.exec()) as TDocument | null;

			if (!document) {
				this.logger.error('No document found to update with filter:', filter);
				throw new Error('Document not found for update');
			}

			this.logger.debug('Document updated');
			return this.toDomain(document);
		} catch (error) {
			this.logger.error('Error updating document:', error);
			throw error;
		}
	}

	/**
	 * Replaces a full document by a custom filter.
	 * The replacement document is built by merging the replacement domain object
	 * with the existing document's fields that are not present in the replacement.
	 * This ensures that fields like _id and other database-only fields are preserved during replacement.
	 *
	 * @param filter - MongoDB query filter
	 * @param replacement - Full replacement payload
	 * @returns The replaced domain object
	 * @throws Error if document not found or replace fails
	 */
	protected async replaceOne(filter: QueryFilter<TDocument>, replacement: TDomain): Promise<TDomain> {
		try {
			const documentOnlyFields = this.getDocumentOnlyFields();
			const replacementDocument = { ...replacement } as TDocument;

			if (documentOnlyFields.length > 0) {
				const projection = documentOnlyFields.join(' ');
				const existingDocument = (await this.model
					.findOne(filter, projection)
					.lean()
					.exec()) as TDocument | null;

				if (!existingDocument) {
					this.logger.error('No document found to replace with filter:', filter);
					throw new Error('Document not found for replacement');
				}

				// Copy document-only fields from existing document to replacement document
				for (const key of documentOnlyFields) {
					replacementDocument[key] = existingDocument[key];
				}
			}

			const document = (await this.model
				.findOneAndReplace(filter, replacementDocument, {
					returnDocument: 'after', // Return the document after replacement
					runValidators: true, // Validate replacement document against schema
					lean: true, // Return plain JavaScript object instead of Mongoose document
					projection: { _id: 0, __v: 0 }, // Exclude persistence-only metadata fields
					upsert: false // Do not create a new document if none matches the filter
				})
				.exec()) as TDocument | null;

			if (!document) {
				this.logger.error('No document found to replace with filter:', filter);
				throw new Error('Document not found for replacement');
			}

			this.logger.debug('Document replaced');
			return this.toDomain(document);
		} catch (error) {
			this.logger.error('Error replacing document:', error);
			throw error;
		}
	}

	/**
	 * Deletes a document by a custom filter.
	 *
	 * @param filter - MongoDB query filter
	 * @throws Error if no document was found or deleted
	 */
	protected async deleteOne(filter: QueryFilter<TDocument>): Promise<void> {
		try {
			const result = await this.model.findOneAndDelete(filter).exec();

			if (!result) {
				this.logger.error('No document found to delete with filter:', filter);
				throw new Error('Document not found for deletion');
			}

			this.logger.debug(`Document with ID '${result._id}' deleted`);
		} catch (error) {
			this.logger.error('Error deleting document:', error);
			throw error;
		}
	}

	/**
	 * Deletes multiple documents matching the given filter.
	 *
	 * @param filter - MongoDB query filter
	 * @param failIfEmpty - Whether to throw error if no documents are found (default: true)
	 * @throws Error if no documents were found or deleted (only when failIfEmpty is true)
	 */
	protected async deleteMany(filter: QueryFilter<TDocument> = {}, failIfEmpty = true): Promise<void> {
		try {
			const result = await this.model.deleteMany(filter).exec();
			const deletedCount = result.deletedCount || 0;

			if (deletedCount === 0) {
				if (failIfEmpty) {
					this.logger.error('No documents found to delete with filter:', filter);
					throw new Error('No documents found for deletion');
				} else {
					this.logger.debug('No documents found to delete with filter:', filter);
				}
			} else {
				this.logger.debug(`Deleted ${deletedCount} documents`);
			}
		} catch (error) {
			if (error instanceof Error && error.message === 'No documents found for deletion') {
				throw error;
			}

			this.logger.error('Error deleting documents:', error);
			throw error;
		}
	}

	/**
	 * Counts the total number of documents matching the given filter.
	 *
	 * @param filter - MongoDB query filter (optional, defaults to counting all documents)
	 * @returns The number of documents matching the filter
	 */
	protected async count(filter: QueryFilter<TDocument> = {}): Promise<number> {
		try {
			return await this.model.countDocuments(filter).exec();
		} catch (error) {
			this.logger.error('Error counting documents:', error);
			throw error;
		}
	}

	// ==========================================
	// HELPER METHODS
	// ==========================================

	/**
	 * Builds query projection while excluding persistence-only metadata fields.
	 *
	 * @param fields - Optional list of fields to include
	 * @param includeId - Whether to keep _id in the result (required for cursor pagination)
	 */
	private buildProjection(fields?: string[], includeId = false): Record<string, 0 | 1> {
		if (fields && fields.length > 0) {
			const sanitizedFields = fields.filter((field) => field !== '_id' && field !== '__v');
			const projection: Record<string, 0 | 1> = Object.fromEntries(
				sanitizedFields.map((field) => [field, 1] as const)
			);

			if (!includeId) {
				projection._id = 0;
			}

			return projection;
		}

		return includeId ? { __v: 0 } : { _id: 0, __v: 0 };
	}

	/**
	 * Removes persistence-only metadata fields from a document before mapping it to domain.
	 */
	private stripMetadataFromDocument(document: Require_id<TDocument> & { __v?: number }): TDocument {
		const { _id, __v, ...domainDocument } = document;
		(void _id, __v);
		return domainDocument as TDocument;
	}

	/**
	 * Builds a MongoDB update query from a partial object, converting undefined values to $unset operators.
	 * Handles nested objects recursively.
	 *
	 * @param partial - The partial object containing fields to update (undefined values will be unset)
	 * @returns An UpdateQuery object with $set and $unset operators
	 */
	protected buildUpdateQuery(partial: Partial<TDocument>): UpdateQuery<TDocument> {
		const $set: Record<string, unknown> = {};
		const $unset: Record<string, ''> = {};
		const atomicUpdatePaths = new Set(this.getAtomicUpdatePaths());

		const buildUpdateQueryDeep = (input: Record<string, unknown>, prefix = ''): void => {
			for (const key in input) {
				const value = input[key];
				const path = prefix ? `${prefix}.${key}` : key;

				if (value === undefined) {
					// Mark field for unsetting if value is undefined
					$unset[path] = '';
				} else if (this.isPlainObject(value) && !atomicUpdatePaths.has(path)) {
					// Recursively build update query for nested objects that are not atomic paths
					buildUpdateQueryDeep(value, path);
				} else {
					// Set field value for $set operator
					$set[path] = value;
				}
			}
		};

		buildUpdateQueryDeep(partial as Record<string, unknown>);

		const updateQuery: UpdateQuery<TDocument> = {};

		if (Object.keys($set).length > 0) {
			updateQuery.$set = $set;
		}

		if (Object.keys($unset).length > 0) {
			updateQuery.$unset = $unset;
		}

		return updateQuery;
	}

	/**
	 * Checks whether a value is a plain object.
	 */
	private isPlainObject(value: unknown): value is Record<string, unknown> {
		if (value === null || typeof value !== 'object') {
			return false;
		}

		if (Array.isArray(value)) {
			return false;
		}

		return Object.getPrototypeOf(value) === Object.prototype;
	}

	/**
	 * Encodes a cursor for pagination.
	 * Creates a base64-encoded token containing the last document's sort field value and _id.
	 * Handles undefined/null values by converting them to null for consistent serialization.
	 *
	 * @param document - The last document from the current page
	 * @param sortField - The field used for sorting
	 * @returns Base64-encoded cursor token
	 */
	protected encodeCursor(document: Require_id<TDocument>, sortField: string): string {
		const fieldValue = document[sortField as keyof Require_id<TDocument>];

		const cursor: PaginationCursor = {
			// Convert undefined to null for JSON serialization
			fieldValue: fieldValue === undefined ? null : fieldValue,
			id: String(document._id)
		};

		return Buffer.from(JSON.stringify(cursor)).toString('base64');
	}

	/**
	 * Decodes a pagination cursor token.
	 *
	 * @param token - The base64-encoded cursor token
	 * @returns Decoded cursor object with fieldValue and id
	 * @throws Error if the token is invalid or malformed
	 */
	protected decodeCursor(token: string): PaginationCursor {
		try {
			const decoded = Buffer.from(token, 'base64').toString('utf-8');
			const cursor = JSON.parse(decoded);

			if (
				!Object.prototype.hasOwnProperty.call(cursor, 'fieldValue') ||
				!Object.prototype.hasOwnProperty.call(cursor, 'id')
			) {
				throw new Error('Invalid cursor format');
			}

			return cursor;
		} catch (error) {
			this.logger.error('Failed to decode pagination cursor:', error);
			throw new Error('Invalid pagination token');
		}
	}

	/**
	 * Applies cursor-based pagination to the MongoDB filter.
	 * Uses compound comparison to handle non-unique sort fields correctly.
	 * Handles missing/undefined fields properly in MongoDB queries.
	 *
	 * For ascending order:
	 *   (sortField > cursor.fieldValue) OR (sortField = cursor.fieldValue AND _id > cursor.id)
	 *
	 * For descending order:
	 *   (sortField < cursor.fieldValue) OR (sortField = cursor.fieldValue AND _id < cursor.id)
	 *
	 * Special handling for null/undefined values (missing fields):
	 * - In ascending order, missing fields come first in MongoDB's sort order
	 * - In descending order, missing fields come last
	 * - We use $exists: false to check for missing fields instead of comparing with null
	 *
	 * @param filter - The MongoDB filter to modify
	 * @param cursor - The decoded cursor
	 * @param sortField - The field used for sorting
	 * @param sortOrder - The sort order ('asc' or 'desc')
	 */
	protected applyCursorToFilter(
		filter: QueryFilter<TDocument>,
		cursor: PaginationCursor,
		sortField: string,
		sortOrder: SortOrder
	): void {
		const comparison = sortOrder === SortOrder.ASC ? '$gt' : '$lt';
		const equalComparison = sortOrder === SortOrder.ASC ? '$gt' : '$lt';

		// Build compound filter for pagination
		// This ensures correct ordering even when sortField values are not unique
		const orConditions: QueryFilter<TDocument>[] = [];

		// If cursor field value is null (field doesn't exist in the document)
		if (cursor.fieldValue === null) {
			// For missing fields, we filter by _id among documents where the field doesn't exist
			orConditions.push({
				[sortField]: { $exists: false },
				_id: { [equalComparison]: cursor.id }
			} as QueryFilter<TDocument>);

			// In ascending order, also include documents where the field exists (they come after missing fields)
			if (sortOrder === SortOrder.ASC) {
				orConditions.push({
					[sortField]: { $exists: true }
				} as QueryFilter<TDocument>);
			}
		} else {
			// Normal case: field has a value
			orConditions.push(
				{
					[sortField]: { [comparison]: cursor.fieldValue }
				} as QueryFilter<TDocument>,
				{
					[sortField]: cursor.fieldValue,
					_id: { [equalComparison]: cursor.id }
				} as QueryFilter<TDocument>
			);

			// In descending order, also include documents where the field doesn't exist (they come after all values)
			if (sortOrder === SortOrder.DESC) {
				orConditions.push({
					[sortField]: { $exists: false }
				} as QueryFilter<TDocument>);
			}
		}

		Object.assign(filter, { $or: orConditions });
	}
}

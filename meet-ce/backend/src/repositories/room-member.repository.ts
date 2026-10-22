import type {
	MeetRoomMember,
	MeetRoomMemberField,
	MeetRoomMemberPermissions,
	ProjectedMeetRoomMember
} from '@openvidu-meet/typings';
import { SortOrder, TextMatchMode } from '@openvidu-meet/typings';
import { inject, injectable } from 'inversify';
import type { QueryFilter } from 'mongoose';
import { INTERNAL_CONFIG } from '../config/internal-config.js';
import type {
	MeetRoomMemberDocument,
	MeetRoomMemberDocumentOnlyField
} from '../models/mongoose-schemas/room-member.schema.js';
import {
	MEET_ROOM_MEMBER_DOCUMENT_ONLY_FIELDS,
	MeetRoomMemberModel
} from '../models/mongoose-schemas/room-member.schema.js';
import { LoggerService } from '../services/logger.service.js';
import type {
	MeetRoomMemberPage,
	RoomMemberQuery,
	RoomMemberQueryWithFields,
	RoomMemberQueryWithProjection
} from '../types/room-member-projection.types.js';
import { buildStringMatchFilter } from '../utils/string-match-filter.utils.js';
import { addBaseUrlToPath, extractPathFromUrl } from '../utils/url.utils.js';
import { BaseRepository } from './base.repository.js';

/**
 * Repository for managing MeetRoomMember entities in MongoDB.
 * Provides CRUD operations and specialized queries for room member data.
 */
@injectable()
export class RoomMemberRepository extends BaseRepository<MeetRoomMember, MeetRoomMemberDocument> {
	constructor(@inject(LoggerService) logger: LoggerService) {
		super(logger, MeetRoomMemberModel);
	}

	protected toDomain(dbObject: MeetRoomMemberDocument): MeetRoomMember {
		const { schemaVersion, ...member } = dbObject;
		void schemaVersion;
		return this.enrichRoomMemberWithBaseUrl(member as MeetRoomMember);
	}

	protected override getDocumentOnlyFields(): readonly MeetRoomMemberDocumentOnlyField[] {
		return MEET_ROOM_MEMBER_DOCUMENT_ONLY_FIELDS;
	}

	protected override getAtomicUpdatePaths(): readonly string[] {
		// Custom permissions must be treated as an atomic update path because
		// we want to ensure it is fully replaced rather than partially updated.
		return ['customPermissions'];
	}

	/**
	 * Adds a member to a room.
	 *
	 * @param member - The room member data to add
	 * @returns The created room member
	 */
	create(member: MeetRoomMember): Promise<MeetRoomMember> {
		const normalizedMember = this.normalizeRoomMemberForStorage(member) as MeetRoomMember;
		const document: MeetRoomMemberDocument = {
			...normalizedMember,
			schemaVersion: INTERNAL_CONFIG.ROOM_MEMBER_SCHEMA_VERSION
		};
		return this.createDocument(document);
	}

	/**
	 * Updates specific fields of a room member without replacing the entire document.
	 *
	 * @param roomId - The ID of the room
	 * @param memberId - The ID of the member
	 * @param fieldsToUpdate - Partial member data with fields to update
	 * @returns The updated room member
	 * @throws Error if room member not found
	 */
	updatePartial(roomId: string, memberId: string, fieldsToUpdate: Partial<MeetRoomMember>): Promise<MeetRoomMember> {
		const normalizedFieldsToUpdate = this.normalizeRoomMemberForStorage(fieldsToUpdate);
		return this.updatePartialOne({ roomId, memberId }, normalizedFieldsToUpdate);
	}

	/**
	 * Replaces an existing room member with new data.
	 *
	 * @param member - The complete updated room member data
	 * @returns The updated room member
	 * @throws Error if room member not found
	 */
	replace(member: MeetRoomMember): Promise<MeetRoomMember> {
		const normalizedMember = this.normalizeRoomMemberForStorage(member) as MeetRoomMember;
		return this.replaceOne({ roomId: member.roomId, memberId: member.memberId }, normalizedMember);
	}

	/**
	 * Finds a specific member in a room.
	 *
	 * @param roomId - The ID of the room
	 * @param memberId - The ID of the member
	 * @param fields - Array of field names to include in the result
	 * @returns The room member or null if not found
	 */
	findByRoomAndMemberId(roomId: string, memberId: string): Promise<MeetRoomMember | null>;

	findByRoomAndMemberId<const TFields extends readonly MeetRoomMemberField[]>(
		roomId: string,
		memberId: string,
		fields: TFields
	): Promise<ProjectedMeetRoomMember<TFields> | null>;

	findByRoomAndMemberId(
		roomId: string,
		memberId: string,
		fields?: readonly MeetRoomMemberField[]
	): Promise<MeetRoomMember | Partial<MeetRoomMember> | null>;

	findByRoomAndMemberId(
		roomId: string,
		memberId: string,
		fields?: readonly MeetRoomMemberField[]
	): Promise<MeetRoomMember | Partial<MeetRoomMember> | null> {
		return this.findOne({ roomId, memberId }, fields as string[]) as Promise<
			MeetRoomMember | Partial<MeetRoomMember> | null
		>;
	}

	/**
	 * Finds room members by their memberIds.
	 *
	 * @param roomId - The ID of the room
	 * @param memberIds - Array of member identifiers
	 * @param fields - Array of field names to include in the result
	 * @returns Array of found room members
	 */
	findByRoomAndMemberIds(roomId: string, memberIds: string[]): Promise<MeetRoomMember[]>;

	findByRoomAndMemberIds<const TFields extends readonly MeetRoomMemberField[]>(
		roomId: string,
		memberIds: string[],
		fields: TFields
	): Promise<ProjectedMeetRoomMember<TFields>[]>;

	findByRoomAndMemberIds(
		roomId: string,
		memberIds: string[],
		fields?: readonly MeetRoomMemberField[]
	): Promise<MeetRoomMember[] | Partial<MeetRoomMember>[]> {
		return this.findAll({ roomId, memberId: { $in: memberIds } }, fields as string[]) as Promise<
			MeetRoomMember[] | Partial<MeetRoomMember>[]
		>;
	}

	/**
	 * Gets all room IDs where a user is a member, optionally filtered by permission.
	 *
	 * @param memberId - The ID of the member (userId)
	 * @param permission - Optional permission key to filter memberships
	 * @returns Array of room IDs where the user is a member and has the permission (if provided)
	 */
	async getRoomIdsByMemberId(memberId: string, permission?: keyof MeetRoomMemberPermissions): Promise<string[]> {
		const filter: QueryFilter<MeetRoomMemberDocument> = { memberId };

		if (permission) {
			filter[`effectivePermissions.${permission}`] = true;
		}

		const members = await this.findAll(filter, ['roomId']);
		return members.map((member) => member.roomId);
	}

	/**
	 * Finds members of a room with optional filtering, pagination, and sorting.
	 *
	 * @param roomId - The ID of the room
	 * @param options - Query options
	 * @param options.name - Optional member name to filter by
	 * @param options.nameMatchMode - Match mode for name filtering (default: 'exact')
	 * @param options.nameCaseInsensitive - Whether name filtering should ignore case (default: false)
	 * @param options.baseRole - Optional base role to filter members by
	 * @param options.type - Optional member type (user or identified guest) to filter members by
	 * @param options.fields - Array of field names to include in the result
	 * @param options.maxItems - Maximum number of results to return (default: 100)
	 * @param options.nextPageToken - Token for pagination
	 * @param options.sortField - Field to sort by (default: 'membershipDate')
	 * @param options.sortOrder - Sort order: 'asc' or 'desc' (default: 'desc')
	 * @returns Object containing members array, pagination info, and optional next page token
	 */
	async findByRoomId(roomId: string, options?: RoomMemberQuery): Promise<MeetRoomMemberPage<MeetRoomMember>>;

	async findByRoomId<const TFields extends readonly MeetRoomMemberField[]>(
		roomId: string,
		options: RoomMemberQueryWithProjection<TFields>
	): Promise<MeetRoomMemberPage<ProjectedMeetRoomMember<TFields>>>;

	async findByRoomId(
		roomId: string,
		options: RoomMemberQueryWithFields
	): Promise<MeetRoomMemberPage<MeetRoomMember | Partial<MeetRoomMember>>>;

	async findByRoomId(
		roomId: string,
		options: RoomMemberQueryWithFields = {}
	): Promise<MeetRoomMemberPage<MeetRoomMember | Partial<MeetRoomMember>>> {
		const {
			name,
			nameMatchMode = TextMatchMode.EXACT,
			nameCaseInsensitive = false,
			baseRole,
			type,
			fields,
			maxItems = 100,
			nextPageToken,
			sortField = 'membershipDate',
			sortOrder = SortOrder.DESC
		} = options;

		// Build base filter
		const filter: QueryFilter<MeetRoomMemberDocument> = { roomId };

		if (name) {
			filter.name = buildStringMatchFilter(name, nameMatchMode, nameCaseInsensitive);
		}

		if (baseRole) {
			filter.baseRole = baseRole;
		}

		if (type) {
			filter.type = type;
		}

		// Use base repository's pagination method
		const result = await this.findMany(
			filter,
			{
				maxItems,
				nextPageToken,
				sortField,
				sortOrder
			},
			fields as string[]
		);

		return {
			members: result.items,
			isTruncated: result.isTruncated,
			nextPageToken: result.nextPageToken
		};
	}

	/**
	 * Removes a member from a room.
	 *
	 * @param roomId - The ID of the room
	 * @param memberId - The ID of the member to remove
	 * @throws Error if room member not found or could not be deleted
	 */
	deleteByRoomAndMemberId(roomId: string, memberId: string): Promise<void> {
		return this.deleteOne({ roomId, memberId });
	}

	/**
	 * Removes multiple members from a room.
	 *
	 * @param roomId - The ID of the room
	 * @param memberIds - Array of member IDs to remove
	 * @throws Error if no room members were found or could not be deleted
	 */
	deleteByRoomIdAndMemberIds(roomId: string, memberIds: string[]): Promise<void> {
		return this.deleteMany({ roomId, memberId: { $in: memberIds } });
	}

	/**
	 * Removes all members from a room.
	 * Does not fail if no members are found.
	 *
	 * @param roomId - The ID of the room
	 */
	deleteAllByRoomId(roomId: string): Promise<void> {
		return this.deleteMany({ roomId }, false);
	}

	/**
	 * Removes all room memberships for a specific member across all rooms.
	 * This is useful when deleting a user account.
	 * Does not fail if no memberships are found.
	 *
	 * @param memberId - The ID of the member whose memberships should be deleted
	 */
	deleteAllByMemberId(memberId: string): Promise<void> {
		return this.deleteMany({ memberId }, false);
	}

	// ==========================================
	// PRIVATE HELPER METHODS
	// ==========================================

	/**
	 * Normalizes room member data for storage by removing the base URL from access URL.
	 * This ensures only the path is stored in the database.
	 * NOTE: Only normalizes accessUrl when it is present in a partial payload.
	 *
	 * @param member - The room member data to normalize
	 * @returns The normalized room member with access URL stripped to path
	 */
	private normalizeRoomMemberForStorage(member: Partial<MeetRoomMember>): Partial<MeetRoomMember> {
		if (member.accessUrl) {
			member.accessUrl = extractPathFromUrl(member.accessUrl);
		}

		return member;
	}

	/**
	 * Enriches room member data by adding the base URL to access URL when present.
	 *
	 * @param member - The room member data to enrich
	 * @returns The enriched room member with complete access URL
	 */
	private enrichRoomMemberWithBaseUrl(member: MeetRoomMember): MeetRoomMember {
		if (member.accessUrl) {
			member.accessUrl = addBaseUrlToPath(member.accessUrl);
		}

		return member;
	}
}

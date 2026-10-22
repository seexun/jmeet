import type { MeetRoom, MeetRoomField, ProjectedMeetRoom } from '@openvidu-meet/typings';
import { MeetRoomStatus, SortOrder, TextMatchMode } from '@openvidu-meet/typings';
import { inject, injectable } from 'inversify';
import type { QueryFilter } from 'mongoose';
import { INTERNAL_CONFIG } from '../config/internal-config.js';
import type { MeetRoomDocument, MeetRoomDocumentOnlyField } from '../models/mongoose-schemas/room.schema.js';
import { MEET_ROOM_DOCUMENT_ONLY_FIELDS, MeetRoomModel } from '../models/mongoose-schemas/room.schema.js';
import { LoggerService } from '../services/logger.service.js';
import type {
	MeetRoomPage,
	RoomQuery,
	RoomQueryWithFields,
	RoomQueryWithProjection
} from '../types/room-projection.types.js';
import { buildStringMatchFilter } from '../utils/string-match-filter.utils.js';
import { addBaseUrlToPath, extractPathFromUrl } from '../utils/url.utils.js';
import { BaseRepository } from './base.repository.js';
import { RoomMemberRepository } from './room-member.repository.js';

/**
 * Repository for managing MeetRoom entities in MongoDB.
 * Provides CRUD operations and specialized queries for room data.
 */
@injectable()
export class RoomRepository extends BaseRepository<MeetRoom, MeetRoomDocument> {
	constructor(
		@inject(LoggerService) protected logger: LoggerService,
		@inject(RoomMemberRepository) protected roomMemberRepository: RoomMemberRepository
	) {
		super(logger, MeetRoomModel);
	}

	/**
	 * Transforms a persisted MeetRoom document into a domain MeetRoom object.
	 * Enriches access URLs with the base URL.
	 *
	 * @param dbObject - The MongoDB document representing a room
	 * @returns Room with complete URLs
	 */
	protected toDomain(dbObject: MeetRoomDocument): MeetRoom {
		const { schemaVersion, ...room } = dbObject;
		void schemaVersion;
		return this.enrichRoomWithBaseUrls(room as MeetRoom);
	}

	protected override getDocumentOnlyFields(): readonly MeetRoomDocumentOnlyField[] {
		return MEET_ROOM_DOCUMENT_ONLY_FIELDS;
	}

	protected override getAtomicUpdatePaths(): readonly string[] {
		// Recording encoding must be treated as an atomic update path because
		// it can be either a string or an object, and we want to ensure it is fully replaced rather than partially updated.
		return ['config.recording.encoding'];
	}

	/**
	 * Creates a new room.
	 * URLs are stored in the database without the base URL.
	 *
	 * @param room - The room data to create
	 * @returns The created room with enriched URLs
	 */
	create(room: MeetRoom): Promise<MeetRoom> {
		const normalizedRoom = this.normalizeRoomForStorage(room) as MeetRoom;
		const document: MeetRoomDocument = {
			...normalizedRoom,
			schemaVersion: INTERNAL_CONFIG.ROOM_SCHEMA_VERSION
		};
		return this.createDocument(document);
	}

	/**
	 * Updates specific fields of a room without replacing the entire document.
	 *
	 * @param roomId - The unique room identifier
	 * @param fieldsToUpdate - Partial room data with fields to update
	 * @returns The updated room with enriched URLs
	 * @throws Error if room not found
	 */
	updatePartial(roomId: string, fieldsToUpdate: Partial<MeetRoom>): Promise<MeetRoom> {
		const normalizedFieldsToUpdate = this.normalizeRoomForStorage(fieldsToUpdate);
		return this.updatePartialOne({ roomId }, normalizedFieldsToUpdate);
	}

	/**
	 * Replaces an existing room with new data.
	 * URLs are stored in the database without the base URL.
	 *
	 * @param room - The complete updated room data
	 * @returns The updated room with enriched URLs
	 * @throws Error if room not found
	 */
	replace(room: MeetRoom): Promise<MeetRoom> {
		const normalizedRoom = this.normalizeRoomForStorage(room) as MeetRoom;
		return this.replaceOne({ roomId: room.roomId }, normalizedRoom);
	}

	/**
	 * Finds a room by its roomId.
	 * Returns the room with enriched URLs (including base URL).
	 *
	 * @param roomId - The unique room identifier
	 * @param fields - Array of field names to include in the result
	 * @returns The room or null if not found
	 */
	findByRoomId(roomId: string): Promise<MeetRoom | null>;

	findByRoomId<const TFields extends readonly MeetRoomField[]>(
		roomId: string,
		fields: TFields
	): Promise<ProjectedMeetRoom<TFields> | null>;

	findByRoomId(roomId: string, fields?: readonly MeetRoomField[]): Promise<MeetRoom | Partial<MeetRoom> | null>;

	findByRoomId(roomId: string, fields?: readonly MeetRoomField[]): Promise<MeetRoom | Partial<MeetRoom> | null> {
		return this.findOne({ roomId }, fields as string[]) as Promise<MeetRoom | Partial<MeetRoom> | null>;
	}

	/**
	 * Finds a room by its numeric meeting code (join-by-code entry).
	 *
	 * @param meetingCode - The 10-digit numeric meeting code
	 * @param fields - Array of field names to include in the result
	 * @returns The room or null if not found
	 */
	findByMeetingCode(meetingCode: string, fields?: readonly MeetRoomField[]): Promise<MeetRoom | Partial<MeetRoom> | null> {
		return this.findOne({ meetingCode }, fields as string[]) as Promise<MeetRoom | Partial<MeetRoom> | null>;
	}

	/**
	 * Finds rooms owned by a specific user.
	 * Returns rooms with enriched URLs (including base URL).
	 *
	 * @param owner - The userId of the room owner
	 * @param fields - Array of field names to include in the result
	 * @returns Array of rooms owned by the user
	 */
	findByOwner(owner: string): Promise<MeetRoom[]>;

	findByOwner<const TFields extends readonly MeetRoomField[]>(
		owner: string,
		fields: TFields
	): Promise<ProjectedMeetRoom<TFields>[]>;

	findByOwner(owner: string, fields?: readonly MeetRoomField[]): Promise<MeetRoom[] | Partial<MeetRoom>[]> {
		return this.findAll({ owner }, fields as string[]) as Promise<MeetRoom[] | Partial<MeetRoom>[]>;
	}

	/**
	 * Finds room IDs where user access is enabled.
	 *
	 * @returns Array of rooms including only roomId
	 */
	async findRoomIdsWithUserAccessEnabled(): Promise<string[]> {
		const rooms = await this.findAll({ 'access.user.enabled': true }, ['roomId']);
		return rooms.map((room) => room.roomId);
	}

	/**
	 * Finds rooms with optional filtering, pagination, and sorting.
	 * Returns rooms with enriched URLs (including base URL).
	 *
	 * Uses compound sorting (sortField + _id) to ensure consistent pagination
	 * even when the sort field has duplicate values.
	 *
	 * @param options - Query options
	 * @param options.roomName - Optional room name to filter by
	 * @param options.roomNameMatchMode - Match mode for room name filtering (default: 'exact')
	 * @param options.roomNameCaseInsensitive - Whether room name matching should ignore case (default: false)
	 * @param options.status - Optional room status to filter by
	 * @param options.owner - Optional owner userId to filter by
	 * @param options.member - Optional member userId to filter rooms where user is a member
	 * @param options.userAccess - If true, includes rooms with user access enabled
	 * @param options.fields - Array of field names to include in the result
	 * @param options.maxItems - Maximum number of results to return (default: 100)
	 * @param options.nextPageToken - Token for pagination (encoded cursor with last sortField value and _id)
	 * @param options.sortField - Field to sort by (default: 'creationDate')
	 * @param options.sortOrder - Sort order: 'asc' or 'desc' (default: 'desc')
	 * @returns Object containing rooms array, pagination info, and optional next page token
	 */
	async find(options?: RoomQuery): Promise<MeetRoomPage<MeetRoom>>;

	async find<const TFields extends readonly MeetRoomField[]>(
		options: RoomQueryWithProjection<TFields>
	): Promise<MeetRoomPage<ProjectedMeetRoom<TFields>>>;

	async find(options: RoomQueryWithFields): Promise<MeetRoomPage<MeetRoom | Partial<MeetRoom>>>;

	async find(options: RoomQueryWithFields = {}): Promise<MeetRoomPage<MeetRoom | Partial<MeetRoom>>> {
		const {
			roomName,
			roomNameMatchMode = TextMatchMode.EXACT,
			roomNameCaseInsensitive = false,
			status,
			owner,
			member,
			userAccess,
			fields,
			maxItems = 100,
			nextPageToken,
			sortField = 'creationDate',
			sortOrder = SortOrder.DESC
		} = options;

		// Build base filter
		const filter: QueryFilter<MeetRoomDocument> = {};

		const accessScopeOrFilters: QueryFilter<MeetRoomDocument>[] = [];

		if (owner) {
			accessScopeOrFilters.push({ owner });
		}

		if (member) {
			const memberRoomIds = await this.roomMemberRepository.getRoomIdsByMemberId(member);
			accessScopeOrFilters.push({ roomId: { $in: memberRoomIds } });
		}

		if (userAccess) {
			accessScopeOrFilters.push({ 'access.user.enabled': true });
		}

		// Combine access scope filters with $or if there are multiple, or merge directly if only one
		if (accessScopeOrFilters.length === 1) {
			Object.assign(filter, accessScopeOrFilters[0]);
		} else if (accessScopeOrFilters.length > 1) {
			filter.$or = accessScopeOrFilters;
		}

		if (roomName) {
			filter.roomName = buildStringMatchFilter(roomName, roomNameMatchMode, roomNameCaseInsensitive);
		}

		if (status) {
			filter.status = status;
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
			rooms: result.items,
			isTruncated: result.isTruncated,
			nextPageToken: result.nextPageToken
		};
	}

	/**
	 * Finds expired rooms (autoDeletionDate < now) in paginated batches.
	 *
	 * @param batchSize - Number of rooms to retrieve per page
	 * @param pageToken - Optional cursor token from a previous call
	 * @returns A paginated page of expired rooms
	 */
	async findExpiredRooms(batchSize = 100, pageToken?: string): Promise<MeetRoomPage<MeetRoom>> {
		const now = Date.now();

		const { items, isTruncated, nextPageToken } = await this.findMany(
			{
				autoDeletionDate: { $exists: true, $lt: now }
			},
			{
				maxItems: batchSize,
				nextPageToken: pageToken,
				sortField: 'autoDeletionDate',
				sortOrder: SortOrder.ASC
			}
		);

		return {
			rooms: items,
			isTruncated,
			nextPageToken
		};
	}

	/**
	 * Finds active rooms in paginated batches, projecting only roomId.
	 *
	 * @param batchSize - Number of rooms to retrieve per page
	 * @param pageToken - Optional cursor token from a previous call
	 * @returns A paginated page of active room identifiers
	 */
	async findActiveRooms(batchSize = 100, pageToken?: string): Promise<MeetRoomPage<Pick<MeetRoom, 'roomId'>>> {
		const { items, isTruncated, nextPageToken } = await this.findMany(
			{
				status: MeetRoomStatus.ACTIVE_MEETING
			},
			{
				maxItems: batchSize,
				nextPageToken: pageToken,
				sortField: 'creationDate',
				sortOrder: SortOrder.DESC
			},
			['roomId']
		);

		return {
			rooms: items as Pick<MeetRoom, 'roomId'>[],
			isTruncated,
			nextPageToken
		};
	}

	/**
	 * Deletes a room by its roomId.
	 *
	 * @param roomId - The unique room identifier
	 * @throws Error if the room was not found or could not be deleted
	 */
	deleteByRoomId(roomId: string): Promise<void> {
		return this.deleteOne({ roomId });
	}

	/**
	 * Deletes multiple rooms by their roomIds.
	 *
	 * @param roomIds - Array of room identifiers
	 * @throws Error if no rooms were found or could not be deleted
	 */
	deleteByRoomIds(roomIds: string[]): Promise<void> {
		return this.deleteMany({ roomId: { $in: roomIds } });
	}

	/**
	 * Counts the total number of rooms.
	 */
	countTotal(): Promise<number> {
		return this.count();
	}

	/**
	 * Counts the number of rooms with active meetings.
	 */
	countActiveRooms(): Promise<number> {
		return this.count({ status: MeetRoomStatus.ACTIVE_MEETING });
	}

	// ==========================================
	// PRIVATE HELPER METHODS
	// ==========================================

	/**
	 * Normalizes room data for storage by removing the base URL from access URLs.
	 * This ensures only the path is stored in the database.
	 * NOTE: Only normalizes fields that are present in the partial payload.
	 *
	 * @param room - The partial room data to normalize
	 * @returns Normalized partial room data
	 */
	private normalizeRoomForStorage(room: Partial<MeetRoom>): Partial<MeetRoom> {
		const userUrl = room.access?.user.url;
		const moderatorUrl = room.access?.anonymous.moderator.url;
		const speakerUrl = room.access?.anonymous.speaker.url;
		const recordingUrl = room.access?.anonymous.recording.url;

		if (userUrl) {
			room.access!.user.url = extractPathFromUrl(userUrl);
		}

		if (moderatorUrl) {
			room.access!.anonymous.moderator.url = extractPathFromUrl(moderatorUrl);
		}

		if (speakerUrl) {
			room.access!.anonymous.speaker.url = extractPathFromUrl(speakerUrl);
		}

		if (recordingUrl) {
			room.access!.anonymous.recording.url = extractPathFromUrl(recordingUrl);
		}

		return room;
	}

	/**
	 * Enriches room data by adding the base URL to access URLs.
	 * Only enriches URLs that are present in the document.
	 *
	 * @param document - The MongoDB document
	 * @returns Room data with complete URLs
	 */
	private enrichRoomWithBaseUrls(room: MeetRoom): MeetRoom {
		const userUrl = room.access?.user.url;
		const moderatorUrl = room.access?.anonymous.moderator.url;
		const speakerUrl = room.access?.anonymous.speaker.url;
		const recordingUrl = room.access?.anonymous.recording.url;

		if (userUrl) {
			room.access!.user.url = addBaseUrlToPath(userUrl);
		}

		if (moderatorUrl) {
			room.access!.anonymous.moderator.url = addBaseUrlToPath(moderatorUrl);
		}

		if (speakerUrl) {
			room.access!.anonymous.speaker.url = addBaseUrlToPath(speakerUrl);
		}

		if (recordingUrl) {
			room.access!.anonymous.recording.url = addBaseUrlToPath(recordingUrl);
		}

		return room;
	}
}

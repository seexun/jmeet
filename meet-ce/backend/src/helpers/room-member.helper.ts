import type { MeetRoomMember, MeetRoomMemberExtraField, MeetRoomMemberField } from '@openvidu-meet/typings';
import { MEET_ROOM_MEMBER_EXTRA_FIELDS, MEET_ROOM_MEMBER_FIELDS } from '@openvidu-meet/typings';
import { addHttpResponseMetadata, applyHttpFieldFiltering, buildFieldsForDbQuery } from './field-filter.helper.js';

export class MeetRoomMemberHelper {
	private constructor() {
		// Prevent instantiation of this utility class
	}

	/**
	 * Calculates the optimal fields to request from the database for room member queries.
	 * Minimizes data transfer by excluding unnecessary extra fields.
	 *
	 * @param fields - Explicitly requested fields
	 * @param extraFields - Extra fields to include
	 * @returns Array of fields to request from the database
	 */
	static computeFieldsForMemberQuery(
		fields?: MeetRoomMemberField[],
		extraFields?: MeetRoomMemberExtraField[]
	): MeetRoomMemberField[] | undefined {
		return buildFieldsForDbQuery(fields, extraFields, MEET_ROOM_MEMBER_FIELDS, MEET_ROOM_MEMBER_EXTRA_FIELDS);
	}

	/**
	 * Applies HTTP-level field filtering to a MeetRoomMember object.
	 * This is the final transformation before sending the response to the client.
	 *
	 * The logic follows the union principle: final allowed fields = fields ∪ extraFields.
	 * Extra fields (e.g. `effectivePermissions`) are excluded unless explicitly requested.
	 *
	 * @param member - The room member object to process
	 * @param fields - Optional array of field names to include
	 * @param extraFields - Optional array of extra field names to include
	 * @returns A MeetRoomMember object with fields filtered according to the union of both parameters
	 */
	static applyFieldFilters<TMember extends Partial<MeetRoomMember>>(
		member: TMember,
		fields?: MeetRoomMemberField[],
		extraFields?: MeetRoomMemberExtraField[]
	): TMember {
		return applyHttpFieldFiltering(member, fields, extraFields, MEET_ROOM_MEMBER_EXTRA_FIELDS);
	}

	/**
	 * Adds metadata to the room member response indicating which extra fields are available.
	 *
	 * @param obj - The object to enhance with metadata
	 * @returns The object with `_extraFields` metadata added
	 */
	static addResponseMetadata<T>(obj: T): T & { _extraFields: MeetRoomMemberExtraField[] } {
		return addHttpResponseMetadata(obj, MEET_ROOM_MEMBER_EXTRA_FIELDS);
	}
}

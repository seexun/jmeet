import type {
	MeetRoom,
	MeetRoomAccess,
	MeetRoomExtraField,
	MeetRoomField,
	MeetRoomMemberPermissions,
	MeetRoomOptions
} from '@openvidu-meet/typings';
import { MEET_ROOM_EXTRA_FIELDS, MEET_ROOM_FIELDS, SENSITIVE_ROOM_FIELDS_ENTRIES } from '@openvidu-meet/typings';
import { randomInt } from 'crypto';
import { MEET_ENV } from '../environment.js';
import { addHttpResponseMetadata, applyHttpFieldFiltering, buildFieldsForDbQuery } from './field-filter.helper.js';

export class MeetRoomHelper {
	private constructor() {
		// Prevent instantiation of this utility class
	}

	/**
	 * Sanitizes a room name by normalizing format.
	 *
	 * @param val The string to sanitize
	 * @returns A sanitized string safe for use as a room name
	 */
	static sanitizeRoomName(val: string): string {
		return val
			.trim() // Remove leading/trailing spaces
			.replace(/\s+/g, ' '); // Replace multiple consecutive spaces with a single space
	}

	/**
	 * Sanitizes an identifier by removing invalid characters
	 *
	 * @param val The string to sanitize
	 * @returns A sanitized string safe for use as an identifier
	 */
	static sanitizeRoomId(val: string): string {
		return val.replace(/[^a-zA-Z0-9_-]/g, ''); // Allow only letters, numbers, hyphens and underscores
	}

	/**
	 * Generates a numeric meeting code (9 digits, leading digit 1-9) for join-by-code entry.
	 * Aligned with the Tencent-meeting shape: xxx-xxx-xxx when displayed (formatting is
	 * a frontend concern; storage and API stay pure digits).
	 * Uses crypto random integers; collisions are handled by the caller via unique-index retry.
	 */
	static generateMeetingCode(): string {
		let code = String(1 + randomInt(9)); // 1-9 leading digit: no leading zero, stable 9-digit length
		for (let i = 0; i < 8; i++) {
			code += randomInt(10);
		}
		return code;
	}

	/**
	 * Sanitizes a user-entered meeting code: digits only (spaces/separators stripped).
	 */
	static sanitizeMeetingCode(val: string): string {
		return val.replace(/[^0-9]/g, '');
	}

	/**
	 * Creates a sanitized room ID prefix from the given room name.
	 *
	 * This method normalizes the room name by:
	 * - Decomposing combined characters (e.g., á -> a + ´)
	 * - Converting to lowercase
	 * - Replacing hyphens and spaces with underscores
	 * - Allowing only lowercase letters, numbers, and underscores
	 * - Replacing multiple consecutive underscores with a single underscore
	 * - Removing leading and trailing underscores
	 *
	 * @param roomName The original room name.
	 * @returns A sanitized string suitable for use as a room ID prefix.
	 */
	static createRoomIdPrefixFromRoomName(roomName: string): string {
		return roomName
			.normalize('NFD') // Decompose combined characters (e.g., á -> a + ´)
			.toLowerCase() // Convert to lowercase
			.replace(/[-\s]/g, '_') // Replace hyphens and spaces with underscores
			.replace(/[^a-z0-9_]/g, '') // Allow only lowercase letters, numbers and underscores
			.replace(/_+/g, '_') // Replace multiple consecutive underscores with a single underscore
			.replace(/_+$/, '') // Remove trailing underscores
			.replace(/^_+/, ''); // Remove leading underscores
	}

	/**
	 * Converts an MeetRoom object to an MeetRoomOptions object.
	 *
	 * @param room - The MeetRoom object to convert.
	 * @returns An MeetRoomOptions object containing the same properties as the input room.
	 */
	static toRoomOptions(room: MeetRoom): MeetRoomOptions {
		return {
			roomName: room.roomName,
			autoDeletionDate: room.autoDeletionDate,
			autoDeletionPolicy: room.autoDeletionPolicy,
			config: room.config,
			roles: room.roles,
			access: {
				anonymous: {
					moderator: {
						enabled: room.access.anonymous.moderator.enabled
					},
					speaker: {
						enabled: room.access.anonymous.speaker.enabled
					},
					recording: {
						enabled: room.access.anonymous.recording.enabled
					}
				},
				user: {
					enabled: room.access.user.enabled
				}
			}
			// maxParticipants: room.maxParticipants
		};
	}

	/**
	 * Extracts speaker, moderator, and recording secrets from MeetRoom anonymous access URLs.
	 *
	 * This method parses the 'secret' query parameter from speaker, moderator, and recording
	 * anonymous access URLs associated with the meeting room.
	 *
	 * @param roomAccess - The access configuration of the MeetRoom from which to extract secrets.
	 * @returns An object containing the extracted secrets with the following properties:
	 *   - speakerSecret: The secret extracted from the speaker anonymous access URL
	 *   - moderatorSecret: The secret extracted from the moderator anonymous access URL
	 *   - recordingSecret: The secret extracted from the recording anonymous access URL
	 */
	static extractSecretsFromRoom(roomAccess: MeetRoomAccess): {
		speakerSecret: string;
		moderatorSecret: string;
		recordingSecret: string;
	} {
		const speakerUrl = roomAccess.anonymous.speaker.url;
		const moderatorUrl = roomAccess.anonymous.moderator.url;
		const recordingUrl = roomAccess.anonymous.recording.url;

		const parsedSpeakerUrl = new URL(speakerUrl);
		const speakerSecret = parsedSpeakerUrl.searchParams.get('secret') || '';
		const parsedModeratorUrl = new URL(moderatorUrl);
		const moderatorSecret = parsedModeratorUrl.searchParams.get('secret') || '';
		const parsedRecordingUrl = new URL(recordingUrl);
		const recordingSecret = parsedRecordingUrl.searchParams.get('secret') || '';
		return { speakerSecret, moderatorSecret, recordingSecret };
	}

	/**
	 * Safely parses JSON metadata and checks if createdBy matches NAME_ID.
	 * @returns true if metadata indicates JMeet as creator, false otherwise
	 */
	static checkIfMeetingBelogsToOpenViduMeet(metadata?: string): boolean {
		if (!metadata) return false;

		try {
			const parsed = JSON.parse(metadata);
			const isOurs = parsed?.createdBy === MEET_ENV.NAME_ID;
			return isOurs;
		} catch (err: unknown) {
			return false;
		}
	}

	/**
	 * Calculates optimal fields to request from database for Room queries.
	 * Minimizes data transfer by excluding unnecessary extra fields.
	 *
	 * @param fields - Explicitly requested fields
	 * @param extraFields - Extra fields to include
	 * @returns Array of fields to request from database
	 */
	static computeFieldsForRoomQuery(
		fields?: MeetRoomField[],
		extraFields?: MeetRoomExtraField[]
	): MeetRoomField[] | undefined {
		return buildFieldsForDbQuery(fields, extraFields, MEET_ROOM_FIELDS, MEET_ROOM_EXTRA_FIELDS);
	}

	/**
	 * Applies HTTP-level field filtering to a MeetRoom object.
	 * This is the final transformation before sending the response to the client.
	 *
	 * The logic follows the union principle: final allowed fields = fields ∪ extraFields
	 *
	 * @param room - The room object to process
	 * @param fields - Optional array of field names to include (e.g., ['roomId', 'roomName'])
	 * @param extraFields - Optional array of extra field names to include (e.g., ['config'])
	 * @returns A MeetRoom object with fields filtered according to the union of both parameters
	 * @example
	 * ```
	 * // No filters - removes extra fields only:
	 * const room = applyFieldFilters(fullRoom);
	 * // Result: room without 'config' property
	 *
	 * // Only fields specified - includes only those fields:
	 * const room = applyFieldFilters(fullRoom, ['roomId', 'roomName']);
	 * // Result: { roomId: '123', roomName: 'My Room' }
	 *
	 * // Only extraFields specified - includes base fields + extra fields:
	 * const room = applyFieldFilters(fullRoom, undefined, ['config']);
	 * // Result: room with all base fields and 'config' property
	 *
	 * // Both specified - includes union of both:
	 * const room = applyFieldFilters(fullRoom, ['roomId'], ['config']);
	 * // Result: { roomId: '123', config: {...} }
	 * ```
	 */
	static applyFieldFilters(room: MeetRoom, fields?: MeetRoomField[], extraFields?: MeetRoomExtraField[]): MeetRoom {
		return applyHttpFieldFiltering(room, fields, extraFields, MEET_ROOM_EXTRA_FIELDS);
	}

	/**
	 * Applies permission filtering to a MeetRoom object by removing sensitive fields based on the provided permissions.
	 *
	 * @param room - The MeetRoom object to filter
	 * @param permissions - The permissions of the room member, used to determine which sensitive fields to exclude
	 * @returns A MeetRoom object with sensitive fields removed according to the member's permissions
	 */
	static applyPermissionFiltering<TRoom extends Partial<MeetRoom>>(
		room: TRoom,
		permissions: MeetRoomMemberPermissions
	): TRoom {
		if (!room || !permissions || SENSITIVE_ROOM_FIELDS_ENTRIES.length === 0) {
			return room;
		}

		const filteredRoom = { ...room } as TRoom;

		for (const [permissionKey, fieldPaths] of SENSITIVE_ROOM_FIELDS_ENTRIES) {
			if (fieldPaths.length === 0 || permissions[permissionKey]) {
				continue;
			}

			fieldPaths.forEach((fieldPath) => {
				this.deleteFieldByPath(filteredRoom as unknown as Record<string, unknown>, fieldPath);
			});
		}

		return filteredRoom;
	}

	/**
	 * Determines if permission filtering may be needed based on requested room fields.
	 *
	 * If no explicit field projection is provided, all fields may be present and filtering must be applied.
	 * If fields are provided, filtering is only needed when they include the first segment of any sensitive path.
	 */
	static shouldApplyPermissionFilteringForFields(fields?: MeetRoomField[]): boolean {
		if (!fields) {
			return true;
		}

		const sensitiveFieldFirstSegments = new Set<MeetRoomField>();

		for (const [, fieldPaths] of SENSITIVE_ROOM_FIELDS_ENTRIES) {
			fieldPaths.forEach((fieldPath) => {
				const firstSegment = fieldPath.split('.')[0] as MeetRoomField;
				sensitiveFieldFirstSegments.add(firstSegment);
			});
		}

		return fields.some((field) => sensitiveFieldFirstSegments.has(field));
	}

	/**
	 * Deletes a property from an object by path (supports top-level and nested fields).
	 */
	private static deleteFieldByPath(entity: Record<string, unknown>, path: string): void {
		if (!path.includes('.')) {
			delete entity[path];
			return;
		}

		const segments = path.split('.');
		const lastSegment = segments.pop();
		let current: Record<string, unknown> = entity;

		for (const segment of segments) {
			const nextNode = current[segment];

			if (!nextNode || typeof nextNode !== 'object' || Array.isArray(nextNode)) {
				return;
			}

			current = nextNode as Record<string, unknown>;
		}

		delete current[lastSegment!];
	}

	/**
	 * Adds metadata to the room response indicating which extra fields are available.
	 * This allows API consumers to discover available extra fields without consulting documentation.
	 *
	 * @param obj - The object to enhance with metadata
	 * @returns The object with _extraFields metadata added
	 */
	static addResponseMetadata<T>(obj: T): T & { _extraFields: MeetRoomExtraField[] } {
		return addHttpResponseMetadata(obj, MEET_ROOM_EXTRA_FIELDS);
	}
}

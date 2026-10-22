import type { MeetRecordingField } from '@openvidu-meet/typings';
import {
	MEET_RECORDING_FIELDS,
	MEET_RECORDING_SORT_FIELDS,
	MeetRecordingLayout,
	MeetRecordingStatus,
	SortOrder,
	TextMatchMode
} from '@openvidu-meet/typings';
import { z } from 'zod';
import { encodingValidator, nonEmptySanitizedRoomId } from './room.schema.js';

/**
 * Shared fields validation schema for Recording entity
 * Validates and transforms comma-separated string to typed array
 * Only allows fields that exist in MEET_RECORDING_FIELDS
 */
const fieldsSchema = z
	.string()
	.optional()
	.transform((value) => {
		if (!value) return undefined;

		const requested = value
			.split(',')
			.map((field) => field.trim())
			.filter((field) => field !== '');

		// Filter: only keep valid fields that exist in MeetRecordingInfo
		const validFields = requested.filter((field) =>
			MEET_RECORDING_FIELDS.includes(field as MeetRecordingField)
		) as MeetRecordingField[];

		// Deduplicate
		const unique = Array.from(new Set(validFields));

		return unique.length > 0 ? unique : undefined;
	});

export const nonEmptySanitizedRecordingId = (fieldName: string) =>
	z
		.string()
		.min(1, { message: `${fieldName} is required and cannot be empty` })
		.transform((val) => {
			const sanitizedValue = val.trim();

			// Verify the format of the recording ID
			// The recording ID should be in the format 'roomId--EG_xxx--uid'
			const parts = sanitizedValue.split('--');

			// If the recording ID is not in the expected format, return the sanitized value
			// The next validation will check if the format is correct
			if (parts.length !== 3) return sanitizedValue;

			// If the recording ID is in the expected format, sanitize the roomId part
			const { success, data } = nonEmptySanitizedRoomId('roomId').safeParse(parts[0]);

			if (!success) {
				// If the roomId part is not valid, return the sanitized value
				return sanitizedValue;
			}

			return `${data}--${parts[1]}--${parts[2]}`;
		})
		.refine((data) => data !== '', {
			message: `${fieldName} cannot be empty after sanitization`
		})
		.refine(
			(data) => {
				const parts = data.split('--');

				if (parts.length !== 3) return false;

				if (parts[0].length === 0) return false;

				if (!parts[1].startsWith('EG_') || parts[1].length <= 3) return false;

				if (parts[2].length === 0) return false;

				return true;
			},
			{
				message: `${fieldName} does not follow the expected format`
			}
		);

export const StartRecordingReqSchema = z.object({
	roomId: nonEmptySanitizedRoomId('roomId'),
	config: z
		.object({
			layout: z.nativeEnum(MeetRecordingLayout).optional(),
			encoding: encodingValidator.optional()
		})
		.optional()
});

export const RecordingFiltersSchema = z
	.object({
		roomId: nonEmptySanitizedRoomId('roomId').optional(),
		roomName: z.string().optional(),
		roomNameMatchMode: z.nativeEnum(TextMatchMode).optional(),
		roomNameCaseInsensitive: z.preprocess((arg) => {
			if (typeof arg === 'string') {
				if (arg.toLowerCase() === 'true') return true;

				if (arg.toLowerCase() === 'false') return false;
			}

			return arg;
		}, z.boolean().optional().default(false)),
		status: z.nativeEnum(MeetRecordingStatus).optional(),
		fields: fieldsSchema,
		maxItems: z.coerce
			.number()
			.positive('maxItems must be a positive number')
			.transform((val) => {
				// Convert the value to a number
				const intVal = Math.floor(val);
				// Ensure it's not greater than 100
				return intVal > 100 ? 100 : intVal;
			})
			.default(10),
		nextPageToken: z.string().optional(),
		sortField: z.enum(MEET_RECORDING_SORT_FIELDS).optional().default('startDate'),
		sortOrder: z.nativeEnum(SortOrder).optional().default(SortOrder.DESC)
	})
	.superRefine((data, ctx) => {
		if (data.roomNameMatchMode === TextMatchMode.REGEX && data.roomName) {
			try {
				new RegExp(String(data.roomName));
			} catch {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['roomName'],
					message: 'Invalid regular expression pattern'
				});
			}
		}
	});

export const BulkDeleteRecordingsReqSchema = z.object({
	recordingIds: z.preprocess(
		(arg) => {
			if (typeof arg === 'string') {
				// If the argument is a string, it is expected to be a comma-separated list of recording IDs.
				return arg
					.split(',')
					.map((s) => s.trim())
					.filter((s) => s !== '');
			}

			return [];
		},
		z.array(nonEmptySanitizedRecordingId('recordingId')).min(1, {
			message: 'At least one recordingId is required'
		})
	)
});

export const RecordingQueryFieldsSchema = z.object({
	fields: fieldsSchema
});

export const RecordingHeaderFieldsSchema = z.object({
	'x-fields': fieldsSchema
});

/**
 * Merges X-Fields header values into query.fields for recordings.
 * When both header and query param provide fields, values are merged (union of unique fields).
 * This allows API consumers to use either mechanism or both simultaneously.
 */
export function mergeRecordingHeaderFieldsIntoQuery(
	headers: Record<string, unknown>,
	query: Record<string, unknown>
): void {
	const headerResult = RecordingHeaderFieldsSchema.safeParse(headers);

	if (!headerResult.success) {
		return;
	}

	const headerFields = headerResult.data['x-fields'];

	if (headerFields) {
		const existingFields =
			typeof query.fields === 'string'
				? query.fields
						.split(',')
						.map((f: string) => f.trim())
						.filter((f: string) => f !== '')
				: [];
		const merged = Array.from(new Set([...existingFields, ...headerFields]));
		query.fields = merged.join(',');
	}
}

export const GetRecordingReqSchema = z.object({
	params: z.object({
		recordingId: nonEmptySanitizedRecordingId('recordingId')
	}),
	query: z.object({
		fields: fieldsSchema,
		recordingSecret: z.string().optional()
	})
});

export const StopRecordingReqSchema = z.object({
	params: z.object({
		recordingId: nonEmptySanitizedRecordingId('recordingId')
	}),
	query: z.object({
		fields: fieldsSchema
	})
});

export const GetRecordingMediaReqSchema = z.object({
	params: z.object({
		recordingId: nonEmptySanitizedRecordingId('recordingId')
	}),
	query: z.object({
		recordingSecret: z.string().optional()
	}),
	headers: z
		.object({
			range: z
				.string()
				.regex(/^bytes=\d+-\d*$/, {
					message: 'Invalid range header format. Expected: bytes=start-end'
				})
				.optional()
		})
		.passthrough() // Allow other headers to pass through
});

export const GetRecordingUrlReqSchema = z.object({
	params: z.object({
		recordingId: nonEmptySanitizedRecordingId('recordingId')
	}),
	query: z.object({
		privateAccess: z
			.preprocess((val) => {
				if (typeof val === 'string') {
					return val.toLowerCase() === 'true';
				}

				return val;
			}, z.boolean())
			.default(false)
	})
});

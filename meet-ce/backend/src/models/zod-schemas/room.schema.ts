import type {
	MeetAppearanceConfig,
	MeetChatConfig,
	MeetE2EEConfig,
	MeetRecordingConfig,
	MeetRecordingEncodingOptions,
	MeetRoomAccessConfig,
	MeetRoomAutoDeletionPolicy,
	MeetRoomCaptionsConfig,
	MeetRoomConfig,
	MeetMeetingSecurityConfig,
	MeetRoomExtraField,
	MeetRoomField,
	MeetRoomOptions,
	MeetRoomRolesConfig,
	MeetRoomTheme,
	MeetVirtualBackgroundConfig
} from '@openvidu-meet/typings';
import {
	MEET_ROOM_EXTRA_FIELDS,
	MEET_ROOM_FIELDS,
	MEET_ROOM_SORT_FIELDS,
	MeetRecordingAudioCodec,
	MeetRecordingEncodingPreset,
	MeetRecordingLayout,
	MeetRecordingVideoCodec,
	MeetRoomDeletionPolicyWithMeeting,
	MeetRoomDeletionPolicyWithRecordings,
	MeetRoomStatus,
	MeetRoomThemeMode,
	SortOrder,
	TextMatchMode
} from '@openvidu-meet/typings';
import ms from 'ms';
import { z } from 'zod';
import { INTERNAL_CONFIG } from '../../config/internal-config.js';
import { MeetRoomHelper } from '../../helpers/room.helper.js';
import { PartialMeetPermissionsSchema } from './room-member.schema.js';

export const nonEmptySanitizedRoomId = (fieldName: string) =>
	z
		.string()
		.min(1, { message: `${fieldName} is required and cannot be empty` })
		.max(100, { message: `${fieldName} cannot exceed 100 characters` })
		.transform(MeetRoomHelper.sanitizeRoomId)
		.refine((data) => data !== '', {
			message: `${fieldName} cannot be empty after sanitization`
		});

// Encoding options validation - both video and audio are required with all their fields
export const EncodingOptionsSchema: z.ZodType<MeetRecordingEncodingOptions> = z.object({
	video: z.object({
		width: z.number().positive('Video width must be a positive number'),
		height: z.number().positive('Video height must be a positive number'),
		framerate: z.number().positive('Video framerate must be a positive number'),
		codec: z.nativeEnum(MeetRecordingVideoCodec),
		bitrate: z.number().positive('Video bitrate must be a positive number'),
		keyFrameInterval: z.number().positive('Video keyFrameInterval must be a positive number'),
		depth: z.number().positive('Video depth must be a positive number')
	}),
	audio: z.object({
		codec: z.nativeEnum(MeetRecordingAudioCodec),
		bitrate: z.number().positive('Audio bitrate must be a positive number'),
		frequency: z.number().positive('Audio frequency must be a positive number')
	})
});

/**
 * Custom encoding validator to handle both preset strings and encoding objects.
 * Used in RecordingConfigSchema
 */
export const encodingValidator = z.any().superRefine((value, ctx) => {
	// If undefined, skip validation (it's optional)
	if (value === undefined) {
		return;
	}

	// Check if it's a string preset
	if (typeof value === 'string') {
		const presetValues = Object.values(MeetRecordingEncodingPreset);

		if (!presetValues.includes(value as MeetRecordingEncodingPreset)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: `Invalid encoding preset. Must be one of: ${presetValues.join(', ')}`
			});
		}

		return;
	}

	// If it's not a string, it must be an encoding object
	if (typeof value !== 'object' || value === null) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: 'Encoding must be either a preset string or an encoding configuration object'
		});
		return;
	}

	// Both video and audio must be provided
	if (!value.video || !value.audio) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: 'Both video and audio configuration must be provided when using encoding options'
		});
		return;
	}

	if (value.video === null || typeof value.video !== 'object') {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: 'Video encoding must be a valid object'
		});
		return;
	}

	if (value.audio === null || typeof value.audio !== 'object') {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: 'Audio encoding must be a valid object'
		});
		return;
	}

	// Check video fields
	const requiredVideoFields = ['width', 'height', 'framerate', 'codec', 'bitrate', 'keyFrameInterval', 'depth'];
	const missingVideoFields = requiredVideoFields.filter((field) => !(field in value.video));

	if (missingVideoFields.length > 0) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: `When video encoding is provided, required fields are missing: ${missingVideoFields.join(', ')}`,
			path: ['video']
		});
	}

	// Check audio fields
	const requiredAudioFields = ['codec', 'bitrate', 'frequency'];
	const missingAudioFields = requiredAudioFields.filter((field) => !(field in value.audio));

	if (missingAudioFields.length > 0) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: `When audio encoding is provided, required fields are missing: ${missingAudioFields.join(', ')}`,
			path: ['audio']
		});
	}

	// Validate the actual types and values using the schema
	const result = EncodingOptionsSchema.safeParse(value);

	if (!result.success) {
		result.error.issues.forEach((issue) => {
			ctx.addIssue(issue);
		});
	}
});

const RecordingConfigSchema: z.ZodType<MeetRecordingConfig> = z.object({
	enabled: z.boolean(),
	layout: z.nativeEnum(MeetRecordingLayout).optional(),
	encoding: encodingValidator.optional()
});

const ChatConfigSchema: z.ZodType<MeetChatConfig> = z.object({
	enabled: z.boolean()
});

const VirtualBackgroundConfigSchema: z.ZodType<MeetVirtualBackgroundConfig> = z.object({
	enabled: z.boolean()
});

const E2EEConfigSchema: z.ZodType<MeetE2EEConfig> = z.object({
	enabled: z.boolean()
});

const CaptionsConfigSchema: z.ZodType<MeetRoomCaptionsConfig> = z.object({
	enabled: z.boolean()
});

const MeetingSecurityConfigSchema = z.object({
	securityLevel: z.enum(['standard', 'internal', 'confidential']).default('standard'),
	waitingRoomEnabled: z.boolean(),
	locked: z.boolean(),
	accessScope: z.enum(['invited_and_internal', 'internal_only', 'anyone_with_link']),
	allowJoinBeforeHost: z.boolean(),
	muteOnEntry: z.boolean(),
	allowSelfUnmute: z.boolean(),
	screenSharePolicy: z.enum(['moderators_only', 'all_participants']),
	allowParticipantRename: z.boolean(),
	allowMultipleDevices: z.boolean(),
	watermarkEnabled: z.boolean()
}) satisfies z.ZodType<MeetMeetingSecurityConfig>;

const ThemeModeSchema: z.ZodType<MeetRoomThemeMode> = z.nativeEnum(MeetRoomThemeMode);

const hexColorSchema = z
	.string()
	.regex(
		/^#([0-9A-Fa-f]{8}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{3})$/,
		'Must be a valid hex color code (with or without alpha)'
	);

const RoomThemeSchema: z.ZodType<MeetRoomTheme> = z.object({
	name: z
		.string()
		.min(1, 'Theme name cannot be empty')
		.max(50, 'Theme name cannot exceed 50 characters')
		.regex(/^[a-zA-Z0-9_-]+$/, 'Theme name can only contain letters, numbers, hyphens and underscores'),
	enabled: z.boolean(),
	baseTheme: ThemeModeSchema,
	backgroundColor: hexColorSchema.optional(),
	primaryColor: hexColorSchema.optional(),
	secondaryColor: hexColorSchema.optional(),
	accentColor: hexColorSchema.optional(),
	surfaceColor: hexColorSchema.optional()
});

export const AppearanceConfigSchema: z.ZodType<MeetAppearanceConfig> = z.object({
	themes: z.array(RoomThemeSchema).length(1, 'There must be exactly one theme defined')
});

/**
 * Schema for updating room config (partial updates allowed)
 * Used when updating an existing room's config - missing fields keep their current values
 */
const UpdateRoomConfigSchema: z.ZodType<Partial<MeetRoomConfig>> = z
	.object({
		security: MeetingSecurityConfigSchema.optional(),
		recording: RecordingConfigSchema.optional(),
		chat: ChatConfigSchema.optional(),
		virtualBackground: VirtualBackgroundConfigSchema.optional(),
		e2ee: E2EEConfigSchema.optional(),
		captions: CaptionsConfigSchema.optional()
		// appearance: AppearanceConfigSchema,
	})
	.transform((data: Partial<MeetRoomConfig>) => {
		// Automatically disable recording when E2EE is enabled
		if (data.e2ee?.enabled && data.recording?.enabled) {
			data.recording = {
				...data.recording,
				enabled: false
			};
		}

		return data;
	});

/**
 * Schema for creating room config (applies defaults for missing fields)
 * Used when creating a new room - missing fields get default values
 *
 * IMPORTANT: Using functions in .default() to avoid shared mutable state.
 * Each call creates a new object instance instead of reusing the same reference.
 */
const CreateRoomConfigSchema: z.ZodType<Partial<MeetRoomConfig>> = z
	.object({
		security: MeetingSecurityConfigSchema.optional().default({
			securityLevel: 'standard',
			waitingRoomEnabled: false,
			locked: false,
			accessScope: 'anyone_with_link',
			allowJoinBeforeHost: true,
			muteOnEntry: true,
			allowSelfUnmute: true,
			screenSharePolicy: 'all_participants',
			allowParticipantRename: true,
			allowMultipleDevices: false,
			watermarkEnabled: false
		}),
		recording: RecordingConfigSchema.optional().default(() => ({
			enabled: true,
			layout: MeetRecordingLayout.GRID,
			encoding: MeetRecordingEncodingPreset.H264_720P_30
		})),
		chat: ChatConfigSchema.optional().default(() => ({ enabled: true })),
		virtualBackground: VirtualBackgroundConfigSchema.optional().default(() => ({ enabled: true })),
		e2ee: E2EEConfigSchema.optional().default(() => ({ enabled: false })),
		captions: CaptionsConfigSchema.optional().default(() => ({ enabled: true }))
		// appearance: AppearanceConfigSchema,
	})
	.transform((data) => {
		// Apply default layout if not provided
		if (data.recording.layout === undefined) {
			data.recording.layout = MeetRecordingLayout.GRID;
		}

		// Apply default encoding if not provided
		if (data.recording.encoding === undefined) {
			data.recording.encoding = MeetRecordingEncodingPreset.H264_720P_30;
		}

		// Automatically disable recording when E2EE is enabled
		if (data.e2ee.enabled && data.recording.enabled) {
			data.recording = {
				...data.recording,
				enabled: false
			};
		}

		return data as MeetRoomConfig;
	});

const RoomDeletionPolicyWithMeetingSchema: z.ZodType<MeetRoomDeletionPolicyWithMeeting> = z.nativeEnum(
	MeetRoomDeletionPolicyWithMeeting
);

const RoomDeletionPolicyWithRecordingsSchema: z.ZodType<MeetRoomDeletionPolicyWithRecordings> = z.nativeEnum(
	MeetRoomDeletionPolicyWithRecordings
);

const RoomAutoDeletionPolicySchema: z.ZodType<MeetRoomAutoDeletionPolicy> = z.object({
	withMeeting: RoomDeletionPolicyWithMeetingSchema,
	withRecordings: RoomDeletionPolicyWithRecordingsSchema
});

const RoomRolesConfigSchema: z.ZodType<MeetRoomRolesConfig> = z.object({
	moderator: z
		.object({
			permissions: PartialMeetPermissionsSchema
		})
		.optional(),
	speaker: z
		.object({
			permissions: PartialMeetPermissionsSchema
		})
		.optional()
});

const RoomAccessConfigSchema: z.ZodType<MeetRoomAccessConfig> = z.object({
	anonymous: z
		.object({
			moderator: z
				.object({
					enabled: z.boolean()
				})
				.optional(),
			speaker: z
				.object({
					enabled: z.boolean()
				})
				.optional(),
			recording: z
				.object({
					enabled: z.boolean()
				})
				.optional()
		})
		.optional(),
	user: z
		.object({
			enabled: z.boolean()
		})
		.optional()
});

export const RoomOptionsSchema: z.ZodType<MeetRoomOptions> = z.object({
	roomName: z
		.string()
		.max(50, 'roomName cannot exceed 50 characters')
		.transform(MeetRoomHelper.sanitizeRoomName)
		.optional()
		.default('Room'),
	schedule: z
		.object({
			startDate: z.number().int().positive(),
			durationMinutes: z.number().int().min(15).max(1440),
			timezone: z.string().min(1).max(100),
			recurrence: z.enum(['none', 'daily', 'weekly']),
			allowEarlyJoinMinutes: z.number().int().min(0).max(120)
		})
		.optional(),
	autoDeletionDate: z
		.number()
		.positive('autoDeletionDate must be a positive integer')
		.refine(
			(date) => date >= Date.now() + ms(INTERNAL_CONFIG.MIN_ROOM_AUTO_DELETE_DURATION),
			`autoDeletionDate must be at least ${INTERNAL_CONFIG.MIN_ROOM_AUTO_DELETE_DURATION} in the future`
		)
		.optional(),
	autoDeletionPolicy: RoomAutoDeletionPolicySchema.optional()
		.default(() => ({
			withMeeting: MeetRoomDeletionPolicyWithMeeting.WHEN_MEETING_ENDS,
			withRecordings: MeetRoomDeletionPolicyWithRecordings.CLOSE
		}))
		.refine(
			(policy) => {
				return !policy || policy.withMeeting !== MeetRoomDeletionPolicyWithMeeting.FAIL;
			},
			{
				message: 'FAIL policy is not allowed for withMeeting auto-deletion policy',
				path: ['withMeeting']
			}
		)
		.refine(
			(policy) => {
				return !policy || policy.withRecordings !== MeetRoomDeletionPolicyWithRecordings.FAIL;
			},
			{
				message: 'FAIL policy is not allowed for withRecordings auto-deletion policy',
				path: ['withRecordings']
			}
		),
	config: CreateRoomConfigSchema.optional().default({
		security: {
			securityLevel: 'standard',
			waitingRoomEnabled: false,
			locked: false,
			accessScope: 'anyone_with_link',
			allowJoinBeforeHost: true,
			muteOnEntry: true,
			allowSelfUnmute: true,
			screenSharePolicy: 'all_participants',
			allowParticipantRename: true,
			allowMultipleDevices: false,
			watermarkEnabled: false
		},
		recording: {
			enabled: true,
			layout: MeetRecordingLayout.GRID,
			encoding: MeetRecordingEncodingPreset.H264_720P_30
		},
		chat: { enabled: true },
		virtualBackground: { enabled: true },
		e2ee: { enabled: false },
		captions: { enabled: true }
	}),
	roles: RoomRolesConfigSchema.optional(),
	access: RoomAccessConfigSchema.optional().default({
		anonymous: {
			moderator: { enabled: true },
			speaker: { enabled: true },
			recording: { enabled: true }
		},
		user: { enabled: false }
	})
	// maxParticipants: z
	// 	.number()
	// 	.positive('Max participants must be a positive integer')
	// 	.nullable()
	// 	.optional()
	// 	.default(null)
});

// Shared extraFields validation schema for Room entity
// Validates and transforms comma-separated string to typed array
const extraFieldsSchema = z
	.string()
	.optional()
	.transform((value) => {
		// Transform to typed array of MeetRoomExtraField
		if (!value) return undefined;

		const allowed = MEET_ROOM_EXTRA_FIELDS;
		const requested = value.split(',').map((p) => p.trim());
		const valid = requested.filter((p) => allowed.includes(p as MeetRoomExtraField));

		return valid.length > 0 ? (valid as MeetRoomExtraField[]) : undefined;
	});

// Shared fields validation schema for Room entity
// Validates and transforms comma-separated string to typed array
// IMPORTANT: Only allows BASE fields (non-extra fields) in the 'fields' parameter.
// Any extra fields included in 'fields' will be automatically filtered out.
// Extra fields MUST be requested via the 'extraFields' parameter.
const fieldsSchema = z
	.string()
	.optional()
	.transform((value) => {
		if (!value) return undefined;

		const requested = value
			.split(',')
			.map((field) => field.trim())
			.filter((field) => field !== '');

		// Filter: only keep valid BASE fields (exclude extra fields)
		// This ensures 'fields' parameter can ONLY contain base fields
		const validBaseFields = requested.filter((field) => {
			// Must be a valid field AND NOT an extra field
			return (
				MEET_ROOM_FIELDS.includes(field as MeetRoomField) &&
				!MEET_ROOM_EXTRA_FIELDS.includes(field as MeetRoomExtraField)
			);
		}) as MeetRoomField[];

		// Deduplicate
		const unique = Array.from(new Set(validBaseFields));

		return unique.length > 0 ? unique : undefined;
	});

export const RoomFiltersSchema = z
	.object({
		roomName: z.string().optional(),
		roomNameMatchMode: z.nativeEnum(TextMatchMode).optional(),
		roomNameCaseInsensitive: z.preprocess((arg) => {
			if (typeof arg === 'string') {
				if (arg.toLowerCase() === 'true') return true;

				if (arg.toLowerCase() === 'false') return false;
			}

			return arg;
		}, z.boolean().optional().default(false)),
		owner: z.string().min(1, 'owner cannot be empty').optional(),
		member: z.string().min(1, 'member cannot be empty').optional(),
		userAccess: z.preprocess((arg) => {
			if (typeof arg === 'string') {
				if (arg.toLowerCase() === 'true') return true;

				if (arg.toLowerCase() === 'false') return false;
			}

			return arg;
		}, z.boolean().optional()),
		status: z.nativeEnum(MeetRoomStatus).optional(),
		fields: fieldsSchema,
		extraFields: extraFieldsSchema,
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
		sortField: z.enum(MEET_ROOM_SORT_FIELDS).optional().default('creationDate'),
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

export const RoomQueryFieldsSchema = z.object({
	fields: fieldsSchema,
	extraFields: extraFieldsSchema
});

/**
 * Schema for validating X-Fields and X-ExtraFields headers.
 * Used across all room operations to support field filtering via headers.
 */
export const RoomHeaderFieldsSchema = z.object({
	'x-fields': fieldsSchema,
	'x-extrafields': extraFieldsSchema
});

/**
 * Merges validated header field values into query params.
 * Headers are merged with query params using union (deduplication).
 * If a header and query param overlap, the merged result contains unique values from both.
 *
 * This allows controllers to only read from req.query regardless of whether
 * the client used headers, query params, or both.
 *
 * @param headers - The request headers object
 * @param query - The current query params object (will be mutated)
 */
export function mergeHeaderFieldsIntoQuery(headers: Record<string, unknown>, query: Record<string, unknown>): void {
	const headerResult = RoomHeaderFieldsSchema.safeParse(headers);

	if (!headerResult.success) {
		// If headers are invalid, skip merging (they'll be ignored)
		return;
	}

	const headerFields = headerResult.data['x-fields'];
	const headerExtraFields = headerResult.data['x-extrafields'];

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

	if (headerExtraFields) {
		const existingExtraFields =
			typeof query.extraFields === 'string'
				? query.extraFields
						.split(',')
						.map((f: string) => f.trim())
						.filter((f: string) => f !== '')
				: [];
		const merged = Array.from(new Set([...existingExtraFields, ...headerExtraFields]));
		query.extraFields = merged.join(',');
	}
}

export const DeleteRoomReqSchema = z.object({
	fields: fieldsSchema,
	extraFields: extraFieldsSchema,
	withMeeting: RoomDeletionPolicyWithMeetingSchema.optional().default(MeetRoomDeletionPolicyWithMeeting.FAIL),
	withRecordings: RoomDeletionPolicyWithRecordingsSchema.optional().default(MeetRoomDeletionPolicyWithRecordings.FAIL)
});

export const BulkDeleteRoomsReqSchema = z.object({
	roomIds: z.preprocess(
		(arg) => {
			// First, convert input to array of strings
			let roomIds: string[] = [];

			if (typeof arg === 'string') {
				roomIds = arg
					.split(',')
					.map((s) => s.trim())
					.filter((s) => s !== '');
			} else if (Array.isArray(arg)) {
				roomIds = arg.map((item) => String(item)).filter((s) => s !== '');
			}

			// Apply sanitization BEFORE validation and deduplicate
			// This prevents identical IDs from being processed separately
			const sanitizedIds = new Set();

			// Pre-sanitize to check for duplicates that would become identical
			for (const id of roomIds) {
				const transformed = MeetRoomHelper.sanitizeRoomId(id);

				// Only add non-empty IDs
				if (transformed !== '') {
					sanitizedIds.add(transformed);
				}
			}

			return Array.from(sanitizedIds);
		},
		z.array(z.string()).min(1, {
			message: 'At least one valid roomId is required after sanitization'
		})
	),
	fields: fieldsSchema,
	extraFields: extraFieldsSchema,
	withMeeting: RoomDeletionPolicyWithMeetingSchema.optional().default(MeetRoomDeletionPolicyWithMeeting.FAIL),
	withRecordings: RoomDeletionPolicyWithRecordingsSchema.optional().default(MeetRoomDeletionPolicyWithRecordings.FAIL)
});

export const UpdateRoomConfigReqSchema = z.object({
	config: UpdateRoomConfigSchema
});

export const UpdateRoomRolesReqSchema = z.object({
	roles: RoomRolesConfigSchema
});

export const UpdateRoomAccessReqSchema = z.object({
	access: RoomAccessConfigSchema
});

export const UpdateRoomStatusReqSchema = z.object({
	status: z.enum([MeetRoomStatus.OPEN, MeetRoomStatus.CLOSED])
});

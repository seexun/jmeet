import { expect } from '@jest/globals';
import {
	LiveKitPermissions,
	MeetingEndAction,
	MeetRecordingEncodingOptions,
	MeetRecordingEncodingPreset,
	MeetRecordingInfo,
	MeetRecordingLayout,
	MeetRecordingStatus,
	MeetRoom,
	MeetRoomAutoDeletionPolicy,
	MeetRoomConfig,
	MeetRoomMemberPermissions,
	MeetRoomMemberUIBadge,
	MeetRoomStatus,
	TrackSource
} from '@openvidu-meet/typings';
import { Response } from 'supertest';
import { container } from '../../src/config/dependency-injector.config';
import { INTERNAL_CONFIG } from '../../src/config/internal-config';
import { TokenService } from '../../src/services/token.service';
import { getFullPath } from './request-helpers';

export const DEFAULT_RECORDING_ENCODING_PRESET = MeetRecordingEncodingPreset.H264_720P_30;
export const DEFAULT_RECORDING_LAYOUT = MeetRecordingLayout.GRID;

export const expectErrorResponse = (
	response: Response,
	status = 422,
	error = 'Unprocessable Entity',
	message = 'Invalid request',
	details?: Array<{ field?: string; message: string }>
) => {
	expect(response.status).toBe(status);
	expect(response.body).toMatchObject({
		...(error ? { error } : {}),
		...(message ? { message } : {})
	});

	if (details === undefined) {
		expect(response.body.details).toBeUndefined();
		return;
	}

	expect(Array.isArray(response.body.details)).toBe(true);
	expect(response.body.details).toEqual(
		expect.arrayContaining(
			details.map((d) => {
				const matcher: any = { message: expect.stringContaining(d.message) };

				if (d.field !== undefined) {
					matcher.field = d.field;
				}

				return expect.objectContaining(matcher);
			})
		)
	);
};

export const expectValidationError = (response: Response, field: string, message: string) => {
	expectErrorResponse(response, 422, 'Unprocessable Entity', 'Invalid request', [{ field, message }]);
};

/**
 * Asserts that a rooms response matches the expected values for testing purposes.
 * Validates the room array length and pagination properties.
 *
 * @param body - The API response body to validate
 * @param expectedRoomLength - The expected number of rooms in the response
 * @param expectedMaxItems - The expected maximum number of items in pagination
 * @param expectedTruncated - The expected value for pagination.isTruncated flag
 * @param expectedNextPageToken - The expected presence of pagination.nextPageToken
 *                               (if true, expects nextPageToken to be defined;
 *                                if false, expects nextPageToken to be undefined)
 */
export const expectSuccessRoomsResponse = (
	response: Response,
	expectedRoomLength: number,
	expectedMaxItems: number,
	expectedTruncated: boolean,
	expectedNextPageToken: boolean
) => {
	const { body } = response;
	expect(response.status).toBe(200);
	expect(body).toBeDefined();
	expect(body.rooms).toBeDefined();
	expect(Array.isArray(body.rooms)).toBe(true);
	expect(body.rooms.length).toBe(expectedRoomLength);
	expect(body.pagination).toBeDefined();
	expect(body.pagination.isTruncated).toBe(expectedTruncated);

	expectedNextPageToken
		? expect(body.pagination.nextPageToken).toBeDefined()
		: expect(body.pagination.nextPageToken).toBeUndefined();
	expect(body.pagination.maxItems).toBe(expectedMaxItems);
};

export const expectSuccessRoomResponse = (
	response: Response,
	roomName: string,
	roomIdPrefix?: string,
	autoDeletionDate?: number,
	config?: MeetRoomConfig
) => {
	expect(response.status).toBe(200);
	expectValidRoom(response.body, roomName, roomIdPrefix, config, autoDeletionDate);
};

export const expectSuccessRoomConfigResponse = (response: Response, config: MeetRoomConfig) => {
	expect(response.status).toBe(200);
	expect(response.body).toBeDefined();
	expect(response.body).toEqual(config);
};

export const expectExtraFieldsInResponse = (room: MeetRoom) => {
	expect((room as any)._extraFields).toBeDefined();
	expect((room as any)._extraFields).toContain('config');
	expect((room as any)._extraFields).toContain('roles');
};

export const expectValidRoom = (
	room: MeetRoom,
	name: string,
	roomIdPrefix?: string,
	config?: MeetRoomConfig,
	autoDeletionDate?: number,
	autoDeletionPolicy?: MeetRoomAutoDeletionPolicy,
	status?: MeetRoomStatus,
	meetingEndAction?: MeetingEndAction
) => {
	expect(room).toBeDefined();

	expect(room.roomId).toBeDefined();
	expect(room.roomName).toBeDefined();
	expect(room.roomName).toBe(name);
	expect(room.roomId).not.toBe('');

	if (roomIdPrefix) {
		expect(room.roomId.startsWith(roomIdPrefix)).toBe(true);
	}

	expect(room.creationDate).toBeDefined();

	if (autoDeletionDate !== undefined) {
		expect(room.autoDeletionDate).toBeDefined();
		expect(room.autoDeletionDate).toBe(autoDeletionDate);
	} else {
		expect(room.autoDeletionDate).toBeUndefined();
		expect(room.autoDeletionPolicy).toBeUndefined();
	}

	if (autoDeletionPolicy !== undefined) {
		expect(room.autoDeletionPolicy).toBeDefined();
		expect(room.autoDeletionPolicy).toEqual(autoDeletionPolicy);
	}

	// Validate config based on parameter:
	// - If config is provided: verify it exists and matches the expected value
	// - If config is undefined: verify the property does not exist
	if (config === undefined) {
		expect(room.config).toBeUndefined();
	} else {
		expect(room.config).toBeDefined();
		// Use toMatchObject to allow encoding defaults to be added without breaking tests
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		expect(room.config).toMatchObject(config as any);
	}

	expect(room.owner).toBeDefined();
	expect(room.access).toBeDefined();
	expect(room.access.anonymous.moderator).toBeDefined();
	expect(room.access.anonymous.speaker).toBeDefined();
	expect(room.access.anonymous.recording).toBeDefined();
	expect(room.access.user).toBeDefined();
	expect(room.access.anonymous.moderator.enabled).toBeDefined();
	expect(room.access.anonymous.speaker.enabled).toBeDefined();
	expect(room.access.anonymous.recording.enabled).toBeDefined();
	expect(room.access.user.enabled).toBeDefined();
	expect(room.access.anonymous.moderator.url).toBeDefined();
	expect(room.access.anonymous.speaker.url).toBeDefined();
	expect(room.access.anonymous.recording.url).toBeDefined();
	expect(room.access.user.url).toBeDefined();
	expect(room.access.anonymous.moderator.url).toContain(room.roomId);
	expect(room.access.anonymous.speaker.url).toContain(room.roomId);
	expect(room.access.anonymous.recording.url).toContain(room.roomId);
	expect(room.access.user.url).toContain(room.roomId);

	expect(room.status).toBeDefined();
	expect(room.status).toEqual(status || MeetRoomStatus.OPEN);
	expect(room.meetingEndAction).toBeDefined();
	expect(room.meetingEndAction).toEqual(meetingEndAction || MeetingEndAction.NONE);
};

export const expectValidRecording = (
	recording: MeetRecordingInfo,
	recordingId: string,
	roomId: string,
	roomName: string,
	status: MeetRecordingStatus
) => {
	expect(recording).toBeDefined();
	expect(recording.recordingId).toBeDefined();
	expect(recording.roomId).toBeDefined();
	expect(recording.roomName).toBeDefined();
	expect(recording.recordingId).toBe(recordingId);
	expect(recording.roomId).toBe(roomId);
	expect(recording.roomName).toBe(roomName);
	expect(recording.startDate).toBeDefined();
	expect(recording.status).toBeDefined();
	expect(recording.status).toBe(status);
	expect(recording.filename).toBeDefined();
	expect(recording.details).toBeDefined();
	expect(recording.layout).toBeDefined();

	// Validate layout is a valid value
	if (recording.layout !== undefined) {
		expect(Object.values(MeetRecordingLayout)).toContain(recording.layout);
	}

	// Validate encoding is present and has a valid value
	expect(recording.encoding).toBeDefined();

	if (recording.encoding !== undefined) {
		if (typeof recording.encoding === 'string') {
			// Encoding preset: should match the default H264_720P_30
			expect(recording.encoding).toBe('H264_720P_30');
		} else {
			// Advanced encoding options: should have valid codec values
			expect(typeof recording.encoding).toBe('object');
			const encodingObj = recording.encoding as MeetRecordingEncodingOptions;

			if (encodingObj.video?.codec) {
				expect(['H264_BASELINE', 'H264_MAIN', 'H264_HIGH', 'VP8']).toContain(encodingObj.video.codec);
			}

			if (encodingObj.audio?.codec) {
				expect(['OPUS', 'AAC']).toContain(encodingObj.audio.codec);
			}
		}
	}
};

export const expectValidRoomWithFields = (room: MeetRoom, fields: string[] = []) => {
	expect(room).toBeDefined();
	expectObjectFields(room, fields);
};

export const expectValidRecordingWithFields = (rec: MeetRecordingInfo, fields: string[] = []) => {
	expect(rec).toBeDefined();
	expectObjectFields(rec, fields);
};

const expectObjectFields = (obj: unknown, present: string[] = [], absent: string[] = []) => {
	expect(Object.keys(obj as any)).toEqual(expect.arrayContaining(present));
	present.forEach((key) => {
		expect(obj).toHaveProperty(key);
		expect((obj as any)[key]).not.toBeUndefined();
	});
	absent.forEach((key) => {
		// if the property exists, it must be undefined. If it doesn't exist, it's also valid (not present)
		expect(Object.prototype.hasOwnProperty.call(obj, key) ? (obj as any)[key] : undefined).toBeUndefined();
	});
};

// Validate recording location header in the response
export const expectValidRecordingLocationHeader = (response: Response) => {
	const locationHeader = response.headers.location;
	expect(locationHeader).toBeDefined();
	const locationHeaderUrl = new URL(locationHeader);
	expect(locationHeaderUrl.pathname).toBe(
		getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/recordings/${response.body.recordingId}`)
	);
};

/**
 * Validates a successful recording media response, supporting edge cases and range requests.
 *
 * @param response - The HTTP response object to validate
 * @param range - Optional range header that was sent in the request
 * @param fullSize - Optional total file size for range validation
 * @param options - Optional configuration to handle edge cases:
 *   - allowSizeDifference: Allows a difference between content-length and actual body size (default: false)
 *   - ignoreRangeFormat: Ignores exact range format checking (useful for adjusted ranges) (default: false)
 *   - expectedStatus: Override the expected status code (default: auto-determined based on range)
 */
export const expectSuccessRecordingMediaResponse = (
	response: Response,
	range?: string,
	fullSize?: number,
	options?: {
		allowSizeDifference?: boolean;
		ignoreRangeFormat?: boolean;
		expectedStatus?: number;
	}
) => {
	// Default options
	const opts = {
		allowSizeDifference: false,
		ignoreRangeFormat: false,
		...options
	};

	// Determine expected status
	const expectedStatus = opts.expectedStatus ?? (range ? 206 : 200);

	// Basic validations for any successful response
	expect(response.status).toBe(expectedStatus);
	expect(response.headers['content-type']).toBe('video/mp4');
	expect(response.headers['accept-ranges']).toBe('bytes');
	expect(response.headers['content-length']).toBeDefined();
	expect(parseInt(response.headers['content-length'])).toBeGreaterThan(0);
	expect(response.headers['cache-control']).toBeDefined();

	// Verify response is binary data with some size
	expect(response.body).toBeInstanceOf(Buffer);
	expect(response.body.length).toBeGreaterThan(0);

	// Handle range responses (206 Partial Content)
	if (range && expectedStatus === 206) {
		// Verify the content-range header
		expect(response.headers['content-range']).toBeDefined();

		// If ignoreRangeFormat is true, only check the format of the content-range header
		if (opts.ignoreRangeFormat) {
			expect(response.headers['content-range']).toMatch(/^bytes \d+-\d+\/\d+$/);

			if (fullSize) {
				// Verify the total size in content-range header
				const totalSizeMatch = response.headers['content-range'].match(/\/(\d+)$/);

				if (totalSizeMatch) {
					expect(parseInt(totalSizeMatch[1])).toBe(fullSize);
				}
			}
		} else {
			// Extract the requested range from the request header
			const rangeMatch = range.match(/^bytes=(\d+)-(\d*)$/);

			if (!rangeMatch) {
				throw new Error(`Invalid range format: ${range}`);
			}

			const requestedStart = parseInt(rangeMatch[1]);
			const requestedEnd = rangeMatch[2] ? parseInt(rangeMatch[2]) : fullSize ? fullSize - 1 : undefined;

			expect(requestedStart).not.toBeNaN();

			// Verify the range in the response
			const contentRangeMatch = response.headers['content-range'].match(/^bytes (\d+)-(\d+)\/(\d+)$/);

			if (!contentRangeMatch) {
				throw new Error(`Invalid content-range format: ${response.headers['content-range']}`);
			}

			const actualStart = parseInt(contentRangeMatch[1]);
			const actualEnd = parseInt(contentRangeMatch[2]);
			const actualTotal = parseInt(contentRangeMatch[3]);

			// Verify the start matches
			expect(actualStart).toBe(requestedStart);

			// If full size is provided, verify the total is correct
			if (fullSize) {
				expect(actualTotal).toBe(fullSize);

				// The end may be adjusted if it exceeds the total size
				if (requestedEnd !== undefined && requestedEnd >= fullSize) {
					expect(actualEnd).toBe(fullSize - 1);
				} else if (requestedEnd !== undefined) {
					expect(actualEnd).toBe(requestedEnd);
				}
			}
		}

		// Verify that Content-Length is consistent
		const declaredLength = parseInt(response.headers['content-length']);
		expect(declaredLength).toBeGreaterThan(0);

		// If size differences are not allowed, body length must match exactly
		if (!opts.allowSizeDifference) {
			expect(response.body.length).toBe(declaredLength);
		} else {
			// Allow some difference but ensure it's within a reasonable tolerance
			const bodyLength = response.body.length;
			const diff = Math.abs(bodyLength - declaredLength);
			const tolerance = Math.max(declaredLength * 0.05, 10); // 5% or at least 10 bytes

			expect(diff).toBeLessThanOrEqual(tolerance);
		}
	} else if (expectedStatus === 200) {
		// For full content responses
		const declaredLength = parseInt(response.headers['content-length']);

		if (!opts.allowSizeDifference) {
			expect(response.body.length).toBe(declaredLength);
		}

		// If full size is provided, content-length must match
		if (fullSize !== undefined) {
			expect(declaredLength).toBe(fullSize);
		}
	}
};

export const expectValidStartRecordingResponse = (
	response: Response,
	roomId: string,
	roomName: string,
	expectedLayout?: MeetRecordingLayout,
	expectedEncoding?: MeetRecordingEncodingPreset | MeetRecordingEncodingOptions
) => {
	expect(response.status).toBe(201);
	expect(response.body).toHaveProperty('recordingId');

	expectValidRecordingLocationHeader(response);

	const recordingId = response.body.recordingId;
	expect(recordingId).toBeDefined();

	expect(recordingId).toContain(roomId);
	expect(response.body).toHaveProperty('roomId', roomId);
	expect(response.body).toHaveProperty('roomName', roomName);
	expect(response.body).toHaveProperty('startDate');
	expect(response.body).toHaveProperty('status', 'active');
	expect(response.body).toHaveProperty('filename');
	expect(response.body).toHaveProperty('layout');
	expect(response.body).not.toHaveProperty('duration');
	expect(response.body).not.toHaveProperty('endDate');
	expect(response.body).not.toHaveProperty('size');

	expect(response.body.layout).toBeDefined();
	expect(response.body.encoding).toBeDefined();

	// Validate expected layout if provided
	if (expectedLayout) {
		expect(response.body.layout).toEqual(expectedLayout);
	} else {
		// Default layout
		expect(response.body.layout).toEqual(DEFAULT_RECORDING_LAYOUT);
	}

	if (expectedEncoding !== undefined) {
		if (typeof expectedEncoding === 'string') {
			// Encoding preset
			expect(response.body.encoding).toEqual(expectedEncoding);
		} else {
			// Advanced encoding options
			expect(response.body.encoding).toMatchObject(expectedEncoding as any);
		}
	} else {
		// Default encoding preset
		expect(response.body.encoding).toEqual(DEFAULT_RECORDING_ENCODING_PRESET);
	}
};

export const expectValidStopRecordingResponse = (
	response: Response,
	recordingId: string,
	roomId: string,
	roomName: string,
	expectedLayout?: MeetRecordingLayout,
	expectedEncoding?: MeetRecordingEncodingPreset | MeetRecordingEncodingOptions
) => {
	expect(response.status).toBe(202);
	expect(response.body).toBeDefined();
	expectValidRecordingLocationHeader(response);
	expect(response.body).toHaveProperty('recordingId', recordingId);
	expect([MeetRecordingStatus.COMPLETE, MeetRecordingStatus.ENDING]).toContain(response.body.status);
	expect(response.body).toHaveProperty('roomId', roomId);
	expect(response.body).toHaveProperty('roomName', roomName);
	expect(response.body).toHaveProperty('filename');
	expect(response.body).toHaveProperty('startDate');
	expect(response.body).toHaveProperty('duration', expect.any(Number));
	expect(response.body).toHaveProperty('layout');
	expect(response.body).toHaveProperty('encoding');

	// Validate layout is a valid value
	if (expectedLayout) {
		expect(response.body.layout).toEqual(expectedLayout);
	} else {
		// Default layout
		expect(response.body.layout).toEqual(DEFAULT_RECORDING_LAYOUT);
	}

	// Validate encoding property
	if (expectedEncoding) {
		expect(response.body.encoding).toEqual(expectedEncoding);
	} else {
		// Default encoding preset
		expect(response.body.encoding).toEqual(DEFAULT_RECORDING_ENCODING_PRESET);
	}
};

export const expectValidGetRecordingResponse = (
	response: Response,
	expectedConfig: {
		recordingId: string;
		roomId: string;
		roomName: string;
		recordingStatus?: MeetRecordingStatus;
		recordingDuration?: number;
		recordingLayout?: MeetRecordingLayout;
		recordingEncoding?: MeetRecordingEncodingPreset | MeetRecordingEncodingOptions;
	}
) => {
	expect(response.status).toBe(200);
	expect(response.body).toBeDefined();
	const body = response.body;

	const { recordingId, roomId, roomName, recordingStatus, recordingDuration, recordingLayout, recordingEncoding } =
		expectedConfig;

	expect(body).toMatchObject({ recordingId, roomId, roomName });

	// Validate layout property
	expect(body).toHaveProperty('layout');
	expect(body.layout).toBeDefined();

	if (recordingLayout !== undefined) {
		expect(body.layout).toBe(recordingLayout);
	} else {
		// Default layout
		expect(body.layout).toBe(DEFAULT_RECORDING_LAYOUT);
	}

	// Validate encoding property
	expect(body).toHaveProperty('encoding');
	expect(body.encoding).toBeDefined();

	// Validate encoding property is present and coherent
	if (recordingEncoding !== undefined) {
		if (typeof recordingEncoding === 'string') {
			expect(body.layout).toBe(recordingLayout);
		} else {
			expect(body.encoding).toMatchObject(recordingEncoding as any);
		}
	} else {
		// Default encoding preset
		expect(body.encoding).toBe(DEFAULT_RECORDING_ENCODING_PRESET);
	}

	expect(body.status).toBeDefined();

	if (recordingStatus !== undefined) {
		expect(body.status).toBe(recordingStatus);
	}

	const isRecFinished =
		recordingStatus &&
		(recordingStatus === MeetRecordingStatus.COMPLETE ||
			recordingStatus === MeetRecordingStatus.ABORTED ||
			recordingStatus === MeetRecordingStatus.FAILED ||
			recordingStatus === MeetRecordingStatus.LIMIT_REACHED);
	expect(body).toEqual(
		expect.objectContaining({
			recordingId: expect.stringMatching(new RegExp(`^${recordingId}$`)),
			roomId: expect.stringMatching(new RegExp(`^${roomId}$`)),
			roomName: expect.stringMatching(new RegExp(`^${roomName}$`)),
			...(isRecFinished ? { status: expect.any(String) } : {}),
			...(isRecFinished ? { duration: expect.any(Number) } : {}),
			...(isRecFinished ? { startDate: expect.any(Number) } : {}),
			...(isRecFinished ? { endDate: expect.any(Number) } : {}),
			...(isRecFinished ? { size: expect.any(Number) } : {}),
			filename: expect.any(String),
			...(isRecFinished ? { details: expect.any(String) } : {})
		})
	);

	if (isRecFinished) {
		expect(body.endDate).toBeGreaterThanOrEqual(body.startDate);
		expect(body.duration).toBeGreaterThanOrEqual(0);
	}

	if (isRecFinished && recordingDuration) {
		expect(body.duration).toBeLessThanOrEqual(recordingDuration);

		const computedSec = (body.endDate - body.startDate) / 1000;
		const diffSec = Math.abs(recordingDuration - computedSec);
		// Estimate 5 seconds of tolerace because of time to start/stop recording
		expect(diffSec).toBeLessThanOrEqual(5);
	}
};

export const expectSuccessListRecordingResponse = (
	response: Response,
	recordingLength: number,
	isTruncated: boolean,
	nextPageToken: boolean,
	maxItems = 10
) => {
	expect(response.status).toBe(200);
	expect(response.body).toBeDefined();
	expect(response.body.recordings).toBeDefined();
	expect(Array.isArray(response.body.recordings)).toBe(true);
	expect(response.body.recordings.length).toBe(recordingLength);
	expect(response.body.pagination).toBeDefined();
	expect(response.body.pagination.isTruncated).toBe(isTruncated);

	if (nextPageToken) {
		expect(response.body.pagination.nextPageToken).toBeDefined();
	} else {
		expect(response.body.pagination.nextPageToken).toBeUndefined();
	}

	expect(response.body.pagination.maxItems).toBeDefined();
	expect(response.body.pagination.maxItems).toBeGreaterThan(0);
	expect(response.body.pagination.maxItems).toBeLessThanOrEqual(100);
	expect(response.body.pagination.maxItems).toBe(maxItems);
};

export const expectValidGetRecordingUrlResponse = (response: Response, recordingId: string) => {
	expect(response.status).toBe(200);
	const recordingUrl = response.body.url;
	expect(recordingUrl).toBeDefined();

	const parsedUrl = new URL(recordingUrl);
	expect(parsedUrl.pathname).toBe(getFullPath(`/recording/${recordingId}`));
	expect(parsedUrl.searchParams.get('secret')).toBeDefined();
};

export const expectValidRoomMemberTokenResponse = (
	response: Response,
	validations: {
		roomId: string;
		memberId?: string;
		userId?: string;
		permissions: MeetRoomMemberPermissions;
		badge?: MeetRoomMemberUIBadge;
		isPromotedModerator?: boolean;
		joinMeeting?: boolean;
		participantName?: string;
		participantIdentityPrefix?: string;
	}
) => {
	const {
		roomId,
		memberId,
		userId,
		permissions,
		badge,
		isPromotedModerator,
		joinMeeting = false,
		participantName,
		participantIdentityPrefix
	} = validations;

	expect(response.status).toBe(200);
	expect(response.body).toHaveProperty('token');

	const token = response.body.token;
	const decodedToken = decodeJWTToken(token);

	if (joinMeeting) {
		expect(participantName).toBeDefined();
		expect(decodedToken).toHaveProperty('name', participantName);
		expect(decodedToken).toHaveProperty('sub');

		if (memberId || userId) {
			expect(decodedToken.sub).toBe(memberId || userId);
		} else if (participantIdentityPrefix) {
			expect(decodedToken.sub?.startsWith(participantIdentityPrefix)).toBe(true);
		}

		const livekitPermissions = getLiveKitPermissions(roomId, permissions!);
		expect(decodedToken).toHaveProperty('video', livekitPermissions);
	} else {
		expect(decodedToken).not.toHaveProperty('name');
		expect(decodedToken).not.toHaveProperty('sub');
		expect(decodedToken).not.toHaveProperty('video');
	}

	expect(decodedToken).toHaveProperty('metadata');
	const metadata = JSON.parse(decodedToken.metadata || '{}');
	expect(metadata).toHaveProperty('iat');
	expect(metadata).toHaveProperty('roomId', roomId);
	expect(metadata).toHaveProperty('permissions', permissions);
	expect(metadata).toHaveProperty('badge', badge);

	if (memberId) {
		expect(metadata).toHaveProperty('memberId', memberId);
	} else {
		expect(metadata).not.toHaveProperty('memberId');
	}

	if (userId) {
		expect(metadata).toHaveProperty('userId', userId);
	} else {
		expect(metadata).not.toHaveProperty('userId');
	}

	if (isPromotedModerator !== undefined) {
		expect(metadata).toHaveProperty('isPromotedModerator', isPromotedModerator);
	} else {
		expect(metadata).not.toHaveProperty('isPromotedModerator');
	}

	if (joinMeeting) {
		expect(metadata).toHaveProperty('livekitUrl');
	} else {
		expect(metadata).not.toHaveProperty('livekitUrl');
	}
};

/** Assert a well-formed 200 response from createAssistant */
export const expectValidAssistantResponse = (response: Response, expectedId = 'dispatch-test-001') => {
	expect(response.status).toBe(201);
	expect(response.body).toMatchObject({ id: expectedId, status: 'active' });
	expect((response.body.id as string).trim().length).toBeGreaterThan(0);
};

const getLiveKitPermissions = (roomId: string, permissions: MeetRoomMemberPermissions): LiveKitPermissions => {
	const canPublishSources: TrackSource[] = [];

	if (permissions.canPublishAudio) {
		canPublishSources.push('microphone' as unknown as TrackSource);
	}

	if (permissions.canPublishVideo) {
		canPublishSources.push('camera' as unknown as TrackSource);
	}

	if (permissions.canShareScreen) {
		canPublishSources.push('screen_share' as unknown as TrackSource);
		canPublishSources.push('screen_share_audio' as unknown as TrackSource);
	}

	const livekitPermissions: LiveKitPermissions = {
		room: roomId,
		roomJoin: true,
		canPublish: permissions.canPublishAudio || permissions.canPublishVideo || permissions.canShareScreen,
		canPublishSources,
		canSubscribe: true,
		canPublishData: true,
		canUpdateOwnMetadata: true
	};
	return livekitPermissions;
};

const decodeJWTToken = (token: string) => {
	const tokenService = container.get(TokenService);
	return tokenService.getClaimsIgnoringExpiration(token);
};

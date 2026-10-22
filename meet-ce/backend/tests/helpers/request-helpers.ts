import { expect } from '@jest/globals';
import {
	MeetAppearanceConfig,
	MeetAssistantCapabilityName,
	MeetParticipantModerationAction,
	MeetRecordingEncodingOptions,
	MeetRecordingEncodingPreset,
	MeetRecordingInfo,
	MeetRecordingStatus,
	MeetRoom,
	MeetRoomAccessConfig,
	MeetRoomConfig,
	MeetRoomDeletionPolicyWithMeeting,
	MeetRoomDeletionPolicyWithRecordings,
	MeetRoomExtraField,
	MeetRoomField,
	MeetRoomMemberOptions,
	MeetRoomMemberTokenOptions,
	MeetRoomOptions,
	MeetRoomRolesConfig,
	MeetRoomStatus,
	MeetUserOptions,
	SecurityConfig,
	WebhookConfig
} from '@openvidu-meet/typings';
import { Express } from 'express';
import ms, { StringValue } from 'ms';
import request, { Response } from 'supertest';
import { container, initializeEagerServices } from '../../src/config/dependency-injector.config.js';
import { INTERNAL_CONFIG } from '../../src/config/internal-config.js';
import { MEET_ENV } from '../../src/environment.js';
import { GlobalConfigRepository } from '../../src/repositories/global-config.repository.js';
import { RoomRepository } from '../../src/repositories/room.repository.js';
import { createApp, registerDependencies } from '../../src/server.js';
import { ApiKeyService } from '../../src/services/api-key.service.js';
import { GlobalConfigService } from '../../src/services/global-config.service.js';
import { RecordingService } from '../../src/services/recording.service.js';
import { RoomScheduledTasksService } from '../../src/services/room-scheduled-tasks.service.js';
import { getBasePath } from '../../src/utils/html-dynamic-base-path.utils.js';
import {
	waitForAllRecordingsToStop,
	waitForAllRoomsToDelete,
	waitForMeetingToEnd,
	waitForRecordingToStop
} from './wait-helpers.js';

/**
 * Constructs the full API path by prepending the base path.
 * Handles trailing/leading slashes to avoid double slashes.
 */
export const getFullPath = (apiPath: string): string => {
	const basePath = getBasePath();

	// Remove trailing slash from base path if apiPath starts with /
	if (basePath.endsWith('/') && apiPath.startsWith('/')) {
		return basePath.slice(0, -1) + apiPath;
	}

	return basePath + apiPath;
};

let app: Express;

export const sleep = (time: StringValue) => {
	return new Promise((resolve) => setTimeout(resolve, ms(time)));
};

export const startTestServer = async (): Promise<Express> => {
	if (app) {
		return app;
	}

	registerDependencies();
	app = createApp();
	await initializeEagerServices();
	return app;
};

// API KEY HELPERS

export const generateApiKey = async (): Promise<string> => {
	checkAppIsRunning();

	const { accessToken } = await loginRootAdmin();
	const response = await request(app)
		.post(getFullPath(`${INTERNAL_CONFIG.INTERNAL_API_BASE_PATH_V1}/api-keys`))
		.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, accessToken)
		.send();
	expect(response.status).toBe(201);
	expect(response.body).toHaveProperty('key');
	return response.body.key;
};

export const getApiKeys = async () => {
	checkAppIsRunning();

	const { accessToken } = await loginRootAdmin();
	const response = await request(app)
		.get(getFullPath(`${INTERNAL_CONFIG.INTERNAL_API_BASE_PATH_V1}/api-keys`))
		.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, accessToken)
		.send();
	return response;
};

export const deleteApiKeys = async () => {
	checkAppIsRunning();

	const { accessToken } = await loginRootAdmin();
	const response = await request(app)
		.delete(getFullPath(`${INTERNAL_CONFIG.INTERNAL_API_BASE_PATH_V1}/api-keys`))
		.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, accessToken)
		.send();
	return response;
};

export const restoreDefaultApiKeys = async () => {
	const apiKeyService = container.get(ApiKeyService);

	// Check if there are existing API keys and delete them
	const existingKeys = await apiKeyService.getApiKeys();

	if (existingKeys.length > 0) {
		await apiKeyService.deleteApiKeys();
	}

	await apiKeyService.initializeApiKey();
};

// GLOBAL CONFIG HELPERS

export const getRoomsAppearanceConfig = async () => {
	checkAppIsRunning();

	const response = await request(app)
		.get(getFullPath(`${INTERNAL_CONFIG.INTERNAL_API_BASE_PATH_V1}/config/rooms/appearance`))
		.send();
	return response;
};

export const updateRoomsAppearanceConfig = async (config: { appearance: MeetAppearanceConfig }) => {
	checkAppIsRunning();

	const { accessToken } = await loginRootAdmin();
	const response = await request(app)
		.put(getFullPath(`${INTERNAL_CONFIG.INTERNAL_API_BASE_PATH_V1}/config/rooms/appearance`))
		.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, accessToken)
		.send(config);
	return response;
};

export const getWebhookConfig = async () => {
	checkAppIsRunning();

	const { accessToken } = await loginRootAdmin();
	const response = await request(app)
		.get(getFullPath(`${INTERNAL_CONFIG.INTERNAL_API_BASE_PATH_V1}/config/webhooks`))
		.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, accessToken)
		.send();
	return response;
};

export const updateWebhookConfig = async (config: WebhookConfig) => {
	checkAppIsRunning();

	const { accessToken } = await loginRootAdmin();
	const response = await request(app)
		.put(getFullPath(`${INTERNAL_CONFIG.INTERNAL_API_BASE_PATH_V1}/config/webhooks`))
		.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, accessToken)
		.send(config);

	return response;
};

export const testWebhookUrl = async (url: string) => {
	checkAppIsRunning();

	const response = await request(app)
		.post(getFullPath(`${INTERNAL_CONFIG.INTERNAL_API_BASE_PATH_V1}/config/webhooks/test`))
		.send({ url });
	return response;
};

export const getSecurityConfig = async () => {
	checkAppIsRunning();

	const response = await request(app)
		.get(getFullPath(`${INTERNAL_CONFIG.INTERNAL_API_BASE_PATH_V1}/config/security`))
		.send();
	return response;
};

export const updateSecurityConfig = async (config: SecurityConfig) => {
	checkAppIsRunning();

	const { accessToken } = await loginRootAdmin();
	const response = await request(app)
		.put(getFullPath(`${INTERNAL_CONFIG.INTERNAL_API_BASE_PATH_V1}/config/security`))
		.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, accessToken)
		.send(config);
	return response;
};

export const getCaptionsConfig = async () => {
	checkAppIsRunning();

	const response = await request(app)
		.get(getFullPath(`${INTERNAL_CONFIG.INTERNAL_API_BASE_PATH_V1}/config/captions`))
		.send();
	return response;
};

export const restoreDefaultGlobalConfig = async () => {
	const configService = container.get(GlobalConfigService);
	const defaultGlobalConfig = configService['getDefaultConfig']();
	const configRepository = container.get(GlobalConfigRepository);
	await configRepository.replace(defaultGlobalConfig);
};

// AUTH HELPERS

export const loginReq = async (body: { userId: string; password: string }) => {
	checkAppIsRunning();

	return await request(app)
		.post(getFullPath(`${INTERNAL_CONFIG.INTERNAL_API_BASE_PATH_V1}/auth/login`))
		.send(body);
};

/**
 * Logs in a user and returns the access and refresh (if available) tokens in the format "Bearer <token>"
 */
export const loginUser = async (
	userId: string,
	password: string
): Promise<{ accessToken: string; refreshToken?: string }> => {
	const response = await loginReq({ userId, password });
	expect(response.status).toBe(200);
	expect(response.body).toHaveProperty('accessToken');
	const accessToken = `Bearer ${response.body.accessToken}`;
	const refreshToken = response.body.refreshToken ? `Bearer ${response.body.refreshToken}` : undefined;
	return { accessToken, refreshToken };
};

/**
 * Logs in the root admin user and returns the access an refresh tokens in the format "Bearer <token>"
 */
export const loginRootAdmin = async (): Promise<{ accessToken: string; refreshToken: string }> => {
	const { accessToken, refreshToken } = await loginUser(MEET_ENV.INITIAL_ADMIN_USER, MEET_ENV.INITIAL_ADMIN_PASSWORD);
	return { accessToken, refreshToken: refreshToken! };
};

export const refreshTokenReq = async (refreshToken: string) => {
	checkAppIsRunning();

	return await request(app)
		.post(getFullPath(`${INTERNAL_CONFIG.INTERNAL_API_BASE_PATH_V1}/auth/refresh`))
		.set(INTERNAL_CONFIG.REFRESH_TOKEN_HEADER, refreshToken);
};

// USER HELPERS

export const createUser = async (options: MeetUserOptions) => {
	checkAppIsRunning();

	return await request(app)
		.post(getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/users`))
		.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
		.send(options);
};

export const getUsers = async (query: Record<string, unknown> = {}) => {
	checkAppIsRunning();

	return await request(app)
		.get(getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/users`))
		.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
		.query(query);
};

export const getUser = async (userId: string) => {
	checkAppIsRunning();

	return await request(app)
		.get(getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/users/${userId}`))
		.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
		.send();
};

export const getMe = async (accessToken: string) => {
	checkAppIsRunning();

	return await request(app)
		.get(getFullPath(`${INTERNAL_CONFIG.INTERNAL_API_BASE_PATH_V1}/users/me`))
		.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, accessToken)
		.send();
};

export const changePasswordReq = async (
	body: { currentPassword: string; newPassword: string },
	accessToken: string
) => {
	checkAppIsRunning();

	return await request(app)
		.post(getFullPath(`${INTERNAL_CONFIG.INTERNAL_API_BASE_PATH_V1}/users/change-password`))
		.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, accessToken)
		.send(body);
};

/**
 * Changes the password for the authenticated user and
 * returns the access and refresh tokens in the format "Bearer <token>" if provided.
 * If the user does not require password change, no tokens are returned
 */
export const changePassword = async (
	currentPassword: string,
	newPassword: string,
	accessToken: string
): Promise<{ accessToken?: string; refreshToken?: string }> => {
	const response = await changePasswordReq({ currentPassword, newPassword }, accessToken);
	expect(response.status).toBe(200);

	const newAccessToken = response.body.accessToken;
	const newRefreshToken = response.body.refreshToken;

	return {
		accessToken: newAccessToken ? `Bearer ${newAccessToken}` : undefined,
		refreshToken: newRefreshToken ? `Bearer ${newRefreshToken}` : undefined
	};
};

export const resetUserPassword = async (userId: string, newPassword: string, accessToken?: string) => {
	checkAppIsRunning();

	const { accessToken: rootAdminAccessToken } = await loginRootAdmin();
	return await request(app)
		.put(getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/users/${userId}/password`))
		.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, accessToken ?? rootAdminAccessToken)
		.send({ newPassword });
};

export const updateUserRole = async (userId: string, role: string, accessToken?: string) => {
	checkAppIsRunning();

	const { accessToken: rootAdminAccessToken } = await loginRootAdmin();
	return await request(app)
		.put(getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/users/${userId}/role`))
		.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, accessToken ?? rootAdminAccessToken)
		.send({ role });
};

export const deleteUser = async (userId: string, accessToken?: string) => {
	checkAppIsRunning();

	const { accessToken: rootAdminAccessToken } = await loginRootAdmin();
	return await request(app)
		.delete(getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/users/${userId}`))
		.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, accessToken ?? rootAdminAccessToken)
		.send();
};

export const bulkDeleteUsers = async (userIds: string[], accessToken?: string) => {
	checkAppIsRunning();

	const { accessToken: rootAdminAccessToken } = await loginRootAdmin();
	return await request(app)
		.delete(getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/users`))
		.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, accessToken ?? rootAdminAccessToken)
		.query({ userIds: userIds.join(',') });
};

export const deleteAllUsers = async () => {
	checkAppIsRunning();

	let nextPageToken: string | undefined;

	do {
		const response = await getUsers({ fields: 'userId', maxItems: 100, nextPageToken });
		expect(response.status).toBe(200);

		nextPageToken = response.body.pagination?.nextPageToken ?? undefined;
		const userIds = response.body.users
			.map((user: { userId: string }) => user.userId)
			.filter((userId: string) => userId !== MEET_ENV.INITIAL_ADMIN_USER);

		if (userIds.length === 0) {
			break;
		}

		await bulkDeleteUsers(userIds);
	} while (nextPageToken);
};

// ROOM HELPERS

/**
 * Creates a room with the specified options and optional headers for response customization.
 *
 * @param options - Room creation options (roomName, config, etc.)
 * @param accessToken - Optional access token for authentication (uses API key if not provided)
 * @param headers - Optional headers object supporting:
 *                  - xFields: Comma-separated list of fields to include (e.g., 'roomId,roomName')
 *                  - xExtraFields: Comma-separated list of extra fields to include (e.g., 'config')
 * @returns A Promise that resolves to the created MeetRoom
 * @example
 * ```
 * // Create room with default collapsed config
 * const room = await createRoom({ roomName: 'Test' });
 *
 * // Create room with specific fields only
 * const room = await createRoom({ roomName: 'Test' }, undefined, { xFields: 'roomId,roomName' });
 *
 * // Create room with extra fields included
 * const room = await createRoom({ roomName: 'Test' }, undefined, { xExtraFields: 'config' });
 * ```
 */
export const createRoom = async (
	options: MeetRoomOptions = {},
	accessToken?: string,
	headers?: { xFields?: string; xExtraFields?: string }
): Promise<MeetRoom> => {
	checkAppIsRunning();

	const req = request(app)
		.post(getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/rooms`))
		.send(options)
		.expect(201);

	if (accessToken) {
		req.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, accessToken);
	} else {
		req.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY);
	}

	// Add optional headers for response customization
	if (headers?.xFields) {
		req.set('x-fields', headers.xFields);
	}

	if (headers?.xExtraFields) {
		req.set('x-extrafields', headers.xExtraFields);
	}

	const response = await req;
	return response.body;
};

export const getRooms = async (
	query: Record<string, unknown> = {},
	headers?: { xFields?: string; xExtraFields?: string },
	accessToken?: string
) => {
	checkAppIsRunning();

	const req = request(app)
		.get(getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/rooms`))
		.query(query);

	if (accessToken) {
		req.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, accessToken);
	} else {
		req.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY);
	}

	if (headers?.xFields) {
		req.set('x-fields', headers.xFields);
	}

	if (headers?.xExtraFields) {
		req.set('x-extrafields', headers.xExtraFields);
	}

	return await req;
};

/**
 * Retrieves information about a specific room from the API.
 *
 * @param roomId - The unique identifier of the room to retrieve
 * @param fields - Optional fields to filter in the response
 * @param extraFields - Optional extraFields parameter to include additional data (e.g., 'config')
 * @param roomMemberToken - Optional room member token for authentication
 * @returns A Promise that resolves to the room data
 * @throws Error if the app instance is not defined
 */
export const getRoom = async (
	roomId: string,
	fields?: string,
	extraFields?: string,
	roomMemberToken?: string,
	headers?: { xFields?: string; xExtraFields?: string }
) => {
	checkAppIsRunning();

	const queryParams: Record<string, string> = {};

	if (fields) queryParams.fields = fields;

	if (extraFields) queryParams.extraFields = extraFields;

	const req = request(app)
		.get(getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/rooms/${roomId}`))
		.query(queryParams);

	if (roomMemberToken) {
		req.set(INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, roomMemberToken);
	} else {
		req.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY);
	}

	if (headers?.xFields) {
		req.set('x-fields', headers.xFields);
	}

	if (headers?.xExtraFields) {
		req.set('x-extrafields', headers.xExtraFields);
	}

	return await req;
};

export const getRoomConfig = async (roomId: string): Promise<Response> => {
	checkAppIsRunning();

	return await request(app)
		.get(getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/rooms/${roomId}/config`))
		.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
		.send();
};

export const updateRoomConfig = async (roomId: string, config: Partial<MeetRoomConfig>) => {
	checkAppIsRunning();

	return await request(app)
		.put(getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/rooms/${roomId}/config`))
		.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
		.send({ config });
};

export const updateRoomStatus = async (
	roomId: string,
	status: MeetRoomStatus,
	headers?: { xFields?: string; xExtraFields?: string }
) => {
	checkAppIsRunning();

	const req = request(app)
		.put(getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/rooms/${roomId}/status`))
		.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY);

	if (headers?.xFields) {
		req.set('x-fields', headers.xFields);
	}

	if (headers?.xExtraFields) {
		req.set('x-extrafields', headers.xExtraFields);
	}

	return await req.send({ status });
};

export const updateRoomRoles = async (roomId: string, rolesConfig: MeetRoomRolesConfig) => {
	checkAppIsRunning();

	return await request(app)
		.put(getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/rooms/${roomId}/roles`))
		.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
		.send({ roles: rolesConfig });
};

export const updateRoomAccessConfig = async (roomId: string, accessConfig: MeetRoomAccessConfig) => {
	checkAppIsRunning();

	return await request(app)
		.put(getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/rooms/${roomId}/access`))
		.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
		.send({ access: accessConfig });
};

export const deleteRoom = async (
	roomId: string,
	query: Record<string, unknown> = {},
	headers?: { xFields?: string; xExtraFields?: string }
) => {
	checkAppIsRunning();

	const req = request(app)
		.delete(getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/rooms/${roomId}`))
		.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
		.query(query);

	if (headers?.xFields) {
		req.set('x-fields', headers.xFields);
	}

	if (headers?.xExtraFields) {
		req.set('x-extrafields', headers.xExtraFields);
	}

	return await req;
};

export const bulkDeleteRooms = async (
	roomIds: string[],
	withMeeting?: string,
	withRecordings?: string,
	fields?: MeetRoomField[],
	extraFields?: MeetRoomExtraField[],
	headers?: { xFields?: string; xExtraFields?: string }
) => {
	checkAppIsRunning();

	const query: Record<string, string | boolean | undefined> = {
		roomIds: roomIds.join(','),
		withMeeting,
		withRecordings
	};

	if (fields) {
		query.fields = fields.join(',');
	}

	if (extraFields) {
		query.extraFields = extraFields.join(',');
	}

	const req = request(app)
		.delete(getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/rooms`))
		.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
		.query(query);

	if (headers?.xFields) {
		req.set('x-fields', headers.xFields);
	}

	if (headers?.xExtraFields) {
		req.set('x-extrafields', headers.xExtraFields);
	}

	return await req;
};

export const deleteAllRooms = async () => {
	checkAppIsRunning();

	let nextPageToken: string | undefined;
	const roomIdsToDelete: string[] = [];

	do {
		const response = await getRooms({ fields: 'roomId', maxItems: 100, nextPageToken });
		expect(response.status).toBe(200);

		nextPageToken = response.body.pagination?.nextPageToken ?? undefined;
		const roomIds = response.body.rooms.map((room: { roomId: string }) => room.roomId);

		if (roomIds.length === 0) {
			break;
		}

		roomIdsToDelete.push(...roomIds);

		await bulkDeleteRooms(
			roomIds,
			MeetRoomDeletionPolicyWithMeeting.FORCE,
			MeetRoomDeletionPolicyWithRecordings.FORCE
		);
	} while (nextPageToken);

	await waitForAllRoomsToDelete(roomIdsToDelete);
};

/**
 * Runs the expired rooms garbage collector.
 *
 * This function retrieves the RoomScheduledTasksService from the dependency injection container
 * and calls its deleteExpiredRooms method to clean up expired rooms.
 * It then waits for 1 second before completing.
 */
export const runExpiredRoomsGC = async () => {
	checkAppIsRunning();

	// Capture expired rooms without active meetings — these are synchronously deleted by the GC,
	// which in turn causes LiveKit to emit room_finished webhooks that the backend must process.
	const roomRepository = container.get(RoomRepository);
	const { rooms: expiredRooms } = await roomRepository.findExpiredRooms();
	const expiredRoomIdsToWait = expiredRooms
		.filter((r) => r.status !== MeetRoomStatus.ACTIVE_MEETING)
		.map((r) => r.roomId);

	const roomTaskScheduler = container.get(RoomScheduledTasksService);
	await roomTaskScheduler['deleteExpiredRooms']();

	// Wait until the deleted rooms are confirmed gone (404) or no longer active in the Meet API.
	await waitForAllRoomsToDelete(expiredRoomIdsToWait);
};

/**
 * Runs the inconsistent rooms garbage collector.
 *
 * This function retrieves the RoomScheduledTasksService from the dependency injection container
 * and calls its validateRoomsStatusGC method to clean up inconsistent rooms.
 * It then waits for 1 second before completing.
 */
export const executeRoomStatusValidationGC = async () => {
	checkAppIsRunning();

	const roomTaskScheduler = container.get(RoomScheduledTasksService);
	await roomTaskScheduler['validateRoomsStatusGC']();
	await sleep('1s');
};

// ROOM MEMBER HELPERS

export const createRoomMember = async (
	roomId: string,
	memberOptions: MeetRoomMemberOptions,
	// 'effectivePermissions' is an extra field (excluded by default); request it by default so tests can assert on it
	extraFields = 'effectivePermissions'
) => {
	checkAppIsRunning();

	const req = request(app)
		.post(getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/rooms/${roomId}/members`))
		.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY);

	if (extraFields) {
		req.set('x-extrafields', extraFields);
	}

	return await req.send(memberOptions);
};

export const getRoomMembers = async (roomId: string, query: Record<string, unknown> = {}) => {
	checkAppIsRunning();

	return await request(app)
		.get(getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/rooms/${roomId}/members`))
		.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
		.query(query);
};

export const getRoomMember = async (
	roomId: string,
	memberId: string,
	// 'effectivePermissions' is an extra field (excluded by default); request it by default so tests can assert on it
	extraFields = 'effectivePermissions'
) => {
	checkAppIsRunning();

	const queryParams: Record<string, string> = {};

	if (extraFields) {
		queryParams.extraFields = extraFields;
	}

	return await request(app)
		.get(getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/rooms/${roomId}/members/${memberId}`))
		.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
		.query(queryParams);
};

export const updateRoomMember = async (
	roomId: string,
	memberId: string,
	updates: Record<string, unknown>,
	// 'effectivePermissions' is an extra field (excluded by default); request it by default so tests can assert on it
	extraFields = 'effectivePermissions'
) => {
	checkAppIsRunning();

	const req = request(app)
		.put(getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/rooms/${roomId}/members/${memberId}`))
		.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY);

	if (extraFields) {
		req.set('x-extrafields', extraFields);
	}

	return await req.send(updates);
};

export const deleteRoomMember = async (roomId: string, memberId: string) => {
	checkAppIsRunning();

	return await request(app)
		.delete(getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/rooms/${roomId}/members/${memberId}`))
		.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
		.send();
};

export const bulkDeleteRoomMembers = async (roomId: string, memberIds: string[]) => {
	checkAppIsRunning();

	return await request(app)
		.delete(getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/rooms/${roomId}/members`))
		.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
		.query({ memberIds: memberIds.join(',') });
};

export const generateRoomMemberTokenRequest = async (
	roomId: string,
	tokenOptions: MeetRoomMemberTokenOptions,
	accessToken?: string,
	previousToken?: string
) => {
	checkAppIsRunning();

	const req = request(app)
		.post(getFullPath(`${INTERNAL_CONFIG.INTERNAL_API_BASE_PATH_V1}/rooms/${roomId}/members/token`))
		.send(tokenOptions);

	if (accessToken) {
		req.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, accessToken);
	}

	if (previousToken) {
		req.set(INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, previousToken);
	}

	return await req;
};

/**
 * Generates a room member token for a room and returns the JWT token in the format "Bearer <token>"
 */
export const generateRoomMemberToken = async (
	roomId: string,
	tokenOptions: MeetRoomMemberTokenOptions,
	accessToken?: string,
	previousToken?: string
): Promise<string> => {
	const response = await generateRoomMemberTokenRequest(roomId, tokenOptions, accessToken, previousToken);
	expect(response.status).toBe(200);

	expect(response.body).toHaveProperty('token');
	return `Bearer ${response.body.token}`;
};

export const refreshRoomMemberTokenRequest = async (roomId: string, previousToken: string) => {
	checkAppIsRunning();

	return await request(app)
		.post(getFullPath(`${INTERNAL_CONFIG.INTERNAL_API_BASE_PATH_V1}/rooms/${roomId}/members/token/refresh`))
		.set(INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, previousToken)
		.send({});
};

// MEETING HELPERS

export const createAssistant = (
	token: string,
	body = { capabilities: [{ name: MeetAssistantCapabilityName.LIVE_CAPTIONS }] }
): Promise<Response> =>
	request(app)
		.post(getFullPath(`${INTERNAL_CONFIG.INTERNAL_API_BASE_PATH_V1}/ai/assistants`))
		.set(INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, token)
		.send(body);

/** DELETE /ai/assistants/:id with a room member token */
export const cancelAssistant = (assistantId: string, token: string): Promise<Response> =>
	request(app)
		.delete(getFullPath(`${INTERNAL_CONFIG.INTERNAL_API_BASE_PATH_V1}/ai/assistants/${assistantId}`))
		.set(INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, token);

export const updateParticipant = async (
	roomId: string,
	participantIdentity: string,
	action: MeetParticipantModerationAction,
	roomMemberToken: string
) => {
	checkAppIsRunning();

	const response = await request(app)
		.put(
			getFullPath(
				`${INTERNAL_CONFIG.INTERNAL_API_BASE_PATH_V1}/meetings/${roomId}/participants/${participantIdentity}/role`
			)
		)
		.set(INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, roomMemberToken)
		.send({ action });
	return response;
};

export const kickParticipant = async (roomId: string, participantIdentity: string, roomMemberToken: string) => {
	checkAppIsRunning();

	const response = await request(app)
		.delete(
			getFullPath(
				`${INTERNAL_CONFIG.INTERNAL_API_BASE_PATH_V1}/meetings/${roomId}/participants/${participantIdentity}`
			)
		)
		.set(INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, roomMemberToken)
		.send();
	return response;
};

export const endMeeting = async (roomId: string, roomMemberToken: string) => {
	checkAppIsRunning();

	const response = await request(app)
		.delete(getFullPath(`${INTERNAL_CONFIG.INTERNAL_API_BASE_PATH_V1}/meetings/${roomId}`))
		.set(INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, roomMemberToken)
		.send();

	await waitForMeetingToEnd(roomId);
	return response;
};

// RECORDING HELPERS

export const startRecording = async (
	roomId: string,
	config?: {
		layout?: string;
		encoding?: MeetRecordingEncodingPreset | MeetRecordingEncodingOptions;
	},
	options?: {
		headers?: { xFields?: string };
	}
) => {
	checkAppIsRunning();

	const body: {
		roomId: string;
		config?: {
			layout?: string;
			encoding?: MeetRecordingEncodingPreset | MeetRecordingEncodingOptions;
		};
	} = { roomId };

	if (config) {
		body.config = config;
	}

	const req = request(app)
		.post(getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/recordings`))
		.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
		.send(body);

	if (options?.headers?.xFields) {
		req.set('x-fields', options.headers.xFields);
	}

	return await req;
};

export const stopRecording = async (
	recordingId: string,
	options?: {
		headers?: { xFields?: string };
	}
) => {
	checkAppIsRunning();

	const req = request(app)
		.post(getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/recordings/${recordingId}/stop`))
		.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
		.send();

	if (options?.headers?.xFields) {
		req.set('x-fields', options.headers.xFields);
	}

	const response = await req;
	await waitForRecordingToStop(recordingId);

	return response;
};

export const getAllRecordings = async (query: Record<string, unknown> = {}, headers?: { xFields?: string }) => {
	checkAppIsRunning();

	const req = request(app)
		.get(getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/recordings`))
		.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
		.query(query);

	if (headers?.xFields) {
		req.set('x-fields', headers.xFields);
	}

	return await req;
};

export const getAllRecordingsFromRoom = async (roomMemberToken: string) => {
	checkAppIsRunning();

	return await request(app)
		.get(getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/recordings`))
		.set(INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, roomMemberToken);
};

export const downloadRecordings = async (
	recordingIds: string[],
	asBuffer = true,
	roomMemberToken?: string
): Promise<Response> => {
	checkAppIsRunning();

	const req = request(app)
		.get(getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/recordings/download`))
		.query({ recordingIds: recordingIds.join(',') });

	if (roomMemberToken) {
		req.set(INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, roomMemberToken);
	} else {
		req.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY);
	}

	if (asBuffer) {
		return await req.buffer().parse((res, cb) => {
			const data: Buffer[] = [];
			res.on('data', (chunk) => data.push(chunk));
			res.on('end', () => cb(null, Buffer.concat(data)));
		});
	}

	return await req;
};

export const getRecording = async (
	recordingId: string,
	options?: {
		fields?: string;
		headers?: { xFields?: string };
	}
) => {
	checkAppIsRunning();

	const queryParams: Record<string, string> = {};

	if (options?.fields) queryParams.fields = options.fields;

	const req = request(app)
		.get(getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/recordings/${recordingId}`))
		.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
		.query(queryParams);

	if (options?.headers?.xFields) {
		req.set('x-fields', options.headers.xFields);
	}

	return await req;
};

export const getRecordingMedia = async (recordingId: string, range?: string) => {
	checkAppIsRunning();

	const req = request(app)
		.get(getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/recordings/${recordingId}/media`))
		.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY);

	if (range) {
		req.set('range', range);
	}

	return await req;
};

export const getRecordingUrl = async (recordingId: string, privateAccess = false) => {
	checkAppIsRunning();

	return await request(app)
		.get(getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/recordings/${recordingId}/url`))
		.query({ privateAccess })
		.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY);
};

/**
 * Retrieves the access secret for a specific recording by parsing the recording URL.
 *
 * @param recordingId - The unique identifier of the recording
 * @param privateAccess - Whether to request a private access URL
 * @returns A Promise that resolves to the access secret string
 */
export const getRecordingAccessSecret = async (recordingId: string, privateAccess = false): Promise<string> => {
	const response = await getRecordingUrl(recordingId, privateAccess);
	expect(response.status).toBe(200);
	const recordingUrl = response.body.url;
	expect(recordingUrl).toBeDefined();

	// Parse the URL to extract the secret from the query parameters
	const parsedUrl = new URL(recordingUrl);
	const secret = parsedUrl.searchParams.get('recordingSecret');
	return secret!;
};

export const deleteRecording = async (recordingId: string) => {
	checkAppIsRunning();

	return await request(app)
		.delete(getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/recordings/${recordingId}`))
		.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY);
};

export const bulkDeleteRecordings = async (recordingIds: string[], roomMemberToken?: string): Promise<Response> => {
	checkAppIsRunning();

	const req = request(app)
		.delete(getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/recordings`))
		.query({ recordingIds: recordingIds.join(',') });

	if (roomMemberToken) {
		req.set(INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, roomMemberToken);
	} else {
		req.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY);
	}

	return await req;
};

export const stopAllRecordings = async () => {
	checkAppIsRunning();

	const response = await getAllRecordings();

	const recordingIds: string[] = response.body.recordings
		.filter((rec: MeetRecordingInfo) => rec.status === MeetRecordingStatus.ACTIVE)
		.map((recording: { recordingId: string }) => recording.recordingId);

	if (recordingIds.length === 0) {
		return;
	}

	console.log(`Stopping ${recordingIds.length} recordings...`, recordingIds);
	const tasks = recordingIds.map((recordingId: string) =>
		request(app)
			.post(getFullPath(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/recordings/${recordingId}/stop`))
			.set(INTERNAL_CONFIG.API_KEY_HEADER, MEET_ENV.INITIAL_API_KEY)
			.send()
	);
	const results = await Promise.all(tasks);

	// Check responses
	results.forEach((response) => {
		expect(response.status).toBe(202);
	});
	await waitForAllRecordingsToStop(recordingIds);
};

export const deleteAllRecordings = async () => {
	checkAppIsRunning();

	let nextPageToken: string | undefined;

	do {
		const response = await getAllRecordings({
			fields: 'recordingId',
			maxItems: 100,
			nextPageToken
		});
		expect(response.status).toBe(200);

		nextPageToken = response.body.pagination?.nextPageToken ?? undefined;
		const recordingIds = response.body.recordings.map(
			(recording: { recordingId: string }) => recording.recordingId
		);

		if (recordingIds.length === 0) {
			break;
		}

		await bulkDeleteRecordings(recordingIds);
	} while (nextPageToken);
};

export const runReleaseActiveRecordingLock = async (roomId: string) => {
	checkAppIsRunning();

	const recordingService = container.get(RecordingService);
	await recordingService.releaseRecordingLockIfNoEgress(roomId);
};

// ANALYTICS HELPERS

export const getAnalytics = async () => {
	checkAppIsRunning();

	const { accessToken } = await loginRootAdmin();
	const response = await request(app)
		.get(getFullPath(`${INTERNAL_CONFIG.INTERNAL_API_BASE_PATH_V1}/analytics`))
		.set(INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, accessToken)
		.send();

	return response;
};

// PRIVATE METHODS

const checkAppIsRunning = () => {
	if (!app) {
		throw new Error('App instance is not defined');
	}
};

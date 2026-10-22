import { MeetUserRole } from '@openvidu-meet/typings';
import type { NextFunction, Request, Response } from 'express';
import { container } from '../config/dependency-injector.config.js';
import { INTERNAL_CONFIG } from '../config/internal-config.js';
import {
	errorInsufficientPermissions,
	errorRoomNotFound,
	handleError,
	internalError,
	OpenViduMeetError,
	rejectRequestFromMeetError
} from '../models/error.model.js';
import { RequestSessionService } from '../services/request-session.service.js';
import { RoomService } from '../services/room.service.js';
import { RoomQueryWithFields } from '../types/room-projection.types.js';
import { runConcurrently } from '../utils/concurrency.utils.js';

/**
 * Middleware to apply room list access filters to validated query options.
 *
 * - ADMIN: can list all rooms (no extra filters)
 * - ROOM_MANAGER: can list rooms they own or where they are members (and rooms with user access enabled)
 * - ROOM_MEMBER: can list only rooms where they are members (and rooms with user access enabled)
 */
export const applyRoomListAccessFilters = async (_req: Request, res: Response, next: NextFunction) => {
	const requestSessionService = container.get(RequestSessionService);
	const user = requestSessionService.getAuthenticatedUser();

	// If there is no authenticated user, reject the request
	if (!user) {
		const error = errorInsufficientPermissions();
		return rejectRequestFromMeetError(res, error);
	}

	// ADMIN users can list all rooms.
	if (user.role === MeetUserRole.ADMIN) {
		return next();
	}

	const queryOptions = res.locals.validatedQuery as RoomQueryWithFields;
	const hasScopeFilters = !!queryOptions.owner || !!queryOptions.member || queryOptions.userAccess;

	// Non-admin users can only scope owner/member filters to their own userId.
	if (queryOptions.owner && queryOptions.owner !== user.userId) {
		const error = errorInsufficientPermissions();
		return rejectRequestFromMeetError(res, error);
	}

	if (queryOptions.member && queryOptions.member !== user.userId) {
		const error = errorInsufficientPermissions();
		return rejectRequestFromMeetError(res, error);
	}

	// Default behavior when client does not provide explicit scope filters:
	// ROOM_MANAGER => owned OR member OR user access
	// ROOM_MEMBER => member OR user access
	if (!hasScopeFilters) {
		if (user.role === MeetUserRole.ROOM_MANAGER) {
			queryOptions.owner = user.userId;
		}

		queryOptions.member = user.userId;
		queryOptions.userAccess = true;
	}

	res.locals.validatedQuery = queryOptions;
	return next();
};

/**
 * Middleware to authorize access to a room.
 *
 * - If a Room Member Token is used, it checks that the token's roomId matches the requested roomId.
 * - If a user is authenticated, it checks their role and whether they are the owner or a member of the room.
 * - If neither a valid token nor an authenticated user is present, it rejects the request.
 */
export const authorizeRoomAccess = async (req: Request, res: Response, next: NextFunction) => {
	const roomId = req.params.roomId as string;

	const roomService = container.get(RoomService);
	const roomExists = await roomService.meetRoomExists(roomId);

	// Fail fast if room does not exist
	if (!roomExists) {
		const error = errorRoomNotFound(roomId);
		return rejectRequestFromMeetError(res, error);
	}

	const requestSessionService = container.get(RequestSessionService);
	const memberRoomId = requestSessionService.getRoomIdFromMember();
	const user = requestSessionService.getAuthenticatedUser();

	const forbiddenError = errorInsufficientPermissions();

	// Room Member Token
	if (memberRoomId) {
		// Check if the member's roomId matches the requested roomId
		if (memberRoomId !== roomId) {
			return rejectRequestFromMeetError(res, forbiddenError);
		}

		return next();
	}

	// Authenticated user
	if (user) {
		try {
			const canAccess = await roomService.canUserAccessRoom(roomId, user);

			if (!canAccess) {
				return rejectRequestFromMeetError(res, forbiddenError);
			}

			return next();
		} catch (error) {
			return handleError(res, error, 'checking user access to room');
		}
	}

	// If there is no token and no user, reject the request
	return rejectRequestFromMeetError(res, forbiddenError);
};

/**
 * Middleware to authorize management of a room.
 *
 * - Checks if the authenticated user is an admin or the owner of the room.
 */
export const authorizeRoomManagement = async (req: Request, res: Response, next: NextFunction) => {
	const roomId = req.params.roomId as string;

	const roomService = container.get(RoomService);
	const roomExists = await roomService.meetRoomExists(roomId);

	// Fail fast if room does not exist
	if (!roomExists) {
		const error = errorRoomNotFound(roomId);
		return rejectRequestFromMeetError(res, error);
	}

	const requestSessionService = container.get(RequestSessionService);
	const user = requestSessionService.getAuthenticatedUser();

	const forbiddenError = errorInsufficientPermissions();

	if (!user) {
		return rejectRequestFromMeetError(res, forbiddenError);
	}

	if (user.role === MeetUserRole.ADMIN) {
		return next();
	}

	try {
		const isOwner = await roomService.isRoomOwner(roomId, user.userId);

		if (!isOwner) {
			return rejectRequestFromMeetError(res, forbiddenError);
		}

		return next();
	} catch (error) {
		return handleError(res, error, 'checking room ownership');
	}
};

/**
 * Middleware to partition roomIds for bulk delete into processable and failed entries.
 *
 * Failed entries include:
 * - Rooms that do not exist.
 * - Rooms the authenticated non-admin user cannot manage.
 */
export const validateBulkDeleteRoomManagement = async (_req: Request, res: Response, next: NextFunction) => {
	const roomService = container.get(RoomService);
	const requestSessionService = container.get(RequestSessionService);
	const user = requestSessionService.getAuthenticatedUser();
	const { roomIds } = res.locals.validatedQuery as { roomIds: string[] };

	type BulkDeleteRoomFailed = {
		roomId: string;
		error: string;
		message: string;
	};

	const settledResults = await runConcurrently(
		roomIds,
		async (roomId) => {
			try {
				// Check that user is admin or owner of the room
				if (user && user.role !== MeetUserRole.ADMIN) {
					const isOwner = await roomService.isRoomOwner(roomId, user.userId);

					if (!isOwner) {
						throw errorInsufficientPermissions();
					}
				}

				return roomId;
			} catch (error) {
				const meetError =
					error instanceof OpenViduMeetError ? error : internalError(`deleting room '${roomId}'`);

				throw {
					roomId,
					error: meetError.name,
					message: meetError.message
				} as BulkDeleteRoomFailed;
			}
		},
		{ concurrency: INTERNAL_CONFIG.CONCURRENCY_BULK_RETRIEVE_ROOMS }
	);

	const processableIds: string[] = [];
	const failed: BulkDeleteRoomFailed[] = [];

	settledResults.forEach((result) => {
		if (result.status === 'fulfilled') {
			processableIds.push(result.value);
		} else {
			failed.push(result.reason as BulkDeleteRoomFailed);
		}
	});

	res.locals.bulkValidation = {
		processableIds,
		failed
	};
	return next();
};

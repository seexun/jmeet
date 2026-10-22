import type { MeetRoomMemberPermissions, MeetRoomMemberTokenOptions } from '@openvidu-meet/typings';
import { MeetUserRole } from '@openvidu-meet/typings';
import type { NextFunction, Request, Response } from 'express';
import { container } from '../config/dependency-injector.config.js';
import {
	errorInsufficientPermissions,
	errorInvalidRoomSecret,
	errorRoomMemberNotFound,
	errorRoomNotFound,
	handleError,
	rejectRequestFromMeetError
} from '../models/error.model.js';
import { RequestSessionService } from '../services/request-session.service.js';
import { RoomMemberService } from '../services/room-member.service.js';
import { RoomService } from '../services/room.service.js';
import type { AuthValidator } from './auth.middleware.js';
import { accessTokenValidator, allowAnonymous, withAuth } from './auth.middleware.js';

/**
 * Middleware to authorize access to specific room member information.
 *
 * - If the user is authenticated via room member token, checks if they are accessing their own info.
 * - If authenticated as a user (Meet account holder), checks if they have management permissions (admin or owner),
 *  or if they are accessing their own member info.
 */
export const authorizeRoomMemberAccess = async (req: Request, res: Response, next: NextFunction) => {
	const roomId = req.params.roomId as string;
	const memberId = req.params.memberId as string;

	// Fail fast if room or member does not exist
	try {
		const roomMemberService = container.get(RoomMemberService);
		const isMember = await roomMemberService.isRoomMember(roomId, memberId);

		if (!isMember) {
			const error = errorRoomMemberNotFound(roomId, memberId);
			return rejectRequestFromMeetError(res, error);
		}
	} catch (error) {
		return handleError(res, error, 'checking if member exists in room');
	}

	const requestSessionService = container.get(RequestSessionService);
	const user = requestSessionService.getAuthenticatedUser();
	const memberRoomId = requestSessionService.getRoomIdFromMember();
	const currentMemberId = requestSessionService.getRoomMemberId();

	const forbiddenError = errorInsufficientPermissions();

	// Room Member Token
	if (memberRoomId) {
		// Check if the token belongs to the requested room
		// and if the memberId matches the requested member
		const isSameRoom = memberRoomId === roomId;
		const isSameMember = currentMemberId === memberId;

		if (!isSameRoom || !isSameMember) {
			return rejectRequestFromMeetError(res, forbiddenError);
		}

		return next();
	}

	// Authenticated user
	if (user) {
		// Allow if user is admin
		if (user.role === MeetUserRole.ADMIN) {
			return next();
		}

		try {
			// Check if user is room owner
			// or is accessing their own member info
			const roomService = container.get(RoomService);
			const isOwner = await roomService.isRoomOwner(roomId, user.userId);
			const isSameMember = user.userId === memberId;

			if (!isOwner && !isSameMember) {
				return rejectRequestFromMeetError(res, forbiddenError);
			}

			return next();
		} catch (error) {
			return handleError(res, error, 'checking room ownership');
		}
	}

	return rejectRequestFromMeetError(res, forbiddenError);
};

/**
 * Middleware to configure authentication for generating room member tokens.
 *
 * - If a secret is provided in the request body, anonymous access is allowed.
 * - If no secret is provided, the user must be authenticated as ADMIN, ROOM_MANAGER, or ROOM_MEMBER.
 */
export const setupRoomMemberTokenAuthentication = async (req: Request, res: Response, next: NextFunction) => {
	const { secret } = req.body as MeetRoomMemberTokenOptions;
	const authValidators: AuthValidator[] = [];

	if (secret) {
		authValidators.push(allowAnonymous);
	} else {
		authValidators.push(accessTokenValidator(MeetUserRole.ADMIN, MeetUserRole.ROOM_MANAGER, MeetUserRole.ROOM_MEMBER));
	}

	return withAuth(...authValidators)(req, res, next);
};

/**
 * Middleware to authorize the generation of a room member token.
 *
 * - If a secret is provided, it checks if it matches a valid room secret (anonymous access) or if it corresponds to a room member.
 * - If no secret is provided, it checks if the authenticated user has permissions to access the room (admin, owner, or member).
 */
export const authorizeRoomMemberTokenGeneration = async (req: Request, res: Response, next: NextFunction) => {
	const { roomId } = req.params as Record<string, string>;
	const { secret } = req.body as MeetRoomMemberTokenOptions;

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

	// Scenario 1: Secret provided (Anonymous access or Member ID)
	if (secret) {
		try {
			const isIdentifiedGuestMemberId = secret.startsWith('guest-');

			if (isIdentifiedGuestMemberId) {
				// Check if secret is a memberId
				const roomMemberService = container.get(RoomMemberService);
				const isMember = await roomMemberService.isRoomMember(roomId, secret);

				if (!isMember) {
					const error = errorRoomMemberNotFound(roomId, secret);
					return rejectRequestFromMeetError(res, error);
				}

				return next();
			}

			// Check if secret matches any room access URL secret
			const isValidSecret = await roomService.isValidRoomSecret(roomId, secret);

			if (!isValidSecret) {
				const error = errorInvalidRoomSecret(roomId, secret);
				return rejectRequestFromMeetError(res, error);
			}

			return next();
		} catch (error) {
			return handleError(res, error, 'checking room secret');
		}
	}

	// Scenario 2: No secret provided (Authenticated User)
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

	return rejectRequestFromMeetError(res, forbiddenError);
};

/**
 * Middleware to check if the room member has a specific permission.
 *
 * @param permission The permission to check (key of MeetRoomMemberPermissions).
 */
export const withRoomMemberPermission = (permission: keyof MeetRoomMemberPermissions) => {
	return async (req: Request, res: Response, next: NextFunction) => {
		const roomId = req.params.roomId as string;

		const roomService = container.get(RoomService);
		const roomExists = await roomService.meetRoomExists(roomId!);

		// Fail fast if room does not exist
		if (!roomExists) {
			const error = errorRoomNotFound(roomId!);
			return rejectRequestFromMeetError(res, error);
		}

		const requestSessionService = container.get(RequestSessionService);
		const memberRoomId = requestSessionService.getRoomIdFromMember();
		const permissions = requestSessionService.getRoomMemberPermissions();

		// Check if room member belongs to the requested room
		// and has the required permission
		const sameRoom = memberRoomId === roomId;
		const hasPermission = permissions && permissions[permission];

		if (!sameRoom || !hasPermission) {
			const error = errorInsufficientPermissions();
			return rejectRequestFromMeetError(res, error);
		}

		return next();
	};
};

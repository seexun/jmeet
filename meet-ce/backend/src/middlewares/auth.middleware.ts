import type { MeetUserRole } from '@openvidu-meet/typings';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { container } from '../config/dependency-injector.config.js';
import {
	OpenViduMeetError,
	errorInsufficientPermissions,
	errorInvalidToken,
	errorInvalidTokenSubject,
	errorPasswordChangeRequired,
	errorUnauthorized,
	rejectRequestFromMeetError
} from '../models/error.model.js';
import { TokenType, type TokenMetadata } from '../models/token.model.js';
import { RoomMemberRepository } from '../repositories/room-member.repository.js';
import { RoomRepository } from '../repositories/room.repository.js';
import { LoggerService } from '../services/logger.service.js';
import { RequestSessionService } from '../services/request-session.service.js';
import { TokenService } from '../services/token.service.js';
import { UserService } from '../services/user.service.js';
import { getAccessToken, getRoomMemberToken } from '../utils/token.utils.js';

/**
 * Interface for authentication validators.
 * Each validator must implement methods to check if credentials are present and to validate them.
 */
export interface AuthValidator {
	/**
	 * Returns the priority of this validator (higher number = higher priority).
	 * Priority order: apiKeyValidator (4) > roomMemberTokenValidator (3) > accessTokenValidator (2) > allowAnonymous (1)
	 */
	getPriority(): number;

	/**
	 * Checks if the authentication credentials for this validator are present in the request.
	 * This allows the middleware to skip validation for methods that are not being used.
	 */
	isPresent(req: Request): Promise<boolean>;

	/**
	 * Validates the authentication credentials and sets the session.
	 */
	validate(req: Request): Promise<void>;
}

/**
 * This middleware allows to chain multiple validators to check if the request is authorized.
 * Validators are automatically sorted by priority: apiKeyValidator > roomMemberTokenValidator > accessTokenValidator > allowAnonymous.
 * Only validates the authentication methods that are present in the request.
 * If any of the validators grants access, the request is allowed to continue.
 * If a validator is present but fails validation, the error is returned immediately.
 * If none are present, the request is rejected with unauthorized error.
 *
 * @param validators List of validators to check if the request is authorized
 * @returns RequestHandler middleware
 */
export const withAuth = (...validators: AuthValidator[]): RequestHandler => {
	return async (req: Request, res: Response, next: NextFunction) => {
		// Sort validators by priority (descending)
		const sortedValidators = [...validators].sort((a, b) => {
			return b.getPriority() - a.getPriority();
		});

		for (const validator of sortedValidators) {
			const isPresent = await validator.isPresent(req);

			if (isPresent) {
				try {
					await validator.validate(req);
					// If validator grants access, allow the request to continue
					return next();
				} catch (error) {
					// If a present validator fails, return the error immediately
					const meetError = error instanceof OpenViduMeetError ? error : errorUnauthorized();
					return rejectRequestFromMeetError(res, meetError);
				}
			}
		}

		// No validator was present, return unauthorized
		return rejectRequestFromMeetError(res, errorUnauthorized());
	};
};

/**
 * Access token validator for user access.
 * Validates access tokens and user roles, and sets the authenticated user in the session.
 *
 * @param roles One or more roles that are allowed to access the resource
 */
export const accessTokenValidator = (...roles: MeetUserRole[]): AuthValidator => {
	return {
		getPriority(): number {
			return 2;
		},

		async isPresent(req: Request): Promise<boolean> {
			const token = getAccessToken(req);
			return !!token;
		},

		async validate(req: Request): Promise<void> {
			const token = getAccessToken(req);

			if (!token) {
				throw errorUnauthorized();
			}

			let userId: string | undefined;
			let tokenType: TokenType;
			let issuedAt: number;
			let parsedMetadata: TokenMetadata;

			try {
				// Verify the token and extract the user ID and token metadata
				const tokenService = container.get(TokenService);
				const { sub, metadata: tokenMetadata } = await tokenService.verifyToken(token);

				if (!tokenMetadata) {
					throw new Error('Missing required token claims');
				}

				// Validate that this is an access or temporary token, not a refresh token
				parsedMetadata = tokenService.parseTokenMetadata(tokenMetadata);
				userId = sub;
				tokenType = parsedMetadata.tokenType;
				issuedAt = parsedMetadata.iat;

				if (tokenType === TokenType.REFRESH) {
					throw new Error('Invalid token type for access');
				}
			} catch (error) {
				const logger = container.get(LoggerService);
				logger.error('Invalid access token:', error);
				throw errorInvalidToken();
			}

			const userService = container.get(UserService);
			const user = userId ? await userService.getUser(userId) : null;

			if (!user || user.enabled === false) {
				throw errorInvalidTokenSubject();
			}

			if (parsedMetadata.authVersion !== (user.authVersion ?? 1)) throw errorInvalidToken();

			// Invalidate access tokens issued before the user's latest role change
			if (issuedAt < user.roleUpdatedAt) {
				throw errorInvalidToken();
			}

			// Restrict access if password change is required or if token is temporary
			if (user.mustChangePassword || tokenType === TokenType.TEMPORARY) {
				// Allow only change-password and me endpoints
				const requestPath = req.path;
				const allowedPaths = ['/change-password', '/me'];

				if (!allowedPaths.includes(requestPath)) {
					throw errorPasswordChangeRequired();
				}
			}

			// Check if user has one of the required roles
			if (!roles.includes(user.role)) {
				throw errorInsufficientPermissions();
			}

			const requestSessionService = container.get(RequestSessionService);
			requestSessionService.setUser(user);
		}
	};
};

/**
 * Room member token validator for room access.
 * Validates room member tokens and sets the room member metadata in the session.
 */
export const roomMemberTokenValidator: AuthValidator = {
	getPriority(): number {
		return 3;
	},

	async isPresent(req: Request): Promise<boolean> {
		const token = getRoomMemberToken(req);
		return !!token;
	},

	async validate(req: Request): Promise<void> {
		const token = getRoomMemberToken(req);

		if (!token) {
			throw errorUnauthorized();
		}

		const requestSessionService = container.get(RequestSessionService);

		try {
			// Verify the token and extract the room member token metadata
			const tokenService = container.get(TokenService);
			const { sub: participantIdentity, metadata: tokenMetadata } = await tokenService.verifyToken(token);

			if (!tokenMetadata) {
				throw new Error('Missing required token claims');
			}

			// Validate the room member token metadata
			const parsedMetadata = tokenService.parseRoomMemberTokenMetadata(tokenMetadata);
			const { iat, roomId, memberId, userId } = parsedMetadata;

			const roomRepository = container.get(RoomRepository);
			const room = await roomRepository.findByRoomId(roomId, ['rolesUpdatedAt']);

			// Always validate room role/access updates for any room member token
			if (!room || iat < room.rolesUpdatedAt) {
				throw new Error('Token has outdated permissions');
			}

			// If the token has a memberId, validate that permissions haven't been updated after token issuance
			if (memberId) {
				const roomMemberRepository = container.get(RoomMemberRepository);
				const roomMember = await roomMemberRepository.findByRoomAndMemberId(roomId, memberId, [
					'permissionsUpdatedAt'
				]);

				// If member not found or permissions were updated after token issuance, invalidate token
				if (!roomMember || iat < roomMember.permissionsUpdatedAt) {
					throw new Error('Token has outdated permissions');
				}
			}

			// If the token is associated with a user, validate user role wasn't updated after token issuance
			if (userId) {
				const userService = container.get(UserService);
				const user = await userService.getUser(userId, ['roleUpdatedAt']);

				// If user not found or role was updated after token issuance, invalidate token
				if (!user || iat < user.roleUpdatedAt) {
					throw new Error('Token has outdated permissions');
				}
			}

			// Set room member token metadata in the session
			requestSessionService.setRoomMemberTokenInfo(parsedMetadata, participantIdentity);
		} catch (error) {
			const logger = container.get(LoggerService);
			logger.error('Invalid room member token:', error);
			throw errorInvalidToken();
		}

		await setAuthenticatedUserIfPresent(req);
	}
};

/**
 * Anonymous access validator.
 * Allows unauthenticated access with an anonymous user.
 */
export const allowAnonymous: AuthValidator = {
	getPriority(): number {
		return 1;
	},

	async isPresent(): Promise<boolean> {
		// Anonymous access is always available
		return true;
	},

	async validate(req: Request): Promise<void> {
		await setAuthenticatedUserIfPresent(req);
	}
};

/**
 * Set authenticated user in request context if access token is present and valid
 */
const setAuthenticatedUserIfPresent = async (req: Request): Promise<void> => {
	// Check if there is a user already authenticated
	const token = getAccessToken(req);

	if (!token) {
		return;
	}

	try {
		const tokenService = container.get(TokenService);
		const payload = await tokenService.verifyToken(token);
		const userId = payload.sub;

		const userService = container.get(UserService);
		const user = userId ? await userService.getUser(userId) : null;

		if (user) {
			const requestSessionService = container.get(RequestSessionService);
			requestSessionService.setUser(user);
		}
	} catch (error) {
		const logger = container.get(LoggerService);
		logger.debug('Token found but invalid:' + error);
	}
};

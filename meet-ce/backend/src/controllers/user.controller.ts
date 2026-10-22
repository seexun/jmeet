import type { MeetUserFilters, MeetUserOptions, MeetUserRole } from '@openvidu-meet/typings';
import type { Request, Response } from 'express';
import { container } from '../config/dependency-injector.config.js';
import { INTERNAL_CONFIG } from '../config/internal-config.js';
import {
	errorUnauthorized,
	errorUserNotFound,
	handleError,
	rejectRequestFromMeetError
} from '../models/error.model.js';
import { LoggerService } from '../services/logger.service.js';
import { RequestSessionService } from '../services/request-session.service.js';
import { TokenService } from '../services/token.service.js';
import { UserService } from '../services/user.service.js';
import { getBaseUrl } from '../utils/url.utils.js';

// 操作审计属企业版能力；开源版保留调用点但不落审计记录
const recordUserAudit = async (
	_req: Request,
	_action: 'user.create' | 'user.role_update' | 'user.password_reset' | 'user.account_status_update' | 'user.sessions_revoke' | 'user.delete' | 'user.bulk_delete',
	_targetId?: string,
	_details?: Record<string, unknown>
): Promise<void> => {};

export const createUser = async (req: Request, res: Response) => {
	const userOptions = req.body as MeetUserOptions;

	const logger = container.get(LoggerService);
	logger.verbose(`Creating user with login name '${userOptions.loginName}'`);

	try {
		const userService = container.get(UserService);
		const user = await userService.createUser(userOptions);
		await recordUserAudit(req, 'user.create', user.userId, { role: user.role });
		res.set('Location', `${getBaseUrl()}${INTERNAL_CONFIG.API_BASE_PATH_V1}/users/${user.userId}`);
		return res.status(201).json(userService.convertToDTO(user));
	} catch (error) {
		handleError(res, error, 'creating user');
	}
};

export const getUsers = async (req: Request, res: Response) => {
	const queryParams = res.locals.validatedQuery as MeetUserFilters;

	const logger = container.get(LoggerService);
	logger.verbose(`Getting all users`);

	try {
		const userService = container.get(UserService);
		const { users, isTruncated, nextPageToken, totalCount } = await userService.getUsers(queryParams);

		const usersDTO = users.map((user) => userService.convertToDTO(user));
		const maxItems = Number(queryParams.maxItems);

		return res.status(200).json({
			users: usersDTO,
			pagination: {
				isTruncated,
				nextPageToken,
				maxItems,
				totalCount
			}
		});
	} catch (error) {
		handleError(res, error, 'getting users');
	}
};

export const getUser = async (req: Request, res: Response) => {
	const { userId } = req.params as Record<string, string>;

	const logger = container.get(LoggerService);
	logger.verbose(`Getting user with ID '${userId}'`);

	try {
		const userService = container.get(UserService);
		const user = await userService.getUser(userId);

		if (!user) {
			throw errorUserNotFound(userId);
		}

		return res.status(200).json(userService.convertToDTO(user));
	} catch (error) {
		handleError(res, error, 'getting user');
	}
};

export const getMe = (_req: Request, res: Response) => {
	const requestSessionService = container.get(RequestSessionService);
	const user = requestSessionService.getAuthenticatedUser();

	if (!user) {
		const error = errorUnauthorized();
		return rejectRequestFromMeetError(res, error);
	}

	const userService = container.get(UserService);
	const userDTO = userService.convertToDTO(user);
	return res.status(200).json(userDTO);
};

export const resetUserPassword = async (req: Request, res: Response) => {
	const { userId } = req.params as Record<string, string>;
	const { newPassword } = req.body as { newPassword: string };

	const logger = container.get(LoggerService);
	logger.verbose(`Admin resetting password for user '${userId}'`);

	try {
		const userService = container.get(UserService);
		await userService.resetUserPassword(userId, newPassword);
		await recordUserAudit(req, 'user.password_reset', userId);

		return res.status(200).json({
			message: `Password for user '${userId}' has been reset successfully. User must change password on next login.`
		});
	} catch (error) {
		handleError(res, error, 'resetting user password');
	}
};

/**
 * Self-service profile update (own account only). Whitelisted fields:
 * display name, inline avatar (data URL), preferred language, notification mute.
 */
export const updateMe = async (req: Request, res: Response) => {
	const requestSessionService = container.get(RequestSessionService);
	const sessionUser = requestSessionService.getAuthenticatedUser();
	if (!sessionUser) {
		return rejectRequestFromMeetError(res, errorUnauthorized());
	}

	const userService = container.get(UserService);
	const body = (req.body ?? {}) as {
		name?: unknown;
		avatarDataUrl?: unknown;
		preferredLanguage?: unknown;
		notificationsMuted?: unknown;
	};

	const patch: Parameters<UserService['updateOwnProfile']>[1] = {};

	if (body.name !== undefined) {
		const name = String(body.name).trim();
		if (name.length < 1 || name.length > 64) {
			return res.status(400).json({ message: 'Name must be 1-64 characters.' });
		}
		patch.name = name;
	}

	if (body.avatarDataUrl !== undefined) {
		if (body.avatarDataUrl === null || body.avatarDataUrl === '') {
			patch.avatarDataUrl = null;
		} else {
			const value = String(body.avatarDataUrl);
			if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) {
				return res.status(415).json({ message: 'Unsupported avatar format. Use PNG, JPEG, or WebP.' });
			}
			if (value.length > 400_000) {
				return res.status(413).json({ message: 'Avatar exceeds 300 KB.' });
			}
			patch.avatarDataUrl = value;
		}
	}

	if (body.preferredLanguage !== undefined) {
		const lang = String(body.preferredLanguage);
		if (lang !== 'cn' && lang !== 'en') {
			return res.status(400).json({ message: 'Invalid language.' });
		}
		patch.preferredLanguage = lang;
	}

	if (body.notificationsMuted !== undefined) {
		patch.notificationsMuted = Boolean(body.notificationsMuted);
	}

	if (Object.keys(patch).length === 0) {
		return res.status(400).json({ message: 'No updatable fields provided.' });
	}

	const updated = await userService.updateOwnProfile(sessionUser.userId, patch);
	if (!updated) {
		return res.status(404).json({ message: 'User not found.' });
	}
	return res.status(200).json(userService.convertToDTO(updated));
};

export const changePassword = async (req: Request, res: Response) => {
	const requestSessionService = container.get(RequestSessionService);
	const user = requestSessionService.getAuthenticatedUser();

	if (!user) {
		const error = errorUnauthorized();
		return rejectRequestFromMeetError(res, error);
	}

	const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };

	const logger = container.get(LoggerService);
	logger.verbose(`Changing password for user '${user.userId}'`);

	try {
		const userService = container.get(UserService);
		await userService.changePassword(user.userId, currentPassword, newPassword);

		const message = `Password for user '${user.userId}' changed successfully`;
		logger.info(message);

		// Generate new tokens if the user had to change password
		if (user.mustChangePassword) {
			logger.info(`Generating new tokens for user '${user.userId}' after password change`);
			const tokenService = container.get(TokenService);
			const updatedUser = await userService.getUser(user.userId);
			if (!updatedUser) throw errorUserNotFound(user.userId);
			const accessToken = await tokenService.generateAccessToken(updatedUser);
			const refreshToken = await tokenService.generateRefreshToken(updatedUser);

			return res.status(200).json({
				message,
				accessToken,
				refreshToken
			});
		}

		return res.status(200).json({ message });
	} catch (error) {
		handleError(res, error, 'changing password');
	}
};

export const updateUserRole = async (req: Request, res: Response) => {
	const { userId } = req.params as Record<string, string>;
	const { role } = req.body as { role: MeetUserRole };

	const logger = container.get(LoggerService);
	logger.verbose(`Admin updating role for user '${userId}' to '${role}'`);

	try {
		const userService = container.get(UserService);
		const user = await userService.changeUserRole(userId, role);
		await recordUserAudit(req, 'user.role_update', userId, { role });

		return res.status(200).json(userService.convertToDTO(user));
	} catch (error) {
		handleError(res, error, 'updating user role');
	}
};

export const updateAccountStatus = async (req: Request, res: Response) => {
	const userId = String(req.params.userId);
	try {
		const user = await container.get(UserService).setAccountEnabled(userId, Boolean(req.body.enabled));
		await recordUserAudit(req, 'user.account_status_update', userId, { enabled: user.enabled });
		return res.status(200).json(container.get(UserService).convertToDTO(user));
	} catch (error) { handleError(res, error, 'updating account status'); }
};

export const revokeUserSessions = async (req: Request, res: Response) => {
	const userId = String(req.params.userId);
	try {
		await container.get(UserService).revokeAllSessions(userId);
		await recordUserAudit(req, 'user.sessions_revoke', userId);
		return res.status(200).json({ message: 'All user sessions were revoked' });
	} catch (error) { handleError(res, error, 'revoking user sessions'); }
};

export const deleteUser = async (req: Request, res: Response) => {
	const { userId } = req.params as Record<string, string>;

	const logger = container.get(LoggerService);
	logger.verbose(`Deleting user with ID '${userId}'`);

	try {
		const userService = container.get(UserService);
		await userService.deleteUser(userId);
		await recordUserAudit(req, 'user.delete', userId);
		return res.status(200).json({ message: `User '${userId}' deleted successfully` });
	} catch (error) {
		handleError(res, error, 'deleting user');
	}
};

export const bulkDeleteUsers = async (req: Request, res: Response) => {
	const { userIds } = res.locals.validatedQuery as { userIds: string[] };

	const logger = container.get(LoggerService);
	logger.verbose(`Deleting users: ${userIds}`);

	try {
		const userService = container.get(UserService);
		const { deleted, failed } = await userService.bulkDeleteUsers(userIds);
		await recordUserAudit(req, 'user.bulk_delete', undefined, {
			deletedCount: deleted.length,
			failedCount: failed.length
		});

		// All users were successfully deleted
		if (failed.length === 0) {
			return res.status(200).json({ message: 'All users deleted successfully', deleted, failed: [] });
		}

		// Some or all users could not be deleted
		return res.status(400).json({
			message: `${failed.length} user(s) could not be deleted`,
			deleted,
			failed
		});
	} catch (error) {
		handleError(res, error, 'deleting users');
	}
};

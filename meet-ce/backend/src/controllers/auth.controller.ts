import type { Request, Response } from 'express';
import { container } from '../config/dependency-injector.config.js';
import { MEET_ENV } from '../environment.js';
import {
	errorInvalidCredentials,
	errorInvalidRefreshToken,
	errorInvalidTokenSubject,
	errorPasswordChangeRequired,
	errorRefreshTokenNotPresent,
	handleError,
	rejectRequestFromMeetError
} from '../models/error.model.js';
import { TokenType, type TokenMetadata } from '../models/token.model.js';
import { LoggerService } from '../services/logger.service.js';
import { TokenService } from '../services/token.service.js';
import { UserService } from '../services/user.service.js';
import { GlobalConfigService } from '../services/global-config.service.js';
import { RedisService } from '../services/redis.service.js';
import { RequestSessionService } from '../services/request-session.service.js';
import { getRefreshToken } from '../utils/token.utils.js';

export const login = async (req: Request, res: Response) => {
	const logger = container.get(LoggerService);
	logger.verbose('Login request received');
	const { loginName, password } = req.body as { loginName: string; password: string };
	if (!loginName) return res.status(422).json({ message: 'loginName is required' });
	const failureKey = `auth-login-failure:${loginName.toLowerCase()}`;
	const redis = container.get(RedisService);
	if (Number(await redis.get(failureKey) ?? 0) >= 5) return res.status(423).json({ message: 'Account login is temporarily locked' });

	const userService = container.get(UserService);
	const user = await userService.authenticateUser(loginName, password);

	if (!user) {
		await redis.incrementWithTtl(failureKey, 15 * 60);
		logger.warn('Login failed');
		const error = errorInvalidCredentials();
		return rejectRequestFromMeetError(res, error);
	}
	await redis.delete(failureKey);

	try {
		const tokenService = container.get(TokenService);

		// Check if password change is required
		if (user.mustChangePassword) {
			// Generate temporary token with limited TTL, no refresh token
			const accessToken = await tokenService.generateAccessToken(user, true);

			logger.info(`Login succeeded for user '${loginName}', but password change is required`);
			return res.status(200).json({
				message: `User '${loginName}' logged in successfully, but password change is required`,
				accessToken,
				mustChangePassword: true
			});
		}

		// Normal login flow
		const accessToken = await tokenService.generateAccessToken(user);
		const refreshToken = await tokenService.generateRefreshToken(user, { ipAddress: req.ip, userAgent: req.get('user-agent') });

		logger.info(`Login succeeded for user '${loginName}'`);
		return res.status(200).json({
			message: `User '${loginName}' logged in successfully`,
			accessToken,
			refreshToken
		});
	} catch (error) {
		handleError(res, error, 'generating access and refresh tokens');
	}
};

export const getAuthenticationOptions = async (req: Request, res: Response) => {
	try {
		const config = await container.get(GlobalConfigService).getPublicAuthenticationConfig();
		return res.status(200).json(config);
	} catch (error) {
		handleError(res, error, 'getting authentication options');
	}
};

export const listSessions = async (req: Request, res: Response) => {
	const user = container.get(RequestSessionService).getAuthenticatedUser();
	if (!user) return res.status(401).json({ message: 'Unauthorized' });
	const tokenService = container.get(TokenService);
	const sessions = await tokenService.listUserSessions(user.userId);
	// 从请求携带的 refresh token 里解出 sessionId，给设备列表标记「当前设备」
	let currentSessionId: string | undefined;
	const refreshToken = getRefreshToken(req);
	if (refreshToken) {
		try {
			const { metadata } = await tokenService.verifyToken(refreshToken);
			if (metadata) currentSessionId = tokenService.parseTokenMetadata(metadata).sessionId;
		} catch {
			// refresh token 缺失或已失效时不标记任何会话
		}
	}
	return res.status(200).json({
		// 按登录时间倒序：最新设备排最前，「当前设备」通常落在第一页
		sessions: sessions
			.map((session) => ({ ...session, current: Boolean(currentSessionId) && session.sessionId === currentSessionId }))
			.sort((a, b) => b.createdAt - a.createdAt)
	});
};

export const revokeSession = async (req: Request, res: Response) => {
	const user = container.get(RequestSessionService).getAuthenticatedUser();
	if (!user) return res.status(401).json({ message: 'Unauthorized' });
	const revoked = await container.get(TokenService).revokeUserSession(user.userId, String(req.params.sessionId));
	return res.status(revoked ? 200 : 404).json({ revoked });
};

export const logout = async (req: Request, res: Response) => {
	const refreshToken = getRefreshToken(req);
	if (refreshToken) {
		try {
			const tokenService = container.get(TokenService);
			const claims = await tokenService.verifyToken(refreshToken);
			if (claims.metadata) await tokenService.revokeRefreshSession(tokenService.parseTokenMetadata(claims.metadata).sessionId);
		} catch { /* Idempotent logout: invalid/expired refresh tokens are already unusable. */ }
	}
	return res.status(200).json({ message: 'Logout successful' });
};

export const refreshToken = async (req: Request, res: Response) => {
	const logger = container.get(LoggerService);
	logger.verbose('Refresh token request received');

	const refreshToken = getRefreshToken(req);

	if (!refreshToken) {
		logger.warn('No refresh token provided');
		const error = errorRefreshTokenNotPresent();
		return rejectRequestFromMeetError(res, error);
	}

	const tokenService = container.get(TokenService);
	let userId: string | undefined;
	let parsedMetadata: TokenMetadata;

	try {
		// Verify the token and extract the user ID and token metadata
		const { sub, metadata: tokenMetadata } = await tokenService.verifyToken(refreshToken);

		if (!tokenMetadata) {
			throw new Error('Missing required token claims');
		}

		// Validate that this is actually a refresh token
		parsedMetadata = tokenService.parseTokenMetadata(tokenMetadata);
		userId = sub;
		const tokenType = parsedMetadata.tokenType;

		if (tokenType !== TokenType.REFRESH) {
			throw new Error('Invalid token type for refresh operation');
		}
	} catch (error) {
		logger.error('Invalid refresh token:', error);
		const meetError = errorInvalidRefreshToken();
		return rejectRequestFromMeetError(res, meetError);
	}

	const userService = container.get(UserService);
	const user = userId ? await userService.getUser(userId) : null;

	if (!user) {
		logger.warn('Invalid refresh token subject');
		const error = errorInvalidTokenSubject();
		return rejectRequestFromMeetError(res, error);
	}
	if (!(await tokenService.validateRefreshSession(parsedMetadata, user))) return rejectRequestFromMeetError(res, errorInvalidRefreshToken());

	// Restrict refresh if password change is required
	if (user.mustChangePassword) {
		logger.warn(`Cannot refresh token: password change required for user '${userId}'`);
		const error = errorPasswordChangeRequired();
		return rejectRequestFromMeetError(res, error);
	}

	try {
		const accessToken = await tokenService.generateAccessToken(user);
		const shouldRotateRefreshToken = MEET_ENV.REFRESH_TOKEN_ROTATION_ENABLED.toLowerCase() === 'true';
		const newRefreshToken = shouldRotateRefreshToken ? await tokenService.generateRefreshToken(user, { ipAddress: req.ip, userAgent: req.get('user-agent') }) : undefined;
		if (shouldRotateRefreshToken) await tokenService.revokeRefreshSession(parsedMetadata.sessionId);

		logger.info(`Access token refreshed for user '${userId}'`);
		return res.status(200).json({
			message: `Access token for user '${userId}' successfully refreshed`,
			accessToken,
			...(newRefreshToken ? { refreshToken: newRefreshToken } : {})
		});
	} catch (error) {
		handleError(res, error, 'refreshing token');
	}
};

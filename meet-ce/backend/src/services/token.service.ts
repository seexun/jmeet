import type { MeetRoomMemberTokenMetadata, MeetUser } from '@openvidu-meet/typings';
import { inject, injectable } from 'inversify';
import { jwtDecode } from 'jwt-decode';
import type { AccessTokenOptions, ClaimGrants, VideoGrant } from 'livekit-server-sdk';
import { AccessToken, TokenVerifier } from 'livekit-server-sdk';
import { randomUUID } from 'node:crypto';
import ms, { type StringValue } from 'ms';
import { MEET_ENV } from '../environment.js';
import { validateTokenMetadata } from '../middlewares/request-validators/auth-validator.middleware.js';
import { validateRoomMemberTokenMetadata } from '../middlewares/request-validators/room-member-validator.middleware.js';
import type { MeetRoomMemberTokenOptions, TokenMetadata } from '../models/token.model.js';
import { TokenType } from '../models/token.model.js';
import { LoggerService } from './logger.service.js';
import { RedisService } from './redis.service.js';

@injectable()
export class TokenService {
	constructor(@inject(LoggerService) protected logger: LoggerService, @inject(RedisService) private redis: RedisService) {}

	async generateAccessToken(user: MeetUser, isTemporary = false): Promise<string> {
		const tokenMetadata: TokenMetadata = {
			iat: Date.now(),
			tokenType: isTemporary ? TokenType.TEMPORARY : TokenType.ACCESS,
			authVersion: user.authVersion ?? 1
		};
		const tokenOptions: AccessTokenOptions = {
			identity: user.userId,
			name: user.name,
			ttl: isTemporary ? MEET_ENV.PASSWORD_CHANGE_TOKEN_EXPIRATION : MEET_ENV.ACCESS_TOKEN_EXPIRATION,
			metadata: JSON.stringify(tokenMetadata)
		};
		return await this.generateJwtToken(tokenOptions);
	}

	parseTokenMetadata(metadata: string): TokenMetadata {
		try {
			const parsedMetadata = JSON.parse(metadata);
			return validateTokenMetadata(parsedMetadata);
		} catch (error) {
			this.logger.error('Failed to parse token metadata:', error);
			throw new Error('Invalid token metadata format');
		}
	}

	async generateRefreshToken(user: MeetUser, context?: { ipAddress?: string; userAgent?: string }): Promise<string> {
		const sessionId = randomUUID();
		const tokenMetadata: TokenMetadata = {
			iat: Date.now(),
			tokenType: TokenType.REFRESH,
			authVersion: user.authVersion ?? 1,
			sessionId
		};
		const tokenOptions: AccessTokenOptions = {
			identity: user.userId,
			name: user.name,
			ttl: MEET_ENV.REFRESH_TOKEN_EXPIRATION,
			metadata: JSON.stringify(tokenMetadata)
		};
		const token = await this.generateJwtToken(tokenOptions);
		await this.redis.set(this.refreshSessionKey(sessionId), JSON.stringify({ sessionId, userId: user.userId, createdAt: Date.now(), lastSeenAt: Date.now(), ipAddress: context?.ipAddress, userAgent: context?.userAgent }), ms(MEET_ENV.REFRESH_TOKEN_EXPIRATION as StringValue));
		return token;
	}

	async validateRefreshSession(metadata: TokenMetadata, user: MeetUser): Promise<boolean> {
		if (!metadata.sessionId || metadata.authVersion !== (user.authVersion ?? 1) || user.enabled === false) return false;
		return Boolean(await this.redis.get(this.refreshSessionKey(metadata.sessionId)));
	}

	async revokeRefreshSession(sessionId?: string): Promise<void> {
		if (sessionId) await this.redis.delete(this.refreshSessionKey(sessionId));
	}

	async listUserSessions(userId: string): Promise<Array<{ sessionId: string; createdAt: number; lastSeenAt: number; ipAddress?: string; userAgent?: string }>> {
		const entries = await this.redis.scanValues('auth-refresh-session:*');
		return entries.map(({ value }) => JSON.parse(value)).filter((session) => session.userId === userId).map(({ userId: _userId, ...session }) => session);
	}

	async revokeUserSession(userId: string, sessionId: string): Promise<boolean> {
		const raw = await this.redis.get(this.refreshSessionKey(sessionId));
		if (!raw || JSON.parse(raw).userId !== userId) return false;
		await this.revokeRefreshSession(sessionId); return true;
	}

	async revokeAllUserRefreshSessions(userId: string): Promise<number> {
		const entries = await this.redis.scanValues('auth-refresh-session:*'); let revoked = 0;
		for (const { key, value } of entries) {
			try { if (JSON.parse(value).userId === userId) { await this.redis.delete(key); revoked++; } } catch { /* Ignore malformed stale session entries. */ }
		}
		return revoked;
	}

	private refreshSessionKey(sessionId: string): string { return `auth-refresh-session:${sessionId}`; }

	async generateRoomMemberToken(options: MeetRoomMemberTokenOptions): Promise<string> {
		const { tokenMetadata, livekitPermissions, participantName, participantIdentity } = options;

		const tokenOptions: AccessTokenOptions = {
			identity: participantIdentity,
			name: participantName,
			ttl: MEET_ENV.ROOM_MEMBER_TOKEN_EXPIRATION,
			metadata: JSON.stringify(tokenMetadata)
		};
		return await this.generateJwtToken(tokenOptions, livekitPermissions);
	}

	async generateAsrTestToken(_roomName: string, _identity: string, _ttlSeconds = 15 * 60): Promise<string> {
		throw new Error('ASR test tokens are not available in the open-source edition');
	}

	parseRoomMemberTokenMetadata(metadata: string): MeetRoomMemberTokenMetadata {
		try {
			const parsedMetadata = JSON.parse(metadata);
			return validateRoomMemberTokenMetadata(parsedMetadata);
		} catch (error) {
			this.logger.error('Failed to parse room member token metadata:', error);
			throw new Error('Invalid room member token metadata format');
		}
	}

	private async generateJwtToken(tokenOptions: AccessTokenOptions, grants?: VideoGrant): Promise<string> {
		const at = new AccessToken(MEET_ENV.LIVEKIT_API_KEY, MEET_ENV.LIVEKIT_API_SECRET, tokenOptions);

		if (grants) {
			at.addGrant(grants);
		}

		return await at.toJwt();
	}

	async verifyToken(token: string, clockToleranceSeconds = 0): Promise<ClaimGrants> {
		const verifier = new TokenVerifier(MEET_ENV.LIVEKIT_API_KEY, MEET_ENV.LIVEKIT_API_SECRET);
		return await verifier.verify(token, clockToleranceSeconds);
	}

	/**
	 * Decodes a JWT and returns its ClaimGrants, even if expired.
	 */
	getClaimsIgnoringExpiration(token: string): ClaimGrants {
		try {
			const decoded = jwtDecode<ClaimGrants>(token);
			return decoded;
		} catch (error) {
			this.logger.error('Failed to decode JWT:', error);
			throw error;
		}
	}
}

import type { Request } from 'express';
import { INTERNAL_CONFIG } from '../config/internal-config.js';

/**
 * Extracts the access token from the request based on the configured transport mode.
 *
 * @param req - Express request object
 * @returns The JWT token string or undefined if not found
 */
export const getAccessToken = (req: Request): string | undefined => {
	return getTokenFromRequest(req, INTERNAL_CONFIG.ACCESS_TOKEN_HEADER, 'accessToken');
};

/**
 * Extracts the refresh token from the request based on the configured transport mode.
 *
 * @param req - Express request object
 * @returns The JWT refresh token string or undefined if not found
 */
export const getRefreshToken = (req: Request): string | undefined => {
	return getTokenFromRequest(req, INTERNAL_CONFIG.REFRESH_TOKEN_HEADER);
};

/**
 * Extracts the room member token from the request based on the configured transport mode.
 *
 * @param req - Express request object
 * @returns The JWT room member token string or undefined if not found
 */
export const getRoomMemberToken = (req: Request): string | undefined => {
	return getTokenFromRequest(req, INTERNAL_CONFIG.ROOM_MEMBER_TOKEN_HEADER, 'roomMemberToken');
};

/**
 * Generic function to extract a JWT token from the request based on the configured transport mode.
 *
 * @param req - Express request object
 * @param headerName - Name of the header to check
 * @param queryParamName - (Optional) Name of the query parameter to check (for access and room member tokens)
 * @returns The JWT token string or undefined if not found
 */
const getTokenFromRequest = (req: Request, headerName: string, queryParamName?: string): string | undefined => {
	// Try to get from header
	const headerValue = req.headers[headerName];

	// Header value must be a string starting with 'Bearer '
	if (headerValue && typeof headerValue === 'string' && headerValue.startsWith('Bearer ')) {
		return headerValue.substring(7);
	}

	/**
	 * If not found in header, try to get from query parameter
	 * This is needed to send tokens via URL for video playback
	 * since we cannot set custom headers in video element requests
	 */
	if (queryParamName) {
		const token = req.query[queryParamName];

		if (token && typeof token === 'string') {
			return token;
		}
	}
};

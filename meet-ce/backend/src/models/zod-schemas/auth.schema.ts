import { z } from 'zod';
import type { TokenMetadata} from '../token.model.js';
import { TokenType } from '../token.model.js';

export const LoginReqSchema = z.object({
	loginName: z.string().min(3).optional(),
	userId: z.string().min(1).optional(),
	password: z.string().min(5, 'password must be at least 5 characters long'),
	// Accept either a six-digit authenticator code or a one-time recovery code.
	otp: z.string().regex(/^(\d{6}|[a-f0-9]{10})$/i).optional()
}).refine((value) => Boolean(value.loginName || value.userId), { message: 'loginName is required' });

export const TokenMetadataSchema: z.ZodType<TokenMetadata> = z.object({
	iat: z.number(),
	tokenType: z.nativeEnum(TokenType),
	authVersion: z.number().int().positive().optional(),
	sessionId: z.string().uuid().optional()
});

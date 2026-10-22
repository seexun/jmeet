import type { NextFunction, Request, Response } from 'express';
import { rejectUnprocessableRequest } from '../../models/error.model.js';
import type { TokenMetadata } from '../../models/token.model.js';
import { LoginReqSchema, TokenMetadataSchema } from '../../models/zod-schemas/auth.schema.js';

export const validateLoginReq = (req: Request, res: Response, next: NextFunction) => {
	const { success, error, data } = LoginReqSchema.safeParse(req.body);

	if (!success) {
		return rejectUnprocessableRequest(res, error);
	}

	req.body = data;
	next();
};

export const validateTokenMetadata = (metadata: unknown): TokenMetadata => {
	const { success, error, data } = TokenMetadataSchema.safeParse(metadata);

	if (!success) {
		throw new Error(`Invalid metadata: ${error.message}`);
	}

	return data;
};

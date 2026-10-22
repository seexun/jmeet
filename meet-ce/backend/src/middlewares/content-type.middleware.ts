import type { NextFunction, Request, Response } from 'express';
import { errorMalformedBody, errorUnsupportedMediaType, rejectRequestFromMeetError } from '../models/error.model.js';

export const mediaTypeValidatorMiddleware = (req: Request, res: Response, next: NextFunction) => {
	if (req.method === 'GET') {
		return next();
	}

	const supportedMediaTypes = ['application/json'];
	const contentType = req.headers['content-type'];

	if (!contentType || !supportedMediaTypes.includes(contentType)) {
		const error = errorUnsupportedMediaType(supportedMediaTypes);
		return rejectRequestFromMeetError(res, error);
	}

	next();
};

/**
 * Express middleware that handles JSON syntax errors in request bodies.
 * If a SyntaxError with status 400 is detected and contains a 'body' property,
 * it responds with a 400 Bad Request status and a JSON error message.
 * Otherwise, it passes the error to the next middleware in the chain.
 *
 * @param err - The error object that was caught
 * @param _req - The Express request object
 * @param res - The Express response object
 * @param next - Express next function to continue to the next middleware
 */
export const jsonSyntaxErrorHandler = (err: any, _req: Request, res: Response, next: NextFunction): void => {
	if (err instanceof SyntaxError && (err as any).status === 400 && 'body' in err) {
		const error = errorMalformedBody();
		rejectRequestFromMeetError(res, error);
	} else {
		next(err);
	}
};

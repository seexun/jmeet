import type { NextFunction, Request, Response } from 'express';
import { container } from '../config/dependency-injector.config.js';
import { BaseUrlService } from '../services/base-url.service.js';

export const setBaseUrlFromRequest = (req: Request, _res: Response, next: NextFunction) => {
	if (req.path === '/livekit/webhook') {
		// Skip setting base URL for LiveKit webhooks
		return next();
	}

	const baseUrlService = container.get(BaseUrlService);
	baseUrlService.setBaseUrlFromRequest(req);
	next();
};

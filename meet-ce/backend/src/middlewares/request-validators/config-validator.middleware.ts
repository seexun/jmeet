import type { NextFunction, Request, Response } from 'express';
import { rejectUnprocessableRequest } from '../../models/error.model.js';
import { RoomsAppearanceConfigSchema } from '../../models/zod-schemas/global-config.schema.js';

export const validateUpdateRoomsAppearanceConfigReq = (req: Request, res: Response, next: NextFunction) => {
	const { success, error, data } = RoomsAppearanceConfigSchema.safeParse(req.body);

	if (!success) {
		return rejectUnprocessableRequest(res, error);
	}

	req.body = data;
	next();
};

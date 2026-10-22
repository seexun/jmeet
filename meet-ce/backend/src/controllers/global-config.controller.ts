import type { MeetAppearanceConfig } from '@openvidu-meet/typings';
import type { Request, Response } from 'express';
import { container } from '../config/dependency-injector.config.js';
import { handleError } from '../models/error.model.js';
import { GlobalConfigService } from '../services/global-config.service.js';
import { LoggerService } from '../services/logger.service.js';

export const updateRoomsAppearanceConfig = async (req: Request, res: Response) => {
	const logger = container.get(LoggerService);
	const configService = container.get(GlobalConfigService);

	logger.verbose(`Updating rooms appearance config: ${JSON.stringify(req.body)}`);
	const appearanceConfig = req.body as { appearance: MeetAppearanceConfig };

	try {
		const updatedConfig = await configService.updateRoomsAppearanceConfig(appearanceConfig);
		return res.status(200).json(updatedConfig);
	} catch (error) {
		handleError(res, error, 'updating rooms appearance config');
	}
};

export const getRoomsAppearanceConfig = async (_req: Request, res: Response) => {
	const logger = container.get(LoggerService);
	const configService = container.get(GlobalConfigService);

	logger.verbose(`Getting rooms appearance config`);

	try {
		const appearanceConfig = await configService.getRoomsAppearanceConfig();
		return res.status(200).json(appearanceConfig);
	} catch (error) {
		handleError(res, error, 'getting rooms appearance config');
	}
};

export const getPlatformBranding = async (_req: Request, res: Response) => {
	try {
		return res.status(200).json(await container.get(GlobalConfigService).getPlatformBranding());
	} catch (error) {
		handleError(res, error, 'getting platform branding config');
	}
};

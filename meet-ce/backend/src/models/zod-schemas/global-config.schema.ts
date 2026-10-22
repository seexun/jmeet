import { z } from 'zod';
import { AppearanceConfigSchema } from './room.schema.js';

export const PlatformBrandingConfigSchema = z.object({
	productName: z.string().trim().min(1, 'Product name is required').max(64),
	customLogo: z.boolean(),
	logoContentType: z.string().optional(),
	logoUpdatedAt: z.number().int().optional()
});

export const RoomsAppearanceConfigSchema = z.object({
	appearance: AppearanceConfigSchema
});

import type { GlobalConfig, MeetAppearanceConfig, PlatformBrandingConfig } from '@openvidu-meet/typings';
import { DEFAULT_PLATFORM_BRANDING } from '@openvidu-meet/typings';
import { inject, injectable } from 'inversify';
import { MEET_ENV } from '../environment.js';
import { GlobalConfigRepository } from '../repositories/global-config.repository.js';
import { LoggerService } from './logger.service.js';

/**
 * Service for managing global configuration.
 * Handles initialization, retrieval and updates of system-wide configuration.
 */
@injectable()
export class GlobalConfigService {
	constructor(
		@inject(LoggerService) private logger: LoggerService,
		@inject(GlobalConfigRepository) private globalConfigRepository: GlobalConfigRepository
	) {}

	/**
	 * Initializes the global configuration with default values.
	 * Idempotent: skips creation when a config document already exists (e.g. on restart).
	 */
	async initializeGlobalConfig(): Promise<void> {
		try {
			const existing = await this.globalConfigRepository.get(['projectId']);
			if (existing) {
				this.logger.verbose('Global config already initialized, skipping initialization');
				return;
			}
			const defaultConfig = this.getDefaultConfig();
			await this.globalConfigRepository.create(defaultConfig);
			this.logger.info('Global config initialized with default values');
		} catch (error) {
			this.logger.error('Error initializing global config:', error);
			throw error;
		}
	}

	/**
	 * 开源版仅支持本地账号登录。
	 */
	async getPublicAuthenticationConfig() {
		return {
			localLoginEnabled: true,
			recommendedProviderId: undefined,
			identityProviders: [] as Array<{ id: string; type: string; displayName: string }>
		};
	}

	/**
	 * Retrieves the rooms appearance configuration.
	 *
	 * @returns The rooms appearance configuration
	 */
	async getRoomsAppearanceConfig(): Promise<{ appearance: MeetAppearanceConfig }> {
		try {
			const roomsConfig = await this.getGlobalConfigField('roomsConfig');
			return roomsConfig;
		} catch (error) {
			this.logger.error('Error retrieving rooms appearance config:', error);
			throw error;
		}
	}

	/**
	 * Updates the rooms appearance configuration.
	 *
	 * @param appearanceConfig - The appearance configuration to update
	 * @returns The updated appearance configuration
	 */
	async updateRoomsAppearanceConfig(appearanceConfig: {
		appearance: MeetAppearanceConfig;
	}): Promise<{ appearance: MeetAppearanceConfig }> {
		try {
			const roomsConfigDB = await this.getGlobalConfigField('roomsConfig');
			const updatedRoomsConfig = {
				...appearanceConfig
			};

			if (roomsConfigDB.appearance.themes.length > 0) {
				// Preserve existing theme colors if they are not provided in the update
				const existingTheme = roomsConfigDB.appearance.themes[0];
				const newTheme = updatedRoomsConfig.appearance.themes[0];

				newTheme.backgroundColor = newTheme.backgroundColor ?? existingTheme.backgroundColor;
				newTheme.primaryColor = newTheme.primaryColor ?? existingTheme.primaryColor;
				newTheme.secondaryColor = newTheme.secondaryColor ?? existingTheme.secondaryColor;
				newTheme.accentColor = newTheme.accentColor ?? existingTheme.accentColor;
			}

			const updatedConfig = await this.globalConfigRepository.updatePartial({ roomsConfig: updatedRoomsConfig });
			this.logger.info('Rooms appearance config updated successfully');
			return updatedConfig.roomsConfig;
		} catch (error) {
			this.logger.error('Error updating rooms appearance config:', error);
			throw error;
		}
	}

	async getPlatformBranding(): Promise<PlatformBrandingConfig> {
		try {
			const config = await this.globalConfigRepository.get(['platformBranding']);
			return this.normalizePlatformBranding(config?.platformBranding);
		} catch (error) {
			this.logger.error('Error retrieving platform branding config:', error);
			throw error;
		}
	}

	private normalizePlatformBranding(
		branding?: PlatformBrandingConfig & { namePrimary?: string; nameAccent?: string }
	): PlatformBrandingConfig {
		if (!branding) return { ...DEFAULT_PLATFORM_BRANDING };
		const productName =
			branding.productName?.trim() ||
			[branding.namePrimary, branding.nameAccent].filter(Boolean).join(' ').trim() ||
			DEFAULT_PLATFORM_BRANDING.productName;
		return {
			productName,
			customLogo: branding.customLogo ?? false,
			logoContentType: branding.logoContentType,
			logoUpdatedAt: branding.logoUpdatedAt
		};
	}

	/**
	 * Retrieves a specific field from the global configuration.
	 *
	 * @param field - The field name to retrieve
	 * @returns The value of the requested field
	 * @throws Error if global config is not found
	 */
	protected async getGlobalConfigField<T extends keyof GlobalConfig>(field: T): Promise<GlobalConfig[T]> {
		try {
			const config = await this.globalConfigRepository.get([field]);

			if (!config) {
				this.logger.error('Global config not found');
				throw new Error('Global config not found');
			}

			return config[field];
		} catch (error) {
			this.logger.error('Error retrieving global config:', error);
			throw error;
		}
	}

	/**
	 * Returns the default global configuration.
	 */
	protected getDefaultConfig(): GlobalConfig {
		const defaultConfig: GlobalConfig = {
			projectId: MEET_ENV.NAME_ID,
			platformBranding: { ...DEFAULT_PLATFORM_BRANDING },
			roomsConfig: {
				appearance: {
					themes: []
				}
			}
		};
		return defaultConfig;
	}
}

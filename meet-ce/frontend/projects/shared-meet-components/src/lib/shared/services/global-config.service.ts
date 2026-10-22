import { inject, Injectable, signal } from '@angular/core';
import { MeetAppearanceConfig, PlatformBrandingConfig } from '@openvidu-meet/typings';
import { ILogger, LoggerService } from '../../domains/meeting/openvidu-components';
import { HttpService } from './http.service';

@Injectable({
	providedIn: 'root'
})
export class GlobalConfigService {
	protected readonly GLOBAL_CONFIG_API = `${HttpService.INTERNAL_API_PATH_PREFIX}/config`;

	protected loggerService: LoggerService = inject(LoggerService);
	protected httpService: HttpService = inject(HttpService);

	protected log: ILogger = this.loggerService.get('JMeet - GlobalConfigService');

	private readonly _roomAppearanceConfig = signal<MeetAppearanceConfig>({
		themes: []
	});

	readonly roomAppearanceConfig = this._roomAppearanceConfig.asReadonly();

	constructor() {}

	async getRoomsAppearanceConfig(): Promise<{ appearance: MeetAppearanceConfig }> {
		const path = `${this.GLOBAL_CONFIG_API}/rooms/appearance`;
		return await this.httpService.getRequest<{ appearance: MeetAppearanceConfig }>(path);
	}

	async loadRoomsAppearanceConfig(): Promise<void> {
		try {
			const { appearance } = await this.getRoomsAppearanceConfig();
			this._roomAppearanceConfig.set(appearance);
		} catch (error) {
			this.log.e('Error loading rooms appearance config:', error);
			throw error;
		}
	}

	async saveRoomsAppearanceConfig(config: MeetAppearanceConfig) {
		const path = `${this.GLOBAL_CONFIG_API}/rooms/appearance`;
		await this.httpService.putRequest(path, { appearance: config });
	}

	/** 开源版品牌固定为 JMeet：仅读取，不提供改名/换 Logo。 */
	async getPlatformBranding(): Promise<PlatformBrandingConfig> {
		const path = `${this.GLOBAL_CONFIG_API}/platform-branding`;
		return await this.httpService.getRequest<PlatformBrandingConfig>(path);
	}
}

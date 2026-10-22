import { computed, inject, Injectable, signal } from '@angular/core';
import { DEFAULT_PLATFORM_BRANDING, PlatformBrandingConfig } from '@openvidu-meet/typings';
import { GlobalConfigService } from './global-config.service';
import { HttpService } from './http.service';
import { RuntimeConfigService } from './runtime-config.service';

@Injectable({
	providedIn: 'root'
})
export class PlatformBrandingService {
	private readonly globalConfigService = inject(GlobalConfigService);
	private readonly httpService = inject(HttpService);
	private readonly runtimeConfig = inject(RuntimeConfigService);

	private readonly _branding = signal<PlatformBrandingConfig>({ ...DEFAULT_PLATFORM_BRANDING });
	private readonly _loaded = signal(false);

	readonly branding = this._branding.asReadonly();
	readonly loaded = this._loaded.asReadonly();

	readonly productName = computed(
		() => this._branding().productName?.trim() || DEFAULT_PLATFORM_BRANDING.productName
	);
	readonly displayName = this.productName;
	readonly customLogo = computed(() => this._branding().customLogo);
	readonly logoUrl = computed(() => {
		if (!this._branding().customLogo) return null;
		const version = this._branding().logoUpdatedAt ?? 0;
		return this.runtimeConfig.resolveUrl(
			`${HttpService.INTERNAL_API_PATH_PREFIX}/config/platform-branding/logo?v=${version}`
		);
	});

	async ensureLoaded(force = false): Promise<void> {
		if (this._loaded() && !force) return;
		try {
			const branding = await this.globalConfigService.getPlatformBranding();
			this.applyBranding(branding);
		} catch {
			this.applyBranding({ ...DEFAULT_PLATFORM_BRANDING });
		}
	}

	applyBranding(branding: PlatformBrandingConfig): void {
		const normalized: PlatformBrandingConfig = {
			productName: branding.productName?.trim() || DEFAULT_PLATFORM_BRANDING.productName,
			customLogo: branding.customLogo,
			logoContentType: branding.logoContentType,
			logoUpdatedAt: branding.logoUpdatedAt
		};
		this._branding.set(normalized);
		this._loaded.set(true);
		if (typeof document !== 'undefined') {
			document.title = normalized.productName;
			// 浏览器标签页图标跟随平台品牌 logo（用户裁决 2026-10-21）；未自定义时恢复内置链接
			this.applyFavicon(normalized.customLogo ? this.logoUrl() : null);
		}
	}

	/**
	 * 同步 favicon 与品牌 logo。首次改写前把 index.html 的原始 href 存到 data 属性，
	 * 以便删除自定义 logo 后能恢复默认图标。
	 */
	private applyFavicon(url: string | null): void {
		document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]').forEach((link) => {
			link.dataset['defaultHref'] ||= link.getAttribute('href') ?? '';
			link.setAttribute('href', url ?? link.dataset['defaultHref']);
		});
	}
}

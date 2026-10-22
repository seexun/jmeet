import { computed, DOCUMENT, inject, Injectable } from '@angular/core';
import { OpenViduThemeMode, OpenViduThemeService } from '../../domains/meeting/openvidu-components';

export type Theme = 'light';

@Injectable({
	providedIn: 'root'
})
export class ThemeService {
	private document = inject(DOCUMENT);
	protected ovComponentsThemeService = inject(OpenViduThemeService);

	public readonly currentTheme = computed<Theme>(() => 'light');
	public readonly isDark = computed(() => false);
	public readonly isLight = computed(() => true);

	/**
	 * Initializes the light-only theme for SPA and OpenVidu Components.
	 */
	init(): void {
		this.document.documentElement.removeAttribute('data-theme');
		this.ovComponentsThemeService.setTheme(OpenViduThemeMode.Light);
		try {
			localStorage.removeItem('ovMeet-theme');
		} catch {
			// Ignore storage failures in restricted environments.
		}
	}

	public toggleTheme(): void {
		// Light-only product: theme switching is intentionally disabled.
	}

	public resetToSystemPreference(): void {
		this.init();
	}
}

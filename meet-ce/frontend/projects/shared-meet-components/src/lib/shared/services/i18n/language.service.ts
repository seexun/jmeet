import { effect, inject, Injectable, signal } from '@angular/core';
import { StorageService } from '../../../domains/meeting/openvidu-components/services/storage/storage.service';
import {
	de_DE,
	en_US,
	es_ES,
	fr_FR,
	hi_IN,
	it_IT,
	ja_JP,
	nl_NL,
	NzI18nService,
	pt_PT,
	zh_CN
} from 'ng-zorro-antd/i18n';
import type { DateLocale, NzI18nInterface } from 'ng-zorro-antd/i18n';
import { AvailableLangs, LangOption } from '../../models/lang.model';

/**
 * Default set of languages shipped with the application, shared by every scope (meeting, console).
 * Hosts can override it per scope via {@link LanguageService.setAvailableLanguages}.
 */
export const DEFAULT_LANGUAGE_OPTIONS: LangOption[] = [
	{ name: '简体中文', lang: 'cn' },
	{ name: 'English', lang: 'en' },
	{ name: 'Español', lang: 'es' },
	{ name: 'Deutsch', lang: 'de' },
	{ name: 'Français', lang: 'fr' },
	{ name: 'हिन्दी', lang: 'hi' },
	{ name: 'Italiano', lang: 'it' },
	{ name: '日本語', lang: 'ja' },
	{ name: 'Dutch', lang: 'nl' },
	{ name: 'Português', lang: 'pt' }
];

/** App language code → NG-ZORRO locale (drives built-in component texts). */
const NZ_LOCALES: Record<string, NzI18nInterface & DateLocale> = {
	cn: zh_CN,
	en: en_US,
	es: es_ES,
	de: de_DE,
	fr: fr_FR,
	hi: hi_IN,
	it: it_IT,
	ja: ja_JP,
	nl: nl_NL,
	pt: pt_PT
};

/**
 * Single source of truth for the user's selected language across the whole application.
 *
 * The meeting and the console each render their own language selector, but both read and write this
 * one service, so the preference is shared: pick English in the console and the meeting starts in
 * English too (and vice versa). Each area keeps its own translation files — only the *selected
 * language* is shared, persisted under the existing storage key for backward compatibility.
 */
@Injectable({
	providedIn: 'root'
})
export class LanguageService {
	private readonly storageService = inject(StorageService);
	/** Optional: absent in minimal injectors without `provideNzI18n` (then components keep the default locale). */
	private readonly nzI18n = inject(NzI18nService, { optional: true });

	/** Languages offered in the selectors. */
	readonly availableLanguages = signal<LangOption[]>(DEFAULT_LANGUAGE_OPTIONS);

	/** Currently selected language option. Scope translation stores react to this. */
	readonly selectedLanguage = signal<LangOption>(DEFAULT_LANGUAGE_OPTIONS[0]);

	constructor() {
		this.selectedLanguage.set(this.resolveStoredLanguage());

		// NG-ZORRO built-in texts (pagination, pickers, empty…) follow the app language.
		// Default stays zh_CN — unmapped codes fall back to it.
		effect(() => {
			const lang = this.selectedLanguage().lang;
			this.nzI18n?.setLocale(NZ_LOCALES[lang] ?? zh_CN);
		});
	}

	/**
	 * Selects a language by code, persisting it as the shared preference. No-op if the code does not
	 * match an available option (custom languages must be registered via {@link setAvailableLanguages}
	 * first).
	 */
	setLanguage(lang: AvailableLangs): void {
		const option = this.availableLanguages().find((o) => o.lang === lang);
		if (!option) return;

		this.selectedLanguage.set(option);
		this.storageService.setLang(lang);
	}

	/**
	 * Overrides the available languages (e.g. from the `langOptions` web-component input) and
	 * re-resolves the selected language against the new list.
	 */
	setAvailableLanguages(options?: LangOption[]): void {
		if (!options || options.length === 0) return;

		this.availableLanguages.set(options);
		this.selectedLanguage.set(this.resolveStoredLanguage());
	}

	/** Returns the stored language option, falling back to the first available one. */
	private resolveStoredLanguage(): LangOption {
		const storedLang = this.storageService.getLang();
		const options = this.availableLanguages();
		return options.find((o) => o.lang === storedLang) ?? options[0];
	}
}

import { InjectionToken, Provider } from '@angular/core';
import { AvailableLangs } from './lang.model';

/**
 * Locale eagerly bundled as every domain's `default`. It is used both for a non-blank first paint
 * and as the per-key fallback when the active language hasn't translated a key yet.
 */
export const DEFAULT_LANG: AvailableLangs = 'en';

/** Lazily loads one locale's (possibly nested) translations for a domain. */
export type LocaleLoader = () => Promise<Record<string, any>>;

/**
 * A domain's contribution of translations (e.g. the meeting or the console). Each domain registers
 * its own bundle via {@link provideTranslations}; the generic `TranslateService` merges every
 * registered bundle into a single lookup. `default` is imported eagerly; other locales are
 * lazy-loaded on first use. Keys should live under a domain-specific namespace so bundles don't
 * collide.
 */
export interface TranslationBundle {
	/** The eagerly-imported default locale ({@link DEFAULT_LANG}). */
	default: Record<string, any>;
	/** Lazy loaders for the remaining locales, keyed by locale code. */
	loaders?: Record<string, LocaleLoader>;
}

/** Multi-provider token collecting every {@link TranslationBundle} registered across the app. */
export const TRANSLATION_BUNDLES = new InjectionToken<TranslationBundle[]>('TRANSLATION_BUNDLES');

/**
 * Registers a domain's translations with the generic `TranslateService`. Add it at a composition
 * root (`OpenViduComponentsModule.forRoot` for the meeting, the SPA / web-component app config for
 * the rest) so each runtime only ships the keys it actually renders.
 */
export const provideTranslations = (bundle: TranslationBundle): Provider => ({
	provide: TRANSLATION_BUNDLES,
	useValue: bundle,
	multi: true
});

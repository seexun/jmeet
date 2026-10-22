import { TranslationBundle } from '../models';
import en from './en.json';

/**
 * Cross-cutting translations shared across domains (e.g. the error page reachable at `/error`).
 * English ships eagerly (it also acts as the per-key fallback); other locales load lazily.
 * Registered via `provideTranslations` in the application config of every app that renders
 * these shared components.
 */
export const SHARED_TRANSLATIONS: TranslationBundle = {
	default: en,
	loaders: {
		es: () => import('./es.json'),
		de: () => import('./de.json'),
		fr: () => import('./fr.json'),
		cn: () => import('./cn.json'),
		hi: () => import('./hi.json'),
		it: () => import('./it.json'),
		ja: () => import('./ja.json'),
		nl: () => import('./nl.json'),
		pt: () => import('./pt.json')
	}
};

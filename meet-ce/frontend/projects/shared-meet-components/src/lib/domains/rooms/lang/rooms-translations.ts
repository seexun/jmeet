import { TranslationBundle } from '../../../shared/models';
import en from './en.json';

/**
 * Rooms domain translations bundle. English-only for now (it also acts as the per-key fallback);
 * add lazy `loaders` for further locales as their files are authored. Registered via
 * `provideTranslations` in the application config.
 */
export const ROOMS_TRANSLATIONS: TranslationBundle = {
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

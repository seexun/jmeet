import { TranslationBundle } from '../../../shared/models';
import en from './en.json';

/** Auth domain translations bundle. English-only for now (also the per-key fallback). */
export const AUTH_TRANSLATIONS: TranslationBundle = {
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

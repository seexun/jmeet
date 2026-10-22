import { TranslationBundle } from '../../../shared/models';
import en from './en.json';

/**
 * Meeting (openvidu-components) translations bundle. English is bundled eagerly; every other locale
 * is lazy-loaded on first use, keeping the translation JSON out of the initial download. Registered
 * via `provideTranslations` in `OpenViduComponentsModule.forRoot`.
 */
export const MEETING_TRANSLATIONS: TranslationBundle = {
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

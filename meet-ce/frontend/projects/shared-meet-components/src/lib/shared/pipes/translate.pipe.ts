import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '../services/i18n/translate.service';

/**
 * Translates a dot-separated key into the current language. Shared by the whole application.
 *
 * Impure so it re-evaluates as translations load, and it reads the load-version signal so OnPush
 * components refresh once the newly selected language has finished loading — a static screen has no
 * constant change detection to fall back on.
 */
@Pipe({
	name: 'translate',
	pure: false,
	standalone: true
})
export class TranslatePipe implements PipeTransform {
	private readonly translateService = inject(TranslateService);

	transform(key: string): string {
		this.translateService.translationsLoaded();
		return this.translateService.translate(key);
	}
}

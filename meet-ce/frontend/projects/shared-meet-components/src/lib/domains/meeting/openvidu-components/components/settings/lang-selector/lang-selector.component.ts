import { ChangeDetectionStrategy, Component, OnInit, effect, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { AvailableLangs, LangOption } from '../../../models/lang.model';
import { MeetingTranslateService } from '../../../services/translate/meeting-translate.service';

/**
 * @internal
 */
@Component({
	selector: 'ov-lang-selector',
	imports: [FormsModule, NzIconModule, NzDropDownModule, NzTooltipModule, NzMenuModule, NzSelectModule],
	templateUrl: './lang-selector.component.html',
	styleUrl: './lang-selector.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true
})
export class LangSelectorComponent implements OnInit {
	/**
	 * @internal
	 */
	readonly compact = input(false);
	readonly onLangChanged = output<LangOption>();
	langSelected: LangOption = { name: 'English', lang: 'en' };
	languages: LangOption[] = [];
	private readonly translateService = inject(MeetingTranslateService);
	private readonly langSelectedEffect = effect(() => {
		const lang = this.translateService.selectedLanguageOption();
		this.langSelected = lang;
		this.onLangChanged.emit(lang);
	});

	ngOnInit(): void {
		this.languages = this.translateService.getAvailableLanguages();
	}

	onLangSelected(lang: AvailableLangs) {
		// `setCurrentLanguage` persists the choice through the shared language service.
		this.translateService.setCurrentLanguage(lang);
	}

}

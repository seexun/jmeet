import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import {
	SelectableCardComponent,
	SelectableCardOption,
	SelectionCardEvent
} from '../../../../../../shared//components/selectable-card/selectable-card.component';
import { TranslatePipe } from '../../../../../../shared/pipes/translate.pipe';
import { TranslateService } from '../../../../../../shared/services/i18n/translate.service';
import { RecordingTriggerFormGroup, RecordingTriggerType } from '../../../../models/wizard-forms.model';
import { WizardStepId } from '../../../../models/wizard.model';
import { RoomWizardStateService } from '../../../../services/wizard-state.service';

@Component({
	selector: 'ov-recording-trigger',
	imports: [
		ReactiveFormsModule,

		SelectableCardComponent,
		TranslatePipe
	],
	templateUrl: './recording-trigger.component.html',
	styleUrl: './recording-trigger.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecordingTriggerComponent {
	private wizardService = inject(RoomWizardStateService);
	private readonly translateService = inject(TranslateService);

	triggerForm: RecordingTriggerFormGroup;
	triggerOptions: SelectableCardOption[] = [
		{
			id: 'manual',
			title: this.translateService.translate('ROOMS.WIZARD.RECORDING_TRIGGER.MANUAL_TITLE'),
			description: this.translateService.translate('ROOMS.WIZARD.RECORDING_TRIGGER.MANUAL_DESC'),
			icon: 'touch_app'
			// recommended: true
		},
		{
			id: 'auto1',
			title: this.translateService.translate('ROOMS.WIZARD.RECORDING_TRIGGER.AUTO1_TITLE'),
			description: this.translateService.translate('ROOMS.WIZARD.RECORDING_TRIGGER.AUTO1_DESC'),
			icon: 'person',
			isPro: true,
			disabled: true
		},
		{
			id: 'auto2',
			title: this.translateService.translate('ROOMS.WIZARD.RECORDING_TRIGGER.AUTO2_TITLE'),
			description: this.translateService.translate('ROOMS.WIZARD.RECORDING_TRIGGER.AUTO2_DESC'),
			icon: 'people',
			isPro: true,
			disabled: true
		}
	];

	constructor() {
		const recordingTriggerStep = this.wizardService.getStepById(WizardStepId.RECORDING_TRIGGER);
		if (!recordingTriggerStep) {
			throw new Error('recordingTrigger step not found in wizard state');
		}
		this.triggerForm = recordingTriggerStep.formGroup;

		this.triggerForm.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
			this.saveFormData(value);
		});
	}

	private saveFormData(formValue: any) {
		// Note: Recording trigger type is not part of MeetRoomOptions
		// For now, just keep the form state
	}

	/**
	 * Handle option selection from the SelectableCardComponent
	 */
	onOptionChange(event: SelectionCardEvent): void {
		this.triggerForm.patchValue({
			triggerType: event.optionId as RecordingTriggerType
		});
	}

	/**
	 * Get the currently selected option ID for the SelectableCardComponent
	 */
	get selectedOption(): string {
		return this.triggerForm.value.triggerType ?? 'manual';
	}
}

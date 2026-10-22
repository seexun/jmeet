import { ChangeDetectionStrategy, Component, computed, inject, Signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { MeetRecordingLayout, MeetRoomOptions } from '@openvidu-meet/typings';
import { TranslatePipe } from '../../../../../../shared/pipes/translate.pipe';
import { RecordingLayoutFormGroup, RecordingLayoutFormValue } from '../../../../models/wizard-forms.model';
import { WizardStepId } from '../../../../models/wizard.model';
import { RoomWizardStateService } from '../../../../services/wizard-state.service';

interface RecordingLayoutOption {
	id: MeetRecordingLayout;
	titleKey: string;
	descKey: string;
}

@Component({
	selector: 'ov-recording-layout',
	imports: [ReactiveFormsModule, TranslatePipe],
	templateUrl: './recording-layout.component.html',
	styleUrl: './recording-layout.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecordingLayoutComponent {
	private wizardService = inject(RoomWizardStateService);

	readonly Layout = MeetRecordingLayout;

	readonly layoutOptions: RecordingLayoutOption[] = [
		{
			id: MeetRecordingLayout.GRID,
			titleKey: 'ROOMS.WIZARD.RECORDING_LAYOUT.GRID_TITLE',
			descKey: 'ROOMS.WIZARD.RECORDING_LAYOUT.GRID_DESC'
		},
		{
			id: MeetRecordingLayout.SPEAKER,
			titleKey: 'ROOMS.WIZARD.RECORDING_LAYOUT.SPEAKER_TITLE',
			descKey: 'ROOMS.WIZARD.RECORDING_LAYOUT.SPEAKER_DESC'
		},
		{
			id: MeetRecordingLayout.SINGLE_SPEAKER,
			titleKey: 'ROOMS.WIZARD.RECORDING_LAYOUT.SINGLE_SPEAKER_TITLE',
			descKey: 'ROOMS.WIZARD.RECORDING_LAYOUT.SINGLE_SPEAKER_DESC'
		}
	];

	layoutForm: RecordingLayoutFormGroup;
	selectedOption: Signal<MeetRecordingLayout>;
	private formValues: Signal<Partial<RecordingLayoutFormValue>>;

	constructor() {
		const recordingLayoutStep = this.wizardService.getStepById(WizardStepId.RECORDING_LAYOUT);
		if (!recordingLayoutStep) {
			throw new Error('recordingLayout step not found in wizard state');
		}
		this.layoutForm = recordingLayoutStep.formGroup;

		this.formValues = toSignal(this.layoutForm.valueChanges, {
			initialValue: this.layoutForm.getRawValue()
		});

		this.selectedOption = computed(() => {
			return this.formValues().layout || MeetRecordingLayout.GRID;
		});

		this.layoutForm.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
			this.saveFormData(value);
		});
	}

	isSelected(layout: MeetRecordingLayout): boolean {
		return this.selectedOption() === layout;
	}

	onSelect(layout: MeetRecordingLayout): void {
		this.layoutForm.patchValue({ layout });
	}

	private saveFormData(formValue: Partial<RecordingLayoutFormValue>): void {
		const roomOptions = this.wizardService.roomOptions();
		const stepData: Partial<MeetRoomOptions> = {
			config: {
				recording: {
					enabled: roomOptions.config?.recording?.enabled ?? false,
					layout: formValue.layout ?? MeetRecordingLayout.GRID
				}
			}
		};

		this.wizardService.updateStepData(stepData);
	}
}

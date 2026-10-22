import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { MeetRoomOptions } from '@openvidu-meet/typings';
import { TranslatePipe } from '../../../../../../shared/pipes/translate.pipe';
import { RecordingEnabledOption, RecordingFormGroup, RecordingFormValue } from '../../../../models/wizard-forms.model';
import { WizardStepId } from '../../../../models/wizard.model';
import { RoomWizardStateService } from '../../../../services/wizard-state.service';

@Component({
	selector: 'ov-recording-config',
	imports: [ReactiveFormsModule, FormsModule, NzIconModule, NzSwitchModule, TranslatePipe],
	templateUrl: './recording-config.component.html',
	styleUrl: './recording-config.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecordingConfigComponent {
	private wizardService = inject(RoomWizardStateService);

	recordingForm: RecordingFormGroup;

	constructor() {
		const recordingStep = this.wizardService.getStepById(WizardStepId.RECORDING);
		if (!recordingStep) {
			throw new Error('recording step not found in wizard state');
		}
		this.recordingForm = recordingStep.formGroup;

		this.recordingForm.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
			this.saveFormData(value);
		});
	}

	get isRecordingEnabled(): boolean {
		return this.recordingForm.controls.recordingEnabled.value === 'enabled';
	}

	get isE2EEEnabled(): boolean {
		const configStep = this.wizardService.getStepById(WizardStepId.ROOM_CONFIG);
		return configStep?.formGroup.controls.e2eeEnabled.value ?? false;
	}

	// nz-switch 为纯 ControlValueAccessor，经 [ngModel]/(ngModelChange) 取新值（原 Material 开关事件取 $event.checked）。
	onRecordingToggleChange(isEnabled: boolean): void {
		this.applyRecordingEnabled(isEnabled ? 'enabled' : 'disabled');
	}

	private applyRecordingEnabled(optionId: RecordingEnabledOption): void {
		const previouslyEnabled = this.isRecordingEnabled;
		const willBeEnabled = optionId === 'enabled';
		const configStep = this.wizardService.getStepById(WizardStepId.ROOM_CONFIG);

		if (configStep) {
			if (!previouslyEnabled && willBeEnabled) {
				const e2eeEnabled = configStep.formGroup.controls.e2eeEnabled.value;
				if (e2eeEnabled) {
					this.wizardService.setE2EEStateBeforeRecording(true);
					configStep.formGroup.patchValue({ e2eeEnabled: false }, { emitEvent: true });
					this.wizardService.updateStepData({
						config: {
							e2ee: {
								enabled: false
							}
						}
					});
				}
			} else if (previouslyEnabled && !willBeEnabled) {
				const previousE2EEState = this.wizardService.getE2EEStateBeforeRecording();
				if (previousE2EEState !== undefined) {
					configStep.formGroup.patchValue({ e2eeEnabled: previousE2EEState }, { emitEvent: true });
					this.wizardService.updateStepData({
						config: {
							e2ee: {
								enabled: previousE2EEState
							}
						}
					});
					this.wizardService.clearE2EEStateBeforeRecording();
				}
			}
		}

		this.recordingForm.patchValue({
			recordingEnabled: optionId
		});
	}

	private saveFormData(formValue: Partial<RecordingFormValue>): void {
		const stepData: Partial<MeetRoomOptions> = {
			config: {
				recording: {
					enabled: formValue.recordingEnabled === 'enabled'
				}
			},
			access: {
				anonymous: {
					recording: {
						enabled: formValue.anonymousRecordingEnabled ?? false
					}
				}
			}
		};

		this.wizardService.updateStepData(stepData);
	}
}

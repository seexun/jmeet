import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { MeetRoomOptions } from '@openvidu-meet/typings';
import { TranslatePipe } from '../../../../../../shared/pipes/translate.pipe';
import { RoomConfigFormGroup, RoomConfigFormValue } from '../../../../models/wizard-forms.model';
import { WizardStepId } from '../../../../models/wizard.model';
import { RoomWizardStateService } from '../../../../services';

@Component({
	selector: 'ov-room-config',
	imports: [ReactiveFormsModule, FormsModule, NzIconModule, NzSwitchModule, TranslatePipe],
	templateUrl: './room-config.component.html',
	styleUrl: './room-config.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoomConfigComponent {
	private wizardService = inject(RoomWizardStateService);

	roomConfigForm: RoomConfigFormGroup;

	constructor() {
		const roomConfigStep = this.wizardService.getStepById(WizardStepId.ROOM_CONFIG);
		if (!roomConfigStep) {
			throw new Error('roomConfig step not found in wizard state');
		}
		this.roomConfigForm = roomConfigStep.formGroup;

		this.roomConfigForm.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
			this.saveFormData(value);
		});
	}

	private saveFormData(formValue: Partial<RoomConfigFormValue>): void {
		const stepData: Partial<MeetRoomOptions> = {
			config: {
				chat: {
					enabled: formValue.chatEnabled ?? false
				},
				virtualBackground: {
					enabled: formValue.virtualBackgroundEnabled ?? false
				},
				e2ee: {
					enabled: formValue.e2eeEnabled ?? false
				},
				captions: {
					enabled: formValue.captionsEnabled ?? false
				}
			}
		};

		this.wizardService.updateStepData(stepData);
	}

	// nz-switch 为纯 ControlValueAccessor，经 [ngModel]/(ngModelChange) 取新值（原 Material 开关事件取 $event.checked）。
	onE2EEToggleChange(isEnabled: boolean): void {
		this.roomConfigForm.patchValue({
			e2eeEnabled: isEnabled
		});

		const recordingStep = this.wizardService.getStepById(WizardStepId.RECORDING);
		if (!recordingStep) return;

		const recordingForm = recordingStep.formGroup;

		if (isEnabled) {
			// Save the current recording state before disabling it
			const currentRecordingValue = recordingForm.controls.recordingEnabled.value;

			// Only save if it's not already 'disabled' (to preserve user's original choice)
			if (currentRecordingValue !== 'disabled') {
				this.wizardService.setRecordingStateBeforeE2EE(currentRecordingValue);
			}

			// Disable recording automatically
			recordingForm.patchValue(
				{
					recordingEnabled: 'disabled'
				},
				{ emitEvent: true }
			);

			this.wizardService.updateStepData({
				config: {
					recording: {
						enabled: false
					}
				}
			});
		} else {
			// Restore the previous recording state when E2EE is disabled
			const previousRecordingState = this.wizardService.getRecordingStateBeforeE2EE();
			if (previousRecordingState !== undefined) {
				recordingForm.patchValue(
					{
						recordingEnabled: previousRecordingState
					},
					{ emitEvent: true }
				);

				this.wizardService.updateStepData({
					config: {
						recording: {
							enabled: previousRecordingState === 'enabled'
						}
					}
				});

				// Clear the saved state
				this.wizardService.clearRecordingStateBeforeE2EE();
			}
		}
	}

	onChatToggleChange(isEnabled: boolean): void {
		this.roomConfigForm.patchValue({ chatEnabled: isEnabled });
	}

	onVirtualBackgroundToggleChange(isEnabled: boolean): void {
		this.roomConfigForm.patchValue({ virtualBackgroundEnabled: isEnabled });
	}

	onCaptionsToggleChange(isEnabled: boolean): void {
		this.roomConfigForm.patchValue({ captionsEnabled: isEnabled });
	}

	get chatEnabled(): boolean {
		return this.roomConfigForm.value.chatEnabled ?? false;
	}

	get virtualBackgroundEnabled(): boolean {
		return this.roomConfigForm.value.virtualBackgroundEnabled ?? false;
	}

	get e2eeEnabled(): boolean {
		return this.roomConfigForm.value.e2eeEnabled ?? false;
	}

	get captionsEnabled(): boolean {
		return this.roomConfigForm.value.captionsEnabled ?? false;
	}
}

import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { MeetRoomOptions } from '@openvidu-meet/typings';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { JmeetPageHeaderComponent } from '../../../../shared/components';
import { RoomDetailsFormGroup, RoomDetailsFormValue } from '../../models/wizard-forms.model';
import { WizardStepId } from '../../models/wizard.model';
import { RoomWizardStateService } from '../../services';

@Component({
	selector: 'ov-room-basic-creation',
	imports: [
		ReactiveFormsModule,
		JmeetPageHeaderComponent,
		NzIconModule,
		NzInputModule,
		NzSelectModule,
		NzTooltipModule,
		TranslatePipe
	],
	templateUrl: './room-basic-creation.component.html',
	styleUrl: './room-basic-creation.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoomBasicCreationComponent {
	private readonly wizardService = inject(RoomWizardStateService);
	private readonly formBuilder = inject(FormBuilder);

	readonly createRoom = output<MeetRoomOptions>();
	readonly openAdvancedMode = output<void>();
	readonly cancel = output<void>();

	roomDetailsForm: RoomDetailsFormGroup;
	readonly scheduleForm = this.formBuilder.nonNullable.group({
		mode: ['scheduled' as 'instant' | 'scheduled'],
		startDate: [this.defaultStartDate(), Validators.required],
		durationMinutes: [60, [Validators.required, Validators.min(15), Validators.max(1440)]],
		recurrence: ['none' as 'none' | 'daily' | 'weekly'],
		allowEarlyJoinMinutes: [15, [Validators.required, Validators.min(0), Validators.max(120)]]
	});
	readonly timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';

	constructor() {
		const currentStep = this.wizardService.getStepById(WizardStepId.ROOM_DETAILS);
		if (!currentStep) {
			throw new Error('roomDetails step not found in wizard state');
		}
		this.roomDetailsForm = currentStep.formGroup;

		this.roomDetailsForm.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
			this.saveFormData(value);
		});
	}

	private saveFormData(formValue: Partial<RoomDetailsFormValue>) {
		const stepData: Partial<MeetRoomOptions> = {
			roomName: formValue.roomName
		};
		this.wizardService.updateStepData(stepData);
	}

	onCreateRoom() {
		if (this.roomDetailsForm.valid && this.scheduleForm.valid) {
			const formValue = this.roomDetailsForm.value;
			const scheduleValue = this.scheduleForm.getRawValue();
			const options: MeetRoomOptions = { roomName: formValue.roomName || undefined };
			if (scheduleValue.mode === 'scheduled') {
				options.schedule = {
					startDate: new Date(scheduleValue.startDate).getTime(),
					durationMinutes: scheduleValue.durationMinutes,
					timezone: this.timezone,
					recurrence: scheduleValue.recurrence,
					allowEarlyJoinMinutes: scheduleValue.allowEarlyJoinMinutes
				};
			}
			this.wizardService.updateStepData(options);
			this.createRoom.emit(options);
		}
	}

	onOpenAdvancedMode() {
		this.openAdvancedMode.emit();
	}

	onCancel() {
		this.cancel.emit();
	}

	get isFormValid(): boolean {
		return this.roomDetailsForm.valid && this.scheduleForm.valid && !this.roomDetailsForm.pending;
	}

	private defaultStartDate(): string {
		const date = new Date(Date.now() + 60 * 60 * 1000);
		date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
		const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
		return local.toISOString().slice(0, 16);
	}
}

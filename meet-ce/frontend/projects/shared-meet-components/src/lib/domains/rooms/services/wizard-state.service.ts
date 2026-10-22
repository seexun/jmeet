import { computed, inject, Injectable, signal } from '@angular/core';
import { AbstractControl, FormBuilder, FormControl, ValidationErrors, Validators } from '@angular/forms';
import {
	MEET_ROOM_MEMBER_PERMISSIONS_FIELDS,
	DEFAULT_MEETING_SECURITY_CONFIG,
	MeetRecordingLayout,
	MeetRoomConfig,
	MeetRoomDeletionPolicyWithMeeting,
	MeetRoomDeletionPolicyWithRecordings,
	MeetRoomMemberOptions,
	MeetRoomMemberPermissions,
	MeetRoomOptions
} from '@openvidu-meet/typings';
import { deepMerge } from '../../../shared/utils/object.utils';
import { WizardNavigationConfig, WizardStepId } from '../models';
import {
	AnyWizardStep,
	RecordingEnabledOption,
	RecordingTriggerType,
	RoomAccessPermissionsControls,
	RoomDetailsFormGroup
} from '../models/wizard-forms.model';

// Default permissions for each role
const DEFAULT_MODERATOR_PERMISSIONS: MeetRoomMemberPermissions = {
	canRecord: true,
	canRetrieveRecordings: true,
	canDeleteRecordings: true,
	canJoinMeeting: true,
	canShareAccessLinks: true,
	canMakeModerator: true,
	canKickParticipants: true,
	canEndMeeting: true,
	canPublishVideo: true,
	canPublishAudio: true,
	canShareScreen: true,
	canReadChat: true,
	canWriteChat: true,
	canChangeVirtualBackground: true
};

const DEFAULT_SPEAKER_PERMISSIONS: MeetRoomMemberPermissions = {
	canRecord: false,
	canRetrieveRecordings: true,
	canDeleteRecordings: false,
	canJoinMeeting: true,
	canShareAccessLinks: false,
	canMakeModerator: false,
	canKickParticipants: false,
	canEndMeeting: false,
	canPublishVideo: true,
	canPublishAudio: true,
	canShareScreen: true,
	canReadChat: true,
	canWriteChat: true,
	canChangeVirtualBackground: true
};

// Default room config following the app's defaults
const DEFAULT_CONFIG: MeetRoomConfig = {
	security: { ...DEFAULT_MEETING_SECURITY_CONFIG },
	recording: {
		enabled: true,
		layout: MeetRecordingLayout.GRID
	},
	chat: { enabled: true },
	virtualBackground: { enabled: true },
	e2ee: { enabled: false },
	captions: { enabled: true }
};

const DEFAULT_ROOM_OPTIONS: MeetRoomOptions = {
	roomName: undefined,
	config: DEFAULT_CONFIG,
	access: {
		anonymous: {
			moderator: { enabled: true },
			speaker: { enabled: true },
			recording: { enabled: true }
		},
		user: { enabled: false }
	},
	roles: {
		moderator: {
			permissions: DEFAULT_MODERATOR_PERMISSIONS
		},
		speaker: {
			permissions: DEFAULT_SPEAKER_PERMISSIONS
		}
	}
};

/**
 * Service to manage the state of the room creation wizard.
 * Handles step navigation, form data management, and room options building.
 */
@Injectable({
	providedIn: 'root'
})
export class RoomWizardStateService {
	private formBuilder = inject(FormBuilder);

	// Signals for reactive state management
	private _steps = signal<AnyWizardStep[]>([]);
	private _visibleSteps = computed(() => this._steps().filter((step) => step.isVisible));
	private _currentStepIndex = signal<number>(0);
	private _isInitialized = signal<boolean>(false);
	private _editMode = signal<boolean>(false);
	private _roomOptions = signal<MeetRoomOptions>(deepMerge({}, DEFAULT_ROOM_OPTIONS));
	private _pendingMembers = signal<MeetRoomMemberOptions[]>([]);
	private _recordingStateBeforeE2EE = signal<RecordingEnabledOption | undefined>(undefined);
	private _e2eeStateBeforeRecording = signal<boolean | undefined>(undefined);

	public readonly steps = this._steps.asReadonly();
	public readonly currentStepIndex = this._currentStepIndex.asReadonly();
	public readonly isInitialized = this._isInitialized.asReadonly();
	public readonly editMode = this._editMode.asReadonly();
	public readonly currentStep = computed<AnyWizardStep | undefined>(() => {
		const visibleSteps = this._visibleSteps();
		const currentIndex = this._currentStepIndex();

		if (currentIndex < 0 || currentIndex >= visibleSteps.length) {
			return undefined;
		}

		return visibleSteps[currentIndex];
	});
	public readonly roomOptions = this._roomOptions.asReadonly();
	public readonly pendingMembers = this._pendingMembers.asReadonly();

	/**
	 * Initializes the wizard with base steps and default room options.
	 * @param editMode - Whether the wizard is in edit mode
	 * @param existingData - Existing room options to prefill the wizard
	 */
	initializeWizard(editMode: boolean = false, existingData?: MeetRoomOptions): void {
		this._isInitialized.set(false);
		this._editMode.set(editMode);

		// Initialize room options with defaults merged with existing data
		const currentOptions = this._roomOptions();
		const initialRoomOptions: MeetRoomOptions = deepMerge(currentOptions, existingData ?? {});

		this._roomOptions.set(initialRoomOptions);
		this._pendingMembers.set([]);

		// Define wizard steps
		const baseSteps: AnyWizardStep[] = [
			{
				id: WizardStepId.ROOM_DETAILS,
				label: 'ROOMS.WIZARD.STEP_ROOM_DETAILS',
				isCompleted: editMode, // In edit mode, mark as completed but not editable
				isActive: !editMode, // Start with roomDetails step active in create mode
				isVisible: true,
				formGroup: this.formBuilder.group(
					{
						roomName: this.formBuilder.nonNullable.control<string | undefined>(
							{
								value: initialRoomOptions.roomName,
								disabled: editMode
							},
							editMode ? [] : [Validators.maxLength(50)]
						),
						autoDeletionDate: this.formBuilder.nonNullable.control<Date | undefined>({
							value: initialRoomOptions.autoDeletionDate
								? new Date(initialRoomOptions.autoDeletionDate)
								: undefined,
							disabled: editMode
						}),
						autoDeletionHour: this.formBuilder.nonNullable.control(
							{
								value: initialRoomOptions.autoDeletionDate
									? new Date(initialRoomOptions.autoDeletionDate).getHours()
									: 23,
								disabled: editMode
							},
							editMode ? [] : [Validators.min(0), Validators.max(23)]
						),
						autoDeletionMinute: this.formBuilder.nonNullable.control(
							{
								value: initialRoomOptions.autoDeletionDate
									? new Date(initialRoomOptions.autoDeletionDate).getMinutes()
									: 59,
								disabled: editMode
							},
							editMode ? [] : [Validators.min(0), Validators.max(59)]
						),
						autoDeletionPolicyWithMeeting: this.formBuilder.nonNullable.control({
							value:
								initialRoomOptions.autoDeletionPolicy?.withMeeting ??
								MeetRoomDeletionPolicyWithMeeting.WHEN_MEETING_ENDS,
							disabled: editMode
						}),
						autoDeletionPolicyWithRecordings: this.formBuilder.nonNullable.control({
							value:
								initialRoomOptions.autoDeletionPolicy?.withRecordings ??
								MeetRoomDeletionPolicyWithRecordings.CLOSE,
							disabled: editMode
						})
					},
					{
						// Apply future date-time validation only if not in edit mode
						validators: editMode
							? []
							: [
									(control: AbstractControl): ValidationErrors | null => {
										const formGroup = control as RoomDetailsFormGroup;
										const { autoDeletionDate, autoDeletionHour, autoDeletionMinute } =
											formGroup.getRawValue();

										if (!autoDeletionDate) return null;

										const selected = new Date(autoDeletionDate);
										selected.setHours(autoDeletionHour, autoDeletionMinute, 0, 0);

										const now = new Date();
										now.setMinutes(now.getMinutes() + 61, 0, 0); // Ensure at least 1 hour in the future

										return selected.getTime() < now.getTime() ? { minFutureDateTime: true } : null;
									}
								]
					}
				)
			},
			{
				id: WizardStepId.ROOM_CONFIG,
				label: 'ROOMS.WIZARD.STEP_ROOM_FEATURES',
				isCompleted: editMode,
				isActive: editMode, // Start with Room Features step active in edit mode
				isVisible: true,
				formGroup: this.formBuilder.group({
					chatEnabled: this.formBuilder.nonNullable.control(initialRoomOptions.config!.chat!.enabled),
					virtualBackgroundEnabled: this.formBuilder.nonNullable.control(
						initialRoomOptions.config!.virtualBackground!.enabled
					),
					e2eeEnabled: this.formBuilder.nonNullable.control(initialRoomOptions.config!.e2ee!.enabled),
					captionsEnabled: this.formBuilder.nonNullable.control(initialRoomOptions.config!.captions!.enabled)
				})
			},
			{
				id: WizardStepId.ROOM_ACCESS,
				label: 'ROOMS.WIZARD.STEP_ROOM_ACCESS',
				isCompleted: editMode,
				isActive: false,
				isVisible: true,
				formGroup: this.formBuilder.group({
					anonymousModeratorEnabled: this.formBuilder.nonNullable.control(
						initialRoomOptions.access!.anonymous!.moderator!.enabled
					),
					anonymousSpeakerEnabled: this.formBuilder.nonNullable.control(
						initialRoomOptions.access!.anonymous!.speaker!.enabled
					),
					userEnabled: this.formBuilder.nonNullable.control(
						initialRoomOptions.access!.user!.enabled
					),
					moderator: this.formBuilder.group({
						...this.buildPermissionsFormConfig(initialRoomOptions.roles!.moderator!.permissions)
					}),
					speaker: this.formBuilder.group({
						...this.buildPermissionsFormConfig(initialRoomOptions.roles!.speaker!.permissions)
					})
				})
			},
			{
				id: WizardStepId.RECORDING,
				label: 'ROOMS.WIZARD.STEP_RECORDING_SETTINGS',
				isCompleted: editMode, // In edit mode, all editable steps are completed
				isActive: false,
				isVisible: true,
				formGroup: this.formBuilder.group({
					recordingEnabled: this.formBuilder.nonNullable.control<RecordingEnabledOption>(
						initialRoomOptions.config!.recording!.enabled ? 'enabled' : 'disabled'
					),
					anonymousRecordingEnabled: this.formBuilder.nonNullable.control(
						initialRoomOptions.access!.anonymous!.recording!.enabled
					)
				})
			},
			{
				id: WizardStepId.RECORDING_TRIGGER,
				label: 'ROOMS.WIZARD.STEP_RECORDING_TRIGGER',
				isCompleted: editMode, // In edit mode, all editable steps are completed
				isActive: false,
				isVisible: false, // Initially hidden, will be shown based on recording settings
				formGroup: this.formBuilder.group({
					triggerType: this.formBuilder.nonNullable.control<RecordingTriggerType>('manual')
				})
			},
			{
				id: WizardStepId.RECORDING_LAYOUT,
				label: 'ROOMS.WIZARD.STEP_RECORDING_LAYOUT',
				isCompleted: editMode, // In edit mode, all editable steps are completed
				isActive: false,
				isVisible: false, // Initially hidden, will be shown based on recording settings
				formGroup: this.formBuilder.group({
					layout: this.formBuilder.nonNullable.control(
						initialRoomOptions.config!.recording!.layout ?? MeetRecordingLayout.GRID
					)
				})
			}
		];

		this._steps.set(baseSteps);
		const initialStepIndex = editMode ? 1 : 0; // Skip roomDetails step in edit mode
		this._currentStepIndex.set(initialStepIndex);

		// Update step visibility after index is set
		this.updateStepsVisibility();
		this._isInitialized.set(true);
	}

	/**
	 * Gets a step by its ID. The returned step type is narrowed based on the provided step ID.
	 * @param stepId - The ID of the step to retrieve
	 * @returns The step with the specified ID, or undefined if not found
	 */
	getStepById<TStepId extends WizardStepId>(stepId: TStepId): Extract<AnyWizardStep, { id: TStepId }> | undefined {
		return this._steps().find((step): step is Extract<AnyWizardStep, { id: TStepId }> => step.id === stepId);
	}

	/**
	 * Updates room options for a specific step.
	 * This method merges the provided data with the current room options.
	 * @param stepData - The data to update in the room options
	 */
	updateStepData(stepData: Partial<MeetRoomOptions>): void {
		const currentOptions = this._roomOptions();
		const updatedOptions = deepMerge(currentOptions, stepData);

		this._roomOptions.set(updatedOptions);
		this.updateStepsVisibility();
	}

	/**
	 * Updates the visibility of wizard steps based on current room options.
	 * For example, recording-related steps are only visible when recording is enabled.
	 */
	private updateStepsVisibility(): void {
		const currentSteps = this._steps();
		const currentOptions = this._roomOptions();

		const recordingEnabled = currentOptions.config?.recording?.enabled ?? false;

		// Update recording steps visibility based on recordingEnabled
		const updatedSteps = currentSteps.map((step) => {
			if (step.id === WizardStepId.RECORDING_LAYOUT) {
				return {
					...step,
					isVisible: recordingEnabled // Only show if recording is enabled
				};
			}
			if (step.id === WizardStepId.RECORDING_TRIGGER) {
				return {
					...step,
					isVisible: false // TODO: Change to 'recordingEnabled' when recording trigger config is implemented
				};
			}
			return step;
		});
		this._steps.set(updatedSteps);
	}

	goToNextStep(): boolean {
		const currentIndex = this._currentStepIndex();
		const visibleSteps = this._visibleSteps();

		if (currentIndex < visibleSteps.length - 1) {
			// Mark current step as completed
			const currentStep = visibleSteps[currentIndex];
			currentStep.isCompleted = true;
			currentStep.isActive = false;

			// Activate next step
			const nextStep = visibleSteps[currentIndex + 1];
			nextStep.isActive = true;

			this._currentStepIndex.set(currentIndex + 1);
			const steps = this._steps();
			this._steps.set([...steps]); // Trigger reactivity
			return true;
		}

		return false;
	}

	goToPreviousStep(): boolean {
		const currentIndex = this._currentStepIndex();
		const visibleSteps = this._visibleSteps();

		if (currentIndex > 0) {
			// Deactivate current step
			const currentStep = visibleSteps[currentIndex];
			currentStep.isActive = false;

			// Activate previous step
			const previousStep = visibleSteps[currentIndex - 1];
			previousStep.isActive = true;

			this._currentStepIndex.set(currentIndex - 1);
			const steps = this._steps();
			this._steps.set([...steps]); // Trigger reactivity
			return true;
		}

		return false;
	}

	goToStep(targetIndex: number): boolean {
		const currentIndex = this._currentStepIndex();
		if (targetIndex === currentIndex) {
			return false; // No change if the target index is the same as current
		}

		const visibleSteps = this._visibleSteps();

		if (targetIndex >= 0 && targetIndex < visibleSteps.length) {
			// Deactivate current step
			const currentStep = this.currentStep();
			if (currentStep) {
				currentStep.isActive = false;
			}

			// Activate target step
			const targetStep = visibleSteps[targetIndex];
			targetStep.isActive = true;

			this._currentStepIndex.set(targetIndex);
			const steps = this._steps();
			this._steps.set([...steps]); // Trigger reactivity
			return true;
		}

		return false;
	}

	/**
	 * Navigates to a step identified by its WizardStepId, if visible.
	 * @param stepId - The ID of the step to navigate to
	 * @returns true if navigation succeeded, false otherwise
	 */
	goToStepById(stepId: WizardStepId): boolean {
		const targetIndex = this._visibleSteps().findIndex((step) => step.id === stepId);
		if (targetIndex === -1) return false;
		return this.goToStep(targetIndex);
	}

	getNavigationConfig(): WizardNavigationConfig {
		const currentIndex = this._currentStepIndex();
		const visibleSteps = this._visibleSteps();
		const isFirstStep = currentIndex === 0;
		const isLastStep = currentIndex === visibleSteps.length - 1;

		const isEditMode = this._editMode();
		const isSomeStepInvalid = visibleSteps.some((step) => step.formGroup.invalid);

		return {
			showPrevious: !isFirstStep,
			showNext: !isLastStep,
			showCancel: isEditMode,
			// 底部「返回简易模式」按钮移除（用户裁决 2026-10-21）：页头「切换简易模式」是唯一入口
			showBack: false,
			showFinish: isLastStep,
			showSkipAndFinish: false, // Skip and finish is not used in this wizard
			disableFinish: isSomeStepInvalid,
			nextLabel: 'ROOMS.WIZARD.NEXT',
			previousLabel: 'ROOMS.WIZARD.PREVIOUS',
			finishLabel: isEditMode ? 'ROOMS.WIZARD.UPDATE_ROOM' : 'ROOMS.WIZARD.CREATE_ROOM'
		};
	}

	/**
	 * Builds a flat form controls config from a permissions object.
	 */
	private buildPermissionsFormConfig(permissions: Partial<MeetRoomMemberPermissions>): RoomAccessPermissionsControls {
		return this.buildBooleanControls(MEET_ROOM_MEMBER_PERMISSIONS_FIELDS, permissions);
	}

	private buildBooleanControls<T extends string>(
		keys: readonly T[],
		values: Partial<Record<T, boolean>>
	): { [K in T]: FormControl<boolean> } {
		const controls = {} as { [K in T]: FormControl<boolean> };
		for (const key of keys) {
			controls[key] = this.formBuilder.nonNullable.control(values[key] ?? false);
		}
		return controls;
	}

	setRecordingStateBeforeE2EE(value: RecordingEnabledOption): void {
		this._recordingStateBeforeE2EE.set(value);
	}

	getRecordingStateBeforeE2EE(): RecordingEnabledOption | undefined {
		return this._recordingStateBeforeE2EE();
	}

	clearRecordingStateBeforeE2EE(): void {
		this._recordingStateBeforeE2EE.set(undefined);
	}

	setE2EEStateBeforeRecording(value: boolean): void {
		this._e2eeStateBeforeRecording.set(value);
	}

	getE2EEStateBeforeRecording(): boolean | undefined {
		return this._e2eeStateBeforeRecording();
	}

	clearE2EEStateBeforeRecording(): void {
		this._e2eeStateBeforeRecording.set(undefined);
	}

	/**
	 * Adds a pending member to the wizard state.
	 * Members are created after the room is successfully created.
	 */
	addPendingMember(member: MeetRoomMemberOptions): void {
		this._pendingMembers.update((members) => [...members, member]);
	}

	/**
	 * Updates a pending member at the given index.
	 */
	updatePendingMember(index: number, updated: MeetRoomMemberOptions): void {
		this._pendingMembers.update((members) => members.map((m, i) => (i === index ? updated : m)));
	}

	/**
	 * Removes a pending member from the wizard state by index.
	 */
	removePendingMember(index: number): void {
		this._pendingMembers.update((members) => members.filter((_, i) => i !== index));
	}

	/**
	 * Resets the wizard to its initial state with default options.
	 */
	resetWizard(): void {
		this._isInitialized.set(false);
		this._editMode.set(false);
		this._recordingStateBeforeE2EE.set(undefined);
		this._e2eeStateBeforeRecording.set(undefined);
		this._roomOptions.set(deepMerge({}, DEFAULT_ROOM_OPTIONS));
		this._steps.set([]);
		this._currentStepIndex.set(0);
		this._pendingMembers.set([]);
	}
}

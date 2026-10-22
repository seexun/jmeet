import { FormGroup } from '@angular/forms';

/**
 * Enumeration of wizard step identifiers
 */
export enum WizardStepId {
	ROOM_DETAILS = 'roomDetails',
	ROOM_CONFIG = 'roomConfig',
	ROOM_ACCESS = 'roomAccess',
	RECORDING = 'recording',
	RECORDING_TRIGGER = 'recordingTrigger',
	RECORDING_LAYOUT = 'recordingLayout'
}

/**
 * Configuration interface for individual wizard steps
 */
export interface WizardStep<TStepId extends WizardStepId = WizardStepId, TFormGroup extends FormGroup = FormGroup> {
	id: TStepId;
	label: string;
	isCompleted: boolean;
	isActive: boolean;
	isVisible: boolean;
	formGroup: TFormGroup;
}

/**
 * Configuration interface for wizard navigation controls
 */
export interface WizardNavigationConfig {
	// Button visibility flags
	showNext: boolean;
	showPrevious: boolean;
	showCancel: boolean;
	showBack: boolean;
	showFinish: boolean;
	showSkipAndFinish: boolean; // Used for quick create actions
	disableFinish?: boolean;

	// Button labels
	nextLabel?: string;
	previousLabel?: string;
	cancelLabel?: string;
	finishLabel?: string;
	skipAndFinishLabel?: string;
}

/**
 * Event interface for wizard navigation actions
 */
export interface WizardNavigationEvent {
	action: 'next' | 'previous' | 'cancel' | 'finish' | 'back';
	currentStepIndex?: number;
}

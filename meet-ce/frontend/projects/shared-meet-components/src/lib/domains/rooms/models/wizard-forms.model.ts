import { FormControl, FormGroup } from '@angular/forms';
import {
	MeetRecordingLayout,
	MeetRoomDeletionPolicyWithMeeting,
	MeetRoomDeletionPolicyWithRecordings,
	MeetRoomMemberPermissions
} from '@openvidu-meet/typings';
import { WizardStep, WizardStepId } from './wizard.model';

// Form value and group types for the room details step

export interface RoomDetailsFormValue {
	roomName: string | undefined;
	autoDeletionDate: Date | undefined;
	autoDeletionHour: number;
	autoDeletionMinute: number;
	autoDeletionPolicyWithMeeting: MeetRoomDeletionPolicyWithMeeting;
	autoDeletionPolicyWithRecordings: MeetRoomDeletionPolicyWithRecordings;
}

export type RoomDetailsFormGroup = FormGroup<{
	roomName: FormControl<string | undefined>;
	autoDeletionDate: FormControl<Date | undefined>;
	autoDeletionHour: FormControl<number>;
	autoDeletionMinute: FormControl<number>;
	autoDeletionPolicyWithMeeting: FormControl<MeetRoomDeletionPolicyWithMeeting>;
	autoDeletionPolicyWithRecordings: FormControl<MeetRoomDeletionPolicyWithRecordings>;
}>;

// Form value and group types for the room config step

export interface RoomConfigFormValue {
	chatEnabled: boolean;
	virtualBackgroundEnabled: boolean;
	e2eeEnabled: boolean;
	captionsEnabled: boolean;
}

export type RoomConfigFormGroup = FormGroup<{
	chatEnabled: FormControl<boolean>;
	virtualBackgroundEnabled: FormControl<boolean>;
	e2eeEnabled: FormControl<boolean>;
	captionsEnabled: FormControl<boolean>;
}>;

// Form value and group types for the room access step

export type RoomAccessPermissionsControls = {
	[K in keyof MeetRoomMemberPermissions]: FormControl<boolean>;
};

export type RoomAccessRolePermissionsFormGroup = FormGroup<RoomAccessPermissionsControls>;

export interface RoomAccessFormValue {
	anonymousModeratorEnabled: boolean;
	anonymousSpeakerEnabled: boolean;
	userEnabled: boolean;
	moderator: Partial<MeetRoomMemberPermissions>;
	speaker: Partial<MeetRoomMemberPermissions>;
}

export type RoomAccessFormGroup = FormGroup<{
	anonymousModeratorEnabled: FormControl<boolean>;
	anonymousSpeakerEnabled: FormControl<boolean>;
	userEnabled: FormControl<boolean>;
	moderator: RoomAccessRolePermissionsFormGroup;
	speaker: RoomAccessRolePermissionsFormGroup;
}>;

// Form value and group types for the recording config step

export type RecordingEnabledOption = 'enabled' | 'disabled';

export interface RecordingFormValue {
	recordingEnabled: RecordingEnabledOption;
	anonymousRecordingEnabled: boolean;
}

export type RecordingFormGroup = FormGroup<{
	recordingEnabled: FormControl<RecordingEnabledOption>;
	anonymousRecordingEnabled: FormControl<boolean>;
}>;

// Form value and group types for the recording trigger step

export type RecordingTriggerType = 'manual' | 'auto1' | 'auto2';

export interface RecordingTriggerFormValue {
	triggerType: RecordingTriggerType;
}

export type RecordingTriggerFormGroup = FormGroup<{
	triggerType: FormControl<RecordingTriggerType>;
}>;

// Form value and group types for the recording layout step

export interface RecordingLayoutFormValue {
	layout: MeetRecordingLayout;
}

export type RecordingLayoutFormGroup = FormGroup<{
	layout: FormControl<MeetRecordingLayout>;
}>;

/**
 * Mapping of wizard step identifiers to their corresponding form groups
 */
export type WizardStepFormGroupMap = {
	[WizardStepId.ROOM_DETAILS]: RoomDetailsFormGroup;
	[WizardStepId.ROOM_CONFIG]: RoomConfigFormGroup;
	[WizardStepId.ROOM_ACCESS]: RoomAccessFormGroup;
	[WizardStepId.RECORDING]: RecordingFormGroup;
	[WizardStepId.RECORDING_TRIGGER]: RecordingTriggerFormGroup;
	[WizardStepId.RECORDING_LAYOUT]: RecordingLayoutFormGroup;
};

/**
 * Type representing any wizard step with its specific form group type
 */
export type AnyWizardStep = {
	[K in WizardStepId]: WizardStep<K, WizardStepFormGroupMap[K]>;
}[WizardStepId];

import { MeetRoomDeletionPolicyWithMeeting, MeetRoomDeletionPolicyWithRecordings } from '@openvidu-meet/typings';

export interface DialogOptions {
	icon?: string;
	title?: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	confirmCallback?: () => void;
	cancelCallback?: () => void;
	// Action buttons visibility
	showActions?: boolean;
	showConfirmButton?: boolean;
	showCancelButton?: boolean;
	// Warning box options
	showWarningBox?: boolean;
	warningIcon?: string;
	warningTitle?: string;
	warningMessage?: string;
	// Force options
	showForceCheckbox?: boolean;
	forceCheckboxLabel?: string;
	forceMessage?: string;
	forceConfirmCallback?: () => void;
	// 破坏性确认：确认按钮渲染为 danger 色（丢弃数据等不可逆操作）
	confirmDanger?: boolean;
}

export interface DeleteRoomDialogOptions {
	title: string;
	message: string;
	showWithMeetingPolicy: boolean;
	showWithRecordingsPolicy: boolean;
	confirmText?: string;
	confirmCallback: (
		meetingPolicy: MeetRoomDeletionPolicyWithMeeting,
		recordingPolicy: MeetRoomDeletionPolicyWithRecordings
	) => void;
}

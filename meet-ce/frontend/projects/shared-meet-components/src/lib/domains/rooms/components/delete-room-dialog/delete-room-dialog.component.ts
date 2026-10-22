import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { MeetRoomDeletionPolicyWithMeeting, MeetRoomDeletionPolicyWithRecordings } from '@openvidu-meet/typings';
import type { DeleteRoomDialogOptions } from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
	selector: 'ov-delete-room-dialog',
	imports: [
		FormsModule,
		NzIconModule,
		NzRadioModule,
		TranslatePipe
	],
	templateUrl: './delete-room-dialog.component.html',
	styleUrl: './delete-room-dialog.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class DeleteRoomDialogComponent {
	readonly nzModalRef = inject(NzModalRef<DeleteRoomDialogComponent>);
	readonly data: DeleteRoomDialogOptions = inject<DeleteRoomDialogOptions>(NZ_MODAL_DATA);

	meetingPolicyOptions = [
		{
			value: MeetRoomDeletionPolicyWithMeeting.FORCE,
			label: 'ROOMS.DELETE_DIALOG.MEETING_FORCE_LABEL',
			description: 'ROOMS.DELETE_DIALOG.MEETING_FORCE_DESC'
		},
		{
			value: MeetRoomDeletionPolicyWithMeeting.WHEN_MEETING_ENDS,
			label: 'ROOMS.DELETE_DIALOG.MEETING_WHEN_ENDS_LABEL',
			description: 'ROOMS.DELETE_DIALOG.MEETING_WHEN_ENDS_DESC'
		},
		{
			value: MeetRoomDeletionPolicyWithMeeting.FAIL,
			label: 'ROOMS.DELETE_DIALOG.MEETING_FAIL_LABEL',
			description: 'ROOMS.DELETE_DIALOG.MEETING_FAIL_DESC'
		}
	];
	recordingPolicyOptions = [
		{
			value: MeetRoomDeletionPolicyWithRecordings.FORCE,
			label: 'ROOMS.DELETE_DIALOG.RECORDINGS_FORCE_LABEL',
			description: 'ROOMS.DELETE_DIALOG.RECORDINGS_FORCE_DESC'
		},
		{
			value: MeetRoomDeletionPolicyWithRecordings.CLOSE,
			label: 'ROOMS.DELETE_DIALOG.RECORDINGS_CLOSE_LABEL',
			description: 'ROOMS.DELETE_DIALOG.RECORDINGS_CLOSE_DESC'
		},
		{
			value: MeetRoomDeletionPolicyWithRecordings.FAIL,
			label: 'ROOMS.DELETE_DIALOG.RECORDINGS_FAIL_LABEL',
			description: 'ROOMS.DELETE_DIALOG.RECORDINGS_FAIL_DESC'
		}
	];

	selectedMeetingPolicy = signal(MeetRoomDeletionPolicyWithMeeting.WHEN_MEETING_ENDS);
	selectedRecordingPolicy = signal(MeetRoomDeletionPolicyWithRecordings.CLOSE);

	close(type: 'confirm' | 'cancel'): void {
		this.nzModalRef.close();

		if (type === 'confirm') {
			this.data.confirmCallback(this.selectedMeetingPolicy(), this.selectedRecordingPolicy());
		}
	}
}

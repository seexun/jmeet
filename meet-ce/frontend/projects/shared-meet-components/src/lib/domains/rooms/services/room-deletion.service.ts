import { inject, Injectable } from '@angular/core';
import {
	MeetRoom,
	MeetRoomDeletionErrorCode,
	MeetRoomDeletionPolicyWithMeeting,
	MeetRoomDeletionPolicyWithRecordings,
	MeetRoomDeletionSuccessCode
} from '@openvidu-meet/typings';
import { DeleteRoomDialogOptions } from '../../../shared/models/notification.model';
import { TranslateService } from '../../../shared/services/i18n/translate.service';
import { DialogPresetsService } from '../../../shared/services/dialog-presets.service';
import { DIALOG_WIDTH, NotificationService } from '../../../shared/services/notification.service';
import { ILogger } from '../../meeting/openvidu-components';
import { DeleteRoomDialogComponent } from '../components/delete-room-dialog/delete-room-dialog.component';
import { RoomService } from './room.service';

interface RoomDeletionResult {
	roomId: string;
	successCode: MeetRoomDeletionSuccessCode;
	message: string;
	room?: MeetRoom;
}

interface RoomDeletionOptions {
	roomId: string;
	log: ILogger;
	onSuccess: (result: RoomDeletionResult) => void | Promise<void>;
}

@Injectable({
	providedIn: 'root'
})
export class RoomDeletionService {
	private roomService = inject(RoomService);
	private notificationService = inject(NotificationService);
	private dialogPresetsService = inject(DialogPresetsService);
	private readonly translateService = inject(TranslateService);

	deleteRoomWithConfirmation({ roomId, log, onSuccess }: RoomDeletionOptions): void {
		const deleteCallback = async () => {
			await this.deleteRoomWithDefaultPolicies(roomId, log, onSuccess);
		};

		this.notificationService.showDialog({
			...this.dialogPresetsService.getDeleteRoomDialogPreset(roomId),
			confirmCallback: deleteCallback
		});
	}

	isValidDeletionErrorCode(errorCode: string): boolean {
		const validErrorCodes = [
			MeetRoomDeletionErrorCode.ROOM_HAS_ACTIVE_MEETING,
			MeetRoomDeletionErrorCode.ROOM_HAS_RECORDINGS,
			MeetRoomDeletionErrorCode.ROOM_WITH_ACTIVE_MEETING_HAS_RECORDINGS,
			MeetRoomDeletionErrorCode.ROOM_WITH_ACTIVE_MEETING_HAS_RECORDINGS_CANNOT_SCHEDULE_DELETION,
			MeetRoomDeletionErrorCode.ROOM_WITH_RECORDINGS_HAS_ACTIVE_MEETING
		];
		return validErrorCodes.includes(errorCode as MeetRoomDeletionErrorCode);
	}

	removeRoomIdFromMessage(message: string): string {
		const roomIdPattern = /'[^']+'/g;
		let filteredMessage = message.replace(roomIdPattern, '');
		filteredMessage = filteredMessage.replace(/\s+/g, ' ').trim();
		return filteredMessage;
	}

	private async deleteRoomWithDefaultPolicies(
		roomId: string,
		log: ILogger,
		onSuccess: (result: RoomDeletionResult) => void | Promise<void>
	) {
		try {
			const { successCode, message, room } = await this.roomService.deleteRoom(
				roomId,
				MeetRoomDeletionPolicyWithMeeting.FAIL,
				MeetRoomDeletionPolicyWithRecordings.FAIL
			);

			await onSuccess({ roomId, successCode, message, room });
		} catch (error: any) {
			const errorCode = error.error?.error;
			if (errorCode && this.isValidDeletionErrorCode(errorCode)) {
				const errorMessage = this.removeRoomIdFromMessage(error.error.message);
				this.showDeletionErrorDialogWithOptions(roomId, errorMessage, log, onSuccess);
			} else {
				this.notificationService.showSnackbar(this.translateService.translate('ROOMS.ERRORS.FAILED_DELETE_ROOM'));
				log.e('Error deleting room:', error);
			}
		}
	}

	private showDeletionErrorDialogWithOptions(
		roomId: string,
		errorMessage: string,
		log: ILogger,
		onSuccess: (result: RoomDeletionResult) => void | Promise<void>
	): void {
		const deleteWithPoliciesCallback = async (
			meetingPolicy: MeetRoomDeletionPolicyWithMeeting,
			recordingPolicy: MeetRoomDeletionPolicyWithRecordings
		) => {
			try {
				const { successCode, message, room } = await this.roomService.deleteRoom(
					roomId,
					meetingPolicy,
					recordingPolicy
				);
				await onSuccess({ roomId, successCode, message, room });
			} catch (error) {
				this.notificationService.showSnackbar(this.translateService.translate('ROOMS.ERRORS.FAILED_DELETE_ROOM'));
				log.e('Error in second deletion attempt:', error);
			}
		};

		const dialogOptions: DeleteRoomDialogOptions = {
			title: this.translateService.translate('ROOMS.ERRORS.ERROR_DELETING_ROOM'),
			message: errorMessage,
			confirmText: this.translateService.translate('ROOMS.ERRORS.DELETE_WITH_OPTIONS'),
			showWithMeetingPolicy: true,
			showWithRecordingsPolicy: true,
			confirmCallback: deleteWithPoliciesCallback
		};

		// 原弹窗 disableClose: true：遮罩点击、ESC、右上角 X 一律不可关，只能走按钮回调。
		this.notificationService.openModal({
			nzContent: DeleteRoomDialogComponent,
			nzData: dialogOptions,
			nzWidth: DIALOG_WIDTH.confirm,
			nzClosable: false,
			nzMaskClosable: false,
			nzKeyboard: false
		});
	}
}

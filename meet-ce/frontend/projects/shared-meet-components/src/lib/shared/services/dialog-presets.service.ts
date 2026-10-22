import { inject, Injectable } from '@angular/core';
import { DialogOptions } from '../models/notification.model';
import { TranslateService } from './i18n/translate.service';

export type DialogPreset = Omit<DialogOptions, 'confirmCallback' | 'cancelCallback'>;

@Injectable({
	providedIn: 'root'
})
export class DialogPresetsService {
	private readonly translateService = inject(TranslateService);

	getDeleteUserDialogPreset(name: string, userId: string): DialogPreset {
		return {
			title: this.t('COMMON.CONFIRMATIONS.USER_TITLE'),
			icon: 'delete_forever',
			message: this.t('COMMON.CONFIRMATIONS.USER_MESSAGE', { name, userId }),
			showWarningBox: true,
			warningTitle: this.t('COMMON.CONFIRMATIONS.USER_WARNING_TITLE'),
			warningMessage: this.t('COMMON.CONFIRMATIONS.USER_WARNING'),
			confirmText: this.t('COMMON.CONFIRMATIONS.DELETE'),
			cancelText: this.t('COMMON.CONFIRMATIONS.CANCEL')
		};
	}

	getBulkDeleteUsersDialogPreset(count: number): DialogPreset {
		return {
			title: this.t('COMMON.CONFIRMATIONS.USERS_TITLE'),
			icon: 'delete_forever',
			message: this.t('COMMON.CONFIRMATIONS.USERS_MESSAGE', { count }),
			showWarningBox: true,
			warningTitle: this.t('COMMON.CONFIRMATIONS.USER_WARNING_TITLE'),
			warningMessage: this.t('COMMON.CONFIRMATIONS.USER_WARNING'),
			confirmText: this.t('COMMON.CONFIRMATIONS.DELETE'),
			cancelText: this.t('COMMON.CONFIRMATIONS.CANCEL')
		};
	}

	getDeleteRoomDialogPreset(roomId: string): DialogPreset {
		return {
			title: this.t('ROOMS.DELETE_DIALOG.TITLE'),
			icon: 'delete_outline',
			message: this.t('ROOMS.DELETE_DIALOG.MESSAGE', { roomId }),
			confirmText: this.t('ROOMS.DELETE_DIALOG.CONFIRM'),
			cancelText: this.t('ROOMS.COMMON.CANCEL')
		};
	}

	getBulkDeleteRoomsDialogPreset(count: number): DialogPreset {
		return {
			title: this.t('ROOMS.DELETE_DIALOG.BULK_TITLE'),
			icon: 'delete_outline',
			message: this.t('ROOMS.DELETE_DIALOG.BULK_MESSAGE', { count }),
			confirmText: this.t('ROOMS.DELETE_DIALOG.CONFIRM'),
			cancelText: this.t('ROOMS.COMMON.CANCEL')
		};
	}

	getRemoveMemberDialogPreset(memberName: string, showMeetingKickWarning: boolean): DialogPreset {
		return {
			title: this.t('COMMON.CONFIRMATIONS.MEMBER_TITLE'),
			icon: 'person_remove',
			message: this.t('COMMON.CONFIRMATIONS.MEMBER_MESSAGE', { name: memberName }),
			showWarningBox: showMeetingKickWarning,
			warningTitle: this.t('COMMON.CONFIRMATIONS.MEMBER_WARNING_TITLE'),
			warningMessage: this.t('COMMON.CONFIRMATIONS.MEMBER_WARNING'),
			confirmText: this.t('COMMON.CONFIRMATIONS.REMOVE'),
			cancelText: this.t('COMMON.CONFIRMATIONS.CANCEL')
		};
	}

	getBulkRemoveMembersDialogPreset(count: number, showMeetingKickWarning: boolean): DialogPreset {
		return {
			title: this.t('COMMON.CONFIRMATIONS.MEMBERS_TITLE'),
			icon: 'group_remove',
			message: this.t('COMMON.CONFIRMATIONS.MEMBERS_MESSAGE', { count }),
			showWarningBox: showMeetingKickWarning,
			warningTitle: this.t('COMMON.CONFIRMATIONS.MEMBER_WARNING_TITLE'),
			warningMessage: this.t('COMMON.CONFIRMATIONS.MEMBER_WARNING'),
			confirmText: this.t('COMMON.CONFIRMATIONS.REMOVE'),
			cancelText: this.t('COMMON.CONFIRMATIONS.CANCEL')
		};
	}

	getDeleteRecordingDialogPreset(recordingId: string): DialogPreset {
		return {
			title: this.t('COMMON.CONFIRMATIONS.RECORDING_TITLE'),
			icon: 'delete_forever',
			message: this.t('COMMON.CONFIRMATIONS.RECORDING_MESSAGE', { recordingId }),
			confirmText: this.t('COMMON.CONFIRMATIONS.DELETE'),
			cancelText: this.t('COMMON.CONFIRMATIONS.CANCEL')
		};
	}

	getBulkDeleteRecordingsDialogPreset(count: number): DialogPreset {
		return {
			title: this.t('COMMON.CONFIRMATIONS.RECORDINGS_TITLE'),
			icon: 'delete_forever',
			message: this.t('COMMON.CONFIRMATIONS.RECORDINGS_MESSAGE', { count }),
			confirmText: this.t('COMMON.CONFIRMATIONS.DELETE'),
			cancelText: this.t('COMMON.CONFIRMATIONS.CANCEL')
		};
	}

	private t(key: string, params?: Record<string, string | number>): string {
		let value = this.translateService.translate(key);
		if (!params) {
			return value;
		}
		for (const [name, param] of Object.entries(params)) {
			value = value.replaceAll(`{{${name}}}`, String(param));
		}
		return value;
	}
}

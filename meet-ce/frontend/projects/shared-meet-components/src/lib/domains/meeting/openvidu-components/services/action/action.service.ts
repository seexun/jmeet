import { inject, Injectable } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalRef, NzModalService } from 'ng-zorro-antd/modal';
import { DeleteDialogComponent } from '../../components/dialogs/delete-recording.component';
import { DialogTemplateComponent } from '../../components/dialogs/dialog.component';
import { RecordingDialogComponent } from '../../components/dialogs/recording-dialog.component';
import { INotificationOptions } from '../../models/notification-options.model';
import { MeetingTranslateService } from '../translate/meeting-translate.service';

/** Result payload contract of the recording player dialog. */
interface RecordingPlayerResult {
	manageError: boolean;
	error: MediaError | null;
}

/** Toast config fields callers may still set (former notification config subset). */
interface NotificationConfig {
	duration?: number;
	panelClass?: string | string[];
}

/** Minimal HTML escaping — nz-message renders its content via innerHTML. */
function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * @internal
 */
@Injectable({
	providedIn: 'root'
})
export class ActionService {
	private readonly message = inject(NzMessageService);
	private readonly modal = inject(NzModalService);
	private readonly translateService = inject(MeetingTranslateService);

	private dialogRef:
		| NzModalRef<DialogTemplateComponent | RecordingDialogComponent | DeleteDialogComponent>
		| undefined;
	private connectionDialogRef: NzModalRef<DialogTemplateComponent> | undefined;
	private isConnectionDialogOpen = false;

	constructor() {}

	launchNotification(options: INotificationOptions, callback?: () => void): void {
		const config: NotificationConfig = options.config ?? {
			duration: 3000,
			panelClass: 'snackbarNotification'
		};

		const classes = ['snackbarNotification'];
		if (Array.isArray(config.panelClass)) {
			classes.push(...config.panelClass);
		} else if (config.panelClass && config.panelClass !== 'snackbarNotification') {
			classes.push(config.panelClass);
		}

		// Keep the former Material snackbar affordances: the action text stays
		// visible after the message and clicking it fires the callback and closes
		// the toast. Without action text but with a callback, the whole toast is
		// clickable instead. (nz-message renders content via innerHTML, so the
		// action span is appended as markup — both dynamic parts are escaped.)
		const actionText = options.buttonActionText;
		let content = escapeHtml(options.message);
		if (callback && actionText) {
			classes.push('snackbar-notification-action');
			content += `<span class="snackbar-notification-action-text">${escapeHtml(actionText)}</span>`;
		} else if (callback) {
			classes.push('snackbar-notification-action-whole');
		}

		// An unstyled pseudo-type keeps the former icon-free snackbar look.
		// (create() accepts arbitrary type strings; unmatched types render no icon.)
		const notification = this.message.create('snackbar', content, {
			nzDuration: config.duration ?? 3000,
			nzClass: classes.join(' ')
		});

		if (callback) {
			const onClick = (event: MouseEvent) => {
				const target = event.target as HTMLElement | null;
				if (target?.closest('.snackbar-notification-action-text, .snackbar-notification-action-whole')) {
					document.removeEventListener('click', onClick, true);
					// Former MatSnackBar behavior: triggering the action closes the toast.
					this.message.remove(notification.messageId);
					callback();
				}
			};
			document.addEventListener('click', onClick, true);
			notification.onClose.subscribe(() => {
				document.removeEventListener('click', onClick, true);
			});
		}
	}

	openDialog(titleMessage: string, descriptionMessage: string, allowClose = true) {
		this.closeDialog();
		// Former dialog semantics: disableClose = !allowClose.
		this.dialogRef = this.modal.create({
			nzContent: DialogTemplateComponent,
			nzData: { title: titleMessage, description: descriptionMessage, showActionButtons: allowClose },
			nzWidth: '250px',
			nzFooter: null,
			nzClosable: false,
			nzMaskClosable: allowClose,
			nzKeyboard: allowClose
		});
		this.dialogRef.afterClose.subscribe(() => (this.dialogRef = undefined));
	}

	openConnectionDialog(titleMessage: string, descriptionMessage: string, allowClose = false) {
		if (this.isConnectionDialogOpen) return;
		this.connectionDialogRef = this.modal.create({
			nzContent: DialogTemplateComponent,
			nzData: { title: titleMessage, description: descriptionMessage, showActionButtons: allowClose },
			nzWidth: '250px',
			nzFooter: null,
			nzClosable: false,
			nzMaskClosable: allowClose,
			nzKeyboard: allowClose
		});
		this.isConnectionDialogOpen = true;
		this.connectionDialogRef.afterClose.subscribe(() => {
			this.isConnectionDialogOpen = false;
			this.connectionDialogRef = undefined;
		});
	}

	openDeleteRecordingDialog(successCallback: () => void) {
		this.closeDialog();
		// Former behavior: plain dialog open (dismissable via ESC/backdrop).
		this.dialogRef = this.modal.create({
			nzContent: DeleteDialogComponent,
			nzWidth: '250px',
			nzFooter: null,
			nzClosable: false
		});
		this.dialogRef.afterClose.subscribe((result) => {
			if (result) {
				successCallback();
			}
			this.dialogRef = undefined;
		});
	}

	openRecordingPlayerDialog(src: string, allowClose = true) {
		this.closeDialog();
		this.dialogRef = this.modal.create({
			nzContent: RecordingDialogComponent,
			nzData: { src, showActionButtons: allowClose },
			nzWidth: '250px',
			nzFooter: null,
			nzClosable: false,
			nzMaskClosable: allowClose,
			nzKeyboard: allowClose
		});
		this.dialogRef.afterClose.subscribe((data: RecordingPlayerResult) => {
			if (data && data.manageError) {
				this.handleRecordingPlayerError(data.error);
			}
			this.dialogRef = undefined;
		});
	}

	closeDialog() {
		if (this.dialogRef) {
			this.dialogRef.close();
			this.dialogRef = undefined;
		}
	}

	closeConnectionDialog() {
		if (this.connectionDialogRef) {
			this.connectionDialogRef.close();
			this.isConnectionDialogOpen = false;
			this.connectionDialogRef = undefined;
		}
	}

	private handleRecordingPlayerError(error: MediaError | null) {
		let message = 'ERRORS.MEDIA_ERR_GENERIC';
		if (error) {
			switch (error.code) {
				case error.MEDIA_ERR_NETWORK:
					message = 'ERRORS.MEDIA_ERR_NETWORK';
					break;
				case error.MEDIA_ERR_DECODE:
					message = 'ERRORS.MEDIA_ERR_DECODE';
					break;
				case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
					message = 'ERRORS.MEDIA_ERR_SRC_NOT_SUPPORTED';
					break;
			}
		}

		const title = this.translateService.translate('ERRORS.LOAD_RECORDING_TITLE');
		message = this.translateService.translate(message);
		this.openDialog(title, message, true);
	}
}

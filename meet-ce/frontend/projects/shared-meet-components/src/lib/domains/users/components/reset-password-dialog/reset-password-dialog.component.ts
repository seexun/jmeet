import { Clipboard } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzIconTypePipe } from '../../../../shared/pipes/nz-icon-type.pipe';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { MeetUserDTO } from '@openvidu-meet/typings';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { NotificationService } from '../../../../shared/services/notification.service';
import { TranslateService } from '../../../../shared/services/i18n/translate.service';
import { UserService } from '../../services/user.service';
import { UsersUiUtils } from '../../utils/ui';

export interface ResetPasswordDialogData {
	user: MeetUserDTO;
}

@Component({
	selector: 'ov-reset-password-dialog',
	imports: [
		FormsModule,
		NzIconModule, NzIconTypePipe,
		NzInputModule,
		NzSpinModule,
		NzTooltipModule,
		TranslatePipe
	],
	templateUrl: './reset-password-dialog.component.html',
	styleUrl: './reset-password-dialog.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResetPasswordDialogComponent {
	readonly nzModalRef = inject(NzModalRef<ResetPasswordDialogComponent>);
	readonly data = inject<ResetPasswordDialogData>(NZ_MODAL_DATA);

	private userService = inject(UserService);
	private clipboard = inject(Clipboard);
	private notificationService = inject(NotificationService);
	private readonly translateService = inject(TranslateService);

	password = signal('');
	showPassword = signal(false);
	isSaving = signal(false);
	copied = signal(false);

	generatePassword() {
		this.password.set(UsersUiUtils.generateTemporaryPassword());
		this.showPassword.set(true);
	}

	copyToClipboard() {
		const password = this.password();
		if (!password) return;

		this.clipboard.copy(password);
		this.copied.set(true);
		setTimeout(() => this.copied.set(false), 2000);
		this.notificationService.showSnackbar(this.translateService.translate('USERS.ERRORS.PASSWORD_COPIED'));
	}

	async confirm() {
		const password = this.password();
		if (!password) return;

		const delayLoader = setTimeout(() => this.isSaving.set(true), 200);

		try {
			await this.userService.resetUserPassword(this.data.user.userId, password);
			this.notificationService.showSnackbar(
				`${this.translateService.translate('USERS.ERRORS.PASSWORD_RESET_SUCCESS')} ${this.data.user.name}`
			);
			this.nzModalRef.close(true);
		} catch (error) {
			console.error('Error while resetting password', error);
			this.notificationService.showSnackbar(this.translateService.translate('USERS.ERRORS.PASSWORD_RESET_FAILED'));
		} finally {
			clearTimeout(delayLoader);
			this.isSaving.set(false);
		}
	}

	cancel() {
		this.nzModalRef.close(false);
	}
}

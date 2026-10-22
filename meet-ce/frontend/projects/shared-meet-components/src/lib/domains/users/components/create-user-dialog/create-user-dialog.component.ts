import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzIconTypePipe } from '../../../../shared/pipes/nz-icon-type.pipe';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalRef } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { MeetUserRole } from '@openvidu-meet/typings';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { NotificationService } from '../../../../shared/services/notification.service';
import { TranslateService } from '../../../../shared/services/i18n/translate.service';
import { UserService } from '../../services/user.service';
import { UsersUiUtils } from '../../utils/ui';

/** 创建用户对话框（Element 风格）：关闭时以 true 表示创建成功，调用方据此刷新列表。 */
@Component({
	selector: 'ov-create-user-dialog',
	imports: [
		ReactiveFormsModule,
		NzIconModule, NzIconTypePipe,
		NzInputModule,
		NzSelectModule,
		NzSpinModule,
		NzTooltipModule,
		TranslatePipe
	],
	templateUrl: './create-user-dialog.component.html',
	styleUrl: './create-user-dialog.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreateUserDialogComponent {
	private userService = inject(UserService);
	private notificationService = inject(NotificationService);
	private readonly translateService = inject(TranslateService);
	private clipboard = inject(Clipboard);
	readonly nzModalRef = inject(NzModalRef<CreateUserDialogComponent>);

	isSaving = signal(false);
	showPassword = signal(false);
	copied = signal(false);

	availableRoles: MeetUserRole[] = [...UsersUiUtils.AVAILABLE_ROLES];
	protected readonly UsersUiUtils = UsersUiUtils;

	form = new FormGroup({
		loginName: new FormControl('', [
			Validators.required,
			Validators.minLength(3),
			Validators.maxLength(64),
			Validators.pattern(/^[a-zA-Z0-9._-]+$/)
		]),
		name: new FormControl('', [Validators.required, Validators.maxLength(50)]),
		email: new FormControl('', [Validators.email, Validators.maxLength(254)]),
		employeeNumber: new FormControl('', [Validators.maxLength(64)]),
		role: new FormControl<MeetUserRole>(MeetUserRole.ROOM_MANAGER, [Validators.required]),
		password: new FormControl('', [Validators.required, Validators.minLength(5)])
	});

	generatePassword() {
		this.form.get('password')?.setValue(UsersUiUtils.generateTemporaryPassword());
		this.showPassword.set(true);
	}

	copyPasswordToClipboard() {
		const password = this.form.get('password')?.value ?? '';
		if (!password) {
			return;
		}
		this.clipboard.copy(password);
		this.copied.set(true);
		setTimeout(() => this.copied.set(false), 2000);
		this.notificationService.showSnackbar(this.translateService.translate('USERS.ERRORS.PASSWORD_COPIED'));
	}

	async onSubmit() {
		if (this.form.invalid) {
			this.form.markAllAsTouched();
			return;
		}

		const { loginName, name, email, employeeNumber, role, password } = this.form.getRawValue();
		const delayLoader = setTimeout(() => this.isSaving.set(true), 200);

		try {
			await this.userService.createUser({
				loginName: loginName!,
				name: name!,
				email: email || undefined,
				employeeNumber: employeeNumber || undefined,
				role: role!,
				password: password!
			});
			this.notificationService.showSnackbar(
				this.translateService.translate('USERS.ERRORS.USER_CREATED_SUCCESS')
			);
			this.nzModalRef.close(true);
		} catch (error: any) {
			console.error('Error creating user:', error);
			this.notificationService.showSnackbar(
				this.translateService.translate('USERS.ERRORS.USER_CREATE_FAILED')
			);
		} finally {
			clearTimeout(delayLoader);
			this.isSaving.set(false);
		}
	}

	getFieldError(field: string): string | null {
		const control = this.form.get(field);
		if (!control?.errors || !control.touched) {
			return null;
		}

		if (control.errors['required']) {
			return this.translateService.translate('USERS.ERRORS.FIELD_REQUIRED');
		}
		if (control.errors['minlength']) {
			return `${this.translateService.translate('USERS.ERRORS.MIN_LENGTH')} ${control.errors['minlength'].requiredLength} ${this.translateService.translate('USERS.ERRORS.MIN_LENGTH_SUFFIX')}`;
		}
		if (control.errors['pattern']) {
			return this.translateService.translate('USERS.ERRORS.PATTERN');
		}
		if (control.errors['maxlength']) {
			return `${this.translateService.translate('USERS.ERRORS.MAX_LENGTH')} ${control.errors['maxlength'].requiredLength} ${this.translateService.translate('USERS.ERRORS.MAX_LENGTH_SUFFIX')}`;
		}

		return null;
	}
}

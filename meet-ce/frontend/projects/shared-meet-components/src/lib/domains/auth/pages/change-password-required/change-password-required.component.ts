import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import {
	AbstractControl,
	FormControl,
	FormGroup,
	ReactiveFormsModule,
	ValidationErrors,
	Validators
} from '@angular/forms';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzIconTypePipe } from '../../../../shared/pipes/nz-icon-type.pipe';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { JmeetPageHeaderComponent } from '../../../../shared/components';
import { TranslateService } from '../../../../shared/services/i18n/translate.service';
import { NavigationService } from '../../../../shared/services/navigation.service';
import { NotificationService } from '../../../../shared/services/notification.service';
import { SessionStorageService } from '../../../../shared/services/session-storage.service';
import { TokenStorageService } from '../../../../shared/services/token-storage.service';
import { UserService } from '../../../users/services/user.service';

@Component({
	selector: 'ov-change-password-required',
	imports: [
		ReactiveFormsModule,
		JmeetPageHeaderComponent,
		NzIconModule, NzIconTypePipe,
		NzInputModule,
		NzSpinModule,
		NzTooltipModule,
		TranslatePipe
	],
	templateUrl: './change-password-required.component.html',
	styleUrl: './change-password-required.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChangePasswordRequiredComponent implements OnInit {
	private readonly userService = inject(UserService);
	private readonly tokenStorageService = inject(TokenStorageService);
	private readonly sessionStorageService = inject(SessionStorageService);
	private readonly notificationService = inject(NotificationService);
	private readonly navigationService = inject(NavigationService);
	private readonly route = inject(ActivatedRoute);
	private readonly translateService = inject(TranslateService);

	readonly showCurrentPassword = signal(false);
	readonly showNewPassword = signal(false);
	readonly showConfirmPassword = signal(false);
	readonly isSavingPassword = signal(false);

	/**
	 * Where to navigate after a successful password change. Bound directly when rendered outside
	 * the Angular Router (the webcomponent shell); the SPA leaves it empty and reads `redirectTo`
	 * from the route query params instead.
	 */
	readonly redirectToInput = input<string>('', { alias: 'redirectTo' });
	readonly redirectTo = signal('');

	readonly changePasswordForm = new FormGroup({
		currentPassword: new FormControl('', [Validators.required]),
		newPassword: new FormControl('', [Validators.required, Validators.minLength(5)]),
		confirmPassword: new FormControl('', [Validators.required])
	});

	ngOnInit() {
		// Webcomponent: the input carries the destination. SPA: fall back to the route query param.
		const redirectTo = this.redirectToInput() || this.route.snapshot.queryParamMap.get('redirectTo');
		this.redirectTo.set(redirectTo ?? '');

		this.setupPasswordFormValidationListeners();

		// Add custom validators
		this.changePasswordForm.get('newPassword')?.addValidators(this.newPasswordValidator.bind(this));
		this.changePasswordForm.get('confirmPassword')?.addValidators(this.confirmPasswordValidator.bind(this));
	}

	private setupPasswordFormValidationListeners() {
		// Clear invalid password error when user types on current password
		this.changePasswordForm.get('currentPassword')?.valueChanges.subscribe(() => {
			const control = this.changePasswordForm.get('currentPassword');
			if (control?.errors?.['invalidPassword']) {
				const errors = { ...control.errors };
				delete errors['invalidPassword'];
				control.setErrors(Object.keys(errors).length > 0 ? errors : null);
			}

			const newPasswordControl = this.changePasswordForm.get('newPassword');
			if (newPasswordControl?.value) {
				newPasswordControl.updateValueAndValidity();
			}
		});

		// Revalidate confirm password when new password changes
		this.changePasswordForm.get('newPassword')?.valueChanges.subscribe(() => {
			const confirmPasswordControl = this.changePasswordForm.get('confirmPassword');
			if (confirmPasswordControl?.value) {
				confirmPasswordControl.updateValueAndValidity();
			}
		});
	}

	private newPasswordValidator(control: AbstractControl): ValidationErrors | null {
		const currentPassword = this.changePasswordForm.get('currentPassword')?.value;
		const newPassword = control.value;
		if (!currentPassword || !newPassword) {
			return null;
		}
		return currentPassword === newPassword ? { samePassword: true } : null;
	}

	private confirmPasswordValidator(control: AbstractControl): ValidationErrors | null {
		const newPassword = this.changePasswordForm.get('newPassword')?.value;
		const confirmPassword = control.value;
		if (!newPassword || !confirmPassword) {
			return null;
		}
		return newPassword === confirmPassword ? null : { passwordMismatch: true };
	}

	async onChangePassword() {
		if (this.changePasswordForm.invalid) {
			return;
		}

		const { currentPassword, newPassword } = this.changePasswordForm.value;
		const delayLoader = setTimeout(() => this.isSavingPassword.set(true), 200);

		try {
			const response = await this.userService.changePassword(currentPassword!, newPassword!);
			if (!response.accessToken) {
				throw new Error('No renewed access token received after mandatory password change');
			}

			this.tokenStorageService.setAccessToken(response.accessToken);
			if (response.refreshToken) {
				this.tokenStorageService.setRefreshToken(response.refreshToken);
			}

			this.sessionStorageService.removeMustChangePasswordRequired();
			this.notificationService.showSnackbar(this.translateService.translate('AUTH.CHANGE_PASSWORD.ERRORS.UPDATE_SUCCESS'));

			const redirectTo = this.redirectTo();
			if (redirectTo && !redirectTo.includes('/change-password-required')) {
				await this.navigationService.redirectTo(redirectTo, true);
			} else {
				await this.navigationService.redirectTo('/', true);
			}
		} catch (error) {
			if ((error as HttpErrorResponse).status === 400) {
				const control = this.changePasswordForm.get('currentPassword');
				control?.setErrors({ invalidPassword: true });
				control?.markAsTouched();
				this.notificationService.showSnackbar(this.translateService.translate('AUTH.CHANGE_PASSWORD.ERRORS.CURRENT_INCORRECT'));
			} else {
				console.error('Error changing password:', error);
				this.notificationService.showSnackbar(this.translateService.translate('AUTH.CHANGE_PASSWORD.ERRORS.UPDATE_FAILED'));
			}
		} finally {
			clearTimeout(delayLoader);
			this.isSavingPassword.set(false);
		}
	}

	getCurrentPasswordError(): string | null {
		const control = this.changePasswordForm.get('currentPassword');
		if (control?.errors && control.touched) {
			if (control.errors['required']) {
				return this.translateService.translate('AUTH.CHANGE_PASSWORD.ERRORS.CURRENT_REQUIRED');
			}
			if (control.errors['invalidPassword']) {
				return this.translateService.translate('AUTH.CHANGE_PASSWORD.ERRORS.CURRENT_INCORRECT');
			}
		}
		return null;
	}

	getNewPasswordError(): string | null {
		const control = this.changePasswordForm.get('newPassword');
		if (control?.errors && control.touched) {
			const errors = control.errors;
			if (errors['required']) {
				return this.translateService.translate('AUTH.CHANGE_PASSWORD.ERRORS.NEW_REQUIRED');
			}
			if (errors['minlength']) {
				return `${this.translateService.translate('AUTH.CHANGE_PASSWORD.ERRORS.NEW_MIN_PREFIX')}${errors['minlength'].requiredLength}${this.translateService.translate('AUTH.CHANGE_PASSWORD.ERRORS.NEW_MIN_SUFFIX')}`;
			}
			if (errors['samePassword']) {
				return this.translateService.translate('AUTH.CHANGE_PASSWORD.ERRORS.NEW_SAME');
			}
		}
		return null;
	}

	getConfirmPasswordError(): string | null {
		const control = this.changePasswordForm.get('confirmPassword');
		if (control?.touched && control?.errors) {
			if (control.errors['required']) {
				return this.translateService.translate('AUTH.CHANGE_PASSWORD.ERRORS.CONFIRM_REQUIRED');
			}
			if (control.errors['passwordMismatch']) {
				return this.translateService.translate('AUTH.CHANGE_PASSWORD.ERRORS.CONFIRM_MISMATCH');
			}
		}
		return null;
	}
}

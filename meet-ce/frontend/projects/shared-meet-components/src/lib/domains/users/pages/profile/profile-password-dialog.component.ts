import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ValidationErrors, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { NzIconTypePipe } from '../../../../shared/pipes/nz-icon-type.pipe';
import { HttpErrorResponse } from '@angular/common/http';
import { UserService } from '../../services/user.service';
import { NotificationService } from '../../../../shared/services/notification.service';
import { TranslateService } from '../../../../shared/services/i18n/translate.service';

/**
 * 修改密码对话框：国内惯例——改密码是低频动作，收进弹窗而不是常驻表单。
 * 结果语义：修改成功 close(true)，取消/遮罩 close(false)。
 */
@Component({
	selector: 'ov-profile-password-dialog',
	standalone: true,
	imports: [ReactiveFormsModule, NzIconModule, NzInputModule, NzSpinModule, NzTooltipModule, TranslatePipe, NzIconTypePipe],
	template: `
		<div class="profile-dialog">
			<h2 class="profile-dialog__title">{{ 'USERS.PROFILE.PASSWORD_DIALOG_TITLE' | translate }}</h2>
			<div class="profile-dialog__content">
				<form [formGroup]="form" (ngSubmit)="submit()">
					<div class="jmeet-field">
						<label class="jmeet-field-label" for="dialog-current-password">{{
							'USERS.PROFILE.CURRENT_PASSWORD' | translate
						}}</label>
						<div class="password-field-row">
							<input
								id="dialog-current-password"
								nz-input
								[type]="showCurrent() ? 'text' : 'password'"
								formControlName="currentPassword"
								[placeholder]="'USERS.PROFILE.CURRENT_PASSWORD_PLACEHOLDER' | translate"
								autocomplete="current-password"
							/>
							<button
								type="button"
								class="jmeet-button jmeet-button--ghost jmeet-button--icon"
								(click)="showCurrent.set(!showCurrent())"
								nz-tooltip
								[nzTooltipTitle]="
									showCurrent() ? ('USERS.COMMON.HIDE_PASSWORD' | translate) : ('USERS.COMMON.SHOW_PASSWORD' | translate)
								"
							>
								<nz-icon [nzType]="(showCurrent() ? 'visibility_off' : 'visibility') | nzIconType" />
							</button>
						</div>
						@if (form.get('currentPassword')?.errors?.['invalidPassword'] && form.get('currentPassword')?.touched) {
							<p class="password-field-error">{{ 'USERS.ERRORS.CURRENT_PASSWORD_INCORRECT' | translate }}</p>
						}
					</div>

					<div class="jmeet-field">
						<label class="jmeet-field-label" for="dialog-new-password">{{ 'USERS.PROFILE.NEW_PASSWORD' | translate }}</label>
						<div class="password-field-row">
							<input
								id="dialog-new-password"
								nz-input
								[type]="showNew() ? 'text' : 'password'"
								formControlName="newPassword"
								[placeholder]="'USERS.PROFILE.NEW_PASSWORD_PLACEHOLDER' | translate"
								autocomplete="new-password"
							/>
							<button
								type="button"
								class="jmeet-button jmeet-button--ghost jmeet-button--icon"
								(click)="showNew.set(!showNew())"
								nz-tooltip
								[nzTooltipTitle]="
									showNew() ? ('USERS.COMMON.HIDE_PASSWORD' | translate) : ('USERS.COMMON.SHOW_PASSWORD' | translate)
								"
							>
								<nz-icon [nzType]="(showNew() ? 'visibility_off' : 'visibility') | nzIconType" />
							</button>
						</div>
						<p class="password-field-hint">{{ 'USERS.PROFILE.PASSWORD_MIN_HINT' | translate }}</p>
						@if (form.get('newPassword')?.errors?.['samePassword'] && form.get('newPassword')?.touched) {
							<p class="password-field-error">{{ 'USERS.PROFILE.PASSWORD_SAME_ERROR' | translate }}</p>
						}
					</div>

					<div class="jmeet-field">
						<label class="jmeet-field-label" for="dialog-confirm-password">{{
							'USERS.PROFILE.CONFIRM_PASSWORD' | translate
						}}</label>
						<div class="password-field-row">
							<input
								id="dialog-confirm-password"
								nz-input
								[type]="showConfirm() ? 'text' : 'password'"
								formControlName="confirmPassword"
								[placeholder]="'USERS.PROFILE.CONFIRM_PASSWORD_PLACEHOLDER' | translate"
								autocomplete="new-password"
							/>
							<button
								type="button"
								class="jmeet-button jmeet-button--ghost jmeet-button--icon"
								(click)="showConfirm.set(!showConfirm())"
								nz-tooltip
								[nzTooltipTitle]="
									showConfirm() ? ('USERS.COMMON.HIDE_PASSWORD' | translate) : ('USERS.COMMON.SHOW_PASSWORD' | translate)
								"
							>
								<nz-icon [nzType]="(showConfirm() ? 'visibility_off' : 'visibility') | nzIconType" />
							</button>
						</div>
						@if (form.get('confirmPassword')?.errors?.['passwordMismatch'] && form.get('confirmPassword')?.touched) {
							<p class="password-field-error">{{ 'USERS.PROFILE.PASSWORD_MISMATCH_ERROR' | translate }}</p>
						}
					</div>
				</form>
			</div>
			<div class="profile-dialog__actions">
				<button type="button" class="jmeet-button jmeet-button--outline" (click)="nzModalRef.close(false)">
					{{ 'USERS.PROFILE.DIALOG_CANCEL' | translate }}
				</button>
				<button type="button" class="jmeet-button jmeet-button--primary" [disabled]="form.invalid || saving()" (click)="submit()">
					@if (saving()) {
						<nz-spin nzSimple nzSize="small" />
					} @else {
						{{ 'USERS.PROFILE.UPDATE_PASSWORD' | translate }}
					}
				</button>
			</div>
		</div>
	`,
	styles: `
		.profile-dialog {
			display: flex;
			flex-direction: column;
			padding: 0;
		}

		.profile-dialog__title {
			margin: 0;
			padding: 24px 24px 0;
			font-size: 16px;
			font-weight: 600;
			color: var(--jmeet-color-text-primary);
		}

		.profile-dialog__content {
			padding: 16px 24px 0;
			display: flex;
			flex-direction: column;
			gap: 16px;
		}

		.profile-dialog__actions {
			display: flex;
			justify-content: flex-end;
			gap: 8px;
			padding: 16px 24px 20px;
		}

		.password-field-row {
			display: flex;
			align-items: center;
			gap: 8px;
		}

		.password-field-row input {
			flex: 1;
			min-width: 0;
		}

		.password-field-hint,
		.password-field-error {
			margin: 4px 0 0;
			font-size: 12px;
		}

		.password-field-hint {
			color: var(--jmeet-color-text-hint);
		}

		.password-field-error {
			color: var(--jmeet-color-action-danger);
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfilePasswordDialogComponent {
	readonly nzModalRef = inject<NzModalRef<ProfilePasswordDialogComponent, boolean>>(NzModalRef);
	private readonly userService = inject(UserService);
	private readonly notices = inject(NotificationService);
	private readonly translate = inject(TranslateService);

	showCurrent = signal(false);
	showNew = signal(false);
	showConfirm = signal(false);
	saving = signal(false);

	form = new FormGroup({
		currentPassword: new FormControl('', [Validators.required]),
		newPassword: new FormControl('', [Validators.required, Validators.minLength(5)]),
		confirmPassword: new FormControl('', [Validators.required])
	});

	constructor() {
		this.form.get('newPassword')?.addValidators(this.newPasswordValidator.bind(this));
		this.form.get('confirmPassword')?.addValidators(this.confirmPasswordValidator.bind(this));

		// 当前密码输入后清除「密码错误」态；新密码变化时联动复验确认框
		this.form.get('currentPassword')?.valueChanges.subscribe(() => {
			const control = this.form.get('currentPassword');
			if (control?.errors?.['invalidPassword']) {
				const errors = { ...control.errors };
				delete errors['invalidPassword'];
				control.setErrors(Object.keys(errors).length > 0 ? errors : null);
			}
			if (this.form.get('newPassword')?.value) {
				this.form.get('newPassword')?.updateValueAndValidity();
			}
		});
		this.form.get('newPassword')?.valueChanges.subscribe(() => {
			if (this.form.get('confirmPassword')?.value) {
				this.form.get('confirmPassword')?.updateValueAndValidity();
			}
		});
	}

	private newPasswordValidator(control: AbstractControl): ValidationErrors | null {
		const currentPassword = this.form?.get('currentPassword')?.value;
		if (!currentPassword || !control.value) return null;
		return currentPassword === control.value ? { samePassword: true } : null;
	}

	private confirmPasswordValidator(control: AbstractControl): ValidationErrors | null {
		const newPassword = this.form?.get('newPassword')?.value;
		if (!newPassword || !control.value) return null;
		return newPassword === control.value ? null : { passwordMismatch: true };
	}

	async submit() {
		if (this.form.invalid || this.saving()) return;
		const { currentPassword, newPassword } = this.form.value;
		this.saving.set(true);
		try {
			await this.userService.changePassword(currentPassword!, newPassword!);
			this.notices.showSnackbar(this.translate.translate('USERS.ERRORS.PASSWORD_UPDATED_SUCCESS'));
			this.nzModalRef.close(true);
		} catch (error) {
			if ((error as HttpErrorResponse).status === 400) {
				const control = this.form.get('currentPassword');
				control?.setErrors({ invalidPassword: true });
				control?.markAsTouched();
			} else {
				this.notices.showSnackbar(this.translate.translate('USERS.ERRORS.PASSWORD_UPDATE_FAILED'));
			}
		} finally {
			this.saving.set(false);
		}
	}
}

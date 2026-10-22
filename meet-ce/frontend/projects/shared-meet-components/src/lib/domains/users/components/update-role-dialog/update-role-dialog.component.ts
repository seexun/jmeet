import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzIconTypePipe } from '../../../../shared/pipes/nz-icon-type.pipe';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { MeetUserDTO, MeetUserRole } from '@openvidu-meet/typings';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { NotificationService } from '../../../../shared/services/notification.service';
import { TranslateService } from '../../../../shared/services/i18n/translate.service';
import { UserService } from '../../services/user.service';
import { UsersUiUtils } from '../../utils/ui';

export interface UpdateRoleDialogData {
	user: MeetUserDTO;
}

@Component({
	selector: 'ov-update-role-dialog',
	imports: [
		FormsModule,
		NzIconModule, NzIconTypePipe,
		NzSelectModule,
		NzSpinModule,
		TranslatePipe
	],
	templateUrl: './update-role-dialog.component.html',
	styleUrl: './update-role-dialog.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class UpdateRoleDialogComponent {
	readonly nzModalRef = inject(NzModalRef<UpdateRoleDialogComponent, MeetUserDTO | null>);
	readonly data = inject<UpdateRoleDialogData>(NZ_MODAL_DATA);

	private readonly userService = inject(UserService);
	private readonly notificationService = inject(NotificationService);
	private readonly translateService = inject(TranslateService);

	readonly selectedRole = signal<MeetUserRole>(this.data.user.role);
	readonly isSaving = signal(false);
	readonly availableRoles: readonly MeetUserRole[] = UsersUiUtils.AVAILABLE_ROLES;
	protected readonly UsersUiUtils = UsersUiUtils;

	readonly roleSpecificWarning = computed(() => {
		switch (this.selectedRole()) {
			case MeetUserRole.ROOM_MEMBER:
				return this.translateService.translate('USERS.UPDATE_ROLE_DIALOG.WARNING_ROOM_MEMBER');
			case MeetUserRole.ADMIN:
				return this.translateService.translate('USERS.UPDATE_ROLE_DIALOG.WARNING_ADMIN');
			default:
				return '';
		}
	});

	readonly roleChanged = computed(() => this.selectedRole() !== this.data.user.role);

	cancel() {
		this.nzModalRef.close(null);
	}

	async save() {
		if (!this.roleChanged() || this.isSaving()) {
			return;
		}

		const delayLoader = setTimeout(() => this.isSaving.set(true), 200);

		try {
			const updatedUser = await this.userService.updateUserRole(this.data.user.userId, this.selectedRole());
			this.notificationService.showSnackbar(
				`${this.translateService.translate('USERS.ERRORS.ROLE_UPDATED_PREFIX')} ${updatedUser.name} ${this.translateService.translate('USERS.ERRORS.ROLE_UPDATED_TO')} ${this.translateService.translate(UsersUiUtils.getRoleTranslationKey(updatedUser.role))}`
			);
			this.nzModalRef.close(updatedUser);
		} catch (error) {
			console.error('Error while updating user role', error);
			this.notificationService.showSnackbar(this.translateService.translate('USERS.ERRORS.ROLE_UPDATE_FAILED'));
		} finally {
			clearTimeout(delayLoader);
			this.isSaving.set(false);
		}
	}
}

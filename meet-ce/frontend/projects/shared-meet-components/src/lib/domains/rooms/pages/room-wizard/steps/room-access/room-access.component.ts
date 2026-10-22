import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { MeetRoomMemberOptions, MeetRoomMemberPermissions, MeetRoomOptions, MeetRoomRoles } from '@openvidu-meet/typings';
import { take } from 'rxjs';
import { AuthService } from '../../../../../auth/services/auth.service';
import { MemberFormDialogComponent } from '../../../../../room-members/components/member-form-dialog/member-form-dialog.component';
import { MemberFormDialogData } from '../../../../../room-members/models/member-form.model';
import { PERMISSION_GROUPS } from '../../../../../room-members/models/permissions.model';
import { RoomMemberUiUtils } from '../../../../../room-members/utils/ui';
import { TranslatePipe } from '../../../../../../shared/pipes/translate.pipe';
import { DIALOG_WIDTH, NotificationService } from '../../../../../../shared/services/notification.service';
import {
	RoomAccessFormGroup,
	RoomAccessFormValue,
	RoomAccessRolePermissionsFormGroup
} from '../../../../models/wizard-forms.model';
import { WizardStepId } from '../../../../models/wizard.model';
import { RoomWizardStateService } from '../../../../services/wizard-state.service';

type RolePermissionKey = keyof MeetRoomMemberPermissions;

@Component({
	selector: 'ov-room-access',
	imports: [
		ReactiveFormsModule,
		FormsModule,
		NzIconModule,
		NzSelectModule,
		NzSwitchModule,
		NzTooltipModule,
		TranslatePipe
	],
	templateUrl: './room-access.component.html',
	styleUrl: './room-access.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoomAccessComponent implements OnInit {
	private wizardService = inject(RoomWizardStateService);
	// 成员弹窗统一走 NotificationService.openModal（NZ_MODAL_DATA 范式）。
	private notificationService = inject(NotificationService);
	private authService = inject(AuthService);

	currentUserId = signal('');
	moderatorPermissionKeys = signal<RolePermissionKey[]>([]);
	speakerPermissionKeys = signal<RolePermissionKey[]>([]);

	roomAccessForm: RoomAccessFormGroup;
	permissionGroups = PERMISSION_GROUPS;
	protected readonly RoomMemberUiUtils = RoomMemberUiUtils;

	editMode = this.wizardService.editMode;
	pendingMembers = this.wizardService.pendingMembers;

	constructor() {
		const roomAccessStep = this.wizardService.getStepById(WizardStepId.ROOM_ACCESS);
		if (!roomAccessStep) {
			throw new Error('roomAccess step not found in wizard state');
		}
		this.roomAccessForm = roomAccessStep.formGroup;
		this.syncPermissionKeys();

		this.roomAccessForm.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
			this.saveFormData(value);
			this.syncPermissionKeys();
		});
	}

	async ngOnInit(): Promise<void> {
		this.currentUserId.set((await this.authService.getUserId()) ?? '');
	}

	get moderatorForm(): RoomAccessRolePermissionsFormGroup {
		return this.roomAccessForm.controls.moderator;
	}

	get speakerForm(): RoomAccessRolePermissionsFormGroup {
		return this.roomAccessForm.controls.speaker;
	}

	onPermissionSelectionChange(role: 'moderator' | 'speaker', keys: RolePermissionKey[]): void {
		const form = role === 'moderator' ? this.moderatorForm : this.speakerForm;
		const selected = new Set(keys);
		const patch: Partial<MeetRoomMemberPermissions> = {};
		for (const group of this.permissionGroups) {
			for (const permission of group.permissions) {
				patch[permission.key] = selected.has(permission.key);
			}
		}
		form.patchValue(patch);
	}

	openAddMemberDialog(): void {
		this.notificationService
			.openModal({
				nzContent: MemberFormDialogComponent,
				nzData: {
					roomRoles: this.wizardService.roomOptions().roles as MeetRoomRoles,
					roomOwner: this.currentUserId()
				} satisfies MemberFormDialogData,
				nzWidth: DIALOG_WIDTH.form
			})
			.afterClose.pipe(take(1))
			.subscribe((result) => {
				if (!result) return;
				const isDuplicate = result.userId
					? this.pendingMembers().some((m) => m.userId === result.userId)
					: false;
				if (!isDuplicate) {
					this.wizardService.addPendingMember(result);
				}
			});
	}

	openEditMemberDialog(index: number): void {
		const member = this.pendingMembers()[index];
		if (!member) return;

		this.notificationService
			.openModal({
				nzContent: MemberFormDialogComponent,
				nzData: {
					roomRoles: this.wizardService.roomOptions().roles as MeetRoomRoles,
					roomOwner: this.currentUserId(),
					initialData: member
				} satisfies MemberFormDialogData,
				nzWidth: DIALOG_WIDTH.form
			})
			.afterClose.pipe(take(1))
			.subscribe((result) => {
				if (result) {
					this.wizardService.updatePendingMember(index, result);
				}
			});
	}

	onRemoveMember(index: number): void {
		this.wizardService.removePendingMember(index);
	}

	private selectedPermissionKeys(form: RoomAccessRolePermissionsFormGroup): RolePermissionKey[] {
		return this.permissionGroups
			.flatMap((group) => group.permissions)
			.map((permission) => permission.key)
			.filter((key) => form.controls[key]?.value);
	}

	private syncPermissionKeys(): void {
		this.moderatorPermissionKeys.set(this.selectedPermissionKeys(this.moderatorForm));
		this.speakerPermissionKeys.set(this.selectedPermissionKeys(this.speakerForm));
	}

	private saveFormData(formValue: Partial<RoomAccessFormValue>): void {
		const stepData: Partial<MeetRoomOptions> = {
			access: {
				anonymous: {
					moderator: { enabled: formValue.anonymousModeratorEnabled ?? false },
					speaker: { enabled: formValue.anonymousSpeakerEnabled ?? false }
				},
				user: { enabled: formValue.userEnabled ?? false }
			},
			roles: {
				moderator: { permissions: formValue.moderator ?? {} },
				speaker: { permissions: formValue.speaker ?? {} }
			}
		};

		this.wizardService.updateStepData(stepData);
	}
}

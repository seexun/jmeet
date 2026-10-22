import { ChangeDetectionStrategy, Component, inject, input, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzIconTypePipe } from '../../../../shared/pipes/nz-icon-type.pipe';
import { NzAutocompleteModule } from 'ng-zorro-antd/auto-complete';
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import {
	MEET_ROOM_MEMBER_PERMISSIONS_FIELDS,
	MeetRoomMemberOptions,
	MeetRoomMemberPermissions,
	MeetRoomMemberRole,
	MeetRoomRoles,
	MeetUserDTO,
	MeetUserFilters,
	MeetUserRole,
	SortOrder,
	TextMatchMode
} from '@openvidu-meet/typings';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { TranslateService } from '../../../../shared/services/i18n/translate.service';
import { UserService } from '../../../users/services/user.service';
import { MemberFormMemberType } from '../../models/member-form.model';
import { PERMISSION_GROUPS, PermissionGroup } from '../../models/permissions.model';
import { RoomMemberUiUtils } from '../../utils/ui';

@Component({
	selector: 'ov-member-form',
	imports: [
		ReactiveFormsModule,
		NzIconModule, NzIconTypePipe,
		NzInputModule,
		NzSelectModule,
		NzAutocompleteModule,
		NzCollapseModule,
		NzSpinModule,
		NzTooltipModule,
		TranslatePipe
	],
	templateUrl: './member-form.component.html',
	styleUrl: './member-form.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberFormComponent implements OnInit {
	private userService = inject(UserService);
	private readonly translateService = inject(TranslateService);

	// ── Inputs ────────────────────────────────────────────────────────────────
	roomRoles = input.required<MeetRoomRoles>();
	roomOwner = input.required<string>();
	initialData = input<MeetRoomMemberOptions | undefined>(undefined);
	lockIdentity = input<boolean>(false);
	isSaving = input<boolean>(false);

	// ── Outputs ───────────────────────────────────────────────────────────────
	memberSubmitted = output<MeetRoomMemberOptions>();
	memberTypeChanged = output<MemberFormMemberType>();
	cancelled = output<void>();

	// ── State ─────────────────────────────────────────────────────────────────
	readonly permissionGroups = PERMISSION_GROUPS;
	protected readonly RoomMemberUiUtils = RoomMemberUiUtils;

	isUserMode = signal(true);
	isLoadingUsers = signal(false);
	filteredUsers = signal<MeetUserDTO[]>([]);

	// ── Form ──────────────────────────────────────────────────────────────────
	form = new FormGroup({
		memberType: new FormControl<MemberFormMemberType>('user', { nonNullable: true }),
		userId: new FormControl<string>('', [Validators.required, Validators.pattern(/^[a-z0-9_]+$/)]),
		memberName: new FormControl<string>({ value: '', disabled: true }, [
			Validators.required,
			Validators.maxLength(50)
		]),
		role: new FormControl<MeetRoomMemberRole>(MeetRoomMemberRole.SPEAKER, [Validators.required]),
		permissions: this.buildPermissionsFormGroup()
	});

	constructor() {
		// Toggle active field when member type changes
		this.form
			.get('memberType')!
			.valueChanges.pipe(takeUntilDestroyed())
			.subscribe((type) => {
				const isUser = type === 'user';
				this.isUserMode.set(isUser);
				this.memberTypeChanged.emit(type);
				if (isUser) {
					this.form.get('userId')!.enable();
					this.form.get('memberName')!.disable();
					this.form.get('memberName')!.reset('');
				} else {
					this.form.get('memberName')!.enable();
					this.form.get('userId')!.disable();
					this.form.get('userId')!.reset('');
					this.filteredUsers.set([]);
				}
			});

		// Reset permissions to role defaults when role changes
		this.form
			.get('role')!
			.valueChanges.pipe(takeUntilDestroyed())
			.subscribe((role) => {
				if (role) {
					this.resetPermissionsToRoleDefaults(role);
				}
			});

		// Autocomplete search for users
		this.form
			.get('userId')!
			.valueChanges.pipe(debounceTime(500), distinctUntilChanged(), takeUntilDestroyed())
			.subscribe((value) => {
				if (value && value.length >= 1) {
					this.searchUsers(value);
				} else {
					this.searchUsers('');
				}
			});
	}

	ngOnInit(): void {
		const data = this.initialData();
		if (data) {
			this.applyInitialData(data);
		} else {
			// Set default permissions based on default role
			const defaultRole = this.form.get('role')!.value!;
			this.resetPermissionsToRoleDefaults(defaultRole);
		}
	}

	// ── Public Getters ────────────────────────────────────────────────────────

	get permissionsForm(): FormGroup {
		return this.form.get('permissions') as FormGroup;
	}

	// ── Autocomplete Handlers ─────────────────────────────────────────────────

	onUserInputFocus(): void {
		const currentValue = this.form.get('userId')!.value || '';
		if (!currentValue) {
			this.searchUsers('');
		}
	}

	isUserDisabled(user: MeetUserDTO): boolean {
		return user.role === MeetUserRole.ADMIN || user.userId === this.roomOwner();
	}

	getDisabledReason(user: MeetUserDTO): string | null {
		if (user.role === MeetUserRole.ADMIN) {
			return this.translateService.translate('ROOM_MEMBERS.FORM.DISABLED_REASON_ADMIN');
		}
		if (user.userId === this.roomOwner()) {
			return this.translateService.translate('ROOM_MEMBERS.FORM.DISABLED_REASON_OWNER');
		}
		return null;
	}

	setMemberType(type: MemberFormMemberType): void {
		const control = this.form.get('memberType');
		if (!control || control.disabled) return;
		control.setValue(type);
	}

	customizedPermissionCount(): number {
		return PERMISSION_GROUPS.flatMap((group) => group.permissions).filter((permission) =>
			this.permissionDiffersFromDefault(permission.key)
		).length;
	}

	groupCustomizedCount(group: PermissionGroup): number {
		return group.permissions.filter((permission) => this.permissionDiffersFromDefault(permission.key)).length;
	}

	permissionDiffersFromDefault(key: keyof MeetRoomMemberPermissions): boolean {
		const role = this.form.get('role')!.value;
		if (!role) return false;
		const defaults = this.getRoleDefaultPermissions(role);
		return this.permissionsForm.get(key)?.value !== defaults[key];
	}

	resetCustomPermissions(): void {
		const role = this.form.get('role')!.value;
		if (!role) return;
		this.resetPermissionsToRoleDefaults(role);
	}

	customizedPermissionSummary(): string {
		return this.translateService
			.translate('ROOM_MEMBERS.FORM.CUSTOM_PERMISSIONS_CUSTOMIZED')
			.replace('{{count}}', String(this.customizedPermissionCount()));
	}

	groupPermissionCountLabel(count: number): string {
		return this.translateService
			.translate('ROOM_MEMBERS.FORM.CUSTOM_PERMISSIONS_GROUP_COUNT')
			.replace('{{count}}', String(count));
	}

	// ── Form Actions ──────────────────────────────────────────────────────────

	onSubmit(): void {
		if (this.form.invalid) {
			this.form.markAllAsTouched();
			return;
		}

		const { memberType, userId, memberName, role, permissions } = this.form.getRawValue();
		const roles = this.roomRoles();

		// Only send permissions that differ from the role's defaults
		let customPermissions: Partial<MeetRoomMemberPermissions> | undefined;
		if (this.permissionsForm.dirty && permissions && role) {
			const roleDefaults =
				role === MeetRoomMemberRole.MODERATOR ? roles.moderator.permissions : roles.speaker.permissions;

			const diff: Partial<MeetRoomMemberPermissions> = {};
			for (const key of MEET_ROOM_MEMBER_PERMISSIONS_FIELDS) {
				if (permissions[key] !== roleDefaults[key]) {
					diff[key] = permissions[key] as boolean;
				}
			}
			if (Object.keys(diff).length > 0) {
				customPermissions = diff;
			}
		}

		const options: MeetRoomMemberOptions = {
			...(memberType === 'user' ? { userId: userId! } : { name: memberName! }),
			baseRole: role!,
			customPermissions
		};

		this.memberSubmitted.emit(options);
	}

	onCancel(): void {
		this.cancelled.emit();
	}

	getFieldError(field: string): string | null {
		const control = this.form.get(field);
		if (!control?.errors || !control.touched) return null;
		if (control.errors['required']) return this.translateService.translate('ROOM_MEMBERS.ERRORS.FIELD_REQUIRED');
		if (control.errors['pattern']) return this.translateService.translate('ROOM_MEMBERS.ERRORS.PATTERN');
		if (control.errors['maxlength']) {
			const { requiredLength } = control.errors['maxlength'];
			return `${this.translateService.translate('ROOM_MEMBERS.ERRORS.MAX_LENGTH_PREFIX')}${requiredLength}${this.translateService.translate('ROOM_MEMBERS.ERRORS.MAX_LENGTH_SUFFIX')}`;
		}
		return null;
	}

	// ── Private Helpers ───────────────────────────────────────────────────────

	private applyInitialData(options: MeetRoomMemberOptions): void {
		const role = options.baseRole;
		const memberType: MemberFormMemberType = options.userId ? 'user' : 'identified_guest';
		const lockIdentity = this.lockIdentity();

		// Set role without emitting (prevents premature permission reset)
		this.form.get('role')!.setValue(role, { emitEvent: false });

		// Set member type — triggers the subscription that enables/disables fields
		this.form.get('memberType')!.setValue(memberType);

		if (lockIdentity) {
			this.form.get('memberType')!.disable();
		}

		if (memberType === 'user') {
			this.form.get('userId')!.setValue(options.userId ?? '');
			if (lockIdentity) {
				this.form.get('userId')!.disable();
			}
		} else {
			this.form.get('memberName')!.setValue(options.name ?? '');
			if (lockIdentity) {
				this.form.get('memberName')!.disable();
			}
		}

		// Resolve permissions: role defaults + custom overrides
		const roles = this.roomRoles();
		const roleDefaults =
			role === MeetRoomMemberRole.MODERATOR ? roles.moderator.permissions : roles.speaker.permissions;

		const permissionsForm = this.permissionsForm;
		for (const key of MEET_ROOM_MEMBER_PERMISSIONS_FIELDS) {
			const value = options.customPermissions?.[key] ?? roleDefaults[key] ?? false;
			permissionsForm.get(key)?.setValue(value, { emitEvent: false });
		}

		// Mark dirty only if there are active custom permissions (differ from role defaults)
		if (options.customPermissions && Object.keys(options.customPermissions).length > 0) {
			permissionsForm.markAsDirty();
		} else {
			permissionsForm.markAsPristine();
		}
	}

	private buildPermissionsFormGroup(): FormGroup {
		const controls: Record<string, FormControl<boolean>> = {};
		for (const key of MEET_ROOM_MEMBER_PERMISSIONS_FIELDS) {
			controls[key] = new FormControl<boolean>(false, {
				nonNullable: true
			}) as FormControl<boolean>;
		}
		return new FormGroup(controls);
	}

	private getRoleDefaultPermissions(role: MeetRoomMemberRole): MeetRoomMemberPermissions {
		const roomRoles = this.roomRoles();
		return role === MeetRoomMemberRole.MODERATOR ? roomRoles.moderator.permissions : roomRoles.speaker.permissions;
	}

	private resetPermissionsToRoleDefaults(role: MeetRoomMemberRole): void {
		const rolePermissions = this.getRoleDefaultPermissions(role);

		const permissionsForm = this.permissionsForm;
		for (const key of MEET_ROOM_MEMBER_PERMISSIONS_FIELDS) {
			permissionsForm.get(key)?.setValue(rolePermissions[key] ?? false, { emitEvent: false });
		}
		permissionsForm.markAsPristine();
	}

	private async searchUsers(query: string): Promise<void> {
		const delayLoader = setTimeout(() => this.isLoadingUsers.set(true), 200);

		try {
			const filters: MeetUserFilters = {
				maxItems: 20,
				sortField: 'name',
				sortOrder: SortOrder.ASC
			};
			if (query) {
				filters.name = query;
				filters.userId = query;
				filters.nameMatchMode = TextMatchMode.PREFIX;
				filters.nameCaseInsensitive = true;
			}

			const response = await this.userService.listUsers(filters);
			this.filteredUsers.set(response.users);
		} catch {
			this.filteredUsers.set([]);
		} finally {
			clearTimeout(delayLoader);
			this.isLoadingUsers.set(false);
		}
	}
}

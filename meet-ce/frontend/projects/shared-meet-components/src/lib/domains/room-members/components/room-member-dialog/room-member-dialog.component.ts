import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzIconTypePipe } from '../../../../shared/pipes/nz-icon-type.pipe';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { MeetRoomMember, MeetRoomMemberOptions, MeetRoomRoles } from '@openvidu-meet/typings';
import { JmeetLoadingSkeletonComponent } from '../../../../shared/components';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { TranslateService } from '../../../../shared/services/i18n/translate.service';
import { NotificationService } from '../../../../shared/services/notification.service';
import { RoomService } from '../../../rooms/services/room.service';
import { MemberFormComponent } from '../member-form/member-form.component';
import { MemberFormMemberType } from '../../models/member-form.model';
import { RoomMemberService } from '../../services/room-member.service';
import { RoomMemberUiUtils } from '../../utils/ui';

export interface RoomMemberDialogData {
	roomId: string;
	mode: 'add' | 'edit';
	memberId?: string;
}

export type RoomMemberDialogResult = boolean;

@Component({
	selector: 'ov-room-member-dialog',
	imports: [JmeetLoadingSkeletonComponent, NzIconModule, NzIconTypePipe, MemberFormComponent, TranslatePipe],
	templateUrl: './room-member-dialog.component.html',
	styleUrl: './room-member-dialog.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoomMemberDialogComponent implements OnInit {
	private readonly data = inject<RoomMemberDialogData>(NZ_MODAL_DATA);
	readonly nzModalRef = inject(NzModalRef<RoomMemberDialogComponent, RoomMemberDialogResult>);
	private readonly roomMemberService = inject(RoomMemberService);
	private readonly roomService = inject(RoomService);
	private readonly notificationService = inject(NotificationService);
	private readonly translateService = inject(TranslateService);

	readonly isEditMode = signal(this.data.mode === 'edit');
	isLoading = signal(true);
	isSaving = signal(false);
	loadFailed = signal(false);

	roomRoles = signal<MeetRoomRoles | undefined>(undefined);
	roomOwner = signal('');
	memberInitData = signal<MeetRoomMemberOptions | undefined>(undefined);

	async ngOnInit(): Promise<void> {
		try {
			const memberId = this.data.memberId;
			const [roomResponse, member] = await Promise.all([
				this.roomService.getRoom(this.data.roomId, {
					fields: ['owner'],
					extraFields: ['roles']
				}),
				memberId ? this.roomMemberService.getRoomMember(this.data.roomId, memberId) : Promise.resolve(null)
			]);
			const room = roomResponse as { owner?: string; roles?: MeetRoomRoles };
			if (!room.roles) {
				throw new Error('Room roles unavailable');
			}
			this.roomRoles.set(room.roles);
			this.roomOwner.set(room.owner ?? '');

			if (member) {
				this.memberInitData.set(this.buildMemberOptions(member));
			} else if (this.isEditMode()) {
				throw new Error('Member not found');
			}
		} catch (error) {
			console.error(error);
			this.loadFailed.set(true);
			this.notificationService.showSnackbar(
				this.translateService.translate('ROOM_MEMBERS.ERRORS.ROOM_DATA_LOAD_FAILED')
			);
		} finally {
			this.isLoading.set(false);
		}
	}

	onMemberTypeChanged(_type: MemberFormMemberType): void {
		// Form manages its own type state; hook reserved for future analytics.
	}

	async onMemberSubmitted(options: MeetRoomMemberOptions): Promise<void> {
		const delayLoader = setTimeout(() => {
			this.isSaving.set(true);
			// 保存期间禁用遮罩/X/ESC 关闭，等价原 dialogRef.disableClose = true（三锁）。
			// ESC 锁键名为 nzKeyboard（默认 true=ESC 可关），与 rooms.component.ts 等先例一致。
			this.nzModalRef.updateConfig({ nzMaskClosable: false, nzClosable: false, nzKeyboard: false });
		}, 200);

		try {
			if (this.isEditMode() && this.data.memberId) {
				await this.roomMemberService.updateRoomMember(this.data.roomId, this.data.memberId, {
					baseRole: options.baseRole,
					customPermissions: options.customPermissions ?? {}
				});
				this.notificationService.showSnackbar(
					this.translateService.translate('ROOM_MEMBERS.ERRORS.MEMBER_UPDATED_SUCCESS')
				);
			} else {
				await this.roomMemberService.createRoomMember(this.data.roomId, options);
				this.notificationService.showSnackbar(
					this.translateService.translate('ROOM_MEMBERS.ERRORS.MEMBER_ADDED_SUCCESS')
				);
			}
			this.nzModalRef.close(true);
		} catch (error) {
			const msg = this.isEditMode()
				? this.translateService.translate('ROOM_MEMBERS.ERRORS.MEMBER_UPDATE_FAILED')
				: this.translateService.translate('ROOM_MEMBERS.ERRORS.MEMBER_ADD_FAILED');
			this.notificationService.showSnackbar(msg);
			console.error(error);
		} finally {
			clearTimeout(delayLoader);
			this.isSaving.set(false);
			this.nzModalRef.updateConfig({ nzMaskClosable: true, nzClosable: true, nzKeyboard: true });
		}
	}

	onCancelled(): void {
		this.nzModalRef.close(false);
	}

	onClose(): void {
		this.nzModalRef.close(false);
	}

	private buildMemberOptions(member: MeetRoomMember): MeetRoomMemberOptions {
		const isUser = RoomMemberUiUtils.isUserMember(member);
		return {
			...(isUser ? { userId: member.memberId } : { name: member.name }),
			baseRole: member.baseRole,
			customPermissions: member.customPermissions
		};
	}
}

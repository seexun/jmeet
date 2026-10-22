import { Clipboard } from '@angular/cdk/clipboard';
import { DatePipe } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	OnDestroy,
	OnInit,
	computed,
	inject,
	signal,
	viewChild
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzIconTypePipe } from '../../../../shared/pipes/nz-icon-type.pipe';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
	MeetRoom,
	MeetRoomDeletionSuccessCode,
	MeetRoomMember,
	MeetRoomMemberFilters,
	MeetRoomStatus,
	MeetUserRole,
	SortOrder,
	TextMatchMode
} from '@openvidu-meet/typings';
import { BreadcrumbService } from '../../../../shared/services/breadcrumb.service';
import {
	JmeetLoadingSkeletonComponent,
	JmeetPageHeaderComponent,
	JmeetStatusTagComponent,
	JmeetStatusTagVariant
} from '../../../../shared/components';
import { ScrollPersistDirective } from '../../../../shared/directives/scroll-persist.directive';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { TranslateService } from '../../../../shared/services/i18n/translate.service';
import { DialogPresetsService } from '../../../../shared/services/dialog-presets.service';
import { ListStateCacheService } from '../../../../shared/services/list-state-cache.service';
import { NavigationService } from '../../../../shared/services/navigation.service';
import { NotificationService, DIALOG_WIDTH } from '../../../../shared/services/notification.service';
import { AuthService } from '../../../auth/services/auth.service';
import { UserService } from '../../../users/services/user.service';
import { ILogger, LoggerService } from '../../../meeting/openvidu-components';
import {
	MemberTableAction,
	MemberTableFilter,
	RoomMembersListsComponent
} from '../../../room-members/components/room-members-list/room-members-list.component';
import { RoomMemberDialogComponent } from '../../../room-members/components/room-member-dialog/room-member-dialog.component';
import { RoomMemberService } from '../../../room-members/services/room-member.service';
import { RoomShareDialogComponent } from '../../components/room-share-dialog/room-share-dialog.component';
import { RoomDeletionService } from '../../services/room-deletion.service';
import { RoomService } from '../../services/room.service';
import { RoomUiUtils } from '../../utils/ui';

/** Cached UI state for the room detail page, restored on return. */
interface RoomDetailCachedState {
	room: MeetRoom;
	members: MeetRoomMember[];
	memberFilters: MemberTableFilter;
	scrollTop: number;
}

@Component({
	selector: 'ov-room-detail',
	imports: [
		DatePipe,
		NzIconModule, NzIconTypePipe,
		NzDropDownModule,
		NzTooltipModule,
		RouterModule,
		JmeetLoadingSkeletonComponent,
		JmeetPageHeaderComponent,
		JmeetStatusTagComponent,
		RoomMembersListsComponent,
		ScrollPersistDirective,
		TranslatePipe,
		NzMenuModule
	],
	templateUrl: './room-detail.component.html',
	styleUrl: './room-detail.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoomDetailComponent implements OnInit, OnDestroy {
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly listStateCache = inject(ListStateCacheService);
	private readonly authService = inject(AuthService);
	private readonly roomService = inject(RoomService);
	private readonly roomDeletionService = inject(RoomDeletionService);
	private readonly roomMemberService = inject(RoomMemberService);
	private readonly notificationService = inject(NotificationService);
	private readonly userService = inject(UserService);
	private readonly dialogPresetsService = inject(DialogPresetsService);
	private readonly translateService = inject(TranslateService);
	protected readonly navigationService = inject(NavigationService);
	private readonly breadcrumbService = inject(BreadcrumbService);
	private readonly clipboard = inject(Clipboard);
	private readonly loggerService = inject(LoggerService);
	protected readonly log: ILogger = this.loggerService.get('JMeet - RoomDetailComponent');

	private readonly scroller = viewChild(ScrollPersistDirective);
	/** Scroll position to restore on the page container (set when restoring cached state). */
	protected scrollToRestore = 0;

	protected readonly MeetUserRole = MeetUserRole;

	currentUserId = signal<string>('');
	currentUserRole = signal<MeetUserRole | undefined>(undefined);
	canManageRoom = computed(() => {
		const room = this.room();
		if (!room) return false;
		return RoomUiUtils.canManageRoom(room, this.currentUserId(), this.currentUserRole());
	});

	roomId = signal('');
	room = signal<MeetRoom | undefined>(undefined);
	ownerDisplayName = signal('');
	isInitializing = signal(true);
	showInitialLoader = signal(false);

	// Room Members（全量拉取+客户端分页；数据量大时回改服务端分页）
	roomMembers = signal<MeetRoomMember[]>([]);
	loadingMembers = signal(false);
	initialMemberFilters = signal<MemberTableFilter>({
		nameFilter: '',
		nameMatchMode: TextMatchMode.PREFIX,
		nameCaseInsensitive: false,
		baseRole: '',
		type: '',
		sortField: 'membershipDate',
		sortOrder: SortOrder.DESC
	});

	// Track current active filters so deletions can trigger auto-load
	private currentMemberFilters: MemberTableFilter = this.initialMemberFilters();
	private membersDataLoaded = false;

	creationDateFormat = computed(() =>
		this.translateService.selectedLanguageOption().lang === 'cn' ? 'yyyy年M月d日' : 'mediumDate'
	);
	creationTimeFormat = computed(() =>
		this.translateService.selectedLanguageOption().lang === 'cn' ? 'HH:mm' : 'shortTime'
	);

	MeetRoomStatus = MeetRoomStatus;
	protected readonly RoomUiUtils = RoomUiUtils;

	roomStatusVariant(room: MeetRoom): JmeetStatusTagVariant {
		switch (RoomUiUtils.getWorkspaceDisplayStatus(room)) {
			case 'ended':
				return 'default';
			case 'live':
				return 'processing';
			case 'not_started':
				return 'warning';
			default:
				return 'success';
		}
	}

	async ngOnInit() {
		// Capture the navigation trigger synchronously, before any await finalizes the navigation.
		const isBackNavigation = this.navigationService.isPopStateNavigation();

		const roomId = this.route.snapshot.paramMap.get('room-id');
		if (!roomId) {
			await this.navigationService.navigateTo('/rooms');
			return;
		}

		this.roomId.set(roomId);

		this.breadcrumbService.set([
			{
				label: this.translateService.translate('ROOMS.DETAIL.BREADCRUMB_ROOMS'),
				action: () => this.navigationService.navigateTo('/rooms')
			},
			{
				label: roomId
			}
		]);

		const [userId, role] = await Promise.all([this.authService.getUserId(), this.authService.getUserRole()]);
		this.currentUserId.set(userId ?? '');
		this.currentUserRole.set(role);

		// Restore cached state only when navigating *back* (browser back/forward), e.g.
		// from a member edit page. Opening this room afresh (clicking it) loads fresh data.
		const cached = this.listStateCache.get<RoomDetailCachedState>(this.cacheKey());
		if (cached && isBackNavigation) {
			this.room.set(cached.room);
			this.updateBreadcrumb(cached.room);
			this.roomMembers.set(cached.members);
			this.currentMemberFilters = cached.memberFilters;
			this.initialMemberFilters.set(cached.memberFilters);
			this.membersDataLoaded = true;
			this.scrollToRestore = cached.scrollTop; // applied by ScrollPersistDirective once rendered
			void this.loadOwnerDisplayName(cached.room.owner);
			this.isInitializing.set(false);
			await this.maybeOpenMemberDialogFromQuery();
			return;
		}

		const delayLoader = setTimeout(() => {
			this.showInitialLoader.set(true);
		}, 200);

		await this.loadRoomDetails();
		await this.ensureMembersLoaded();

		clearTimeout(delayLoader);
		this.showInitialLoader.set(false);
		this.isInitializing.set(false);
		await this.maybeOpenMemberDialogFromQuery();
	}

	ngOnDestroy() {
		const room = this.room();
		// Only cache once the room has loaded; nothing useful to restore otherwise.
		if (!room) return;

		this.listStateCache.set<RoomDetailCachedState>(this.cacheKey(), {
			room,
			members: this.roomMembers(),
			memberFilters: this.currentMemberFilters,
			scrollTop: this.scroller()?.scrollTop ?? 0
		});
	}

	private cacheKey(): string {
		return `rooms/${this.roomId()}`;
	}

	// --- Room management ---

	private async loadRoomDetails() {
		try {
			const room = await this.roomService.getRoom(this.roomId());
			this.room.set(room);
			this.updateBreadcrumb(room);
			await this.loadOwnerDisplayName(room.owner);
		} catch (error) {
			this.log.e('Error loading room details:', error);
			this.notificationService.showSnackbar(
				this.translateService.translate('ROOMS.ERRORS.FAILED_LOAD_ROOM_DETAILS')
			);
			await this.navigationService.navigateTo('/rooms');
		}
	}

	async accessRoom() {
		const room = this.room()!;
		window.open(room.access.user.url, '_blank');
	}

	copyRoomId(): void {
		// 对外展示/复制一律用数字会议号（meetingCode）；房间未加载时兜底内部 ID
		const code = this.room()?.meetingCode || this.roomId();
		if (this.clipboard.copy(code)) {
			this.notificationService.showSnackbar(
				this.translateService.translate('ROOMS.DETAIL.COPY_ROOM_ID_SUCCESS')
			);
		}
	}

	ownerInitials(): string {
		return RoomUiUtils.getDisplayInitials(this.ownerDisplayName() || this.room()?.owner || '');
	}

	ownerLabel(): string {
		return this.ownerDisplayName() || this.room()?.owner || '';
	}

	private updateBreadcrumb(room: MeetRoom): void {
		this.breadcrumbService.set([
			{
				label: this.translateService.translate('ROOMS.DETAIL.BREADCRUMB_ROOMS'),
				action: () => this.navigationService.navigateTo('/rooms')
			},
			{
				label: room.roomName
			}
		]);
	}

	private async loadOwnerDisplayName(ownerId: string): Promise<void> {
		if (ownerId === this.currentUserId()) {
			try {
				const me = await this.userService.getMe();
				this.ownerDisplayName.set(me.name || me.loginName || ownerId);
				return;
			} catch {
				this.ownerDisplayName.set(this.shortUserId(ownerId));
				return;
			}
		}
		if (this.currentUserRole() === MeetUserRole.ADMIN) {
			try {
				const user = await this.userService.getUser(ownerId);
				this.ownerDisplayName.set(user.name || user.loginName || ownerId);
				return;
			} catch {
				this.ownerDisplayName.set(this.shortUserId(ownerId));
				return;
			}
		}
		this.ownerDisplayName.set(this.shortUserId(ownerId));
	}

	private shortUserId(userId: string): string {
		return userId.length > 12 ? `${userId.slice(0, 8)}…` : userId;
	}

	private async ensureMembersLoaded(): Promise<void> {
		if (this.membersDataLoaded || !this.canManageRoom()) return;
		this.membersDataLoaded = true;
		await this.loadRoomMembers(this.initialMemberFilters());
	}

	shareLink() {
		const room = this.room()!;
		// 原弹窗默认行为：点遮罩/ESC 可关、无右上角 X（nzClosable: false）。
		this.notificationService.openModal({
			nzContent: RoomShareDialogComponent,
			nzData: { access: room.access, roomId: room.roomId, canManageRoom: this.canManageRoom() },
			nzWidth: DIALOG_WIDTH.standard,
			nzClosable: false
		});
	}

	async editRoom() {
		const room = this.room()!;
		await this.navigationService.navigateTo(`/rooms/${room.roomId}/edit`);
	}

	async toggleRoomStatus() {
		const room = this.room()!;

		if (room.status !== MeetRoomStatus.CLOSED) {
			await this.closeRoom();
		} else {
			await this.reopenRoom();
		}
	}

	private async reopenRoom() {
		try {
			const updatedRoom = await this.roomService.updateRoomStatus(this.roomId(), MeetRoomStatus.OPEN);
			this.room.set(updatedRoom);
			this.notificationService.showSnackbar(this.translateService.translate('ROOMS.ERRORS.ROOM_REOPENED'));
		} catch (error) {
			this.notificationService.showSnackbar(this.translateService.translate('ROOMS.ERRORS.FAILED_REOPEN_ROOM'));
			this.log.e('Error reopening room:', error);
		}
	}

	private async closeRoom() {
		try {
			const updatedRoom = await this.roomService.updateRoomStatus(this.roomId(), MeetRoomStatus.CLOSED);
			this.room.set(updatedRoom);

			// The close is applied immediately unless a meeting is still active, in which case
			// it is scheduled to take effect when the meeting ends.
			const message =
				updatedRoom.status === MeetRoomStatus.CLOSED
					? this.translateService.translate('ROOMS.ERRORS.ROOM_CLOSED')
					: this.translateService.translate('ROOMS.ERRORS.ROOM_SCHEDULED_CLOSE');
			this.notificationService.showSnackbar(message);
		} catch (error) {
			this.notificationService.showSnackbar(this.translateService.translate('ROOMS.ERRORS.FAILED_CLOSE_ROOM'));
			this.log.e('Error closing room:', error);
		}
	}

	deleteRoom() {
		this.roomDeletionService.deleteRoomWithConfirmation({
			roomId: this.roomId(),
			log: this.log,
			onSuccess: async ({ successCode, message, room: updatedRoom }) => {
				await this.handleSuccessfulDeletion(successCode, message, updatedRoom);
			}
		});
	}

	private async handleSuccessfulDeletion(
		successCode: MeetRoomDeletionSuccessCode,
		message: string,
		updatedRoom?: MeetRoom
	) {
		if (updatedRoom) {
			// Room was not deleted but updated (e.g., closed due to active meeting)
			if (successCode === MeetRoomDeletionSuccessCode.ROOM_WITH_ACTIVE_MEETING_CLOSED) {
				updatedRoom.status = MeetRoomStatus.CLOSED;
			}

			this.room.set(updatedRoom);
		} else {
			// Room was deleted, navigate back to the rooms list (refreshed so the deleted room is gone)
			await this.navigationService.navigateToAndInvalidate('/rooms', 'rooms');
		}

		this.notificationService.showSnackbar(this.roomDeletionService.removeRoomIdFromMessage(message));
	}

	// --- Room Members management ---

	private async loadRoomMembers(filters: MemberTableFilter) {
		this.currentMemberFilters = filters;
		const delayLoader = setTimeout(() => {
			this.loadingMembers.set(true);
		}, 200);

		// 全量拉取+客户端分页：循环拉取游标页直至 nextPageToken 耗尽（每批 50 条）；
		// 数据量大时回改服务端分页。
		const members: MeetRoomMember[] = [];
		let nextPageToken: string | undefined;
		try {
			do {
				const memberFilters: MeetRoomMemberFilters = {
					maxItems: 50,
					nextPageToken,
					sortField: filters.sortField,
					sortOrder: filters.sortOrder
				};

				// Apply member name filter if provided
				if (filters.nameFilter) {
					memberFilters.name = filters.nameFilter;
					memberFilters.nameMatchMode = filters.nameMatchMode;
					memberFilters.nameCaseInsensitive = filters.nameCaseInsensitive || undefined;
				}

				// Apply base role filter if provided
				if (filters.baseRole) {
					memberFilters.baseRole = filters.baseRole;
				}

				// Apply member type filter if provided
				if (filters.type) {
					memberFilters.type = filters.type;
				}

				const response = await this.roomMemberService.listRoomMembers(this.roomId(), memberFilters);
				members.push(...response.members);
				nextPageToken = response.pagination.nextPageToken;
			} while (nextPageToken);

			this.roomMembers.set(members);
		} catch (error) {
			// 循环拉取失败：中断拉取、保留已得数据（不降级 load-more），沿用既有错误呈现。
			if (members.length > 0) {
				this.roomMembers.set(members);
			}
			this.log.e('Error loading room members:', error);
			this.notificationService.showSnackbar('Failed to load room members');
		} finally {
			clearTimeout(delayLoader);
			this.loadingMembers.set(false);
		}
	}

	async refreshRoomMembers(filters: MemberTableFilter) {
		await this.loadRoomMembers(filters);
	}

	async onMemberAction(action: MemberTableAction) {
		switch (action.action) {
			case 'addMember':
				await this.addMember();
				break;
			case 'edit':
				await this.editMember(action.members[0]);
				break;
			case 'copyLink':
				this.copyMemberLink(action.members[0]);
				break;
			case 'delete':
				this.deleteMember(action.members[0]);
				break;
			case 'bulkDelete':
				this.bulkDeleteMembers(action.members);
				break;
		}
	}

	private async addMember() {
		await this.openMemberDialog('add');
	}

	private async editMember(member: MeetRoomMember) {
		await this.openMemberDialog('edit', member.memberId);
	}

	private async openMemberDialog(mode: 'add' | 'edit', memberId?: string): Promise<void> {
		if (!this.canManageRoom()) return;

		const dialogRef = this.notificationService.openModal({
			nzContent: RoomMemberDialogComponent,
			nzData: {
				roomId: this.roomId(),
				mode,
				memberId
			},
			nzWidth: DIALOG_WIDTH.form
		});

		const saved = await firstValueFrom(dialogRef.afterClose);
		if (saved) {
			await this.refreshRoomMembers(this.currentMemberFilters);
		}
	}

	private async maybeOpenMemberDialogFromQuery(): Promise<void> {
		if (!this.canManageRoom()) return;

		const memberDialog = this.route.snapshot.queryParamMap.get('memberDialog');
		if (memberDialog !== 'add' && memberDialog !== 'edit') return;

		const memberId = this.route.snapshot.queryParamMap.get('memberId') ?? undefined;

		void this.router.navigate([], {
			relativeTo: this.route,
			queryParams: { memberDialog: null, memberId: null },
			queryParamsHandling: 'merge',
			replaceUrl: true
		});

		if (memberDialog === 'edit' && !memberId) return;

		await this.openMemberDialog(memberDialog, memberId);
	}

	private copyMemberLink(member: MeetRoomMember) {
		this.clipboard.copy(member.accessUrl);
		this.notificationService.showSnackbar('Member access link copied to clipboard');
	}

	private deleteMember(member: MeetRoomMember) {
		this.notificationService.showDialog({
			...this.dialogPresetsService.getRemoveMemberDialogPreset(member.name, this.shouldShowMeetingKickWarning()),
			confirmCallback: async () => {
				try {
					await this.roomMemberService.deleteRoomMember(this.roomId(), member.memberId);

					// Remove deleted member from the list
					this.roomMembers.set(this.roomMembers().filter((m) => m.memberId !== member.memberId));
					this.notificationService.showSnackbar(`Member "${member.name}" removed successfully`);
				} catch (error) {
					this.log.e('Error removing member:', error);
					this.notificationService.showSnackbar('Failed to remove member');
				}
			}
		});
	}

	private bulkDeleteMembers(members: MeetRoomMember[]) {
		const bulkDeleteCallback = async () => {
			try {
				const memberIds = members.map((m) => m.memberId);
				const { deleted } = await this.roomMemberService.bulkDeleteRoomMembers(this.roomId(), memberIds);

				// Remove deleted members from the list
				this.roomMembers.set(this.roomMembers().filter((m) => !deleted.includes(m.memberId)));
				this.notificationService.showSnackbar(
					`${deleted.length} member${deleted.length > 1 ? 's' : ''} removed successfully`
				);
			} catch (error: any) {
				this.log.e('Error removing members:', error);

				const deleted = (error?.error?.deleted ?? []) as string[];
				const failed = (error?.error?.failed ?? []) as { memberId: string; error: string }[];

				if (failed.length > 0 || deleted.length > 0) {
					if (deleted.length > 0) {
						this.roomMembers.set(this.roomMembers().filter((m) => !deleted.includes(m.memberId)));
					}

					let msg = '';
					if (deleted.length > 0) {
						msg += `${deleted.length} member${deleted.length > 1 ? 's' : ''} removed successfully. `;
					}
					if (failed.length > 0) {
						msg += `${failed.length} member${failed.length > 1 ? 's' : ''} could not be removed.`;
					}

					this.notificationService.showSnackbar(msg.trim());
				} else {
					this.notificationService.showSnackbar('Failed to remove members');
				}
			}
		};

		const count = members.length;
		this.notificationService.showDialog({
			...this.dialogPresetsService.getBulkRemoveMembersDialogPreset(count, this.shouldShowMeetingKickWarning()),
			confirmCallback: bulkDeleteCallback
		});
	}

	private shouldShowMeetingKickWarning(): boolean {
		return this.room()?.status === MeetRoomStatus.ACTIVE_MEETING;
	}
}

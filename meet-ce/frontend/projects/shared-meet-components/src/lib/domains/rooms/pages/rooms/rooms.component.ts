import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { RouterModule } from '@angular/router';
import {
	MeetRoom,
	MeetRoomDeletionPolicyWithMeeting,
	MeetRoomDeletionPolicyWithRecordings,
	MeetRoomDeletionSuccessCode,
	MeetRoomFilters,
	MeetRoomStatus,
	MeetUserRole,
	SortOrder,
	TextMatchMode
} from '@openvidu-meet/typings';
import { ScrollPersistDirective } from '../../../../shared/directives/scroll-persist.directive';
import {
	JmeetEmptyStateComponent,
	JmeetFilterBarComponent,
	JmeetLoadingSkeletonComponent,
	JmeetPageHeaderComponent,
	JmeetPaginationComponent,
	JmeetStatusTagComponent,
	type JmeetStatusTagVariant
} from '../../../../shared/components';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { TranslateService } from '../../../../shared/services/i18n/translate.service';
import { DialogPresetsService } from '../../../../shared/services/dialog-presets.service';
import { ListStateCacheService } from '../../../../shared/services/list-state-cache.service';
import { NavigationService } from '../../../../shared/services/navigation.service';
import { NotificationService, DIALOG_WIDTH } from '../../../../shared/services/notification.service';
import { AuthService } from '../../../auth/services/auth.service';
import { ILogger, LoggerService } from '../../../meeting/openvidu-components';

import { DeleteRoomDialogOptions } from '../../../../shared/models/notification.model';
import { DeleteRoomDialogComponent } from '../../components/delete-room-dialog/delete-room-dialog.component';
import { RoomShareDialogComponent } from '../../components/room-share-dialog/room-share-dialog.component';
import { RoomDeletionService } from '../../services/room-deletion.service';
import { RoomService } from '../../services/room.service';
import { RoomUiUtils } from '../../utils/ui';
import type { RoomTableAction, RoomTableFilter } from '../../models/rooms-table.model';

export type RoomsWorkspaceTab = 'all' | 'upcoming' | 'live' | 'ended';
export type RoomsScopeChip = 'none' | 'owned' | 'member';

interface MeetingRoomGroup {
	key: string;
	labelKind: 'today' | 'tomorrow' | 'yesterday' | 'date' | 'unscheduled';
	sortKey: number;
	rooms: MeetRoom[];
}

/** Cached UI state for the rooms list, restored when navigating back to it. */
interface RoomsListCachedState {
	rooms: MeetRoom[];
	filters: RoomTableFilter;
	scrollTop: number;
	activeTab: RoomsWorkspaceTab;
	scopeChip: RoomsScopeChip;
}

@Component({
	selector: 'ov-rooms',
	imports: [
		JmeetPageHeaderComponent,
		JmeetLoadingSkeletonComponent,
		JmeetFilterBarComponent,
		JmeetEmptyStateComponent,
		JmeetPaginationComponent,
		JmeetStatusTagComponent,

		NzIconModule,
		NzInputModule,
		NzTooltipModule,
		RouterModule,
		ScrollPersistDirective,
		TranslatePipe,
		DatePipe
	],
	templateUrl: './rooms.component.html',
	styleUrl: './rooms.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoomsComponent implements OnInit, OnDestroy {
	private roomService = inject(RoomService);
	private listStateCache = inject(ListStateCacheService);
	private authService = inject(AuthService);
	private notificationService = inject(NotificationService);
	private dialogPresetsService = inject(DialogPresetsService);
	private readonly translateService = inject(TranslateService);
	protected navigationService = inject(NavigationService);
	protected roomDeletionService = inject(RoomDeletionService);
	protected loggerService = inject(LoggerService);
	protected log: ILogger = this.loggerService.get('JMeet - RoomsComponent');

	private static readonly STATE_KEY = 'rooms';

	private readonly scroller = viewChild(ScrollPersistDirective);
	/** Scroll position to restore on the page container (set when restoring cached state). */
	protected scrollToRestore = 0;

	rooms = signal<MeetRoom[]>([]);
	currentUserId = signal<string>('');
	currentUserRole = signal<MeetUserRole | undefined>(undefined);
	protected readonly MeetUserRole = MeetUserRole;
	protected readonly RoomUiUtils = RoomUiUtils;
	protected readonly MeetRoomStatus = MeetRoomStatus;
	readonly workspaceTabs: Array<{ id: RoomsWorkspaceTab; labelKey: string }> = [
		{ id: 'all', labelKey: 'ROOMS.WORKSPACE.TAB_ALL' },
		{ id: 'upcoming', labelKey: 'ROOMS.WORKSPACE.TAB_UPCOMING' },
		{ id: 'live', labelKey: 'ROOMS.WORKSPACE.TAB_LIVE' },
		{ id: 'ended', labelKey: 'ROOMS.WORKSPACE.TAB_ENDED' }
	];
	// 默认聚焦“进行中”,避免历史归档淹没当前可用的会议;“全部”留给回看/搜索
	activeTab = signal<RoomsWorkspaceTab>('live');
	scopeChip = signal<RoomsScopeChip>('none');
	workspaceSearch = signal('');
	joinMeetingValue = signal('');
	visibleRooms = computed(() => {
		let list = this.rooms();
		if (this.activeTab() === 'upcoming') {
			list = list.filter((room) => RoomUiUtils.isUpcomingMeeting(room));
		} else if (this.activeTab() === 'live') {
			list = list.filter((room) => RoomUiUtils.getWorkspaceDisplayStatus(room) === 'live');
		} else if (this.activeTab() === 'ended') {
			list = list.filter((room) => {
				const status = RoomUiUtils.getWorkspaceDisplayStatus(room);
				return status === 'ended' || status === 'expired';
			});
		}
		const query = this.workspaceSearch().trim().toLocaleLowerCase();
		if (!query) {
			return list;
		}
		return list.filter(
			(room) => room.roomName.toLocaleLowerCase().includes(query) || room.roomId.toLocaleLowerCase().includes(query)
		);
	});
	groupedVisibleRooms = computed((): MeetingRoomGroup[] => {
		const groups = new Map<string, MeetingRoomGroup>();
		const todayStart = this.startOfDay(Date.now());

		// 分组消费当前页切片（客户端分页作用于过滤后数据集）。
		for (const room of this.pagedVisibleRooms()) {
			const timestamp = this.displayTimestamp(room);
			let key: string;
			let labelKind: MeetingRoomGroup['labelKind'];
			let sortKey: number;

			if (timestamp === undefined) {
				key = 'unscheduled';
				labelKind = 'unscheduled';
				sortKey = Number.MAX_SAFE_INTEGER;
			} else {
				const dayStart = this.startOfDay(timestamp);
				key = `day-${dayStart}`;
				sortKey = dayStart;
				const dayOffset = Math.round((dayStart - todayStart) / 86_400_000);
				if (dayOffset === 0) {
					labelKind = 'today';
				} else if (dayOffset === 1) {
					labelKind = 'tomorrow';
				} else if (dayOffset === -1) {
					labelKind = 'yesterday';
				} else {
					labelKind = 'date';
				}
			}

			if (!groups.has(key)) {
				groups.set(key, { key, labelKind, sortKey, rooms: [] });
			}
			groups.get(key)!.rooms.push(room);
		}

		return Array.from(groups.values())
			.map((group) => ({
				...group,
				rooms: [...group.rooms].sort(
					(a, b) => (this.displayTimestamp(a) ?? 0) - (this.displayTimestamp(b) ?? 0)
				)
			}))
			.sort((a, b) => {
				if (a.labelKind === 'unscheduled') return 1;
				if (b.labelKind === 'unscheduled') return -1;
				return b.sortKey - a.sortKey;
			});
	});
	emptyStateTitleKey = computed(() => {
		if (this.workspaceSearch().trim()) {
			return 'ROOMS.WORKSPACE.EMPTY_SEARCH_TITLE';
		}
		switch (this.activeTab()) {
			case 'upcoming':
				return 'ROOMS.WORKSPACE.EMPTY_UPCOMING_TITLE';
			case 'live':
				return 'ROOMS.WORKSPACE.EMPTY_LIVE_TITLE';
			case 'ended':
				return 'ROOMS.WORKSPACE.EMPTY_ENDED_TITLE';
			default:
				return 'ROOMS.WORKSPACE.EMPTY_TITLE';
		}
	});
	emptyStateDescKey = computed(() => {
		if (this.workspaceSearch().trim()) {
			return 'ROOMS.WORKSPACE.EMPTY_SEARCH_DESC';
		}
		switch (this.activeTab()) {
			case 'upcoming':
				return 'ROOMS.WORKSPACE.EMPTY_UPCOMING_DESC';
			case 'live':
				return 'ROOMS.WORKSPACE.EMPTY_LIVE_DESC';
			case 'ended':
				return 'ROOMS.WORKSPACE.EMPTY_ENDED_DESC';
			default:
				return 'ROOMS.WORKSPACE.EMPTY_DESC';
		}
	});
	canShowHostedScope = computed(() => this.currentUserRole() !== MeetUserRole.ROOM_MEMBER);
	readonly todayLabel = computed(() =>
		new Intl.DateTimeFormat(
			this.translateService.selectedLanguageOption().lang === 'cn' ? 'zh-CN' : 'en-US',
			{ month: 'long', day: 'numeric', weekday: 'long' }
		).format(new Date())
	);

	// Loading state
	isInitializing = signal(true);
	showInitialLoader = signal(false);
	isLoading = signal(false);

	initialFilters = signal<RoomTableFilter>({
		nameFilter: '',
		nameMatchMode: TextMatchMode.PREFIX,
		nameCaseInsensitive: false,
		statusFilter: '',
		sortField: 'creationDate',
		sortOrder: SortOrder.DESC,
		ownerFilter: '',
		memberFilter: '',
		showOwnedRooms: false,
		showMemberRooms: false,
		showUserAccessRooms: false
	});

	// Pagination（全量拉取+客户端分页：可见房间 10/页切片，分组消费切片；数据量大时回改服务端分页）
	pageIndex = signal(0);
	pageSize = signal(10);
	pagedVisibleRooms = computed(() => {
		const start = this.pageIndex() * this.pageSize();
		return this.visibleRooms().slice(start, start + this.pageSize());
	});

	// Track current active filters so deletions can trigger auto-load
	private currentFilters: RoomTableFilter = this.initialFilters();

	async ngOnInit() {
		// Capture the navigation trigger synchronously, before any await finalizes the navigation.
		const isBackNavigation = this.navigationService.isPopStateNavigation();

		const [userId, role] = await Promise.all([this.authService.getUserId(), this.authService.getUserRole()]);
		this.currentUserId.set(userId ?? '');
		this.currentUserRole.set(role);

		// Restore previously cached state (filters, sort, loaded pages, scroll) only when
		// navigating *back* (browser back/forward). An explicit navigation to this page
		// (clicking the menu/link) loads fresh data so changes by others are reflected.
		const cached = this.listStateCache.get<RoomsListCachedState>(RoomsComponent.STATE_KEY);
		if (cached && isBackNavigation) {
			this.rooms.set(cached.rooms);
			this.currentFilters = cached.filters;
			this.initialFilters.set(cached.filters);
			this.activeTab.set(cached.activeTab ?? 'all');
			this.scopeChip.set(cached.scopeChip ?? 'none');
			this.scrollToRestore = cached.scrollTop;
			this.isInitializing.set(false);
			return;
		}

		const delayLoader = setTimeout(() => {
			this.showInitialLoader.set(true);
		}, 200);

		await this.refreshRooms(this.buildFilters());

		clearTimeout(delayLoader);
		this.showInitialLoader.set(false);
		this.isInitializing.set(false);
	}

	ngOnDestroy() {
		this.listStateCache.set<RoomsListCachedState>(RoomsComponent.STATE_KEY, {
			rooms: this.rooms(),
			filters: this.currentFilters,
			scrollTop: this.scroller()?.scrollTop ?? 0,
			activeTab: this.activeTab(),
			scopeChip: this.scopeChip()
		});
	}

	constructor() {
		// 数据集变化（切 tab/改 scope/搜索/刷新）后页码越界时回到第一页，避免空页。
		effect(() => {
			const maxPageIndex = Math.max(0, Math.ceil(this.visibleRooms().length / this.pageSize()) - 1);
			if (this.pageIndex() > maxPageIndex) {
				this.pageIndex.set(0);
			}
		});
	}

	onPageChange(change: { pageIndex: number; pageSize: number }): void {
		this.pageIndex.set(change.pageIndex);
		this.pageSize.set(change.pageSize);
	}

	buildFilters(): RoomTableFilter {
		let statusFilter: MeetRoomStatus | '' = '';
		switch (this.activeTab()) {
			case 'upcoming':
				statusFilter = MeetRoomStatus.OPEN;
				break;
			case 'live':
				statusFilter = MeetRoomStatus.ACTIVE_MEETING;
				break;
			case 'ended':
				statusFilter = MeetRoomStatus.CLOSED;
				break;
		}

		const scope = this.scopeChip();
		return {
			nameFilter: '',
			nameMatchMode: TextMatchMode.PREFIX,
			nameCaseInsensitive: false,
			statusFilter,
			sortField: 'creationDate',
			sortOrder: SortOrder.DESC,
			ownerFilter: '',
			memberFilter: '',
			showOwnedRooms: scope === 'owned',
			showMemberRooms: scope === 'member',
			showUserAccessRooms: false
		};
	}

	async onWorkspaceTabChange(tab: RoomsWorkspaceTab) {
		if (this.activeTab() === tab) {
			return;
		}
		this.activeTab.set(tab);
		await this.refreshRooms(this.buildFilters());
	}

	async onScopeChipChange(chip: Exclude<RoomsScopeChip, 'none'>) {
		this.scopeChip.update((current) => (current === chip ? 'none' : chip));
		await this.refreshRooms(this.buildFilters());
	}

	displayTimestamp(room: MeetRoom): number | undefined {
		return RoomUiUtils.getWorkspaceDisplayTimestamp(room);
	}

	groupLabel(group: MeetingRoomGroup): string {
		switch (group.labelKind) {
			case 'today':
				return this.translateService.translate('ROOMS.WORKSPACE.GROUP_TODAY');
			case 'tomorrow':
				return this.translateService.translate('ROOMS.WORKSPACE.GROUP_TOMORROW');
			case 'yesterday':
				return this.translateService.translate('ROOMS.WORKSPACE.GROUP_YESTERDAY');
			case 'unscheduled':
				return this.translateService.translate('ROOMS.WORKSPACE.GROUP_UNSCHEDULED');
			case 'date':
				return new Intl.DateTimeFormat(this.translateService.selectedLanguageOption().lang, {
					month: 'long',
					day: 'numeric',
					weekday: 'short'
				}).format(group.sortKey);
		}
	}

	private startOfDay(timestamp: number): number {
		const date = new Date(timestamp);
		date.setHours(0, 0, 0, 0);
		return date.getTime();
	}

	workspaceStatusClass(room: MeetRoom): string {
		return RoomUiUtils.getWorkspaceDisplayStatus(room);
	}

	workspaceStatusVariant(room: MeetRoom): JmeetStatusTagVariant {
		switch (RoomUiUtils.getWorkspaceDisplayStatus(room)) {
			case 'ended':
			case 'expired':
				return 'default';
			case 'live':
				return 'processing';
			case 'not_started':
				return 'warning';
			default:
				return 'success';
		}
	}

	async onRoomAction(action: RoomTableAction) {
		switch (action.action) {
			case 'create':
				await this.createRoom();
				break;
			case 'access':
				this.accessRoom(action.rooms[0]);
				break;
			case 'edit':
				await this.editRoomConfig(action.rooms[0]);
				break;
			case 'shareLink':
				this.shareLink(action.rooms[0]);
				break;
			case 'reopen':
				this.reopenRoom(action.rooms[0]);
				break;
			case 'close':
				this.closeRoom(action.rooms[0]);
				break;
			case 'delete':
				this.deleteRoom(action.rooms[0]);
				break;
			case 'bulkDelete':
				this.bulkDeleteRooms(action.rooms);
				break;
		}
	}

	onWorkspaceSearch(event: Event) {
		this.workspaceSearch.set((event.target as HTMLInputElement).value);
	}

	onJoinValueChange(event: Event) {
		this.joinMeetingValue.set((event.target as HTMLInputElement).value);
	}

	async joinMeeting(meetingValue: string) {
		const value = meetingValue.trim();
		if (!value) return;

		// Numeric input (9-12 digits, separators tolerated) is a meeting code: resolve it
		// to the roomId first. Everything else keeps the legacy link/roomId passthrough.
		const digits = value.replace(/[^0-9]/g, '');
		if (/^[0-9]{9,12}$/.test(digits)) {
			try {
				const room = await this.roomService.getRoomByMeetingCode(digits);
				await this.navigationService.navigateTo(`/room/${room.roomId}`);
			} catch {
				this.notificationService.showSnackbar(this.translateService.translate('ROOMS.WORKSPACE.JOIN_CODE_NOT_FOUND'));
			}
			return;
		}

		const roomId = value.split('?')[0].replace(/\/$/, '').split('/').pop();
		if (roomId) await this.navigationService.navigateTo(`/room/${roomId}`);
	}

	private async loadRooms(filters: RoomTableFilter) {
		this.currentFilters = filters;
		const delayLoader = setTimeout(() => {
			this.isLoading.set(true);
		}, 200);

		// 全量拉取+客户端分页：循环拉取游标页直至 nextPageToken 耗尽（每批 50 条）；
		// 数据量大时回改服务端分页。
		const rooms: MeetRoom[] = [];
		let nextPageToken: string | undefined;
		try {
			do {
				const roomFilters: MeetRoomFilters = {
					maxItems: 50,
					nextPageToken,
					sortField: filters.sortField,
					sortOrder: filters.sortOrder
				};

				// Apply room name filter if provided
				if (filters.nameFilter) {
					roomFilters.roomName = filters.nameFilter;
					roomFilters.roomNameMatchMode = filters.nameMatchMode;
					roomFilters.roomNameCaseInsensitive = filters.nameCaseInsensitive || undefined;
				}

				// Apply status filter if provided
				if (filters.statusFilter) {
					roomFilters.status = filters.statusFilter as MeetRoomStatus;
				}

				// Apply access-scope filters based on user role
				const role = this.currentUserRole();
				const userId = this.currentUserId();

				if (role === MeetUserRole.ADMIN) {
					// For ADMIN: direct filter pass-through — results are narrowed to rooms matching any selected criterion
					if (filters.ownerFilter) roomFilters.owner = filters.ownerFilter;
					if (filters.memberFilter) roomFilters.member = filters.memberFilter;
					if (filters.showUserAccessRooms) roomFilters.userAccess = true;
				} else if (userId) {
					// For ROOM_MANAGER/ROOM_MEMBER: scope selectors bound to the current user's identity
					if (filters.showOwnedRooms) roomFilters.owner = userId;
					if (filters.showMemberRooms) roomFilters.member = userId;
					if (filters.showUserAccessRooms) roomFilters.userAccess = true;
				}

				const response = await this.roomService.listRooms(roomFilters);
				rooms.push(...response.rooms);
				nextPageToken = response.pagination.nextPageToken;
			} while (nextPageToken);

			this.rooms.set(rooms);
		} catch (error) {
			// 循环拉取失败：中断拉取、保留已得数据（不降级 load-more），沿用既有错误呈现。
			if (rooms.length > 0) {
				this.rooms.set(rooms);
			}
			this.notificationService.showSnackbar(this.translateService.translate('ROOMS.ERRORS.LOADING_ROOMS'));
			this.log.e('Error loading rooms:', error);
		} finally {
			clearTimeout(delayLoader);
			this.isLoading.set(false);
		}
	}

	async refreshRooms(filters: RoomTableFilter) {
		await this.loadRooms(filters);
	}

	private async createRoom() {
		try {
			await this.navigationService.navigateTo('/rooms/new');
		} catch (error) {
			this.notificationService.showSnackbar(this.translateService.translate('ROOMS.ERRORS.CREATING_ROOM'));
			this.log.e('Error creating room:', error);
			return;
		}
	}

	creatingQuickMeeting = signal(false);

	/// 一键快速会议：以默认配置创建房间并直接进入
	async quickMeeting() {
		if (this.creatingQuickMeeting()) return;
		this.creatingQuickMeeting.set(true);
		try {
			const room = await this.roomService.createRoom({
				roomName: this.translateService.translate('ROOMS.WORKSPACE.QUICK_ROOM_NAME')
			});
			await this.navigationService.navigateTo(`/room/${room.roomId}`);
		} catch (error) {
			this.log.e('Error creating quick meeting:', error);
			this.notificationService.showSnackbar(this.translateService.translate('ROOMS.ERRORS.CREATING_ROOM'));
		} finally {
			this.creatingQuickMeeting.set(false);
		}
	}

	private accessRoom({ access }: MeetRoom) {
		window.open(access.user.url, '_blank');
	}

	private async editRoomConfig(room: MeetRoom) {
		try {
			await this.navigationService.navigateTo(`/rooms/${room.roomId}/edit`);
		} catch (error) {
			this.notificationService.showSnackbar(this.translateService.translate('ROOMS.ERRORS.NAVIGATING_ROOM_CONFIG'));
			this.log.e('Error navigating to room config:', error);
		}
	}

	private shareLink(room: MeetRoom) {
		const canManageRoom = RoomUiUtils.canManageRoom(room, this.currentUserId(), this.currentUserRole());
		// 原弹窗默认行为：点遮罩/ESC 可关、无右上角 X（nzClosable: false）。
		this.notificationService.openModal({
			nzContent: RoomShareDialogComponent,
			nzData: { access: room.access, roomId: room.roomId, canManageRoom },
			nzWidth: DIALOG_WIDTH.standard,
			nzClosable: false
		});
	}

	async onRoomClick(roomId: string) {
		try {
			await this.navigationService.navigateTo(`/rooms/${roomId}`);
		} catch (error) {
			this.notificationService.showSnackbar(this.translateService.translate('ROOMS.ERRORS.NAVIGATING_ROOM_DETAIL'));
			this.log.e('Error navigating to room detail:', error);
		}
	}

	private async reopenRoom(room: MeetRoom) {
		try {
			const updatedRoom = await this.roomService.updateRoomStatus(room.roomId, MeetRoomStatus.OPEN);

			// Update room in the list
			this.rooms.set(this.rooms().map((r) => (r.roomId === updatedRoom.roomId ? updatedRoom : r)));
			this.notificationService.showSnackbar(this.translateService.translate('ROOMS.ERRORS.ROOM_REOPENED'));
		} catch (error) {
			this.notificationService.showSnackbar(this.translateService.translate('ROOMS.ERRORS.FAILED_REOPEN_ROOM'));
			this.log.e('Error reopening room:', error);
		}
	}

	private async closeRoom(room: MeetRoom) {
		try {
			const updatedRoom = await this.roomService.updateRoomStatus(room.roomId, MeetRoomStatus.CLOSED);

			// Update room in the list
			this.rooms.set(this.rooms().map((r) => (r.roomId === updatedRoom.roomId ? updatedRoom : r)));

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

	private deleteRoom({ roomId }: MeetRoom) {
		this.roomDeletionService.deleteRoomWithConfirmation({
			roomId,
			log: this.log,
			onSuccess: async ({ room: updatedRoom, successCode, message }) => {
				await this.handleSuccessfulDeletion(roomId, successCode, message, updatedRoom);
			}
		});
	}

	private async handleSuccessfulDeletion(
		roomId: string,
		successCode: MeetRoomDeletionSuccessCode,
		message: string,
		updatedRoom?: MeetRoom
	) {
		if (updatedRoom) {
			// Room was not deleted, but updated (e.g., scheduled for deletion)
			if (successCode === MeetRoomDeletionSuccessCode.ROOM_WITH_ACTIVE_MEETING_CLOSED) {
				updatedRoom.status = MeetRoomStatus.CLOSED;
			}

			this.rooms.set(this.rooms().map((r) => (r.roomId === updatedRoom.roomId ? updatedRoom : r)));
		} else {
			// Room was deleted, remove from list
			this.rooms.set(this.rooms().filter((r) => r.roomId !== roomId));
		}

		this.notificationService.showSnackbar(this.roomDeletionService.removeRoomIdFromMessage(message));
	}

	private bulkDeleteRooms(rooms: MeetRoom[]) {
		const bulkDeleteCallback = async () => {
			try {
				const roomIds = rooms.map((r) => r.roomId);
				const { message, deleted } = await this.roomService.bulkDeleteRooms(
					roomIds,
					MeetRoomDeletionPolicyWithMeeting.FAIL,
					MeetRoomDeletionPolicyWithRecordings.FAIL
				);

				this.handleSuccessfulBulkDeletion(deleted);
				this.notificationService.showSnackbar(message);
			} catch (error: any) {
				// Check if it's a structured error with failed rooms
				const failed = error.error?.failed as { roomId: string; error: string; message: string }[];
				const deleted = error.error?.deleted;
				const errorMessage = error.error?.message;

				if (failed) {
					this.handleSuccessfulBulkDeletion(deleted);

					const hasRoomDeletionError = failed.some((result) =>
						this.roomDeletionService.isValidDeletionErrorCode(result.error)
					);
					if (hasRoomDeletionError) {
						this.showBulkDeletionErrorDialogWithOptions(failed, errorMessage);
					} else {
						this.notificationService.showSnackbar(errorMessage);
						this.log.e('Error in bulk delete:', failed);
					}
				} else {
					this.notificationService.showSnackbar(this.translateService.translate('ROOMS.ERRORS.FAILED_DELETE_ROOMS'));
					this.log.e('Error in bulk delete:', error);
				}
			}
		};

		this.notificationService.showDialog({
			...this.dialogPresetsService.getBulkDeleteRoomsDialogPreset(rooms.length),
			confirmCallback: bulkDeleteCallback
		});
	}

	private handleSuccessfulBulkDeletion(
		successResults: {
			roomId: string;
			successCode: MeetRoomDeletionSuccessCode;
			message: string;
			room?: MeetRoom;
		}[]
	) {
		const currentRooms = this.rooms();
		let updatedRooms = [...currentRooms];
		const deletedRoomIds: string[] = [];

		// Process each successful result
		successResults.forEach(({ roomId, successCode, room: updatedRoom }) => {
			if (updatedRoom) {
				// Room was not deleted, but updated (e.g., scheduled for deletion, closed)
				if (successCode === MeetRoomDeletionSuccessCode.ROOM_WITH_ACTIVE_MEETING_CLOSED) {
					updatedRoom.status = MeetRoomStatus.CLOSED;
				}

				// Update the room in the array
				updatedRooms = updatedRooms.map((r) => (r.roomId === updatedRoom.roomId ? updatedRoom : r));
			} else {
				// Room was deleted, mark for removal from list
				deletedRoomIds.push(roomId);
			}
		});

		// Remove deleted rooms from the array
		if (deletedRoomIds.length > 0) {
			updatedRooms = updatedRooms.filter((r) => !deletedRoomIds.includes(r.roomId));
		}

		// Update the rooms signal with all changes
		this.rooms.set(updatedRooms);
	}

	private showBulkDeletionErrorDialogWithOptions(
		failedResults: {
			roomId: string;
			error: string;
			message: string;
		}[],
		errorMessage: string
	) {
		const roomIds = failedResults.map((r) => r.roomId);

		const bulkDeleteWithPoliciesCallback = async (
			meetingPolicy: MeetRoomDeletionPolicyWithMeeting,
			recordingPolicy: MeetRoomDeletionPolicyWithRecordings
		) => {
			try {
				const { message, deleted } = await this.roomService.bulkDeleteRooms(
					roomIds,
					meetingPolicy,
					recordingPolicy
				);

				this.handleSuccessfulBulkDeletion(deleted);
				this.notificationService.showSnackbar(message);
			} catch (error: any) {
				this.log.e('Error in second bulk deletion attempt:', error);

				// Check if it fails again with structured error
				const failed = error.error?.failed;
				const deleted = error.error?.deleted;
				const message = error.error?.message;

				if (failed && deleted) {
					this.handleSuccessfulBulkDeletion(deleted);
					this.notificationService.showSnackbar(message);
				} else {
					this.notificationService.showSnackbar(this.translateService.translate('ROOMS.ERRORS.FAILED_DELETE_ROOMS'));
				}
			}
		};

		const dialogOptions: DeleteRoomDialogOptions = {
			title: this.translateService.translate('ROOMS.ERRORS.ERROR_DELETING_ROOMS'),
			message: `${errorMessage}. They have active meetings and/or recordings:
			<p>${roomIds.join(', ')}</p>`,
			confirmText: this.translateService.translate('ROOMS.ERRORS.DELETE_WITH_OPTIONS'),
			showWithMeetingPolicy: true,
			showWithRecordingsPolicy: true,
			confirmCallback: bulkDeleteWithPoliciesCallback
		};
		// 原弹窗 disableClose: true：遮罩点击、ESC、右上角 X 一律不可关，只能走按钮回调。
		this.notificationService.openModal({
			nzContent: DeleteRoomDialogComponent,
			nzData: dialogOptions,
			nzWidth: DIALOG_WIDTH.confirm,
			nzClosable: false,
			nzMaskClosable: false,
			nzKeyboard: false
		});
	}
}

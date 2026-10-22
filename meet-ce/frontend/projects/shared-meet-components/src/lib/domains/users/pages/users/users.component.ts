import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { MeetUserDTO, MeetUserFilters, MeetUserRole, SortOrder, TextMatchMode } from '@openvidu-meet/typings';
import { firstValueFrom } from 'rxjs';
import { ScrollPersistDirective } from '../../../../shared/directives/scroll-persist.directive';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { JmeetLoadingSkeletonComponent, JmeetPageHeaderComponent, JmeetStatusTagComponent } from '../../../../shared/components';
import { DialogPresetsService } from '../../../../shared/services/dialog-presets.service';
import { TranslateService } from '../../../../shared/services/i18n/translate.service';
import { ListStateCacheService } from '../../../../shared/services/list-state-cache.service';
import { NavigationService } from '../../../../shared/services/navigation.service';
import { NotificationService, DIALOG_WIDTH } from '../../../../shared/services/notification.service';
import { AuthService } from '../../../auth/services/auth.service';
import { ILogger, LoggerService } from '../../../meeting/openvidu-components';
import { ResetPasswordDialogComponent } from '../../components/reset-password-dialog/reset-password-dialog.component';
import { UpdateRoleDialogComponent } from '../../components/update-role-dialog/update-role-dialog.component';
import { CreateUserDialogComponent } from '../../components/create-user-dialog/create-user-dialog.component';
import {
	UsersListsComponent,
	UserTableAction,
	UserTableFilter
} from '../../components/users-lists/users-lists.component';
import { UserService } from '../../services/user.service';

/** Cached UI state for the users list, restored when navigating back to it. */
interface UsersListCachedState {
	users: MeetUserDTO[];
	totalCount: number;
	filters: UserTableFilter;
	scrollTop: number;
}

@Component({
	selector: 'ov-users',
	imports: [
		JmeetLoadingSkeletonComponent,
		JmeetPageHeaderComponent,
		JmeetStatusTagComponent,

		NzIconModule,
		UsersListsComponent,
		ScrollPersistDirective,
		TranslatePipe
	],
	templateUrl: './users.component.html',
	styleUrl: './users.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class UsersComponent implements OnInit, OnDestroy {
	private userService = inject(UserService);
	private listStateCache = inject(ListStateCacheService);
	private authService = inject(AuthService);
	private notificationService = inject(NotificationService);
	private readonly translateService = inject(TranslateService);
	private dialogPresetsService = inject(DialogPresetsService);
	private navigationService = inject(NavigationService);
	private loggerService = inject(LoggerService);
	protected log: ILogger = this.loggerService.get('JMeet - UsersComponent');

	private static readonly STATE_KEY = 'users';
	// 全量拉取+客户端分页（每批 100 条循环拉至游标耗尽，列表组件按 10/页切片渲染）；
	// 数据量大时回改服务端分页。
	private static readonly DEFAULT_PAGE_SIZE = 100;

	private readonly scroller = viewChild(ScrollPersistDirective);
	/** Scroll position to restore on the page container (set when restoring cached state). */
	protected scrollToRestore = 0;

	users = signal<MeetUserDTO[]>([]);
	currentUserId = signal<string>('');
	rootAdminId = signal<string>('');

	// Loading state
	isInitializing = signal(true);
	showInitialLoader = signal(false);
	isLoading = signal(false);

	initialFilters = signal<UserTableFilter>({
		nameFilter: '',
		nameMatchMode: TextMatchMode.PARTIAL,
		nameCaseInsensitive: true,
		roleFilter: '',
		sortField: 'registrationDate',
		sortOrder: SortOrder.DESC
	});

	// Pagination（全量拉取+客户端分页；totalCount 为后端真实总数，直通列表页码器）
	totalCount = signal(0);

	// Track current active filters so deletions can trigger auto-load
	private currentFilters: UserTableFilter = this.initialFilters();

	async ngOnInit() {
		// Capture the navigation trigger synchronously, before any await finalizes the navigation.
		const isBackNavigation = this.navigationService.isPopStateNavigation();

		this.currentUserId.set((await this.authService.getUserId()) ?? '');

		const rootAdmin = await this.userService.getRootAdmin();
		if (rootAdmin) this.rootAdminId.set(rootAdmin.userId);

		// Restore cached state only when navigating *back* (browser back/forward); an
		// explicit navigation to this page loads fresh data so others' changes show.
		const cached = this.listStateCache.get<UsersListCachedState>(UsersComponent.STATE_KEY);
		if (cached && isBackNavigation) {
			this.users.set(cached.users);
			this.totalCount.set(cached.totalCount);
			this.currentFilters = cached.filters;
			this.initialFilters.set(cached.filters);
			this.scrollToRestore = cached.scrollTop;
			this.isInitializing.set(false);
			return;
		}

		const delayLoader = setTimeout(() => {
			this.showInitialLoader.set(true);
		}, 200);

		await this.loadUsers(this.initialFilters());

		clearTimeout(delayLoader);
		this.showInitialLoader.set(false);
		this.isInitializing.set(false);
	}

	ngOnDestroy() {
		this.listStateCache.set<UsersListCachedState>(UsersComponent.STATE_KEY, {
			users: this.users(),
			totalCount: this.totalCount(),
			filters: this.currentFilters,
			scrollTop: this.scroller()?.scrollTop ?? 0
		});
	}

	private buildUserFilters(filters: UserTableFilter, pageToken?: string, maxItems?: number): MeetUserFilters {
		const userFilters: MeetUserFilters = {
			maxItems: maxItems ?? UsersComponent.DEFAULT_PAGE_SIZE,
			nextPageToken: pageToken,
			sortField: filters.sortField,
			sortOrder: filters.sortOrder
		};

		if (filters.nameFilter) {
			userFilters.name = filters.nameFilter;
			userFilters.nameMatchMode = filters.nameMatchMode;
			userFilters.nameCaseInsensitive = filters.nameCaseInsensitive || undefined;
		}

		if (filters.roleFilter) {
			userFilters.role = filters.roleFilter as MeetUserRole;
		}

		return userFilters;
	}

	private async fetchUsersPage(filters: UserTableFilter, pageToken?: string) {
		return this.userService.listUsers(this.buildUserFilters(filters, pageToken));
	}

	private async loadUsers(filters: UserTableFilter) {
		this.currentFilters = filters;

		const delayLoader = setTimeout(() => {
			this.isLoading.set(true);
		}, 200);

		// 全量拉取+客户端分页：循环拉取游标页直至 nextPageToken 耗尽；数据量大时回改服务端分页。
		const users: MeetUserDTO[] = [];
		let nextPageToken: string | undefined;
		try {
			do {
				const response = await this.fetchUsersPage(filters, nextPageToken);
				users.push(...response.users);
				this.totalCount.set(response.pagination.totalCount);
				nextPageToken = response.pagination.nextPageToken;
			} while (nextPageToken);
			this.users.set(users);
		} catch (error) {
			// 循环拉取失败：中断拉取、保留已得数据（不降级 load-more），沿用既有错误呈现；
			// pager 总数降级为已得数，越界守卫会拉回第 1 页。
			if (users.length > 0) {
				this.totalCount.set(users.length);
				this.users.set(users);
			}
			this.log.e('Error loading users:', error);
			this.notificationService.showSnackbar(this.translateService.translate('USERS.ERRORS.USERS_LOAD_FAILED'));
		} finally {
			clearTimeout(delayLoader);
			this.isLoading.set(false);
		}
	}

	async refreshUsers(filters: UserTableFilter) {
		await this.loadUsers(filters);
	}

	async onFiltersChange(filters: UserTableFilter) {
		await this.loadUsers(filters);
	}

	// ─── Actions ──────────────────────────────────────────────────────────────

	async onUserAction(action: UserTableAction) {
		switch (action.action) {
			case 'create':
				await this.onCreateUser();
				break;
			case 'updateRole':
				await this.onUpdateRole(action.users[0]);
				break;
			case 'resetPassword':
				this.onResetPassword(action.users[0]);
				break;
			case 'delete':
				this.onDeleteUser(action.users[0]);
				break;
			case 'bulkDelete':
				this.onBulkDeleteUsers(action.users);
				break;
		}
	}

	private async onCreateUser() {
		// Element 风格弹框创建（原跳转页保留直链可用），成功后原地刷新列表。
		const created = await firstValueFrom(
			this.notificationService
				.openModal({
					nzContent: CreateUserDialogComponent,
					nzWidth: DIALOG_WIDTH.form,
					nzClosable: false,
					nzMaskClosable: false
				})
				.afterClose
		);

		if (created) {
			await this.loadUsers(this.currentFilters);
		}
	}

	private async onUpdateRole(user: MeetUserDTO) {
		const updatedUser = await firstValueFrom(
			this.notificationService
				.openModal({
					nzContent: UpdateRoleDialogComponent,
					nzData: { user },
					nzWidth: DIALOG_WIDTH.standard,
					nzClosable: false,
					nzMaskClosable: false
				})
				.afterClose
		);

		if (!updatedUser) {
			return;
		}

		this.users.update((currentUsers) =>
			currentUsers.map((currentUser) => (currentUser.userId === updatedUser.userId ? updatedUser : currentUser))
		);
	}

	private onResetPassword(user: MeetUserDTO) {
		this.notificationService.openModal({
			nzContent: ResetPasswordDialogComponent,
			nzData: { user },
			nzWidth: DIALOG_WIDTH.standard,
			nzClosable: false,
			nzMaskClosable: false
		});
	}

	private onDeleteUser(user: MeetUserDTO) {
		this.notificationService.showDialog({
			...this.dialogPresetsService.getDeleteUserDialogPreset(user.name, user.userId),
			confirmCallback: async () => {
				try {
					await this.userService.deleteUser(user.userId);

					// Remove deleted user from the list
					this.users.set(this.users().filter((u) => u.userId !== user.userId));
					this.notificationService.showSnackbar(
						`${this.translateService.translate('USERS.ERRORS.USER_DELETED_PREFIX')}${user.name}${this.translateService.translate('USERS.ERRORS.USER_DELETED_SUFFIX')}`
					);
				} catch (error) {
					this.log.e('Error deleting user:', error);
					this.notificationService.showSnackbar(this.translateService.translate('USERS.ERRORS.USER_DELETE_FAILED'));
				}
			}
		});
	}

	private onBulkDeleteUsers(usersToDelete: MeetUserDTO[]) {
		const bulkDeleteCallback = async () => {
			try {
				const userIds = usersToDelete.map((u) => u.userId);
				const { deleted } = await this.userService.bulkDeleteUsers(userIds);

				// Remove deleted users from the list
				this.users.set(this.users().filter((u) => !deleted.includes(u.userId)));
				this.notificationService.showSnackbar(
					`${deleted.length} ${this.translateService.translate(deleted.length > 1 ? 'USERS.ERRORS.USERS_DELETED_SUFFIX_PLURAL' : 'USERS.ERRORS.USERS_DELETED_SUFFIX_SINGULAR')}`
				);
			} catch (error: any) {
				this.log.e('Error deleting users:', error);

				const deleted = (error?.error?.deleted ?? []) as string[];
				const failed = (error?.error?.failed ?? []) as { userId: string; error: string }[];

				// Some users were deleted, some not
				if (failed.length > 0 || deleted.length > 0) {
					if (deleted.length > 0) {
						this.users.set(this.users().filter((u) => !deleted.includes(u.userId)));
					}

					let message = '';
					if (deleted.length > 0) {
						message += `${deleted.length} ${this.translateService.translate(deleted.length > 1 ? 'USERS.ERRORS.USERS_DELETED_SUFFIX_PLURAL' : 'USERS.ERRORS.USERS_DELETED_SUFFIX_SINGULAR')} `;
					}
					if (failed.length > 0) {
						message += `${failed.length} ${this.translateService.translate(failed.length > 1 ? 'USERS.ERRORS.USERS_FAILED_SUFFIX_PLURAL' : 'USERS.ERRORS.USERS_FAILED_SUFFIX_SINGULAR')}`;
					}

					this.notificationService.showSnackbar(message.trim());
				} else {
					this.notificationService.showSnackbar(this.translateService.translate('USERS.ERRORS.USERS_DELETE_FAILED'));
				}
			}
		};

		const count = usersToDelete.length;
		this.notificationService.showDialog({
			...this.dialogPresetsService.getBulkDeleteUsersDialogPreset(count),
			confirmCallback: bulkDeleteCallback
		});
	}

	async onUserClick(userId: string) {
		try {
			await this.navigateToUserProfile(userId);
		} catch (error) {
			this.notificationService.showSnackbar(this.translateService.translate('USERS.ERRORS.USER_PROFILE_NAVIGATION_FAILED'));
			this.log.e('Error navigating to user profile:', error);
		}
	}

	private async navigateToUserProfile(userId: string) {
		if (userId === this.currentUserId()) {
			await this.navigationService.navigateTo('/profile');
			return;
		}

		await this.navigationService.navigateTo(`/users/${userId}`);
	}
}

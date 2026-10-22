import { DatePipe } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	DestroyRef,
	effect,
	inject,
	input,
	OnInit,
	output,
	signal,
	untracked
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { FormsModule } from '@angular/forms';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzIconTypePipe } from '../../../../shared/pipes/nz-icon-type.pipe';
import { MeetUserDTO, MeetUserRole, MeetUserSortField, SortOrder, TextMatchMode } from '@openvidu-meet/typings';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
	JmeetDataTableComponent,
	JmeetEmptyStateComponent,
	JmeetFilterBarComponent,
	JmeetLoadingSkeletonComponent,
	JmeetPaginationComponent,
	JmeetStatusTagComponent,
	type JmeetStatusTagVariant
} from '../../../../shared/components';
import { setsAreEqual } from '../../../../shared/utils/array.utils';
import { UsersUiUtils } from '../../utils/ui';

/** Column-sort state (structural replacement for the former Material `Sort`). */
export interface SortState {
	active: string;
	direction: 'asc' | 'desc' | '';
}

export interface UserTableAction {
	users: MeetUserDTO[];
	action: 'create' | 'updateRole' | 'resetPassword' | 'delete' | 'bulkDelete';
}

export interface UserTableFilter {
	nameFilter: string;
	nameMatchMode: TextMatchMode;
	nameCaseInsensitive: boolean;
	roleFilter: MeetUserRole | '';
	sortField: MeetUserSortField;
	sortOrder: SortOrder;
}

@Component({
	selector: 'ov-users-lists',
	imports: [
		JmeetPaginationComponent,
		JmeetDataTableComponent,
		JmeetFilterBarComponent,
		NzButtonModule,
		NzInputModule,
		NzSelectModule,
		NzCheckboxModule,
		NzDropDownModule,
		NzTooltipModule,
		FormsModule,
		JmeetEmptyStateComponent,
		JmeetLoadingSkeletonComponent,
		JmeetStatusTagComponent,
		NzIconModule, NzIconTypePipe,
		ReactiveFormsModule,
		DatePipe,
		TranslatePipe,
		NzMenuModule,
	],
	templateUrl: './users-lists.component.html',
	styleUrl: './users-lists.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		'[class.has-selections]': 'hasSelections()'
	}
})
export class UsersListsComponent implements OnInit {
	private destroyRef = inject(DestroyRef);

	users = input<MeetUserDTO[]>([]);
	/** 后端真实总数（users 接口 totalCount 直通）——页码器 [length] 的数据源，非已加载量。 */
	totalCount = input(0);
	currentUserId = input('');
	rootAdminId = input('');
	showSearchBox = input(true);
	showSelection = input(true);
	loading = input(false);
	initialFilters = input<UserTableFilter>({
		nameFilter: '',
		nameMatchMode: TextMatchMode.PARTIAL,
		nameCaseInsensitive: true,
		roleFilter: '',
		sortField: 'registrationDate',
		sortOrder: SortOrder.DESC
	});

	hasSelections = computed(() => this.selectedUsers().size > 0);

	readonly userAction = output<UserTableAction>();
	readonly filterChange = output<UserTableFilter>();
	readonly refresh = output<UserTableFilter>();
	readonly userClicked = output<string>();

	nameFilterControl = new FormControl<string>('', { nonNullable: true });

	// 角色筛选（服务端过滤经父组件链路）；'all' 表示不过滤。
	selectedRole = signal<'all' | MeetUserRole>('all');
	private appliedNameFilter = signal('');

	hasActiveFilters = computed(() => !!this.appliedNameFilter().trim());
	showEmptyFilterMessage = signal(false);

	currentSortField = signal<MeetUserSortField>('registrationDate');
	currentSortOrder = signal<SortOrder>(SortOrder.DESC);

	selectedUsers = signal<Set<string>>(new Set());
	allSelected = signal(false);
	someSelected = signal(false);

	// 全量拉取+客户端分页：数据由父组件循环拉全传入（服务端过滤/排序后），本地 10/页切片渲染；
	// 数据量大时回改服务端分页。
	pageIndex = signal(0);
	pageSize = signal(10);
	pagedUsers = computed(() => {
		const start = this.pageIndex() * this.pageSize();
		return this.users().slice(start, start + this.pageSize());
	});

	displayedColumns = computed(() => {
		const columns = ['index', 'userName', 'loginName', 'role', 'registrationDate', 'actions'];
		return this.showSelection() ? ['select', ...columns] : columns;
	});

	protected readonly UsersUiUtils = UsersUiUtils;

	constructor() {
		effect(() => {
			const users = this.users();
			const validUserIds = new Set(users.map((u) => u.userId));
			const currentSelection = untracked(() => this.selectedUsers());
			const filteredSelection = new Set([...currentSelection].filter((id) => validUserIds.has(id)));

			if (!setsAreEqual(filteredSelection, currentSelection)) {
				this.selectedUsers.set(filteredSelection);
				this.updateSelectionState();
			}

			this.showEmptyFilterMessage.set(users.length === 0 && this.hasActiveFilters());

			// 数据集变化（过滤/刷新）后页码越界时回到第一页，避免空页。
			const maxPageIndex = Math.max(0, Math.ceil(users.length / this.pageSize()) - 1);
			if (this.pageIndex() > maxPageIndex) {
				this.pageIndex.set(0);
			}
		});
	}

	ngOnInit() {
		this.setupSearch();
	}

	private setupSearch() {
		const filters = this.initialFilters();
		this.nameFilterControl.setValue(filters.nameFilter, { emitEvent: false });
		this.appliedNameFilter.set(filters.nameFilter);
		this.currentSortField.set(filters.sortField);
		this.currentSortOrder.set(filters.sortOrder);

		this.nameFilterControl.valueChanges
			.pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
			.subscribe(() => this.emitFilterChange());
	}

	toggleAllSelection() {
		const selected = this.selectedUsers();
		if (this.allSelected()) {
			selected.clear();
		} else {
			this.users().forEach((user) => {
				if (this.canSelectUser(user)) {
					selected.add(user.userId);
				}
			});
		}
		this.selectedUsers.set(new Set(selected));
		this.updateSelectionState();
	}

	toggleUserSelection(user: MeetUserDTO) {
		const selected = this.selectedUsers();
		if (selected.has(user.userId)) {
			selected.delete(user.userId);
		} else {
			selected.add(user.userId);
		}
		this.selectedUsers.set(new Set(selected));
		this.updateSelectionState();
	}

	private updateSelectionState() {
		const selectableUsers = this.users().filter((u) => this.canSelectUser(u));
		const selectedCount = this.selectedUsers().size;
		const selectableCount = selectableUsers.length;

		this.allSelected.set(selectedCount > 0 && selectedCount === selectableCount);
		this.someSelected.set(selectedCount > 0 && selectedCount < selectableCount);
	}

	isUserSelected(user: MeetUserDTO): boolean {
		return this.selectedUsers().has(user.userId);
	}

	canSelectUser(user: MeetUserDTO): boolean {
		return !UsersUiUtils.isProtectedUser(user, this.currentUserId(), this.rootAdminId());
	}

	getSelectedUsers(): MeetUserDTO[] {
		const selected = this.selectedUsers();
		return this.users().filter((u) => selected.has(u.userId));
	}

	createUser() {
		this.userAction.emit({ users: [], action: 'create' });
	}

	onUserClick(user: MeetUserDTO) {
		this.userClicked.emit(user.userId);
	}

	resetPassword(user: MeetUserDTO) {
		this.userAction.emit({ users: [user], action: 'resetPassword' });
	}

	updateRole(user: MeetUserDTO) {
		this.userAction.emit({ users: [user], action: 'updateRole' });
	}

	deleteUser(user: MeetUserDTO) {
		this.userAction.emit({ users: [user], action: 'delete' });
	}

	bulkDeleteSelected() {
		const selectedUsers = this.getSelectedUsers();
		if (selectedUsers.length > 0) {
			this.userAction.emit({ users: selectedUsers, action: 'bulkDelete' });
		}
	}

	refreshUsers() {
		this.refresh.emit(this.buildFilterSnapshot());
	}

	toggleSort(field: MeetUserSortField) {
		if (this.currentSortField() === field) {
			this.currentSortOrder.set(
				this.currentSortOrder() === SortOrder.ASC ? SortOrder.DESC : SortOrder.ASC
			);
		} else {
			this.currentSortField.set(field);
			this.currentSortOrder.set(SortOrder.DESC);
		}
		this.emitFilterChange();
	}

	onSortChange(sortState: SortState) {
		if (!sortState.direction) {
			return;
		}
		this.currentSortField.set(sortState.active as MeetUserSortField);
		this.currentSortOrder.set(sortState.direction as SortOrder);
		this.emitFilterChange();
	}

	applySearch() {
		this.emitFilterChange();
	}

	clearSearch() {
		this.nameFilterControl.setValue('');
	}

	onPageChange(change: { pageIndex: number; pageSize: number }): void {
		this.pageIndex.set(change.pageIndex);
		this.pageSize.set(change.pageSize);
	}

	clearSelection(): void {
		this.selectedUsers.set(new Set());
		this.updateSelectionState();
	}

	private static readonly AVATAR_COLORS = ['#5b8def', '#8b6fef', '#e08b5f', '#4caf7d', '#e05f8f', '#5fa8e0', '#b8892d'];

	avatarColor(name: string): string {
		let hash = 0;
		for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
		return UsersListsComponent.AVATAR_COLORS[hash % UsersListsComponent.AVATAR_COLORS.length];
	}

	avatarInitial(name: string): string {
		return (name || '?').trim().charAt(0).toUpperCase();
	}

	setRoleFilter(role: 'all' | MeetUserRole) {
		this.selectedRole.set(role);
		this.emitFilterChange();
	}


	private buildFilterSnapshot(): UserTableFilter {
		return {
			nameFilter: this.nameFilterControl.value.trim(),
			nameMatchMode: TextMatchMode.PARTIAL,
			nameCaseInsensitive: true,
			roleFilter: this.selectedRole() === 'all' ? '' : (this.selectedRole() as MeetUserRole),
			sortField: this.currentSortField(),
			sortOrder: this.currentSortOrder()
		};
	}

	private emitFilterChange() {
		const snapshot = this.buildFilterSnapshot();
		this.appliedNameFilter.set(snapshot.nameFilter);
		this.filterChange.emit(snapshot);
	}

	roleVariant(role: MeetUserRole): JmeetStatusTagVariant {
		if (role === 'admin') return 'error';
		if (role === 'room_manager') return 'warning';
		return 'default';
	}
}

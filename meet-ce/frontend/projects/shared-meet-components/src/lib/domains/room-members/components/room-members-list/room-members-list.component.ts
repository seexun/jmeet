import { CommonModule, DatePipe } from '@angular/common';
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
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzIconTypePipe } from '../../../../shared/pipes/nz-icon-type.pipe';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { RouterModule } from '@angular/router';
import {
	MeetRoomMember,
	MeetRoomMemberRole,
	MeetRoomMemberSortField,
	MeetRoomMemberType,
	SortOrder,
	TextMatchMode
} from '@openvidu-meet/typings';
import { debounceTime, distinctUntilChanged, merge } from 'rxjs';
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
import { TranslateService } from '../../../../shared/services/i18n/translate.service';
import { setsAreEqual } from '../../../../shared/utils/array.utils';
import { RoomMemberUiUtils } from '../../utils/ui';

export interface MemberTableAction {
	members: MeetRoomMember[];
	action: 'addMember' | 'edit' | 'copyLink' | 'delete' | 'bulkDelete';
}

export interface MemberTableFilter {
	nameFilter: string;
	nameMatchMode: TextMatchMode;
	nameCaseInsensitive: boolean;
	baseRole: MeetRoomMemberRole | '';
	type: MeetRoomMemberType | '';
	sortField: MeetRoomMemberSortField;
	sortOrder: SortOrder;
}

/**
 * Reusable component for displaying a list of room members with filtering, selection, and bulk operations.
 *
 * Features:
 * - Display room members in a Material Design table
 * - Filter by member name
 * - Multi-selection for bulk operations
 * - Individual member actions (copy link, delete)
 * - Responsive design with mobile optimization
 *
 * @example
 * ```html
 * <ov-room-members-lists
 *   [members]="members"
 *   [loading]="isLoading"
 *   [showFilters]="true"
 *   [showSelection]="true"
 *   (memberAction)="handleMemberAction($event)"
 *   (filterChange)="handleFilterChange($event)"
 *   (refresh)="refreshMembers()">
 * </ov-room-members-lists>
 * ```
 */
@Component({
	selector: 'ov-room-members-list',
	imports: [
		ReactiveFormsModule,
		JmeetDataTableComponent,
		JmeetEmptyStateComponent,
		JmeetFilterBarComponent,
		JmeetLoadingSkeletonComponent,
		JmeetPaginationComponent,
		JmeetStatusTagComponent,
		NzInputModule,
		NzSelectModule,
		NzCheckboxModule,
		NzDropDownModule,
		NzTooltipModule,
		NzIconModule, NzIconTypePipe,
		RouterModule,
		DatePipe,
		TranslatePipe,
		NzMenuModule,
	],
	templateUrl: './room-members-list.component.html',
	styleUrl: './room-members-list.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		'[class.has-selections]': 'hasSelections()'
	}
})
export class RoomMembersListsComponent implements OnInit {
	private destroyRef = inject(DestroyRef);
	private readonly translateService = inject(TranslateService);

	members = input<MeetRoomMember[]>([]);
	showSearchBox = input(true);
	showFilters = input(true);
	showSelection = input(true);
	loading = input(false);
	canViewUserProfiles = input(true);
	initialFilters = input<MemberTableFilter>({
		nameFilter: '',
		nameMatchMode: TextMatchMode.PREFIX,
		nameCaseInsensitive: false,
		baseRole: '',
		type: '',
		sortField: 'membershipDate',
		sortOrder: SortOrder.DESC
	});

	// Host binding state for styling when members are selected
	hasSelections = computed(() => this.selectedMembers().size > 0);

	// Output events
	readonly memberAction = output<MemberTableAction>();
	readonly filterChange = output<MemberTableFilter>();
	readonly refresh = output<MemberTableFilter>();
	readonly memberClicked = output<string>();

	// Filter controls
	filtersForm = new FormGroup({
		nameFilter: new FormControl<string>('', { nonNullable: true }),
		nameMatchMode: new FormControl<TextMatchMode>(TextMatchMode.PREFIX, { nonNullable: true }),
		nameCaseInsensitive: new FormControl<boolean>(false, { nonNullable: true }),
		baseRole: new FormControl<MeetRoomMemberRole | ''>('', { nonNullable: true }),
		type: new FormControl<MeetRoomMemberType | ''>('', { nonNullable: true })
	});

	get controls() {
		return this.filtersForm.controls;
	}

	// Pending form snapshot — reflects what's in the input fields right now.
	// Drives transient UI cues (clear-X visibility, search-modifier active states).
	protected filterState = signal(this.filtersForm.getRawValue());

	// Applied filter snapshot — reflects what's actually filtering the table.
	// Updated only when emitFilterChange() fires.
	protected appliedFilterState = signal(this.filtersForm.getRawValue());

	// Reads the applied snapshot so pending free-text input doesn't count as "active".
	hasActiveFilters = computed(() => {
		const f = this.appliedFilterState();
		return !!(f.nameFilter || f.baseRole || f.type);
	});

	// Whether the inline filter panel is expanded
	showFilterPanel = signal(false);

	nameMatchModeOptions = [
		{
			value: TextMatchMode.PREFIX,
			label: this.translateService.translate('ROOM_MEMBERS.LIST.MATCH_MODE_STARTS_WITH'),
			icon: 'first_page'
		},
		{
			value: TextMatchMode.PARTIAL,
			label: this.translateService.translate('ROOM_MEMBERS.LIST.MATCH_MODE_CONTAINS'),
			icon: 'more_horiz'
		},
		{
			value: TextMatchMode.EXACT,
			label: this.translateService.translate('ROOM_MEMBERS.LIST.MATCH_MODE_EXACT'),
			icon: 'format_quote'
		},
		{
			value: TextMatchMode.REGEX,
			label: this.translateService.translate('ROOM_MEMBERS.LIST.MATCH_MODE_REGEX'),
			icon: 'code'
		}
	];

	// Base role filter options ('' means no filter)
	baseRoleOptions: { value: MeetRoomMemberRole | ''; label: string }[] = [
		{ value: '', label: this.translateService.translate('ROOM_MEMBERS.LIST.ROLE_FILTER_ALL') },
		{ value: MeetRoomMemberRole.MODERATOR, label: this.translateService.translate('ROOM_MEMBERS.COMMON.MODERATOR') },
		{ value: MeetRoomMemberRole.SPEAKER, label: this.translateService.translate('ROOM_MEMBERS.COMMON.SPEAKER') }
	];

	// Member type filter options ('' means no filter)
	typeOptions: { value: MeetRoomMemberType | ''; label: string }[] = [
		{ value: '', label: this.translateService.translate('ROOM_MEMBERS.LIST.TYPE_FILTER_ALL') },
		{ value: MeetRoomMemberType.USER, label: this.translateService.translate('ROOM_MEMBERS.LIST.TYPE_USER') },
		{
			value: MeetRoomMemberType.IDENTIFIED_GUEST,
			label: this.translateService.translate('ROOM_MEMBERS.LIST.TYPE_IDENTIFIED_GUEST')
		}
	];

	// Active filters shown as removable chips. Reads the applied snapshot.
	activeFilterChips = computed(() => {
		const f = this.appliedFilterState();
		const chips: { key: string; label: string }[] = [];

		if (f.baseRole) {
			const opt = this.baseRoleOptions.find((o) => o.value === f.baseRole);
			chips.push({
				key: 'baseRole',
				label: `${this.translateService.translate('ROOM_MEMBERS.LIST.ROLE_CHIP_PREFIX')}${opt?.label ?? f.baseRole}`
			});
		}

		if (f.type) {
			const opt = this.typeOptions.find((o) => o.value === f.type);
			chips.push({
				key: 'type',
				label: `${this.translateService.translate('ROOM_MEMBERS.LIST.TYPE_CHIP_PREFIX')}${opt?.label ?? f.type}`
			});
		}

		return chips;
	});

	// Currently selected match mode option (drives the search-box trigger button)
	currentMatchMode = computed(
		() =>
			this.nameMatchModeOptions.find((o) => o.value === this.filterState().nameMatchMode) ??
			this.nameMatchModeOptions[0]
	);

	// Expose TextMatchMode for template
	protected readonly TextMatchMode = TextMatchMode;

	// Sort state
	currentSortField = signal<MeetRoomMemberSortField>('membershipDate');
	currentSortOrder = signal<SortOrder>(SortOrder.DESC);

	showEmptyFilterMessage = signal(false);

	// Selection state
	selectedMembers = signal<Set<string>>(new Set());
	allSelected = signal(false);
	someSelected = signal(false);

	// 全量拉取+客户端分页：数据由父组件循环拉全传入，本地 10/页切片渲染；
	// 数据量大时回改服务端分页。
	pageIndex = signal(0);
	pageSize = signal(10);
	pagedMembers = computed(() => {
		const start = this.pageIndex() * this.pageSize();
		return this.members().slice(start, start + this.pageSize());
	});

	// Table configuration
	displayedColumns = computed(() => {
		const columns = ['name', 'role', 'memberType', 'membershipDate', 'actions'];
		return this.showSelection() ? ['select', ...columns] : columns;
	});

	protected readonly RoomMemberUiUtils = RoomMemberUiUtils;

	constructor() {
		effect(() => {
			const members = this.members();
			const validMemberIds = new Set(members.map((m) => m.memberId));

			const currentSelection = untracked(() => this.selectedMembers());
			const filteredSelection = new Set([...currentSelection].filter((id) => validMemberIds.has(id)));

			if (!setsAreEqual(filteredSelection, currentSelection)) {
				this.selectedMembers.set(filteredSelection);
				this.updateSelectionState();
			}

			this.showEmptyFilterMessage.set(members.length === 0 && this.hasActiveFilters());

			// 数据集变化（过滤/刷新）后页码越界时回到第一页，避免空页。
			const maxPageIndex = Math.max(0, Math.ceil(members.length / this.pageSize()) - 1);
			if (this.pageIndex() > maxPageIndex) {
				this.pageIndex.set(0);
			}
		});
	}

	ngOnInit() {
		this.setupFilters();
	}

	// ===== INITIALIZATION METHODS =====

	private setupFilters() {
		const filters = this.initialFilters();
		this.filtersForm.patchValue(filters, { emitEvent: false });
		const initialSnapshot = this.filtersForm.getRawValue();
		this.filterState.set(initialSnapshot);
		this.appliedFilterState.set(initialSnapshot);
		this.currentSortField.set(filters.sortField);
		this.currentSortOrder.set(filters.sortOrder);

		// Keep the reactive snapshot in sync with any form change
		this.filtersForm.valueChanges
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe(() => this.filterState.set(this.filtersForm.getRawValue()));

		const { nameFilter, nameMatchMode, nameCaseInsensitive, baseRole, type } = this.controls;

		// 搜索输入即搜（400ms 防抖；清空后自动恢复全量，与全局筛选项变更即生效保持一致）
		nameFilter.valueChanges
			.pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
			.subscribe(() => this.emitFilterChange());

		// Emit immediately on any option change
		merge(nameMatchMode.valueChanges, nameCaseInsensitive.valueChanges, baseRole.valueChanges, type.valueChanges)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe(() => this.emitFilterChange());
	}

	// ===== SELECTION METHODS =====

	toggleAllSelection() {
		const selected = this.selectedMembers();
		if (this.allSelected()) {
			selected.clear();
		} else {
			this.members().forEach((member) => {
				if (this.canSelectMember(member)) {
					selected.add(member.memberId);
				}
			});
		}
		this.selectedMembers.set(new Set(selected));
		this.updateSelectionState();
	}

	toggleMemberSelection(member: MeetRoomMember) {
		const selected = this.selectedMembers();
		if (selected.has(member.memberId)) {
			selected.delete(member.memberId);
		} else {
			selected.add(member.memberId);
		}
		this.selectedMembers.set(new Set(selected));
		this.updateSelectionState();
	}

	private updateSelectionState() {
		const selectableMembers = this.members().filter((m) => this.canSelectMember(m));
		const selectedCount = this.selectedMembers().size;
		const selectableCount = selectableMembers.length;

		this.allSelected.set(selectedCount > 0 && selectedCount === selectableCount);
		this.someSelected.set(selectedCount > 0 && selectedCount < selectableCount);
	}

	isMemberSelected(member: MeetRoomMember): boolean {
		return this.selectedMembers().has(member.memberId);
	}

	canSelectMember(_member: MeetRoomMember): boolean {
		return true;
	}

	getSelectedMembers(): MeetRoomMember[] {
		const selected = this.selectedMembers();
		return this.members().filter((m) => selected.has(m.memberId));
	}

	// ===== ACTION METHODS =====

	addMember() {
		this.memberAction.emit({ members: [], action: 'addMember' });
	}

	onMemberClick(member: MeetRoomMember) {
		this.memberClicked.emit(member.memberId);
	}

	copyMemberLink(member: MeetRoomMember) {
		this.memberAction.emit({ members: [member], action: 'copyLink' });
	}

	editMember(member: MeetRoomMember) {
		this.memberAction.emit({ members: [member], action: 'edit' });
	}

	deleteMember(member: MeetRoomMember) {
		this.memberAction.emit({ members: [member], action: 'delete' });
	}

	bulkDeleteSelected() {
		const selectedMembers = this.getSelectedMembers();
		if (selectedMembers.length > 0) {
			this.memberAction.emit({ members: selectedMembers, action: 'bulkDelete' });
		}
	}

	onPageChange(change: { pageIndex: number; pageSize: number }): void {
		this.pageIndex.set(change.pageIndex);
		this.pageSize.set(change.pageSize);
	}

	refreshMembers() {
		this.refresh.emit(this.buildFilterSnapshot());
	}

	/** Column-header sort: cycles asc/desc (no "unsorted" state, like the old matSortDisableClear). */
	toggleSort(field: MeetRoomMemberSortField) {
		if (this.currentSortField() === field) {
			this.currentSortOrder.set(this.currentSortOrder() === SortOrder.ASC ? SortOrder.DESC : SortOrder.ASC);
		} else {
			this.currentSortField.set(field);
			this.currentSortOrder.set(SortOrder.ASC);
		}
		this.emitFilterChange();
	}

	// ===== FILTER METHODS =====

	triggerSearch() {
		this.emitFilterChange();
	}

	toggleFilterPanel() {
		this.showFilterPanel.update((open) => !open);
	}

	removeFilter(key: string) {
		const control = (this.filtersForm.controls as Record<string, FormControl>)[key];
		if (!control) return;
		control.setValue(typeof control.value === 'boolean' ? false : '');
	}

	toggleCaseInsensitive() {
		this.controls.nameCaseInsensitive.setValue(!this.controls.nameCaseInsensitive.value);
	}

	clearNameFilter() {
		this.controls.nameFilter.setValue('');
	}

	setMatchMode(mode: TextMatchMode) {
		this.controls.nameMatchMode.setValue(mode);
	}

	private buildFilterSnapshot(): MemberTableFilter {
		return {
			...this.filtersForm.getRawValue(),
			sortField: this.currentSortField(),
			sortOrder: this.currentSortOrder()
		};
	}

	private emitFilterChange() {
		const snapshot = this.buildFilterSnapshot();
		this.appliedFilterState.set(snapshot);
		this.filterChange.emit(snapshot);
	}

	clearFilters() {
		this.filtersForm.reset(
			{
				nameFilter: '',
				// Preserve search modifiers — they are not part of "filters"
				nameMatchMode: this.controls.nameMatchMode.value,
				nameCaseInsensitive: this.controls.nameCaseInsensitive.value,
				baseRole: '',
				type: ''
			},
			{ emitEvent: false }
		);
		this.filterState.set(this.filtersForm.getRawValue());
		this.emitFilterChange();
	}

	roleVariant(role: MeetRoomMemberRole): JmeetStatusTagVariant {
		if (role === MeetRoomMemberRole.MODERATOR) return 'processing';
		if (role === MeetRoomMemberRole.SPEAKER) return 'success';
		return 'default';
	}
}

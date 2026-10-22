import type { MeetRoom, MeetRoomSortField, MeetRoomStatus, SortOrder, TextMatchMode } from '@openvidu-meet/typings';

// 房间列表页（rooms.component）的表格动作/过滤契约。
// 原定义于已删除的 ov-rooms-lists 死组件（收尾批裁决②：零接线组件删除），
// 类型被在用页面消费，随删除上收至此；组件本体无消费方，未迁移。

export interface RoomTableAction {
	rooms: MeetRoom[];
	action: 'create' | 'access' | 'edit' | 'shareLink' | 'reopen' | 'close' | 'delete' | 'bulkDelete';
}

export interface RoomTableFilter {
	nameFilter: string;
	/** Match mode applied to the room name search. Defaults to 'prefix'. */
	nameMatchMode: TextMatchMode;
	/** Whether room name matching ignores case. Defaults to false. */
	nameCaseInsensitive: boolean;
	statusFilter: MeetRoomStatus | '';
	sortField: MeetRoomSortField;
	sortOrder: SortOrder;
	/** ADMIN only: filter by owner userId */
	ownerFilter: string;
	/** ADMIN only: filter by member userId */
	memberFilter: string;
	/** ROOM_MANAGER only: include only owned rooms in results */
	showOwnedRooms: boolean;
	/** ROOM_MANAGER/ROOM_MEMBER: include only rooms the user is a member of */
	showMemberRooms: boolean;
	/** All roles: include rooms accessible to all users */
	showUserAccessRooms: boolean;
}

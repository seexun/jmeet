/**
 * 分组讨论室：主持人把参会人拆分到若干子会场独立讨论，可广播、巡视、一键召回。
 * 交互对齐国内会议软件（腾讯会议分组讨论）。
 */
export type MeetBreakoutStatus = 'draft' | 'active' | 'ended';

export interface MeetBreakoutRoom {
	breakoutId: string;
	/** 分组显示名，如"第 1 组" */
	name: string;
	/** 分配到该组的参会人 identity 列表 */
	assignedIdentities: string[];
	/** 分配到该组的参会人显示名（主持人管理弹窗展示用） */
	assignedNames: string[];
}

export interface MeetBreakoutSession {
	breakoutSessionId: string;
	roomId: string;
	status: MeetBreakoutStatus;
	rooms: MeetBreakoutRoom[];
	createdBy: string;
	createdAt: number;
	updatedAt: number;
	startedAt?: number;
	endedAt?: number;
	/** 展示字段：当前参会者被分配到的分组（无则 undefined） */
	myRoom?: MeetBreakoutRoom;
	/** 展示字段：当前是否处于分组会场（由前端 sessionStorage 状态维护，后端不下发） */
	lastBroadcast?: { text: string; sentAt: number };
}

/** 创建/更新分组配置 */
export interface MeetBreakoutAssignRequest {
	/** 全量覆盖式提交分组列表（breakoutId 由后端生成并回填，前端提交时可留空） */
	rooms: Array<Omit<MeetBreakoutRoom, 'breakoutId'> & { breakoutId?: string }>;
}

export interface MeetBreakoutJoinTokenResponse {
	/** 直接可用的 LiveKit room member token（指向分组子房间或主会场） */
	token: string;
	/** 加入目标描述（分组名或"主会场"），前端横幅/提示用 */
	targetLabel: string;
	breakoutId?: string;
}

export interface MeetBreakoutBroadcastRequest {
	text: string;
}

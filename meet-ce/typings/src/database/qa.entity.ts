/**
 * 会中问答（Q&A）：参会人向主持人/嘉宾提问，主持人文字回复。
 * 交互对齐国内会议软件（腾讯会议研讨会问答）：
 * - 提问默认仅提问者本人与主持人可见；主持人回复并公开后全员可见
 * - 提问可选匿名；主持人可将某条问答置顶
 */
export type MeetQAQuestionStatus = 'pending' | 'answered' | 'dismissed';

export interface MeetQAAnswer {
	/** 回复文本 */
	text: string;
	/** 回复人（主持人/嘉宾）显示名 */
	answeredByName: string;
	answeredByIdentity: string;
	answeredAt: number;
	/** 回复后是否对全员公开（默认公开，腾讯模式） */
	published: boolean;
}

export interface MeetQAQuestion {
	questionId: string;
	roomId: string;
	meetingSessionId?: string;
	/** 提问内容 */
	text: string;
	/** 是否匿名提问（匿名时 askerName 不下发） */
	anonymous: boolean;
	/** 提问人显示名（匿名或无权限查看时为 undefined） */
	askerName?: string;
	/** 提问人 identity（仅本人与主持人可见） */
	askerIdentity?: string;
	status: MeetQAQuestionStatus;
	answer?: MeetQAAnswer;
	/** 主持人置顶 */
	pinned: boolean;
	/** 是否已由主持人公开（未公开时仅本人与主持人可见） */
	published: boolean;
	createdAt: number;
	updatedAt: number;
	/** 展示字段：是否是本人的提问 */
	isMine?: boolean;
}

export interface MeetQACreateRequest {
	text: string;
	anonymous: boolean;
	/** 提问人显示名（前端随请求携带，与聊天归档同一惯例） */
	askerName?: string;
}

export interface MeetQAAnswerRequest {
	text: string;
	/** 回复并公开（默认 true）；false 时仅提问者可见 */
	publish?: boolean;
	/** 回复人显示名（前端随请求携带） */
	answeredByName?: string;
}

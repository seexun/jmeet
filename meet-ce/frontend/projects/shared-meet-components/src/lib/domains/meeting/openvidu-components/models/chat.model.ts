import type { MeetChatAttachmentRef } from '@openvidu-meet/typings';

/**
 * 聊天附件引用:直接复用 @openvidu-meet/typings 的后端契约(attachmentId/type/fileName/mimeType/size),
 * 避免前后端两份字段定义漂移
 * @internal
 */
export type ChatAttachmentRef = MeetChatAttachmentRef;

/**
 * @internal
 */
export interface ChatMessage {
	isLocal: boolean;
	participantName: string;
	message: string;
	timestamp: number;
	/** 归档历史消息携带;实时消息为 undefined(本地发送归档成功后回填当前场次) */
	meetingSessionId?: string;
	/** 附件消息:渲染缩略图(image)或文件卡片(file);纯文本消息为 undefined */
	attachment?: ChatAttachmentRef;
	/** 仅本地附件消息:上传中/失败标记(成功后删除该字段) */
	uploadStatus?: 'uploading' | 'failed';
	/** 仅本地附件消息:上传失败原因(用于悬停提示) */
	errorHint?: string;
	/** 仅本地附件消息:暂存原文件供失败重试 */
	pendingFile?: File;
	/** 私聊消息(1:1 定向):渲染私聊标记,不参与服务端归档 */
	isPrivate?: boolean;
	/** 发送者 identity(实时消息携带;用于会内 @提及命中判断) */
	fromIdentity?: string;
	/** 消息文本 @ 提及了本端昵称(渲染高亮 + 提醒) */
	mentionsMe?: boolean;
	/** 仅本地私聊消息:私聊对象昵称(气泡内"私聊至 X"标记) */
	toName?: string;
}

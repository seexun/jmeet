export type MeetAgendaItemStatus = 'pending' | 'active' | 'completed';
export interface MeetAgendaItem { agendaItemId:string; roomId:string; meetingSessionId?:string; title:string; description?:string; durationMinutes:number; status:MeetAgendaItemStatus; order:number; materialIds:string[]; pollIds:string[]; startedAt?:number; completedAt?:number; createdBy:string; createdAt:number; updatedAt:number; }
export interface MeetAgendaCreateRequest { title:string; description?:string; durationMinutes:number; materialIds?:string[]; pollIds?:string[]; }
export interface MeetChatArchiveMessage { messageId:string; roomId:string; meetingSessionId:string; participantIdentity:string; participantName:string; message:string; attachment?: MeetChatAttachmentRef; createdAt:number; }
export type MeetChatAttachmentType = 'image' | 'file';
/** 聊天消息里引用附件的轻量结构(DataChannel payload、归档消息、前端消息共用) */
export interface MeetChatAttachmentRef { attachmentId: string; type: MeetChatAttachmentType; fileName: string; mimeType: string; size: number; }
/** 附件元数据完整记录(仅后端 ChatAttachmentModel 使用,storageKey 不下发给客户端) */
export interface MeetChatAttachment extends MeetChatAttachmentRef { roomId: string; meetingSessionId?: string; uploaderIdentity: string; uploaderName: string; storageKey: string; createdAt: number; }

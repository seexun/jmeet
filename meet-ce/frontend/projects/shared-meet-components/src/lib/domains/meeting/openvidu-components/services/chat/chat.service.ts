import { effect, inject, Injectable, signal } from '@angular/core';
import { ChatAttachmentRef, ChatMessage } from '../../models/chat.model';
import { ILogger } from '../../models/logger.model';
import { INotificationOptions } from '../../models/notification-options.model';

import { DataTopic } from '../../models/data-topic.model';
import { PanelType } from '../../models/panel.model';
import { ActionService } from '../action/action.service';
import { LoggerService } from '../logger/logger.service';
import { PanelService } from '../panel/panel.service';
import { ParticipantService } from '../participant/participant.service';
import { MeetingTranslateService } from '../translate/meeting-translate.service';
import { AssetsService } from '../../../../../shared/services/assets.service';
import { HttpService } from '../../../../../shared/services/http.service';
import { MeetingContextService } from '../../../services/meeting-context.service';

/** 归档的历史消息条目(GET .../collaboration/chat,items 按 createdAt 倒序) */
interface ArchivedChatMessage {
	messageId: string;
	meetingSessionId: string;
	participantIdentity: string;
	participantName: string;
	message: string;
	createdAt: number;
	attachment?: ChatAttachmentRef;
}

interface RoomChatHistoryResponse {
	items: ArchivedChatMessage[];
	hasMore: boolean;
}

const CHAT_HISTORY_PAGE_SIZE = 50;

/**
 * @internal
 */
@Injectable({
	providedIn: 'root'
})
export class ChatService {
	private readonly participantService = inject(ParticipantService);
	private readonly panelService = inject(PanelService);
	private readonly actionService = inject(ActionService);
	private readonly translateService = inject(MeetingTranslateService);
	private readonly assets = inject(AssetsService);
	private readonly http = inject(HttpService);
	private readonly meetingContext = inject(MeetingContextService);
	private log: ILogger = inject(LoggerService).get('ChatService');

	chatMessages = signal<ChatMessage[]>([]);
	/** 历史是否还有更早一页可加载 */
	readonly hasMoreHistory = signal(false);
	// Chat notification sound served as a static asset (resolves in SPA & WC modes),
	// matching SoundService instead of inlining the audio as base64.
	private messageSound: HTMLAudioElement = new Audio(this.assets.chatMessageSound);
	private messageList: ChatMessage[] = [];
	/** 历史首页是否已为当前房间加载过(面板重复打开不重复拉同一页) */
	private historyFirstPageLoaded = false;
	/** 历史请求进行中标记,避免并发重复拉取 */
	private loadingHistory = false;
	/** 翻页游标:当前已加载最早一条历史消息的 messageId(实时消息没有 messageId,不可作游标) */
	private earliestHistoryMessageId?: string;
	/** 最近一次见过的房间 ID,用于在加入/切换房间时重置聊天状态 */
	private lastRoomId?: string;
	/** 图片缩略图的 blob objectURL 缓存(attachmentId → objectURL),房间切换时统一 revoke */
	private readonly attachmentUrlCache = new Map<string, string>();
	/** 进行中的附件 blob 请求(attachmentId → in-flight Promise),并发调用复用同一请求避免重复 fetch 与 objectURL 泄漏 */
	private readonly attachmentUrlRequests = new Map<string, Promise<string | undefined>>();

	constructor() {
		this.messageSound.volume = 0.6;
		// 聊天历史按房间归档;离开再进入(或换房间)时清空内存列表,
		// 由面板打开时的 loadHistory 重新拉取,避免上一场的实时消息与新拉取的历史重复。
		effect(() => {
			const roomId = this.meetingContext.roomId();
			if (roomId === this.lastRoomId) return;
			this.lastRoomId = roomId;
			this.resetChatState();
		});
	}

	/** Adds a new message to the chat from a remote participant
	 * @param message
	 * @param participantName
	 * @param attachment 远端附件消息携带的附件引用(纯文本消息为 undefined)
	 * @param options 私聊/@提及等实时消息元数据
	 */
	async addRemoteMessage(
		message: string,
		participantName: string,
		attachment?: ChatAttachmentRef,
		options?: { isPrivate?: boolean; fromIdentity?: string }
	) {
		const mentionsMe = this.messageMentionsMe(message);
		this.addMessage(message, false, participantName, attachment, {
			isPrivate: options?.isPrivate,
			fromIdentity: options?.fromIdentity,
			mentionsMe
		});
		if (!this.panelService.isChatPanelOpened()) {
			const notificationMessage = mentionsMe
				? `${participantName} 在聊天中提到了你`
				: this.translateService.translate('PANEL.CHAT.MESSAGE_SENT_NOTIFICATION');
			const action = this.translateService.translate('PANEL.CHAT.OPEN_CHAT');
			const notificationOptions: INotificationOptions = {
				message: `${participantName.toUpperCase()} ${notificationMessage}`,
				buttonActionText: action
			};
			this.launchNotification(notificationOptions);
			this.messageSound.play().catch(() => {});
		}
	}

	/** 文本是否 @ 了本端昵称（@昵称 整词匹配，昵称含空格时匹配 @前缀） */
	private messageMentionsMe(message: string): boolean {
		const myName = this.participantService.getMyName()?.trim();
		if (!myName || !message.includes('@')) return false;
		const firstName = myName.split(/\s+/)[0];
		const escaped = firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		return new RegExp(`@${escaped}(?![\\w\\u4e00-\\u9fa5])`).test(message);
	}

	/**
	 * Sends a chat message through the data channel.
	 *
	 * @param message The message text to send
	 * @param to 私聊目标 identity;不传(或空)为公共消息。私聊仅定向数据通道投递,不归档
	 */
	async sendMessage(message: string, to?: string) {
		const plainTextMessage = message.replace(/ +(?= )/g, '');
		if (plainTextMessage !== '' && plainTextMessage !== ' ') {
			try {
				const isPrivate = !!to;
				const myIdentity = this.participantService.getMyIdentity();
				// Create message payload
				const payload = JSON.stringify({ message: plainTextMessage, ...(isPrivate ? { to, fromIdentity: myIdentity } : {}) });
				const data: Uint8Array = new TextEncoder().encode(payload);

				// Send through data channel (private messages are delivered to the target only)
				await this.participantService.publishData(data, {
					topic: DataTopic.CHAT,
					reliable: true,
					...(isPrivate ? { destinationIdentities: [to!] } : {})
				});

				// Add to local message list
				const targetName = isPrivate
					? this.participantService.remoteParticipants().find((p) => p.identity === to)?.name ?? '成员'
					: undefined;
				const localMessage = this.addMessage(plainTextMessage, true, this.participantService.getMyName()!, undefined, {
					isPrivate,
					fromIdentity: myIdentity,
					toName: targetName
				});
				// 私聊不写入服务端归档(内容仅两端可见);公共消息照常归档并回填场次
				if (!isPrivate) {
					await this.archive(plainTextMessage, this.participantService.getMyName()!, localMessage);
				}
			} catch (error) {
				this.log.e('Error sending chat message:', error);
				throw error;
			}
		}
	}

	/**
	 * 发送附件消息:先以占位消息进入列表(uploading),上传成功后广播
	 * {message, attachment} payload 并归档;失败则标记 failed 供重试。
	 *
	 * @param file 用户选择的本地文件(图片或普通文件)
	 * @param reuseMessage 重试时复用的占位消息对象(不传则新插一条占位消息)
	 */
	async sendAttachment(file: File, reuseMessage?: ChatMessage): Promise<void> {
		const roomId = this.meetingContext.roomId();
		if (!roomId) return;
		const mimeType = file.type || 'application/octet-stream';
		const isImage = mimeType.startsWith('image/') && mimeType !== 'image/svg+xml';
		const placeholder: ChatMessage = reuseMessage ?? {
			isLocal: true,
			participantName: this.participantService.getMyName()!,
			message: '',
			timestamp: Date.now(),
			attachment: { attachmentId: '', type: isImage ? 'image' : 'file', fileName: file.name, mimeType, size: file.size },
			uploadStatus: 'uploading',
			pendingFile: file
		};
		if (reuseMessage) {
			// 重试:复用原占位消息,不新插一条
			reuseMessage.uploadStatus = 'uploading';
			reuseMessage.pendingFile = file;
			delete reuseMessage.errorHint;
			reuseMessage.attachment = { attachmentId: '', type: isImage ? 'image' : 'file', fileName: file.name, mimeType, size: file.size };
		} else {
			this.messageList.push(placeholder);
		}
		this.chatMessages.set([...this.messageList]);
		try {
			const uploaded = await this.http.postBlobRequest<ChatAttachmentRef>(
				`${HttpService.INTERNAL_API_PATH_PREFIX}/meetings/${roomId}/chat-attachments`,
				file,
				{ 'x-file-name': encodeURIComponent(file.name), 'x-file-content-type': mimeType, 'x-participant-name': encodeURIComponent(this.participantService.getMyName() ?? '') }
			);
			const messageText = this.placeholderText(uploaded);
			const payload = JSON.stringify({ message: messageText, attachment: uploaded });
			await this.participantService.publishData(new TextEncoder().encode(payload), { topic: DataTopic.CHAT, reliable: true });
			placeholder.attachment = uploaded;
			placeholder.message = messageText;
			delete placeholder.pendingFile;
			delete placeholder.uploadStatus;
			await this.archive(messageText, this.participantService.getMyName()!, placeholder, uploaded);
		} catch (error: any) {
			this.log.e('Error sending attachment:', error);
			placeholder.uploadStatus = 'failed';
			placeholder.errorHint = error?.error?.message || error?.message || 'upload failed';
		} finally {
			this.chatMessages.set([...this.messageList]);
		}
	}

	private placeholderText(attachment: ChatAttachmentRef): string {
		const key = attachment.type === 'image' ? 'PANEL.CHAT.IMAGE_PLACEHOLDER' : 'PANEL.CHAT.FILE_PLACEHOLDER';
		return this.translateService.translate(key).replace('{name}', attachment.fileName);
	}

	/** 移除一条本地消息(上传失败占位的"移除"操作) */
	removeMessage(target: ChatMessage): void {
		this.messageList = this.messageList.filter((m) => m !== target);
		this.chatMessages.set([...this.messageList]);
	}

	/** 图片缩略图的 blob objectURL 缓存;房间切换时统一 revoke */
	async getAttachmentUrl(attachmentId: string): Promise<string | undefined> {
		if (!attachmentId) return undefined;
		const cached = this.attachmentUrlCache.get(attachmentId);
		if (cached) return cached;
		const inflight = this.attachmentUrlRequests.get(attachmentId);
		if (inflight) return inflight;
		const roomId = this.meetingContext.roomId();
		if (!roomId) return undefined;
		const request = (async () => {
			try {
				const blob = await this.http.getBlobRequest(`${HttpService.INTERNAL_API_PATH_PREFIX}/meetings/${roomId}/chat-attachments/${attachmentId}/content`);
				const url = URL.createObjectURL(blob);
				this.attachmentUrlCache.set(attachmentId, url);
				return url;
			} catch (error) {
				this.log.w('Loading chat attachment failed:', error);
				return undefined;
			} finally {
				this.attachmentUrlRequests.delete(attachmentId);
			}
		})();
		this.attachmentUrlRequests.set(attachmentId, request);
		return request;
	}

	async downloadAttachment(attachment: ChatAttachmentRef): Promise<void> {
		const roomId = this.meetingContext.roomId();
		if (!roomId) return;
		const blob = await this.http.getBlobRequest(`${HttpService.INTERNAL_API_PATH_PREFIX}/meetings/${roomId}/chat-attachments/${attachment.attachmentId}/content`);
		const url = URL.createObjectURL(blob);
		try {
			const anchor = document.createElement('a');
			anchor.href = url;
			anchor.download = attachment.fileName;
			anchor.click();
		} finally {
			URL.revokeObjectURL(url);
		}
	}

	/**
	 * 加载最近一页房间聊天历史(归档消息,头部插入)。面板每次打开都会调用,
	 * 同一房间仅真正拉取一次;失败后下次打开可重试。
	 */
	async loadHistory(): Promise<void> {
		if (this.historyFirstPageLoaded || this.loadingHistory) return;
		this.historyFirstPageLoaded = await this.fetchHistoryPage();
	}

	/**
	 * 以当前最早一条历史消息的 messageId 为游标,向前加载更早一页历史。
	 */
	async loadMoreHistory(): Promise<void> {
		if (!this.hasMoreHistory() || this.loadingHistory || !this.earliestHistoryMessageId) return;
		await this.fetchHistoryPage(this.earliestHistoryMessageId);
	}

	private async fetchHistoryPage(before?: string): Promise<boolean> {
		const roomId = this.meetingContext.roomId();
		if (!roomId) return false;
		this.loadingHistory = true;
		try {
			const query = `?limit=${CHAT_HISTORY_PAGE_SIZE}${before ? `&before=${encodeURIComponent(before)}` : ''}`;
			const res = await this.http.getRequest<RoomChatHistoryResponse>(
				`${HttpService.INTERNAL_API_PATH_PREFIX}/meetings/${roomId}/collaboration/chat${query}`
			);
			this.hasMoreHistory.set(!!res.hasMore);
			if (res.items?.length) {
				// 接口按 createdAt 倒序返回(newest-first),反转为正序后插入头部。
				// 归档时的 participantIdentity 即后端 actor()(参会者身份),与本地身份
				// 一致的历史消息按本人消息渲染(右侧 + "你"),不受重名影响。
				const localIdentity = this.participantService.localParticipantIdentitySignal();
				const history: ChatMessage[] = res.items
					.slice()
					.reverse()
					.map((m) => ({
						isLocal: !!localIdentity && m.participantIdentity === localIdentity,
						participantName: m.participantName,
						message: m.message,
						timestamp: m.createdAt,
						meetingSessionId: m.meetingSessionId,
						attachment: m.attachment
					}));
				this.messageList = [...history, ...this.messageList];
				this.chatMessages.set([...this.messageList]);
				// items 末尾即本页最早的一条,作为下一次翻页游标
				this.earliestHistoryMessageId = res.items[res.items.length - 1].messageId;
			}
			return true;
		} catch (error) {
			this.log.w('Loading chat history failed:', error);
			return false;
		} finally {
			this.loadingHistory = false;
		}
	}

	private resetChatState(): void {
		this.messageList = [];
		this.chatMessages.set([]);
		this.hasMoreHistory.set(false);
		this.historyFirstPageLoaded = false;
		this.loadingHistory = false;
		this.earliestHistoryMessageId = undefined;
		for (const url of this.attachmentUrlCache.values()) URL.revokeObjectURL(url);
		this.attachmentUrlCache.clear();
		// 房间切换后残留的 in-flight 兑现只会写入一个无人引用、下次 reset 会被 revoke 的缓存条目,attachmentId 全局唯一不会张冠李戴
		this.attachmentUrlRequests.clear();
	}

	private async archive(message: string, participantName: string, localMessage?: ChatMessage, attachment?: ChatAttachmentRef): Promise<void> {
		const roomId = this.meetingContext.roomId();
		if (!roomId) return;
		try {
			const archived = await this.http.postRequest<{ meetingSessionId?: string }>(
				`${HttpService.INTERNAL_API_PATH_PREFIX}/meetings/${roomId}/collaboration/chat`,
				{ message, participantName, ...(attachment ? { attachment } : {}) }
			);
			// 归档成功后把本地消息标记为当前场次,使历史与本场之间能渲染场次分隔线
			if (localMessage && archived?.meetingSessionId) {
				localMessage.meetingSessionId = archived.meetingSessionId;
				this.chatMessages.set([...this.messageList]);
			}
		} catch (error) {
			this.log.w('Chat delivered but archive failed:', error);
		}
	}

	private addMessage(
		message: string,
		isLocal: boolean,
		participantName: string,
		attachment?: ChatAttachmentRef,
		options?: { isPrivate?: boolean; fromIdentity?: string; mentionsMe?: boolean; toName?: string }
	): ChatMessage {
		const chatMessage: ChatMessage = {
			isLocal,
			participantName,
			message,
			timestamp: Date.now(),
			attachment,
			isPrivate: options?.isPrivate || undefined,
			fromIdentity: options?.fromIdentity || undefined,
			mentionsMe: options?.mentionsMe || undefined,
			toName: options?.toName || undefined
		};
		this.messageList.push(chatMessage);
		this.chatMessages.set([...this.messageList]);
		return chatMessage;
	}

	private launchNotification(options: INotificationOptions) {
		this.actionService.launchNotification(
			options,
			this.panelService.togglePanel.bind(this.panelService, PanelType.CHAT)
		);
	}
}

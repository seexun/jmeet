import { CommonModule } from '@angular/common';
import {
	AfterViewInit,
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	ElementRef,
	HostListener,
	inject,
	signal,
	TemplateRef,
	viewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalRef, NzModalService } from 'ng-zorro-antd/modal';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { ChatMessage } from '../../../models/chat.model';
import { PanelType } from '../../../models/panel.model';
import { LinkifyPipe } from '../../../pipes/linkify.pipe';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { ChatService } from '../../../services/chat/chat.service';
import { E2eeService } from '../../../services/e2ee/e2ee.service';
import { PanelService } from '../../../services/panel/panel.service';
import { ParticipantService } from '../../../services/participant/participant.service';
import { MeetingTranslateService } from '../../../services/translate/meeting-translate.service';
import { NotificationService } from '../../../../../../shared/services/notification.service';
import { QQ_EMOTICONS, QqEmoticon } from './qq-emoticons';

const CHAT_MAX_LENGTH = 500;
/** 距顶部不超过该像素值时触发加载更早历史 */
const SCROLL_LOAD_MORE_THRESHOLD = 40;

/**
 *
 * The **ChatPanelComponent** is an integral part of the {@link PanelComponent} and serves as the interface for displaying the session chat.
 */
@Component({
	selector: 'ov-chat-panel',
	imports: [CommonModule, FormsModule, NzIconModule, NzTooltipModule, NzInputModule, NzDropDownModule, NzMenuModule, NzSelectModule, TranslatePipe, LinkifyPipe],
	templateUrl: './chat-panel.component.html',
	styleUrls: ['../panel.component.scss', './chat-panel.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true
})
export class ChatPanelComponent implements AfterViewInit {
	// EP 消息流头像：按昵称哈希取 EP 五色，取首字母
	private static readonly AVATAR_COLORS = ['#006EFF', '#67c23a', '#e6a23c', '#f56c6c', '#909399'];

	avatarInitial(name: string): string {
		const clean = (name || '').trim();
		return clean ? clean[0].toUpperCase() : '?';
	}

	avatarColor(name: string): string {
		let hash = 0;
		for (let i = 0; i < (name || '').length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
		return ChatPanelComponent.AVATAR_COLORS[hash % ChatPanelComponent.AVATAR_COLORS.length];
	}

	/**
	 * @ignore
	 */
	readonly chatScroll = viewChild<ElementRef>('chatScroll');
	/**
	 * @ignore
	 */
	readonly chatInput = viewChild<ElementRef<HTMLTextAreaElement>>('chatInput');
	/**
	 * @ignore
	 */
	readonly imageFileInput = viewChild<ElementRef<HTMLInputElement>>('imageFileInput');
	/**
	 * @ignore
	 */
	readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
	/**
	 * @ignore
	 */
	readonly message = signal<string>('');
	/**
	 * @ignore
	 */
	readonly messageList = computed(() => this.chatService.chatMessages());
	/**
	 * @ignore
	 */
	readonly emojiPickerOpen = signal(false);
	/** 私聊对象 identity(undefined = 发送到所有人) */
	readonly privateRecipient = signal<string | undefined>(undefined);
	/** @提及补全:当前输入的 @ 词(undefined = 补全面板关闭) */
	readonly mentionQuery = signal<string | undefined>(undefined);
	/** 可选私聊/@提及对象:远端参会人 */
	readonly dmCandidates = computed(() =>
		this.participantService.remoteParticipants().map((p) => ({ identity: p.identity, name: p.name || p.identity }))
	);
	/** @提及候选(按已输入片段过滤,最多 6 条) */
	readonly mentionSuggestions = computed(() => {
		const query = this.mentionQuery();
		if (query === undefined) return [];
		const lower = query.toLowerCase();
		return this.dmCandidates()
			.filter((candidate) => !lower || candidate.name.toLowerCase().includes(lower))
			.slice(0, 6);
	});
	/** 私聊对象昵称(输入框占位与气泡标记用) */
	readonly privateRecipientName = computed(() => {
		const identity = this.privateRecipient();
		if (!identity) return undefined;
		return this.dmCandidates().find((c) => c.identity === identity)?.name ?? '成员';
	});
	/**
	 * @ignore
	 */
	readonly emoticons = QQ_EMOTICONS;
	/** 图片附件 attachmentId → objectURL(由 effect 异步补齐) */
	readonly attachmentUrls = signal<Record<string, string>>({});
	/** 全屏预览中的图片 URL */
	readonly imagePreview = signal<string | null>(null);
	readonly imagePreviewTpl = viewChild.required<TemplateRef<unknown>>('imagePreviewTpl');
	private readonly modal = inject(NzModalService);
	private modalRef: NzModalRef | null = null;

	private readonly chatService = inject(ChatService);
	private readonly panelService = inject(PanelService);
	private readonly e2eeService = inject(E2eeService);
	private readonly participantService = inject(ParticipantService);
	private readonly notificationService = inject(NotificationService);
	private readonly translateService = inject(MeetingTranslateService);
	private readonly host = inject(ElementRef<HTMLElement>);

	/** 最近一次渲染的末条消息:尾部变化(新消息)才自动滚到底,历史头部插入不抢滚动 */
	private lastRenderedMessage: ChatMessage | undefined;
	private loadingMoreHistory = false;
	/** 全屏预览对应的原始消息(用于预览态下载原文件) */
	private imagePreviewMessage?: ChatMessage;

	private readonly scrollEffect = effect(() => {
		const messages = this.messageList();
		const lastMessage = messages[messages.length - 1];
		const hasNewMessage = lastMessage !== this.lastRenderedMessage;
		this.lastRenderedMessage = lastMessage;

		if (hasNewMessage && this.panelService.isChatPanelOpened()) {
			this.scrollToBottom();
		}
	});

	/** 图片附件按 attachmentId 异步加载 blob objectURL,已加载的跳过 */
	private readonly attachmentUrlEffect = effect(() => {
		const messages = this.messageList();
		const loaded = this.attachmentUrls();
		for (const m of messages) {
			if (m.attachment?.type !== 'image' || !m.attachment.attachmentId || loaded[m.attachment.attachmentId]) continue;
			void this.chatService.getAttachmentUrl(m.attachment.attachmentId).then((url) => {
				if (!url) return;
				// 仍在本房间且仍需要时才落位(reload/切换后避免旧 URL 写回)
				this.attachmentUrls.update((map) => (map[m.attachment!.attachmentId] ? map : { ...map, [m.attachment!.attachmentId]: url }));
			});
		}
	});

	/**
	 * @ignore
	 */
	@HostListener('document:click', ['$event'])
	onDocumentClick(event: MouseEvent): void {
		if (!this.emojiPickerOpen()) return;
		if (!this.host.nativeElement.contains(event.target as Node)) {
			this.emojiPickerOpen.set(false);
		}
	}

	/**
	 * @ignore
	 * Esc 关闭图片全屏预览。
	 */
	@HostListener('document:keydown.escape')
	onEscape(): void {
		this.closeImagePreview();
	}

	/**
	 * @ignore
	 */
	ngAfterViewInit() {
		// 面板每次打开都会重建本组件;service 侧保证同一房间仅加载一次首页
		void this.loadHistoryWithScrollAnchor(() => this.chatService.loadHistory());
		setTimeout(() => {
			this.scrollToBottom();
			this.chatInput()?.nativeElement.focus();
		}, 100);
	}

	/**
	 * @ignore
	 * 历史消息插入头部后,补偿新增高度,保持当前阅读位置不跳动;
	 * 若原本就在底部则等效于继续贴底。
	 */
	private async loadHistoryWithScrollAnchor(loader: () => Promise<void>): Promise<void> {
		const container = this.chatScroll()?.nativeElement;
		const previousScrollHeight = container?.scrollHeight ?? 0;
		await loader();
		if (!container) return;
		// 等待一帧让新增内容渲染后再补偿
		await new Promise<void>((resolve) => setTimeout(resolve, 20));
		const heightDelta = container.scrollHeight - previousScrollHeight;
		if (heightDelta > 0) container.scrollTop += heightDelta;
	}

	/**
	 * @ignore
	 * 滚动到顶部附近时加载更早的历史消息(若有)。
	 */
	onMessagesScroll(): void {
		if (this.loadingMoreHistory) return;
		if (!this.chatService.hasMoreHistory()) return;
		const container = this.chatScroll()?.nativeElement;
		if (!container || container.scrollTop > SCROLL_LOAD_MORE_THRESHOLD) return;
		this.loadingMoreHistory = true;
		void this.loadHistoryWithScrollAnchor(() => this.chatService.loadMoreHistory()).finally(() => {
			this.loadingMoreHistory = false;
		});
	}

	/**
	 * @ignore
	 */
	eventKeyPress(event: KeyboardEvent): void {
		// Pressed 'Enter' key
		if (event && event.key === 'Enter') {
			event.preventDefault();
			this.sendMessage();
		}
	}

	/**
	 * @ignore
	 */
	async sendMessage(): Promise<void> {
		const text = this.message();
		if (!text.trim()) return;
		// Clear the submitted draft before waiting, so a later send completion
		// cannot erase text the user has already started typing.
		this.message.set('');
		this.emojiPickerOpen.set(false);
		this.mentionQuery.set(undefined);
		try {
			await this.chatService.sendMessage(text, this.privateRecipient());
		} catch (error) {
			if (!this.message()) this.message.set(text);
			throw error;
		}
	}

	/**
	 * @ignore
	 * 选择私聊对象(undefined = 所有人)。
	 */
	onRecipientSelected(identity: string | undefined): void {
		this.privateRecipient.set(identity || undefined);
	}

	/**
	 * @ignore
	 * 输入变化时检测末尾是否处于 "@片段" 状态,驱动提及补全列表。
	 */
	onMessageInput(value: string): void {
		this.message.set(value);
		const match = /@([\w\u4e00-\u9fa5]*)$/.exec(value);
		this.mentionQuery.set(match ? match[1] : undefined);
	}

	/**
	 * @ignore
	 * 选中提及候选:替换末尾 "@片段" 为 "@昵称 "(带空格便于继续输入)。
	 */
	insertMention(name: string): void {
		const current = this.message().replace(/@([\w\u4e00-\u9fa5]*)$/, `@${name} `);
		this.message.set(current);
		this.mentionQuery.set(undefined);
		const textarea = this.chatInput()?.nativeElement;
		requestAnimationFrame(() => textarea?.focus());
	}

	/**
	 * @ignore
	 */
	toggleEmojiPicker(event: MouseEvent): void {
		event.stopPropagation();
		this.emojiPickerOpen.update((open) => !open);
	}

	/**
	 * @ignore
	 */
	insertEmoticon(emoticon: QqEmoticon, event: MouseEvent): void {
		event.stopPropagation();
		const textarea = this.chatInput()?.nativeElement;
		const current = this.message();
		const emoji = emoticon.emoji;

		if (current.length + emoji.length > CHAT_MAX_LENGTH) {
			return;
		}

		if (!textarea) {
			this.message.set(current + emoji);
			return;
		}

		const start = textarea.selectionStart ?? current.length;
		const end = textarea.selectionEnd ?? current.length;
		const next = `${current.slice(0, start)}${emoji}${current.slice(end)}`;

		if (next.length > CHAT_MAX_LENGTH) {
			return;
		}

		this.message.set(next);

		const caret = start + emoji.length;
		requestAnimationFrame(() => {
			textarea.focus();
			textarea.setSelectionRange(caret, caret);
		});
	}

	/**
	 * @ignore
	 */
	scrollToBottom(): void {
		const chatScroll = this.chatScroll();
		if (!chatScroll) return;

		setTimeout(() => {
			try {
				chatScroll.nativeElement.scrollTop = chatScroll.nativeElement.scrollHeight;
			} catch (err) {}
		}, 20);
	}

	/**
	 * @ignore
	 */
	close() {
		this.panelService.togglePanel(PanelType.CHAT);
	}

	/**
	 * @ignore
	 */
	hasEncryptionKeyMismatch = computed(() => {
		if (!this.e2eeService.isEnabled) {
			return false;
		}
		return this.participantService.hasRemoteEncryptionErrorsSignal();
	});

	/**
	 * @ignore
	 * Show name/time only when sender changes (dense chat grouping).
	 */
	/**
	 * 微信式交互：每条消息独立展示（头像/昵称/时间重复），不再折叠连续同人消息。
	 * 保留方法签名以兼容模板与潜在覆写。
	 */
	shouldShowMeta(index: number): boolean {
		return this.messageList()[index] != null;
	}

	/**
	 * @ignore
	 * 相邻两条均为带场次 ID 的消息(归档历史/已归档回填的本场消息)且场次不同时,
	 * 在两者之间渲染"上一场会议"分隔线。
	 */
	shouldShowSessionDivider(index: number): boolean {
		const messages = this.messageList();
		const current = messages[index];
		const previous = messages[index - 1];
		if (!current?.meetingSessionId || !previous?.meetingSessionId) return false;
		return current.meetingSessionId !== previous.meetingSessionId;
	}

	/**
	 * @ignore
	 * 分隔线时间取上一场最后一条消息的发送时间。
	 */
	sessionDividerTime(index: number): number {
		return this.messageList()[index - 1]?.timestamp ?? 0;
	}

	/**
	 * @ignore
	 * 附件 input 的 change 事件:取首个文件发送,并重置 input 以便重复选择同一文件。
	 */
	onAttachmentSelected(event: Event): void {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (file) void this.chatService.sendAttachment(file);
	}

	/**
	 * @ignore
	 * 输入框粘贴图片(截图)时直接作为附件发送。
	 */
	onPaste(event: ClipboardEvent): void {
		const items = event.clipboardData?.items;
		if (!items) return;
		for (const item of items) {
			if (item.type.startsWith('image/')) {
				event.preventDefault();
				const blob = item.getAsFile();
				if (!blob) return;
				void this.chatService.sendAttachment(new File([blob], `paste-${Date.now()}.png`, { type: blob.type }));
				return;
			}
		}
	}

	/**
	 * @ignore
	 * 上传失败消息的重试:复用原占位消息对象重新上传。
	 */
	retryAttachment(data: ChatMessage): void {
		if (!data.pendingFile) return;
		void this.chatService.sendAttachment(data.pendingFile, data);
	}

	/**
	 * @ignore
	 * 移除上传失败的消息。
	 */
	removeAttachment(data: ChatMessage): void {
		this.chatService.removeMessage(data);
	}

	/**
	 * @ignore
	 * 打开图片全屏预览(记录来源消息供预览态下载原文件)。
	 */
	openImagePreview(url: string, data: ChatMessage): void {
		this.imagePreviewMessage = data;
		this.imagePreview.set(url);
		// NzModal 承载：挂 body，绕开 dock 面板动画 transform 对后代 fixed 的捕获
		this.modalRef = this.modal.create({
			nzContent: this.imagePreviewTpl(),
			nzClassName: 'image-preview-modal',
			nzCentered: true,
			nzWidth: 'min(94vw, 1400px)',
			nzFooter: null,
			nzClosable: false
		});
		this.modalRef.afterClose.subscribe(() => {
			this.imagePreview.set(null);
			this.imagePreviewMessage = undefined;
			this.modalRef = null;
		});
	}

	/**
	 * @ignore
	 */
	closeImagePreview(): void {
		this.modalRef?.close();
	}

	/**
	 * @ignore
	 * 预览遮罩内的下载链接:走附件原文件下载。
	 */
	downloadImageFromPreview(event: MouseEvent): void {
		event.preventDefault();
		const attachment = this.imagePreviewMessage?.attachment;
		if (!attachment) return;
		this.chatService.downloadAttachment(attachment).catch(() => this.notifyFileUnavailable());
	}

	/**
	 * @ignore
	 * 文件卡片下载按钮。
	 */
	async downloadAttachment(data: ChatMessage): Promise<void> {
		if (!data.attachment) return;
		try {
			await this.chatService.downloadAttachment(data.attachment);
		} catch {
			// 下载失败:文件已失效,toast 提示(计划自检补遗)
			this.notifyFileUnavailable();
		}
	}

	/**
	 * @ignore
	 * 附件下载失败提示(文件已失效),与会议资料下载失败同一通知通道。
	 */
	private notifyFileUnavailable(): void {
		this.notificationService.showSnackbar(this.translateService.translate('PANEL.CHAT.FILE_UNAVAILABLE'));
	}

	/**
	 * @ignore
	 * 文件大小展示(B/KB/MB)。
	 */
	formatSize(size: number): string {
		if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
		if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
		return `${size} B`;
	}

	/**
	 * @ignore
	 */
	formatTime(timestamp: number): string {
		const date = new Date(timestamp);
		const hours = `${date.getHours()}`.padStart(2, '0');
		const minutes = `${date.getMinutes()}`.padStart(2, '0');
		return `${hours}:${minutes}`;
	}
}

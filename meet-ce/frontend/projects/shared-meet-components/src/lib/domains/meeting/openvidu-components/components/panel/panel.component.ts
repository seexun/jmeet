import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    inject,
    OnInit,
    output,
    signal
} from '@angular/core';
import {
    ActivitiesPanelStatusEvent,
    ChatPanelStatusEvent,
    PanelStatusInfo,
    PanelType,
    ParticipantsPanelStatusEvent,
    SettingsPanelStatusEvent
} from '../../models/panel.model';
import { PanelService } from '../../services/panel/panel.service';
import { TemplateRegistryService } from '../../services/template/template-registry.service';
import { ChatService } from '../../services/chat/chat.service';
import { OpenViduComponentsConfigService } from '../../services/config/directive-config.service';
import { ParticipantService } from '../../services/participant/participant.service';
import { RecordingService } from '../../services/recording/recording.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { ToolbarPanelButtonsComponent } from '../toolbar/toolbar-panel-buttons/toolbar-panel-buttons.component';
import { JmeetMeetingPanelComponent } from '../../../../../shared/components/meeting-panel/meeting-panel.component';

/**
 *
 * The **PanelComponent** is hosted inside of the {@link VideoconferenceComponent}.
 * It is in charge of displaying the videoconference panels providing functionalities to the videoconference app
 * such as the chat ({@link ChatPanelComponent}) and list of participants ({@link ParticipantsPanelComponent})
 */

@Component({
	selector: 'ov-panel',
	imports: [CommonModule, TranslatePipe, ToolbarPanelButtonsComponent, JmeetMeetingPanelComponent],
	templateUrl: './panel.component.html',
	styleUrls: ['./panel.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true
})
export class PanelComponent implements OnInit {
	private readonly panelService = inject(PanelService);
	private readonly chatService = inject(ChatService);
	private readonly participantService = inject(ParticipantService);
	private readonly recordingService = inject(RecordingService);
	private readonly libService = inject(OpenViduComponentsConfigService);
	readonly templateRegistry = inject(TemplateRegistryService);

	/**
	 * This event is fired when the chat panel status has been changed.
	 * It provides the new status of the chat panel represented by the {@link ChatPanelStatusEvent} object.
	 */
	onChatPanelStatusChanged = output<ChatPanelStatusEvent>();

	/**
	 * This event is fired when the participants panel status has been changed.
	 * It provides the new status of the participants panel represented by the {@link ParticipantsPanelStatusEvent} object.
	 */
	onParticipantsPanelStatusChanged = output<ParticipantsPanelStatusEvent>();

	/**
	 * This event is fired when the settings panel status has been changed.
	 * It provides the new status of the settings panel represented by the {@link SettingsPanelStatusEvent} object.
	 */
	onSettingsPanelStatusChanged = output<SettingsPanelStatusEvent>();

	/**
	 * This event is fired when the activities panel status has been changed.
	 * It provides the new status of the activities panel represented by the {@link ActivitiesPanelStatusEvent} object.
	 */
	onActivitiesPanelStatusChanged = output<ActivitiesPanelStatusEvent>();

	/**
	 * This event is fired when the background effects panel status has been changed.
	 * It provides the new status of the background effects panel represented by the {@link BackgroundEffectsPanelStatusEvent} object.
	 * @internal
	 */
	// @Output() onBackgroundEffectsPanelStatusChanged: EventEmitter<BackgroundEffectsPanelStatusEvent> = new EventEmitter<BackgroundEffectsPanelStatusEvent>();

	private panelEmitersHandler: Map<
		PanelType,
		{
			emit: (
				value:
					| ChatPanelStatusEvent
					| ParticipantsPanelStatusEvent
					| SettingsPanelStatusEvent
					| ActivitiesPanelStatusEvent
			) => void;
		}
	> = new Map();

	readonly panelOpened = this.panelService.panelOpened;

	// ── Dock tab 条取数：与 toolbar.component.ts 现行喂值表达式同源 ──
	/** Recording status fed to the tab strip (same source as the toolbar). */
	readonly recordingStatus = this.recordingService.recordingStatus.asReadonly();
	/** Total participants fed to the tab strip (same source as the toolbar). */
	readonly totalParticipants = this.participantService.totalParticipantsSignal;
	/** 能打开的面板才显示对应 tab：沿用 toolbar 的可见性信号（库配置）。 */
	readonly hasActivitiesPanel = this.libService.activitiesPanelButtonSignal;
	readonly hasParticipantsPanel = this.libService.participantsPanelButtonSignal;
	readonly hasChatPanel = this.libService.chatPanelButtonSignal;

	/** 未读消息数：计数与清零逻辑与 toolbar 的 chatMessagesEffect/menuTogglingEffect 同源。 */
	readonly unreadCount = signal(0);
	private readonly lastKnownChatMessageCount = signal(0);

	readonly isChatPanelOpened = computed(() => this.panelOpened().isOpened && this.panelOpened().panelType === PanelType.CHAT);
	readonly isParticipantsPanelOpened = computed(
		() => this.panelOpened().isOpened && this.panelOpened().panelType === PanelType.PARTICIPANTS
	);
	readonly isCaptionsPanelOpened = computed(
		() => this.panelOpened().isOpened && this.panelOpened().panelType === PanelType.CAPTIONS
	);
	readonly isBackgroundEffectsPanelOpened = computed(
		() => this.panelOpened().isOpened && this.panelOpened().panelType === PanelType.BACKGROUND_EFFECTS
	);
	readonly isSettingsPanelOpened = computed(
		() => this.panelOpened().isOpened && this.panelOpened().panelType === PanelType.SETTINGS
	);
	readonly isActivitiesPanelOpened = computed(
		() => this.panelOpened().isOpened && this.panelOpened().panelType === PanelType.ACTIVITIES
	);
	readonly isMediaQualityPanelOpened = computed(
		() => this.panelOpened().isOpened && this.panelOpened().panelType === PanelType.MEDIA_QUALITY
	);
	readonly isExternalPanelOpened = computed(
		() =>
			this.panelOpened().isOpened &&
			!this.isSettingsPanelOpened() &&
			!this.isBackgroundEffectsPanelOpened() &&
			!this.isChatPanelOpened() &&
			!this.isCaptionsPanelOpened() &&
			!this.isParticipantsPanelOpened() &&
			!this.isActivitiesPanelOpened() &&
			!this.isMediaQualityPanelOpened()
	);
	private readonly panelTogglingEffect = effect(() => {
		this.sendPanelStatusChangedEvent(this.panelOpened());
	});

	// 与 toolbar.chatMessagesEffect 同源：聊天面板未开且有新消息时累加未读
	private readonly chatUnreadEffect = effect(() => {
		const messages = this.chatService.chatMessages();
		const currentMessageCount = messages.length;
		const previousMessageCount = this.lastKnownChatMessageCount();
		const newMessagesCount = Math.max(0, currentMessageCount - previousMessageCount);

		// Only update unread messages if panel is not open AND there are new messages
		// Do this calculation BEFORE modifying lastKnownChatMessageCount
		if (!this.panelService.isChatPanelOpened() && newMessagesCount > 0) {
			this.unreadCount.update((count) => count + newMessagesCount);
		}

		// NOW update the signals for next effect run
		this.lastKnownChatMessageCount.set(currentMessageCount);
	});

	// 与 toolbar.menuTogglingEffect 同源：聊天面板打开即清零未读
	private readonly chatOpenedResetEffect = effect(() => {
		const ev = this.panelOpened();
		if (ev.isOpened && ev.panelType === PanelType.CHAT) {
			this.unreadCount.set(0);
		}
	});

	/** Dock 头部标题：按当前打开面板返回对应 translate key（无匹配时为空，仅显关闭钮）。 */
	readonly panelTitle = computed(() => {
		switch (this.panelOpened().panelType) {
			case PanelType.CHAT:
				return 'PANEL.CHAT.TITLE';
			case PanelType.PARTICIPANTS:
				return 'PANEL.PARTICIPANTS.TITLE';
			case PanelType.SETTINGS:
				return 'PANEL.SETTINGS.TITLE';
			case PanelType.ACTIVITIES:
				return 'PANEL.ACTIVITIES.TITLE';
			case PanelType.MEDIA_QUALITY:
				return 'PANEL.MEDIA_QUALITY.TITLE';
			case PanelType.BACKGROUND_EFFECTS:
				return 'PANEL.BACKGROUND.TITLE';
			case PanelType.CAPTIONS:
				return 'PANEL.CAPTIONS.TITLE';
			default:
				return '';
		}
	});

	/**
	 * Closes the currently opened panel through the panel service (dock head close button).
	 */
	closeCurrent() {
		const { isOpened, panelType } = this.panelOpened();
		if (isOpened && panelType) {
			this.panelService.togglePanel(panelType);
		}
	}

	/**
	 * @ignore
	 */
	toggleParticipants() {
		this.panelService.togglePanel(PanelType.PARTICIPANTS);
	}

	/**
	 * @ignore
	 */
	toggleChat() {
		this.panelService.togglePanel(PanelType.CHAT);
	}

	/**
	 * @internal
	 * @param expandPanel
	 */
	toggleActivitiesPanel(expandPanel: string) {
		this.panelService.togglePanel(PanelType.ACTIVITIES, expandPanel);
	}

	/**
	 * @ignore
	 */
	ngOnInit(): void {
		this.panelEmitersHandler.set(PanelType.CHAT, this.onChatPanelStatusChanged);
		this.panelEmitersHandler.set(PanelType.PARTICIPANTS, this.onParticipantsPanelStatusChanged);
		this.panelEmitersHandler.set(PanelType.SETTINGS, this.onSettingsPanelStatusChanged);
		this.panelEmitersHandler.set(PanelType.ACTIVITIES, this.onActivitiesPanelStatusChanged);
	}

	/**
	 * @ignore
	 */
	ngOnDestroy() {
	}

	private sendPanelStatusChangedEvent(event: PanelStatusInfo) {
		const { panelType, isOpened, previousPanelType } = event;

		// Emit to the current panel
		if (panelType) {
			const panelMatch = this.panelEmitersHandler.get(panelType as PanelType);
			if (panelMatch) panelMatch.emit({ isOpened });
		}

		// Emit to the previous panel if it's different from the current one
		if (previousPanelType && panelType !== previousPanelType) {
			const previousPanelMatch = this.panelEmitersHandler.get(previousPanelType as PanelType);
			if (previousPanelMatch) previousPanelMatch.emit({ isOpened: false });
		}
	}
}

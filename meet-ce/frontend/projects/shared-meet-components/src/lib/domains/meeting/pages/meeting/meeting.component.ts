import { NgTemplateOutlet } from '@angular/common';
import { DatePipe } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	contentChild,
	effect,
	inject,
	OnInit,
	signal,
	untracked
} from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { TranslateService } from '../../../../shared/services/i18n/translate.service';
import { RuntimeConfigService } from '../../../../shared/services/runtime-config.service';
import { NotificationService } from '../../../../shared/services/notification.service';
import { SoundService } from '../../../../shared/services/sound.service';
import { MeetingLobbyComponent } from '../../components/meeting-lobby/meeting-lobby.component';
import { MeetingParticipantsPanelComponent } from '../../customization/meeting-participants-panel/meeting-participants-panel.component';
import { MeetingParticipantItemComponent } from '../../customization/meeting-participant-item/meeting-participant-item.component';
import { OpenViduComponentsUiModule, OpenViduThemeMode, OpenViduThemeService, Room } from '../../openvidu-components';
import { MeetingContextService } from '../../services/meeting-context.service';
import { MeetingEventHandlerService } from '../../services/meeting-event-handler.service';
import { MeetingLobbyService } from '../../services/meeting-lobby.service';
import { MeetingThemeService } from '../../services/meeting-theme.service';
import { MeetingService } from '../../services/meeting.service';
import { MeetingSpotlightService } from '../../services/meeting-spotlight.service';
import { MeetingRenameService } from '../../services/meeting-rename.service';
import { MeetingShortcutsService } from '../../services/meeting-shortcuts.service';
import { MeetingPipService } from '../../services/meeting-pip.service';
import { RoomFeatureService } from '../../../rooms/services/room-feature.service';
import { MeetRoomMemberUIBadge } from '@openvidu-meet/typings';

@Component({
	selector: 'ov-meeting',
	templateUrl: './meeting.component.html',
	styleUrls: ['./meeting.component.scss'],
	imports: [
		OpenViduComponentsUiModule,
		NgTemplateOutlet,
		DatePipe,
		FormsModule,
		ReactiveFormsModule,
		NzIconModule,
		NzSpinModule,
		MeetingLobbyComponent,
		MeetingParticipantsPanelComponent
	],
	providers: [MeetingLobbyService, MeetingEventHandlerService, SoundService],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class MeetingComponent implements OnInit {
	protected meetingContextService = inject(MeetingContextService);
	protected lobbyService = inject(MeetingLobbyService);
	protected eventHandlerService = inject(MeetingEventHandlerService);
	protected ovThemeService = inject(OpenViduThemeService);
	protected notificationService = inject(NotificationService);
	protected soundService = inject(SoundService);
	private readonly meetingService = inject(MeetingService);
	private readonly roomFeatureService = inject(RoomFeatureService);
	private readonly spotlightService = inject(MeetingSpotlightService);
	private readonly renameService = inject(MeetingRenameService);
	private readonly shortcutsService = inject(MeetingShortcutsService);
	protected readonly pipService = inject(MeetingPipService);
	// 会议域作用域挂载点：注入即给 body 挂 meeting-ui；root 单例应用级常驻，路由切换不摘（见 MeetingThemeService）。
	private readonly meetingTheme = inject(MeetingThemeService);
	private readonly translateService = inject(TranslateService);
	private readonly runtimeConfigService = inject(RuntimeConfigService);
	private readonly hostClock = signal(Date.now());
	private hostClockTimer?: number;
	readonly hostUnavailableEndsAt = this.meetingContextService.hostUnavailableEndsAt;
	readonly hostUnavailableSeconds = computed(() => Math.max(0, Math.ceil(((this.hostUnavailableEndsAt() ?? 0) - this.hostClock()) / 1000)));
	readonly canClaimHost = computed(() => {
		const badge = this.meetingContextService.localParticipant()?.getBadge();
		return badge === MeetRoomMemberUIBadge.OWNER || badge === MeetRoomMemberUIBadge.ADMIN || badge === MeetRoomMemberUIBadge.MODERATOR;
	});

	// Template reference for custom participant panel item
	protected participantItem = contentChild.required(MeetingParticipantItemComponent);
	protected participantItemTemplate = computed(() => this.participantItem().template());

	/** Controls whether to show lobby (true) or meeting view (false) */
	showLobby = computed(() => !this.roomMemberToken());
	lobbyState = signal<'loading' | 'ready' | 'error'>('loading');

	/** Controls whether to show the videoconference component */
	isMeetingLeft = signal(false);

	/**
	 * Whether the app runs embedded in a host application (iframe).
	 */
	isEmbeddedMode = this.runtimeConfigService.isEmbeddedMode;

	/**
	 * Whether the local participant is alone (no remote participants yet).
	 * The panel after the local participant — the share/copy link panel (standalone SPA)
	 * or the waiting panel (embedded) — is only shown while alone.
	 */
	isAlone = this.meetingContextService.isAlone;

	// Signals for meeting context data
	roomName = this.lobbyService.roomName;
	roomMemberToken = this.lobbyService.roomMemberToken;
	e2eeKey = this.lobbyService.e2eeKeyValue;
	features = this.meetingContextService.meetingUI;

	constructor() {
		this.hostClockTimer = window.setInterval(() => this.hostClock.set(Date.now()), 1000);
		// Light-only runtime: OpenVidu component theme variables resolve to the shared
		// `--jmeet-*` tokens (see theme.model.ts), so no brand color is hardcoded here.
		effect(() => {
			this.meetingContextService.meetingAppearance();
			untracked(() => {
				this.ovThemeService.setTheme(OpenViduThemeMode.Light);
			});
		});
	}

	async claimHost(): Promise<void> {
		const roomId = this.meetingContextService.roomId();
		if (!roomId) return;
		try {
			const state = await this.meetingService.claimMeetingHost(roomId);
			this.meetingContextService.setPrimaryHostIdentity(state.hostIdentity);
			this.notificationService.showSnackbar('您已接管会议主持权限');
		} catch { this.notificationService.showSnackbar('接管失败，可能已有其他主持人完成接管，请稍后重试'); }
	}

	async ngOnInit() {
		try {
			this.lobbyState.set('loading');
			await this.lobbyService.initialize();
			this.lobbyState.set('ready');
		} catch (error) {
			console.error('Error initializing lobby state:', error);
			this.lobbyState.set('error');
			this.notificationService.showDialog({
				title: this.translateService.translate('MEETING_PAGE.INIT_ERROR_TITLE'),
				message: this.translateService.translate('MEETING_PAGE.INIT_ERROR_MESSAGE'),
				showCancelButton: false,
				confirmText: this.translateService.translate('MEETING_PAGE.INIT_ERROR_CONFIRM')
			});
		}
	}

	ngOnDestroy() {
		if (this.hostClockTimer) window.clearInterval(this.hostClockTimer);
		// Cleanup in-meeting experience services (data channel listeners, PiP window, shortcuts)
		this.spotlightService.destroy();
		this.renameService.destroy();
		this.shortcutsService.disable();
		this.pipService.close();
	}

	async onRoomCreated(lkRoom: Room) {
		// At this point, user has joined the meeting and MeetingContextService becomes the Single Source of Truth
		// Store LiveKit room in context
		this.meetingContextService.setLkRoom(lkRoom);

		// Setup LK room event listeners
		this.eventHandlerService.setupRoomListeners(lkRoom);

		// In-meeting experience services: spotlight, rename (own data channel listeners)
		this.spotlightService.initialize(lkRoom);
		this.renameService.initialize(lkRoom);
		this.shortcutsService.enable();

		const roomId = this.meetingContextService.roomId();
		if (roomId) {
			try {
				const host = await this.meetingService.getMeetingHost(roomId);
				this.meetingContextService.setPrimaryHostIdentity(host.hostIdentity);
			} catch (error) {
				console.warn('Unable to initialize primary-host state', error);
			}
		}
	}

	onParticipantConnected(event: any): void {
		// Play joined sound
		this.soundService.playParticipantJoinedSound();
		this.eventHandlerService.onParticipantConnected(event);
	}

	/**
	 * Handles the participant left event and hides the videoconference component
	 */
	onParticipantLeft(event: any): void {
		this.isMeetingLeft.set(true);
		this.eventHandlerService.onParticipantLeft(event);
	}
}

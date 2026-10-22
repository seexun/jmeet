import { CommonModule } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	ElementRef,
	HostListener,
	inject,
	OnDestroy,
	OnInit,
	output,
	signal,
	viewChild
} from '@angular/core';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { SidenavMode } from '../../models/layout/layout.model';
import { PanelType } from '../../models/panel.model';
import { ParticipantLeftEvent, ParticipantLeftReason, ParticipantModel } from '../../models/participant.model';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { ActionService } from '../../services/action/action.service';
import { OpenViduComponentsConfigService } from '../../services/config/directive-config.service';
import { SmartLayoutService } from '../../services/layout/smart-layout.service';
import type { OVRoom } from '../../services/livekit-adapter';
import { Room } from '../../services/livekit-adapter';
import { LoggerService } from '../../services/logger/logger.service';
import { OpenViduService } from '../../services/openvidu/openvidu.service';
import { PanelService } from '../../services/panel/panel.service';
import { ParticipantService } from '../../services/participant/participant.service';
import { SessionRoomEventsService } from '../../services/session/session-room-events.service';
import { TemplateRegistryService } from '../../services/template/template-registry.service';
import { MeetingTranslateService } from '../../services/translate/meeting-translate.service';
import { ViewportService } from '../../services/viewport/viewport.service';
import { VirtualBackgroundService } from '../../services/virtual-background/virtual-background.service';
import { RuntimeConfigService } from '../../../../../shared/services/runtime-config.service';
import { JmeetMeetingShellComponent } from '../../../../../shared/components/meeting-shell/meeting-shell.component';
import { LandscapeWarningComponent } from '../landscape-warning/landscape-warning.component';

/**
 * @internal
 */

@Component({
	selector: 'ov-session',
	imports: [
		CommonModule,
		NzSpinModule,
		TranslatePipe,
		LandscapeWarningComponent,
		JmeetMeetingShellComponent
	],
	templateUrl: './session.component.html',
	styleUrls: ['./session.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true
})
export class SessionComponent implements OnInit, OnDestroy {
	/**
	 * Provides event notifications that fire when Room is created for the local participant.
	 */
	onRoomCreated = output<OVRoom>();

	/**
	 * Provides event notifications that fire when Room is being reconnected for the local participant.
	 */
	onRoomReconnecting = output<void>();

	/**
	 * Provides event notifications that fire when Room is reconnected for the local participant.
	 */
	onRoomReconnected = output<void>();

	/**
	 * Provides event notifications that fire when local participant is connected to the Room.
	 */
	onParticipantConnected = output<ParticipantModel>();

	/**
	 * This event is emitted when the local participant leaves the room.
	 */
	onParticipantLeft = output<ParticipantLeftEvent>();

	room!: Room;
	readonly sidenavMode = signal<SidenavMode>(SidenavMode.SIDE);
	readonly SidenavMode = SidenavMode;
	readonly settingsPanelOpened = signal(false);
	// 成员/聊天/字幕仅在窄屏 OVER 以右侧抽屉（EP 悬浮停靠）全宽浮出；
	// 桌面 SIDE 一律走 300px dock 形态（§5.2⑤，与活动面板一致）
	readonly sideDrawerPanelOpened = signal(false);
	readonly sidePanelOpened = computed(() => this.panelService.panelOpened().isOpened);
	readonly loading = signal(true);

	/**
	 * @internal
	 */
	private shouldDisconnectRoomWhenComponentIsDestroyed: boolean = true;
	private readonly SIDENAV_WIDTH_LIMIT_MODE = 768;
	private readonly layoutService = inject(SmartLayoutService);
	private readonly actionService = inject(ActionService);
	private readonly openviduService = inject(OpenViduService);
	private readonly participantService = inject(ParticipantService);
	private readonly libService = inject(OpenViduComponentsConfigService);
	private readonly panelService = inject(PanelService);
	private readonly translateService = inject(MeetingTranslateService);
	private readonly backgroundService = inject(VirtualBackgroundService);

	private readonly sessionRoomEventsService = inject(SessionRoomEventsService);
	private readonly runtimeConfigService = inject(RuntimeConfigService);
	protected readonly viewportService = inject(ViewportService);
	readonly templateRegistry = inject(TemplateRegistryService);
	readonly videoContainerQuery = viewChild<ElementRef>('videoContainer');
	readonly containerQuery = viewChild<ElementRef<HTMLDivElement>>('container');
	readonly layoutContainerQuery = viewChild<ElementRef>('layoutContainer');
	private layoutUpdateTimeoutId: any = null;
	private updateLayoutInterval: ReturnType<typeof setInterval> | undefined = undefined;
	private sidenavResizeObserver: ResizeObserver | undefined = undefined;
	private containerObserved: boolean = false;
	private transitionLayoutTimeoutId: ReturnType<typeof setTimeout> | null = null;
	private log = inject(LoggerService).get('SessionComponent');
	private readonly LAYOUT_UPDATE_DEBOUNCE_MS = 100;

	private readonly videoContainerEffect = effect(() => {
		const container = this.videoContainerQuery();
		if (container && !this.templateRegistry.toolbar()) {
			// Use microtask to ensure DOM is ready
			Promise.resolve().then(() => {
				if (container && !this.templateRegistry.toolbar()) {
					container.nativeElement.style.height = '100%';
					container.nativeElement.style.minHeight = '100%';
					this.debouncedLayoutUpdate();
				}
			});
		}
	});

	private readonly containerEffect = effect(() => {
		const container = this.containerQuery();
		if (container) {
			Promise.resolve().then(() => {
				if (container && !this.containerObserved) {
					this.containerObserved = true;
					this.observeContainerWidth(container);
				}
			});
		}
	});
	private readonly layoutContainerEffect = effect(() => {
		const container = this.layoutContainerQuery();
		if (container) {
			// Use microtask instead of setTimeout for better performance
			Promise.resolve().then(async () => {
				if (container && this.libService.showBackgroundEffectsButton()) {
					// Apply background from storage when layout container is in DOM only when background effects button is enabled
					await this.backgroundService.applyBackgroundFromStorage();
				}
			});
		}
	});

	// Close background effects panel and remove background if the button is disabled
	private readonly backgroundEffectsEffect = effect(() => {
		const enabled = this.libService.backgroundEffectsButtonSignal();
		if (enabled) return;

		if (this.backgroundService.isBackgroundApplied()) {
			void this.backgroundService.removeBackground().then(() => {
				if (this.panelService.isBackgroundEffectsPanelOpened()) {
					this.panelService.closePanel();
				}
			});
		}
	});

	private readonly panelStateEffect = effect(() => {
		const ev = this.panelService.panelOpened();
		this.settingsPanelOpened.set(ev.isOpened && ev.panelType === PanelType.SETTINGS);
		// 成员/聊天/字幕仅在窄屏 OVER 以右侧抽屉（EP 悬浮停靠）全宽浮出；
		// 桌面 SIDE 一律走 300px dock 形态（§5.2⑤，与活动面板一致）。此前桌面也打
		// drawer 类，令 dock 规则 :not(.drawer) 永不命中——面宽 400+10px 违反 300px
		// 令牌，且原版面板头部与 panel head 双重 chrome（修复轮 3）。
		this.sideDrawerPanelOpened.set(
			this.sidenavMode() === SidenavMode.OVER &&
				ev.isOpened &&
				(ev.panelType === PanelType.PARTICIPANTS ||
					ev.panelType === PanelType.CHAT ||
					ev.panelType === PanelType.CAPTIONS)
		);

		// The side panel is a plain CSS-positioned column now; keep the video
		// layout in sync while its width transition runs.
		this.runTransitionLayoutUpdates();
	});

	@HostListener('window:beforeunload')
	beforeunloadHandler() {
		this.disconnectRoom(ParticipantLeftReason.BROWSER_UNLOAD);
	}

	@HostListener('window:resize')
	sizeChange() {
		this.layoutService.update();
	}

	async ngOnInit() {
		this.shouldDisconnectRoomWhenComponentIsDestroyed = true;

		// Check if room is available before proceeding
		if (!this.openviduService.isRoomInitialized()) {
			this.log.e('Room is not initialized when SessionComponent starts. This indicates a timing issue.');
			this.actionService.openDialog(
				this.translateService.translate('ERRORS.SESSION'),
				'Room is not ready. Please ensure the token is properly configured.'
			);
			return;
		}

		// Get room instance
		try {
			this.room = this.openviduService.getRoom();
			this.log.d('Room successfully obtained for SessionComponent');
		} catch (error: any) {
			this.log.e('Unexpected error getting room:', error);
			this.actionService.openDialog(
				this.translateService.translate('ERRORS.SESSION'),
				'Failed to get room instance: ' + (error?.message || error)
			);
			return;
		}
		this.sessionRoomEventsService.bindRoom(this.room, {
			onRoomReconnecting: () => this.onRoomReconnecting.emit(),
			onRoomReconnected: () => this.onRoomReconnected.emit(),
			onParticipantLeft: (event) => this.onParticipantLeft.emit(event)
		});

		try {
			await this.participantService.connect();
			// Send room created after participant connect for avoiding to send incomplete room payload
			this.onRoomCreated.emit(this.room);

			this.loading.set(false);
			const localParticipant = this.participantService.localParticipant();
			if (localParticipant) {
				this.onParticipantConnected.emit(localParticipant);
			}
		} catch (error: any) {
			this.log.e('There was an error connecting to the room:', error?.code, error?.message);
			this.actionService.openDialog(
				this.translateService.translate('ERRORS.SESSION'),
				error?.error || error?.message || error
			);
		}
	}

	/**
	 * Debounced layout update to prevent excessive recalculations
	 * @param delay Optional custom delay in ms (default: 100ms)
	 */
	private debouncedLayoutUpdate(delay?: number): void {
		if (this.layoutUpdateTimeoutId !== null) {
			clearTimeout(this.layoutUpdateTimeoutId);
		}
		this.layoutUpdateTimeoutId = setTimeout(() => {
			this.layoutService.update();
			this.layoutUpdateTimeoutId = null;
		}, delay || this.LAYOUT_UPDATE_DEBOUNCE_MS);
	}

	async ngOnDestroy() {
		// Clean up the debounce timeout to prevent memory leaks
		if (this.layoutUpdateTimeoutId !== null) {
			clearTimeout(this.layoutUpdateTimeoutId);
			this.layoutUpdateTimeoutId = null;
		}
		if (this.transitionLayoutTimeoutId !== null) {
			clearTimeout(this.transitionLayoutTimeoutId);
			this.transitionLayoutTimeoutId = null;
		}
		this.stopUpdateLayoutInterval();
		this.sidenavResizeObserver?.disconnect();

		if (this.shouldDisconnectRoomWhenComponentIsDestroyed) {
			await this.disconnectRoom(ParticipantLeftReason.LEAVE);
		}
		if (this.room) this.room.removeAllListeners();
		this.participantService.clear();
	}

	async disconnectRoom(reason: ParticipantLeftReason) {
		// Mark session as disconnected for avoiding to do it again in ngOnDestroy
		this.shouldDisconnectRoomWhenComponentIsDestroyed = false;
		await this.openviduService.disconnectRoom(() => {
			this.onParticipantLeft.emit({
				roomName: this.openviduService.getRoomName(),
				participantName: this.participantService.getMyName() || '',
				identity: this.participantService.getMyIdentity() || '',
				reason
			});
		}, false);
	}

	/**
	 * While the side panel width transition (open/close or 390px <-> 650px swap)
	 * runs, refresh the video layout at the cadence the former Material sidenav
	 * events used, then settle with a final update.
	 */
	private runTransitionLayoutUpdates(durationMs: number = 500): void {
		this.startUpdateLayoutInterval();
		if (this.transitionLayoutTimeoutId !== null) {
			clearTimeout(this.transitionLayoutTimeoutId);
		}
		this.transitionLayoutTimeoutId = setTimeout(() => {
			this.stopUpdateLayoutInterval();
			this.layoutService.update();
			this.transitionLayoutTimeoutId = null;
		}, durationMs);
	}

	onBackdropClick(): void {
		// Former Material backdrop behavior (dismiss on outside click), now
		// routed through the panel service so state stays consistent.
		this.panelService.closePanel();
	}

	private startUpdateLayoutInterval() {
		this.stopUpdateLayoutInterval();
		this.updateLayoutInterval = setInterval(() => {
			this.layoutService.update();
		}, 50);
	}

	private stopUpdateLayoutInterval() {
		if (this.updateLayoutInterval) {
			clearInterval(this.updateLayoutInterval);
			this.updateLayoutInterval = undefined;
		}
	}

	private observeContainerWidth(container: ElementRef<HTMLDivElement>): void {
		// Use the actual meeting container width for both SPA and embedded meetings.
		this.sidenavResizeObserver?.disconnect();
		const el = container.nativeElement;
		if (!el) return;

		this.sidenavResizeObserver = new ResizeObserver((entries) => {
			const width = entries[0]?.contentRect.width ?? 0;
			// 成员/聊天为右侧停靠抽屉：桌面 SIDE（推挤舞台，全部瓦片可见），
			// 窄屏横向空间不足时 OVER（全宽浮出 + 遮罩）
			const mode = width <= this.SIDENAV_WIDTH_LIMIT_MODE ? SidenavMode.OVER : SidenavMode.SIDE;
			if (this.sidenavMode() !== mode) {
				this.sidenavMode.set(mode);
			}
		});
		this.sidenavResizeObserver.observe(el);
	}

}

import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	inject,
	input,
	OnDestroy,
	OnInit,
	output,
	signal
} from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzIconTypePipe } from '../../../../../shared/pipes/nz-icon-type.pipe';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { NzModalRef, NzModalService } from 'ng-zorro-antd/modal';
import { AvatarView } from '../../models/avatar-view.model';
import { CustomDevice } from '../../models/device.model';
import { LangOption } from '../../models/lang.model';
import { ILogger } from '../../models/logger.model';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { CdkOverlayService } from '../../services/cdk-overlay/cdk-overlay.service';
import { OpenViduComponentsConfigService } from '../../services/config/directive-config.service';
import { DeviceService } from '../../services/device/device.service';
import { LocalTrack, Track } from '../../services/livekit-adapter';
import { LoggerService } from '../../services/logger/logger.service';
import { OpenViduService } from '../../services/openvidu/openvidu.service';
import { MeetingTranslateService } from '../../services/translate/meeting-translate.service';
import { ViewportService } from '../../services/viewport/viewport.service';
import { VirtualBackgroundService } from '../../services/virtual-background/virtual-background.service';
import { LandscapeWarningComponent } from '../landscape-warning/landscape-warning.component';
import { VideoElementComponent } from '../video-element/video-element.component';
import { PrejoinBackgroundDialogComponent } from './prejoin-background-dialog.component';
import { AudioDevicesComponent } from '../settings/audio-devices/audio-devices.component';
import { VideoDevicesComponent } from '../settings/video-devices/video-devices.component';

/**
 * @internal
 */
@Component({
	selector: 'ov-pre-join',
	imports: [
		NzIconModule, NzIconTypePipe,
		NzSpinModule,
		NzTooltipModule,
		TranslatePipe,
		LandscapeWarningComponent,
		VideoElementComponent,
		VideoDevicesComponent,
		AudioDevicesComponent
	],
	templateUrl: './pre-join.component.html',
	styleUrl: './pre-join.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		'(window:resize)': 'sizeChange()'
	},
	standalone: true
})
export class PreJoinComponent implements OnInit, OnDestroy {
	readonly error = input<{ name: string; message: string } | undefined>(undefined);
	readonly onVideoDeviceChanged = output<CustomDevice>();
	readonly onAudioDeviceChanged = output<CustomDevice>();
	readonly onVideoEnabledChanged = output<boolean>();
	readonly onAudioEnabledChanged = output<boolean>();
	readonly onLangChanged = output<LangOption>();
	readonly onReadyToJoin = output<void>();
	private readonly libService = inject(OpenViduComponentsConfigService);
	private readonly deviceSrv = inject(DeviceService);

	readonly errorMessage = signal<string | undefined>(undefined);
	windowSize!: number;
	readonly isLoading = signal(true);
	readonly participantName = signal<string>('');
	readonly roomName = this.libService.roomNameSignal;

	/**
	 * @ignore
	 */
	readonly showCameraButton = this.libService.cameraButtonSignal;
	readonly showMicrophoneButton = this.libService.microphoneButtonSignal;
	readonly showBackgroundsButton = this.libService.backgroundEffectsButtonSignal;
	readonly showLogo = this.libService.displayLogoSignal;

	private backgroundModal: NzModalRef | null = null;

	videoTrack: LocalTrack | undefined;
	audioTrack: LocalTrack | undefined;
	readonly isVideoEnabled = signal(false);
	readonly isAudioEnabled = signal(false);
	readonly networkCheckState = signal<'checking' | 'good' | 'fair' | 'poor' | 'offline'>('checking');
	readonly networkLatencyMs = signal<number | undefined>(undefined);
	readonly speakerTestActive = signal(false);
	readonly browserCompatible = signal(true);
	readonly mediaPermissions = signal<'granted'|'prompt'|'denied'|'unknown'>('unknown');
	readonly networkRecommendation = computed(()=>this.networkCheckState()==='good'?'适合高清视频':this.networkCheckState()==='fair'?'建议使用标清视频':'建议仅使用音频');
	readonly hasVideoDevices = this.deviceSrv.hasVideoDevices;
	readonly hasAudioDevices = this.deviceSrv.hasAudioDevices;

	/**
	 * Avatar poster descriptor for the local preview. There is no participant stream during
	 * pre-join, so the view-model is built straight from the local form state.
	 */
	readonly avatarView = computed<AvatarView>(() => ({
		show: !this.isVideoEnabled(),
		name: this.participantName(),
		color: 'hsl(48, 100%, 50%)',
		isSpeaking: false,
		hasEncryptionError: false
	}));
	private tracks: LocalTrack[] = [];
	private readonly cdkSrv = inject(CdkOverlayService);
	private readonly openviduService = inject(OpenViduService);
	private readonly virtualBackgroundService = inject(VirtualBackgroundService);
	private readonly translateService = inject(MeetingTranslateService);
	private readonly modal = inject(NzModalService);
	protected readonly viewportService = inject(ViewportService);
	private log: ILogger = inject(LoggerService).get('PreJoinComponent');
	private shouldRemoveTracksWhenComponentIsDestroyed: boolean = true;

	private readonly errorEffect = effect(() => {
		const currentError = this.error();
		if (currentError) {
			this.errorMessage.set(currentError.message ?? currentError.name);
		}
	});

	private readonly participantNameEffect = effect(() => {
		const configuredName = this.libService.participantNameSignal();
		if (configuredName) {
			this.participantName.set(configuredName);
		}
	});

	sizeChange() {
		this.windowSize = window.innerWidth;
	}

	async ngOnInit() {
		this.browserCompatible.set(Boolean(window.RTCPeerConnection&&navigator.mediaDevices?.getUserMedia));
		if(navigator.permissions)try{const p=await navigator.permissions.query({name:'microphone' as PermissionName});this.mediaPermissions.set(p.state);}catch{this.mediaPermissions.set('unknown');}
		await Promise.all([this.initializeDevicesWithRetry(), this.testNetwork()]);
		this.windowSize = window.innerWidth;
		this.isLoading.set(false);
	}

	async testNetwork(): Promise<void> {
		if (!navigator.onLine) {
			this.networkCheckState.set('offline');
			this.networkLatencyMs.set(undefined);
			return;
		}
		this.networkCheckState.set('checking');
		const startedAt = Date.now();
		const controller = new AbortController();
		const timeout = window.setTimeout(() => controller.abort(), 5000);
		try {
			await fetch(window.location.href, {
				method: 'HEAD',
				cache: 'no-store',
				signal: controller.signal
			});
			const latency = Date.now() - startedAt;
			this.networkLatencyMs.set(latency);
			this.networkCheckState.set(latency <= 180 ? 'good' : latency <= 450 ? 'fair' : 'poor');
		} catch {
			this.networkLatencyMs.set(undefined);
			this.networkCheckState.set(navigator.onLine ? 'poor' : 'offline');
		} finally {
			window.clearTimeout(timeout);
		}
	}

	async testSpeaker(): Promise<void> {
		if (this.speakerTestActive()) return;
		this.speakerTestActive.set(true);
		try {
			const AudioContextClass = window.AudioContext;
			const context = new AudioContextClass();
			const oscillator = context.createOscillator();
			const gain = context.createGain();
			oscillator.frequency.value = 660;
			gain.gain.setValueAtTime(0.0001, context.currentTime);
			gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.04);
			gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.7);
			oscillator.connect(gain).connect(context.destination);
			oscillator.start();
			oscillator.stop(context.currentTime + 0.72);
			await new Promise((resolve) => window.setTimeout(resolve, 850));
			await context.close();
		} finally {
			this.speakerTestActive.set(false);
		}
	}

	async ngOnDestroy() {
		this.cdkSrv.setSelector('body');

		if (this.shouldRemoveTracksWhenComponentIsDestroyed) {
			this.tracks?.forEach((track) => {
				track.stop();
			});
		}
	}

	onDeviceSelectorClicked() {
		// Some devices as iPhone do not show the menu panels correctly
		// Updating the container where the panel is added fix the problem.
		this.cdkSrv.setSelector('#prejoin-container');
	}

	join() {
		const participantName = this.participantName().trim();

		// Clear any previous errors
		this.errorMessage.set(undefined);

		// Mark tracks as permanent for avoiding to be removed in ngOnDestroy
		this.shouldRemoveTracksWhenComponentIsDestroyed = false;

		// Assign participant name to the observable if it is defined
		if (participantName) {
			this.libService.updateGeneralConfig({ participantName });
			this.onReadyToJoin.emit();
		} else {
			// No participant name to set, emit immediately
			this.onReadyToJoin.emit();
		}
	}

	async videoEnabledChanged(enabled: boolean) {
		this.isVideoEnabled.set(enabled);
		if (!enabled) {
			this.closeBackgroundPanel();
		} else if (!this.videoTrack) {
			const newVideoTrack = await this.openviduService.createLocalTracks(true, false);
			this.videoTrack = newVideoTrack[0];
			this.tracks.push(this.videoTrack);
			this.openviduService.setLocalTracks(this.tracks);
		}

		this.onVideoEnabledChanged.emit(enabled);
	}

	async videoDeviceChanged(device: CustomDevice) {
		try {
			this.log.d('Video device changed to:', device);

			// Get the updated tracks from the service
			const updatedTracks = this.openviduService.getLocalTracks();

			// Find the new video track
			const newVideoTrack = updatedTracks.find((track) => track.kind === Track.Kind.Video);

			// if (newVideoTrack && newVideoTrack !== this.videoTrack) {
			this.tracks = updatedTracks;
			this.videoTrack = newVideoTrack;

			this.onVideoDeviceChanged.emit(device);
		} catch (error) {
			this.log.e('Error handling video device change:', error);
			this.handleError(error);
		}
	}

	audioDeviceChanged(device: CustomDevice) {
		try {
			this.log.d('Audio device changed to:', device);

			// Get the updated tracks from the service
			const updatedTracks = this.openviduService.getLocalTracks();

			// Find the new audio track
			const newAudioTrack = updatedTracks.find((track) => track.kind === Track.Kind.Audio);

			this.tracks = updatedTracks;
			this.audioTrack = newAudioTrack;

			this.onAudioDeviceChanged.emit(device);
		} catch (error) {
			this.log.e('Error handling audio device change:', error);
			this.handleError(error);
		}
	}

	async audioEnabledChanged(enabled: boolean) {
		this.isAudioEnabled.set(enabled);
		if (enabled && !this.audioTrack) {
			const newAudioTrack = await this.openviduService.createLocalTracks(false, true);
			this.audioTrack = newAudioTrack[0];
			this.tracks.push(this.audioTrack);
			this.openviduService.setLocalTracks(this.tracks);
		}
		this.onAudioEnabledChanged.emit(enabled);
	}

	/**
	 * Open the virtual background settings in a centered dialog
	 */
	toggleBackgroundPanel() {
		if (this.backgroundModal) {
			return;
		}
		const ref = this.modal.create({
			nzTitle: this.translateService.translate('PANEL.BACKGROUND.TITLE'),
			nzContent: PrejoinBackgroundDialogComponent,
			nzWidth: 620,
			nzCentered: true,
			nzFooter: null,
			nzClassName: 'jmeet-prejoin-bg-modal'
		});
		this.backgroundModal = ref;
		ref.afterClose.subscribe(() => {
			if (this.backgroundModal === ref) {
				this.backgroundModal = null;
			}
		});
	}

	/**
	 * Close the virtual background dialog when open
	 */
	closeBackgroundPanel() {
		this.backgroundModal?.close();
	}

	/**
	 * Enhanced error handling with better UX
	 */
	private handleError(error: any) {
		this.log.e('PreJoin component error:', error);
		this.errorMessage.set(error.message || 'An unexpected error occurred');
	}

	/**
	 * Improved device initialization with error handling
	 */
	private async initializeDevicesWithRetry(maxRetries: number = 3): Promise<void> {
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				this.tracks = await this.openviduService.createLocalTracks();
				this.openviduService.setLocalTracks(this.tracks);

				// Creating the tracks above is what grants media permission on first visit; only then
				// are device labels available. Populate the list and align the selection accordingly.
				await this.deviceSrv.syncDevicesAfterTrackCreation(this.tracks);

				this.videoTrack = this.tracks.find((track) => track.kind === Track.Kind.Video);
				this.audioTrack = this.tracks.find((track) => track.kind === Track.Kind.Audio);
				this.isVideoEnabled.set(this.openviduService.isVideoTrackEnabled());
				this.isAudioEnabled.set(this.openviduService.isAudioTrackEnabled());

				// Restore previously selected virtual background in prejoin when possible.
				// Skip restore when the user is not allowed to use virtual backgrounds.
				// Keep prejoin usable even if restore fails.
				if (this.showBackgroundsButton()) {
					try {
						await this.virtualBackgroundService.applyBackgroundFromStorage();
					} catch (error) {
						this.log.w('Failed to restore virtual background from storage in prejoin:', error);
					}
				}

				return; // Success, exit retry loop
			} catch (error) {
				this.log.w(`Device initialization attempt ${attempt} failed:`, error);

				if (attempt === maxRetries) {
					this.handleError(error);
				} else {
					// Wait before retrying
					await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
				}
			}
		}
	}
}

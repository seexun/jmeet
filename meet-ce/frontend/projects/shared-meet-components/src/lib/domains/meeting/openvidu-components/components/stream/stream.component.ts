import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	ElementRef,
	inject,
	input,
	OnDestroy,
	signal,
	viewChild
} from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzIconTypePipe } from '../../../../../shared/pipes/nz-icon-type.pipe';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { AvatarView, DEFAULT_AVATAR_VIEW } from '../../models/avatar-view.model';
import { ParticipantStream } from '../../models/participant.model';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { MeetingTranslateService } from '../../services/translate/meeting-translate.service';
import { CdkOverlayService } from '../../services/cdk-overlay/cdk-overlay.service';
import { OpenViduComponentsConfigService } from '../../services/config/directive-config.service';
import { SmartLayoutService } from '../../services/layout/smart-layout.service';
import { ParticipantService } from '../../services/participant/participant.service';
import { AudioWaveComponent } from '../audio-wave/audio-wave.component';
import { ConnectionQualityIndicatorComponent } from '../connection-quality-indicator/connection-quality-indicator.component';
import { VideoElementComponent } from '../video-element/video-element.component';

/**
 * The **StreamComponent** is hosted inside of the {@link LayoutComponent}.
 * It is in charge of displaying the participant video stream in the videoconference layout.
 */
@Component({
	selector: 'ov-stream',
	imports: [
		NzIconTypePipe,
		NzIconModule,
		NzTooltipModule,
		TranslatePipe,
		AudioWaveComponent,
		ConnectionQualityIndicatorComponent,
		VideoElementComponent
	],
	templateUrl: './stream.component.html',
	styleUrls: ['./stream.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true
})
export class StreamComponent implements OnDestroy {
	private readonly translateSrv = inject(MeetingTranslateService);
	private readonly layoutService = inject(SmartLayoutService);
	private readonly participantService = inject(ParticipantService);
	private readonly cdkSrv = inject(CdkOverlayService);
	private readonly libService = inject(OpenViduComponentsConfigService);
	readonly stream = input<ParticipantStream | undefined>(undefined);

	readonly showParticipantName = this.libService.displayParticipantNameSignal;
	readonly showAudioDetection = this.libService.displayAudioDetectionSignal;
	readonly showVideoControls = this.libService.streamVideoControlsSignal;
	readonly showVideo = signal(false);
	readonly isFullscreen = signal(false);
	readonly mouseHovering = signal(false);

	/**
	 * Avatar poster descriptor for {@link VideoElementComponent}, derived from the participant
	 * stream. Computed (rather than an inline template literal) so its reference stays stable
	 * across change-detection cycles and only changes when the underlying state does.
	 */
	readonly avatarView = computed<AvatarView>(() => {
		const stream = this.stream();

		if (!stream) {
			return DEFAULT_AVATAR_VIEW;
		}

		return {
			show: stream.isCameraStream && (!stream.videoTrack?.track || !stream.participant.isCameraEnabled),
			name: stream.participant.name ?? '',
			color: stream.participant.colorProfile,
			isSpeaking: this.showAudioDetection() && stream.participant.isSpeaking && stream.isCameraStream,
			hasEncryptionError: stream.participant.hasEncryptionError
		};
	});

	/**
	 * @ignore
	 */
	hoveringTimeout: ReturnType<typeof setTimeout> | undefined;
	private showVideoTimeout: ReturnType<typeof setTimeout> | undefined;
	/** True while the pointer is over the video controls; suppresses the auto-hide timer. */
	private isOverControls = false;

	/**
	 * @ignore
	 */
	readonly streamContainerQuery = viewChild('streamContainer', { read: ElementRef });

	private readonly HOVER_TIMEOUT = 2000;
	private readonly NO_SIZE_TIMEOUT = 100;
	private readonly querySyncEffect = effect(() => {
		if (this.streamContainerQuery()) {
			if (this.showVideoTimeout) {
				clearTimeout(this.showVideoTimeout);
			}
			this.showVideoTimeout = setTimeout(() => {
				this.showVideo.set(true);
			}, this.NO_SIZE_TIMEOUT);
		}
	});

	ngOnDestroy() {
		if (this.showVideoTimeout) {
			clearTimeout(this.showVideoTimeout);
		}
		if (this.hoveringTimeout) {
			clearTimeout(this.hoveringTimeout);
		}
		this.cdkSrv.setSelector('body');
	}

	/**
	 * @ignore
	 */
	toggleVideoPinned() {
		const stream = this.stream();
		const sid = stream?.videoTrack?.trackSid;
		if (stream?.participant) {
			if (stream.participant.isLocal) {
				if (stream.participant.isFloating) {
					this.participantService.toggleLocalVideoFloating(sid);
				}
				this.participantService.toggleMyVideoPinned(sid);
			} else {
				this.participantService.toggleRemoteVideoPinned(sid);
			}
		}
		this.layoutService.update();
	}

	/**
	 * @ignore
	 */
	toggleFloat() {
		const stream = this.stream();
		const sid = stream?.videoTrack?.trackSid;
		if (stream?.participant && stream.participant.isLocal) {
			this.participantService.toggleLocalVideoFloating(sid);
			this.layoutService.update();
		}
	}

	toggleMuteForcibly() {
		const stream = this.stream();
		if (stream?.participant) {
			this.participantService.setRemoteMutedForcibly(
				stream.participant.sid,
				!stream.isMutedForcibly,
				stream.source
			);
		}
	}

	/**
	 * @ignore
	 * Reveals the controls on pointer movement over the stream and (re)arms the auto-hide timer.
	 */
	mouseHover(event: MouseEvent) {
		event.preventDefault();
		this.revealControls();
	}

	/**
	 * @ignore
	 * Pins the controls open while the pointer rests on them (clicking, hovering), so they don't
	 * vanish mid-interaction. The auto-hide timer stays disarmed until {@link releaseControls}.
	 */
	keepControlsVisible() {
		this.isOverControls = true;
		this.revealControls();
	}

	/**
	 * @ignore
	 * Re-arms the auto-hide timer once the pointer leaves the controls.
	 */
	releaseControls() {
		this.isOverControls = false;
		this.scheduleAutoHideControls();
	}

	/** Shows the controls and (re)arms the auto-hide timer, unless the pointer is parked on them. */
	private revealControls() {
		this.mouseHovering.set(true);
		this.scheduleAutoHideControls();
	}

	/**
	 * Arms the auto-hide timer, replacing any pending one. No-ops while the pointer rests on the
	 * controls so they remain visible until the pointer leaves.
	 */
	private scheduleAutoHideControls() {
		clearTimeout(this.hoveringTimeout);
		if (this.isOverControls) {
			return;
		}
		this.hoveringTimeout = setTimeout(() => this.mouseHovering.set(false), this.HOVER_TIMEOUT);
	}
}

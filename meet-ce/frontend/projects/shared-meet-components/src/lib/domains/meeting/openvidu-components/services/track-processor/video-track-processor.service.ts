import { effect, inject, Injectable, signal, Signal } from '@angular/core';
import {
	BackgroundProcessor,
	BackgroundProcessorWrapper,
	supportsBackgroundProcessors,
	supportsModernBackgroundProcessors,
	SwitchBackgroundProcessorOptions
} from '@livekit/track-processors';
import { RuntimeConfigService } from '../../../../../shared/services/runtime-config.service';
import { ILogger } from '../../models/logger.model';
import { OVLocalVideoTrack } from '../livekit-adapter';
import { LoggerService } from '../logger/logger.service';
import { PlatformService } from '../platform/platform.service';

// Selfie-segmenter models. Landscape (256x144) is tuned for wide desktop video;
// the general/square model (256x256) segments portrait mobile capture better, so
// physical mobile devices use it (the landscape model would distort a portrait frame).
const SELFIE_SEGMENTER_LANDSCAPE = 'assets/mediapipe/selfie_segmenter_landscape.tflite';
const SELFIE_SEGMENTER_GENERAL = 'assets/mediapipe/selfie_segmenter.tflite';
// Directory holding the MediaPipe tasks-vision WASM runtime, self-hosted from the
// Meet server instead of the default jsdelivr CDN (offline-capable, no 3rd party).
const MEDIAPIPE_WASM_PATH = 'assets/mediapipe/wasm';

/**
 * Manages the lifecycle of the LiveKit background video track processor.
 *
 * Responsibilities:
 * - Initializing the BackgroundProcessor at startup (modern browsers) or on-demand (Firefox)
 * - Attaching the processor to new video tracks
 * - Switching background modes (blur / virtual background / disabled)
 * - Tracking GPU / processor support state
 *
 * This service has no dependency on OpenViduService, keeping the processing concern
 * isolated and ready to be extended alongside a future AudioTrackProcessorService.
 *
 * @internal
 */
@Injectable({
	providedIn: 'root'
})
export class VideoTrackProcessorService {
	private backgroundProcessor?: BackgroundProcessorWrapper;

	private _isBackgroundProcessorSupported = signal(false);

	/**
	 * Readonly signal indicating whether the background processor is available.
	 * False when the browser has no GPU support or processor initialisation failed.
	 */
	readonly isBackgroundProcessorSupported: Signal<boolean> = this._isBackgroundProcessorSupported.asReadonly();

	/**
	 * Stores the last applied options so the effect can be restored after a camera switch.
	 */
	private currentBackgroundOptions: SwitchBackgroundProcessorOptions | null = null;

	private log: ILogger = inject(LoggerService).get('VideoTrackProcessorService');
	private readonly runtimeConfigService = inject(RuntimeConfigService);
	private readonly platformService = inject(PlatformService);

	/**
	 * Waits until the service is ready for requests (immediate in SPA mode, after the
	 * webcomponent calls setServerBaseUrl() otherwise) before pre-initialising the
	 * processor. Without this, the relative model path resolves against the host
	 * page in webcomponent mode and MediaPipe loads HTML instead of the .tflite.
	 */
	private readonly initEffect = effect(() => {
		if (!this.runtimeConfigService.isReadyForRequests()) return;
		this.initialiseProcessor();
	});

	/**
	 * @internal
	 */
	constructor() {
		if (!supportsBackgroundProcessors()) {
			this.log.w('Background processors not supported in this browser (GPU may be disabled)');
			return;
		}

		if (!supportsModernBackgroundProcessors()) {
			// Firefox / non-modern: mark as supported but defer creation until first use.
			this._isBackgroundProcessorSupported.set(true);
			this.log.d('Background processors supported but not modern – will initialise on-demand');
		}
	}

	private initialiseProcessor(): void {
		if (this.backgroundProcessor || !supportsModernBackgroundProcessors()) return;

		try {
			this.backgroundProcessor = BackgroundProcessor({
				mode: 'disabled',
				assetPaths: this.getAssetPaths()
			});
			this._isBackgroundProcessorSupported.set(true);
			this.log.d('Background processor initialised at startup (modern processors supported)');
		} catch (error: any) {
			this.log.w('Failed to initialise background processor:', error?.message || error);
			this._isBackgroundProcessorSupported.set(false);
		}
	}

	private getAssetPaths() {
		// On physical mobile devices (typically portrait capture) the general/square
		// model segments better than the landscape one. Chosen at processor init.
		const modelPath = this.platformService.isPhysicalMobileDevice()
			? SELFIE_SEGMENTER_GENERAL
			: SELFIE_SEGMENTER_LANDSCAPE;
		return {
			modelAssetPath: this.runtimeConfigService.resolveUrl(modelPath),
			tasksVisionFileSet: this.runtimeConfigService.resolveUrl(MEDIAPIPE_WASM_PATH)
		};
	}

	/**
	 * Switches the active background mode.
	 *
	 * For modern browsers the processor is already attached to the track; only a switchTo call
	 * is required. For Firefox the processor is lazily attached on first activation using the
	 * supplied videoTrack reference.
	 *
	 * @param options - New background mode options
	 * @param videoTrack - Required for the Firefox lazy-attachment path; ignored on modern browsers
	 * @internal
	 */
	async switchBackgroundMode(
		options: SwitchBackgroundProcessorOptions,
		videoTrack?: OVLocalVideoTrack
	): Promise<void> {
		if (!this.isBackgroundProcessorSupported()) {
			this.log.w('Background processor not supported (GPU disabled). Virtual background is disabled.');
			return;
		}

		try {
			if (!supportsModernBackgroundProcessors() && videoTrack) {
				await this.handleLazyProcessorAttachment(options.mode, videoTrack);
			}

			if (this.backgroundProcessor) {
				await this.backgroundProcessor.switchTo(options);
				this.currentBackgroundOptions = options;
				this.log.d('Background mode switched:', options);
			}
		} catch (error: any) {
			this.log.e('Failed to switch background mode:', error?.message || error);
			this._isBackgroundProcessorSupported.set(false);
			// Do not rethrow – gracefully degrade rather than crashing the call site.
		}
	}

	/**
	 * Attaches the background processor to a freshly-created video track.
	 *
	 * - Modern browsers: pre-attaches the shared processor; `processor.init()` re-reads the
	 *   transformer's stored options, automatically restoring any previously active effect.
	 * - Firefox / non-modern: lazily attaches the processor only when an effect was already
	 *   active, then re-applies the stored options explicitly.
	 *
	 * @param videoTrack - The new video track to attach the processor to
	 * @internal
	 */
	async applyToVideoTrack(videoTrack: OVLocalVideoTrack): Promise<void> {
		if (!this.isBackgroundProcessorSupported()) return;

		if (supportsModernBackgroundProcessors()) {
			if (!this.backgroundProcessor) return;
			try {
				await videoTrack.setProcessor(this.backgroundProcessor);
				this.log.d('Background processor applied to video track');
			} catch (error: any) {
				this.log.w('Failed to apply background processor to video track:', error?.message || error);
				this._isBackgroundProcessorSupported.set(false);
			}
		} else if (this.currentBackgroundOptions && this.currentBackgroundOptions.mode !== 'disabled') {
			// Firefox: processor is not pre-allocated; create on first use and restore the effect.
			try {
				if (!this.backgroundProcessor) {
					this.backgroundProcessor = BackgroundProcessor({
						mode: 'disabled',
						assetPaths: this.getAssetPaths()
					});
				}
				await videoTrack.setProcessor(this.backgroundProcessor);
				// The transformer options are reset on init for non-modern browsers; re-apply explicitly.
				await this.backgroundProcessor.switchTo(this.currentBackgroundOptions);
				this.log.d('Background effect restored on new track (non-modern):', this.currentBackgroundOptions);
			} catch (error: any) {
				this.log.w('Failed to restore background processor (non-modern):', error?.message || error);
			}
		}
	}

	/**
	 * Handles lazy processor attachment for browsers without modern processor support (Firefox).
	 * Creates and attaches the processor on-demand when an effect is first activated,
	 * and detaches it when the effect is disabled.
	 */
	private async handleLazyProcessorAttachment(
		mode: SwitchBackgroundProcessorOptions['mode'],
		videoTrack: OVLocalVideoTrack
	): Promise<void> {
		const hasProcessor = Boolean(videoTrack.getProcessor());
		const isDisabled = mode === 'disabled';

		if (!isDisabled && !hasProcessor) {
			try {
				if (!this.backgroundProcessor) {
					this.log.d('Creating background processor on-demand');
					this.backgroundProcessor = BackgroundProcessor({
						mode: 'disabled',
						assetPaths: this.getAssetPaths()
					});
				}
				this.log.d('Attaching processor on effect activation (lazy loading)');
				await videoTrack.setProcessor(this.backgroundProcessor);
			} catch (error: any) {
				this.log.w('Failed to attach background processor (GPU may be disabled):', error?.message || error);
				this._isBackgroundProcessorSupported.set(false);
			}
			return;
		}

		if (isDisabled && hasProcessor) {
			this.log.d('Stopping processor on effect deactivation');
			await videoTrack.stopProcessor();
		}
	}
}

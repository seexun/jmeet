import { Injectable, computed, signal } from '@angular/core';
import { DeepFilterNoiseFilter, DeepFilterNoiseFilterProcessor } from 'deepfilternet3-noise-filter';
import { OVLocalAudioTrack } from '../livekit-adapter';

export type NoiseSuppressionState = 'off' | 'loading' | 'active' | 'fallback' | 'unsupported';

@Injectable({ providedIn: 'root' })
export class AudioNoiseSuppressionService {
	private processor?: DeepFilterNoiseFilterProcessor;
	private readonly stateSignal = signal<NoiseSuppressionState>('off');
	readonly state = this.stateSignal.asReadonly();
	readonly pending = computed(() => this.stateSignal() === 'loading');
	readonly supported = DeepFilterNoiseFilterProcessor.isSupported();

	async setEnabled(track: OVLocalAudioTrack | undefined, enabled: boolean): Promise<boolean> {
		if (!enabled) {
			if (track) await track.stopProcessor().catch(() => undefined);
			if (this.processor) await this.processor.destroy().catch(() => undefined);
			this.processor = undefined;
			this.stateSignal.set('off');
			return true;
		}
		if (!this.supported) {
			this.stateSignal.set('unsupported');
			return false;
		}
		if (!track) {
			this.stateSignal.set('fallback');
			return false;
		}
		this.stateSignal.set('loading');
		try {
			this.processor ??= DeepFilterNoiseFilter({
				enabled: true,
				noiseReductionLevel: 70,
				sampleRate: 48_000,
				assetConfig: { cdnUrl: new URL('assets/ai-noise', document.baseURI).toString().replace(/\/$/, '') }
			});
			await track.setProcessor(this.processor);
			await this.processor.setEnabled(true);
			this.stateSignal.set('active');
			return true;
		} catch {
			await track.stopProcessor().catch(() => undefined);
			await this.processor?.destroy().catch(() => undefined);
			this.processor = undefined;
			this.stateSignal.set('fallback');
			return false;
		}
	}
}

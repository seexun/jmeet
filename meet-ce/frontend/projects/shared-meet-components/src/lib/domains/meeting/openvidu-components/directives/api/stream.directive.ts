import { Directive, ElementRef, OnDestroy, effect, inject, input } from '@angular/core';
import { OpenViduComponentsConfigService } from '../../services/config/directive-config.service';

/**
 * The **displayParticipantName** directive allows show/hide the participants name in stream component.
 *
 * Default: `true`
 *
 * It can be used in the parent element {@link VideoconferenceComponent} specifying the name of the `stream` component:
 *
 * @example
 * <ov-videoconference [streamDisplayParticipantName]="false"></ov-videoconference>
 *
 * \
 * And it also can be used in the {@link StreamComponent}.
 * @example
 * <ov-stream [displayParticipantName]="false"></ov-stream>
 */
@Directive({
	selector: 'ov-videoconference[streamDisplayParticipantName], ov-stream[displayParticipantName]',
	standalone: true
})
export class StreamDisplayParticipantNameDirective implements OnDestroy {
	readonly streamDisplayParticipantName = input<boolean | undefined>(undefined);
	readonly displayParticipantName = input<boolean | undefined>(undefined);

	public elementRef = inject(ElementRef);
	private readonly libService = inject(OpenViduComponentsConfigService);
	private readonly displayParticipantNameEffect = effect(() => {
		this.update(this.displayParticipantName() ?? this.streamDisplayParticipantName() ?? true);
	});

	ngOnDestroy(): void {
		this.clear();
	}

	update(value: boolean) {
		this.libService.updateStreamConfig({ displayParticipantName: value });
	}

	clear() {
		this.update(true);
	}
}

/**
 * The **displayAudioDetection** directive allows show/hide the participants audio detection in stream component.
 *
 * Default: `true`
 *
 * It can be used in the parent element {@link VideoconferenceComponent} specifying the name of the `stream` component:
 *
 * @example
 * <ov-videoconference [streamDisplayAudioDetection]="false"></ov-videoconference>
 *
 * \
 * And it also can be used in the {@link StreamComponent}.
 * @example
 * <ov-stream [displayAudioDetection]="false"></ov-stream>
 */
@Directive({
	selector: 'ov-videoconference[streamDisplayAudioDetection], ov-stream[displayAudioDetection]',
	standalone: true
})
export class StreamDisplayAudioDetectionDirective implements OnDestroy {
	readonly streamDisplayAudioDetection = input<boolean | undefined>(undefined);
	readonly displayAudioDetection = input<boolean | undefined>(undefined);

	public elementRef = inject(ElementRef);
	private readonly libService = inject(OpenViduComponentsConfigService);
	private readonly displayAudioDetectionEffect = effect(() => {
		this.update(this.displayAudioDetection() ?? this.streamDisplayAudioDetection() ?? true);
	});

	ngOnDestroy(): void {
		this.clear();
	}

	update(value: boolean) {
		this.libService.updateStreamConfig({ displayAudioDetection: value });
	}
	clear() {
		this.update(true);
	}
}

/**
 * The **videoControls** directive allows show/hide the participants video controls in stream component.
 *
 * Default: `true`
 *
 * It can be used in the parent element {@link VideoconferenceComponent} specifying the name of the `stream` component:
 *
 * @example
 * <ov-videoconference [streamVideoControls]="false"></ov-videoconference>
 *
 * \
 * And it also can be used in the {@link StreamComponent}.
 * @example
 * <ov-stream [videoControls]="false"></ov-stream>
 */
@Directive({
	selector: 'ov-videoconference[streamVideoControls], ov-stream[videoControls]',
	standalone: true
})
export class StreamVideoControlsDirective implements OnDestroy {
	readonly streamVideoControls = input<boolean | undefined>(undefined);
	readonly videoControls = input<boolean | undefined>(undefined);

	public elementRef = inject(ElementRef);
	private readonly libService = inject(OpenViduComponentsConfigService);
	private readonly videoControlsEffect = effect(() => {
		this.update(this.videoControls() ?? this.streamVideoControls() ?? true);
	});

	ngOnDestroy(): void {
		this.clear();
	}

	update(value: boolean) {
		this.libService.updateStreamConfig({ videoControls: value });
	}

	clear() {
		this.update(true);
	}
}

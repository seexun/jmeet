// * Internal directives *

import { AfterViewInit, Directive, ElementRef, Input, OnDestroy, OnInit, inject, input } from '@angular/core';
import { AssetsService } from '../../../../../shared/services/assets.service';
import { ParticipantModel } from '../../models/participant.model';
import { OpenViduComponentsConfigService } from '../../services/config/directive-config.service';

/**
 * Load default OpenVidu logo if custom one is not exist
 * @internal
 */
@Directive({
	selector: 'img[ovLogo]',
	standalone: true
})
export class FallbackLogoDirective implements OnInit {
	private readonly assets = inject(AssetsService);
	// Default OpenVidu logo served as a static asset (resolves in SPA & WC modes).
	readonly assetsLogo = this.assets.logo;
	readonly ovLogo = input<string>('');
	public elementRef = inject(ElementRef);

	ngOnInit() {
		this.loadImage(this.ovLogo() || this.assetsLogo);
	}

	private loadImage(url: string) {
		const element = this.elementRef.nativeElement as HTMLImageElement;
		const tempImage = new Image();

		const handleImageErrorOrLoad = (url: string) => {
			if (tempImage.width <= 1 && tempImage.height <= 1) {
				// Custom logo failed to load: fall back to the default OpenVidu asset.
				if (url === this.ovLogo()) {
					this.loadImage(this.assetsLogo);
				}
			} else {
				element.src = url;
			}
		};

		tempImage.onload = () => {
			handleImageErrorOrLoad(url);
		};

		tempImage.onerror = () => {
			handleImageErrorOrLoad(url);
		};
		tempImage.src = url;
	}
}

/**
 * @internal
 */
@Directive({
	selector: 'ov-smart-layout[ovRemoteParticipants]',
	standalone: true
})
export class LayoutRemoteParticipantsDirective {
	private _ovRemoteParticipants: ParticipantModel[] | undefined;

	@Input() set ovRemoteParticipants(value: ParticipantModel[] | undefined) {
		this._ovRemoteParticipants = value;
		this.update(value);
	}
	public elementRef = inject(ElementRef);
	private readonly directiveService = inject(OpenViduComponentsConfigService);

	ngOnDestroy(): void {
		this.clear();
	}

	ngAfterViewInit() {
		this.update(this._ovRemoteParticipants);
	}

	update(value: ParticipantModel[] | undefined) {
		this.directiveService.setLayoutRemoteParticipants(value);
	}

	clear() {
		this.update(undefined);
	}
}

/**
 * @internal
 */
@Directive({
	selector: 'ov-videoconference[brandingLogo], ov-toolbar[brandingLogo]',
	standalone: true
})
export class ToolbarBrandingLogoDirective implements AfterViewInit, OnDestroy {
	/**
	 * @ignore
	 */
	@Input() set brandingLogo(value: string) {
		this._brandingLogo = value;
		this.update(this._brandingLogo);
	}

	private _brandingLogo: string = '';

	/**
	 * @ignore
	 */
	public elementRef = inject(ElementRef);
	private readonly libService = inject(OpenViduComponentsConfigService);

	ngAfterViewInit() {
		this.update(this._brandingLogo);
	}

	ngOnDestroy(): void {
		this.clear();
	}
	private clear() {
		this._brandingLogo = '';
		this.update(this._brandingLogo);
	}

	private update(value: string) {
		this.libService.updateToolbarConfig({ brandingLogo: value });
	}
}

/**
 * @internal
 * The **viewRecordingsButton** directive allows show/hide the view recordings toolbar button.
 *
 * Default: `false`
 *
 * It can be used in the parent element {@link VideoconferenceComponent} specifying the name of the `toolbar` component:
 *
 * @example
 * <ov-videoconference [toolbarViewRecordingsButton]="true"></ov-videoconference>
 *
 * \
 * And it also can be used in the {@link ToolbarComponent}.
 * @example
 * <ov-toolbar [viewRecordingsButton]="true"></ov-toolbar>
 *
 * When the button is clicked, it will fire the `onViewRecordingsClicked` event.
 */
@Directive({
	selector: 'ov-videoconference[toolbarViewRecordingsButton], ov-toolbar[viewRecordingsButton]',
	standalone: true
})
export class ToolbarViewRecordingsButtonDirective implements AfterViewInit, OnDestroy {
	/**
	 * @ignore
	 */
	@Input() set toolbarViewRecordingsButton(value: boolean) {
		this.viewRecordingsValue = value;
		this.update(this.viewRecordingsValue);
	}
	/**
	 * @ignore
	 */
	@Input() set viewRecordingsButton(value: boolean) {
		this.viewRecordingsValue = value;
		this.update(this.viewRecordingsValue);
	}

	private viewRecordingsValue: boolean = false;

	/**
	 * @ignore
	 */
	public elementRef = inject(ElementRef);
	private readonly libService = inject(OpenViduComponentsConfigService);

	ngAfterViewInit() {
		this.update(this.viewRecordingsValue);
	}

	ngOnDestroy(): void {
		this.clear();
	}
	private clear() {
		this.viewRecordingsValue = false;
		this.update(true);
	}

	private update(value: boolean) {
		this.libService.updateToolbarConfig({ viewRecordings: value });
	}
}

/**
 * @internal
 *
 * The **recordingActivityStartStopRecordingButton** directive allows to show or hide the start/stop recording buttons in recording activity.
 *
 * Default: `true`
 *
 * It is only available for {@link VideoconferenceComponent}.
 *
 * @example
 * <ov-videoconference [recordingActivityStartStopRecordingButton]="false"></ov-videoconference>
 */
@Directive({
	selector: 'ov-videoconference[recordingActivityStartStopRecordingButton]',
	standalone: true
})
export class StartStopRecordingButtonsDirective implements OnDestroy {
	/**
	 * @ignore
	 */
	@Input() set recordingActivityStartStopRecordingButton(value: boolean) {
		this.update(value);
	}

	/**
	 * @ignore
	 */
	public elementRef = inject(ElementRef);
	private readonly libService = inject(OpenViduComponentsConfigService);

	ngOnDestroy(): void {
		this.clear();
	}

	private clear() {
		this.update(true);
	}

	private update(value: boolean) {
		this.libService.updateRecordingActivityConfig({ startStopButton: value });
	}
}

/**
 * @internal
 * The **recordingActivityViewRecordingsButton** directive allows to show/hide the view recordings button in the recording activity panel.
 *
 * Default: `false`
 *
 * Can be used in {@link VideoconferenceComponent}.
 *
 * @example
 * <ov-videoconference [recordingActivityViewRecordingsButton]="true"></ov-videoconference>
 */
@Directive({
	selector: 'ov-videoconference[recordingActivityViewRecordingsButton]',
	standalone: true
})
export class RecordingActivityViewRecordingsButtonDirective implements AfterViewInit, OnDestroy {
	@Input() set recordingActivityViewRecordingsButton(value: boolean) {
		this._value = value;
		this.update(this._value);
	}

	private _value: boolean = false;

	public elementRef = inject(ElementRef);
	private readonly libService = inject(OpenViduComponentsConfigService);

	ngAfterViewInit() {
		this.update(this._value);
	}

	ngOnDestroy(): void {
		this.clear();
	}

	private clear() {
		this._value = false;
		this.update(this._value);
	}

	private update(value: boolean) {
		this.libService.updateRecordingActivityConfig({ viewRecordingsButton: value });
	}
}


/**
 * @internal
 * The **toolbarRoomName** directive allows to display a specific room name in the toolbar.
 * If the room name is not set, it will display the room ID instead.
 *
 * Can be used in {@link ToolbarComponent}.
 *
 * @example
 * <ov-videoconference [toolbarRoomName]="roomName"></ov-videoconference>
 */
@Directive({
	selector: 'ov-videoconference[toolbarRoomName], ov-toolbar[roomName]',
	standalone: true
})
export class ToolbarRoomNameDirective implements AfterViewInit, OnDestroy {
	@Input() set toolbarRoomName(value: string | undefined) {
		this._roomName = value;
		this.updateRoomName();
	}

	@Input() set roomName(value: string | undefined) {
		this._roomName = value;
		this.updateRoomName();
	}

	private _roomName?: string;

	public elementRef = inject(ElementRef);
	private readonly libService = inject(OpenViduComponentsConfigService);

	ngAfterViewInit() {
		this.updateRoomName();
	}

	ngOnDestroy(): void {
		this.clear();
	}

	private clear() {
		this._roomName = undefined;
		this.updateRoomName();
	}

	private updateRoomName() {
		this.libService.updateToolbarConfig({ roomName: this._roomName || '' });
	}
}

/**
 * @internal
 *
 * The **e2eeKey** directive allows to configure end-to-end encryption for the videoconference.
 * When provided, the room will be configured with E2EE using an external key provider.
 *
 * Default: `undefined`
 *
 * Usage:
 * <ov-videoconference [e2eeKey]="yourEncryptionKey"></ov-videoconference>
 */
@Directive({
	selector: 'ov-videoconference[e2eeKey]',
	standalone: true
})
export class E2EEKeyDirective implements AfterViewInit, OnDestroy {
	@Input() set e2eeKey(value: string | undefined) {
		this._value = value;
		this.update(this._value);
	}

	private _value: string | undefined;

	public elementRef = inject(ElementRef);
	private readonly libService = inject(OpenViduComponentsConfigService);

	ngAfterViewInit() {
		this.update(this._value);
	}

	ngOnDestroy(): void {
		this.clear();
	}

	private clear() {
		this._value = undefined;
		this.update(this._value);
	}

	private update(value: string | undefined) {
		// Only update if value is valid (not undefined, not null, not empty string)
		const validValue = value && value.trim() !== '' ? value.trim() : undefined;
		this.libService.updateGeneralConfig({ e2eeKey: validValue });
	}
}

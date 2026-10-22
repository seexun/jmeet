import { Directive, ElementRef, OnDestroy, effect, inject, input } from '@angular/core';
// import { CaptionService } from '../../services/caption/caption.service';
import { AvailableLangs, LangOption } from '../../models/lang.model';
import { OpenViduComponentsConfigService } from '../../services/config/directive-config.service';
import { StorageService } from '../../services/storage/storage.service';
import { MeetingTranslateService } from '../../services/translate/meeting-translate.service';

/**
 * The **livekitUrl** directive sets the livekitUrl to grant a participant access to a Room.
 * This Livekit Url will be use by each participant when connecting to a Room.
 *
 * It is only available for {@link VideoconferenceComponent}.
 *
 *  Default: `""`
 *
 * @example
 * <ov-videoconference [livekitUrl]="http://localhost:1234"></ov-videoconference>
 */
@Directive({
	selector: 'ov-videoconference[livekitUrl]',
	standalone: true
})
export class LivekitUrlDirective implements OnDestroy {
	/**
	 * @ignore
	 */
	readonly livekitUrl = input<string>('');

	/**
	 * @ignore
	 */
	public elementRef = inject(ElementRef);
	private readonly libService = inject(OpenViduComponentsConfigService);
	private readonly livekitUrlEffect = effect(() => {
		this.update(this.livekitUrl());
	});

	/**
	 * @ignore
	 */
	ngOnDestroy(): void {
		this.clear();
	}

	/**
	 * @ignore
	 */
	clear() {
		this.update('');
	}

	/**
	 * @ignore
	 */
	update(value: string) {
		this.libService.updateGeneralConfig({ livekitUrl: value });
	}
}

/**
 * The **token** directive sets the token to grant a participant access to a Room.
 * This OpenVidu token will be use by each participant when connecting to a Room.
 *
 * It is only available for {@link VideoconferenceComponent}.
 *
 *  Default: `""`
 *
 * @example
 * <ov-videoconference [token]="token"></ov-videoconference>
 */
@Directive({
	selector: 'ov-videoconference[token]',
	standalone: true
})
export class TokenDirective implements OnDestroy {
	/**
	 * @ignore
	 */
	readonly token = input<string>('');

	/**
	 * @ignore
	 */
	public elementRef = inject(ElementRef);
	private readonly libService = inject(OpenViduComponentsConfigService);
	private readonly tokenEffect = effect(() => {
		this.update(this.token());
	});

	/**
	 * @ignore
	 */
	ngOnDestroy(): void {
		this.clear();
	}

	/**
	 * @ignore
	 */
	clear() {
		this.update('');
	}

	/**
	 * @ignore
	 */
	update(value: string) {
		this.libService.updateGeneralConfig({ token: value });
	}
}

/**
 * The **tokenError** directive allows to display an error message in case of issues during token request.
 *
 * It is only available for {@link VideoconferenceComponent}.
 *
 *  Default: `undefined`
 *
 * @example
 * <ov-videoconference [tokenError]="error"></ov-videoconference>
 */
@Directive({
	selector: 'ov-videoconference[tokenError]',
	standalone: true
})
export class TokenErrorDirective implements OnDestroy {
	/**
	 * @ignore
	 */
	readonly tokenError = input<any>(undefined);

	/**
	 * @ignore
	 */
	public elementRef = inject(ElementRef);
	private readonly libService = inject(OpenViduComponentsConfigService);
	private readonly tokenErrorEffect = effect(() => {
		this.update(this.tokenError());
	});

	/**
	 * @ignore
	 */
	ngOnDestroy(): void {
		this.clear();
	}

	/**
	 * @ignore
	 */
	clear() {
		this.update(undefined);
	}

	/**
	 * @ignore
	 */
	update(value: any) {
		this.libService.updateGeneralConfig({ tokenError: value });
	}
}

/**
 * The **lang** directive allows set the UI language to a default language.
 *
 * It is only available for {@link VideoconferenceComponent}.
 *
 * **Default:** English `en`
 *
 * **Available Langs:**
 *
 * * English: `en`
 * * Spanish: `es`
 * * German: `de`
 * * French: `fr`
 * * Chinese: `cn`
 * * Hindi: `hi`
 * * Italian: `it`
 * * Japanese: `ja`
 * * Netherlands: `nl`
 * * Portuguese: `pt`
 *
 * @example
 * <ov-videoconference [lang]="'es'"></ov-videoconference>
 */
@Directive({
	selector: 'ov-videoconference[lang]',
	standalone: true
})
export class LangDirective implements OnDestroy {
	/**
	 * @ignore
	 */
	readonly lang = input<AvailableLangs>('en');

	/**
	 * @ignore
	 */
	public elementRef = inject(ElementRef);
	private readonly translateService = inject(MeetingTranslateService);
	private readonly langEffect = effect(() => {
		this.update(this.lang());
	});

	/**
	 * @ignore
	 */
	ngOnDestroy(): void {
		this.clear();
	}

	/**
	 * @ignore
	 */
	clear() {
		this.update('en');
	}

	/**
	 * @ignore
	 */
	update(value: AvailableLangs) {
		this.translateService.setCurrentLanguage(value);
	}
}

/**
 * The **langOptions** directive allows to set the application language options.
 * It will override the application languages provided by default.
 * This propety is an array of objects which must comply with the {@link LangOption} interface.
 *
 * It is only available for {@link VideoconferenceComponent}.
 *
 * Default: ```
 * [
 * 	{ name: 'English', lang: 'en' },
 *  { name: 'Español', lang: 'es' },
 *  { name: 'Deutsch', lang: 'de' },
 *  { name: 'Français', lang: 'fr' },
 *  { name: '中国', lang: 'cn' },
 *  { name: 'हिन्दी', lang: 'hi' },
 *  { name: 'Italiano', lang: 'it' },
 *  { name: 'やまと', lang: 'ja' },
 *  { name: 'Dutch', lang: 'nl' },
 *  { name: 'Português', lang: 'pt' }
 * ]```
 *
 * Note: If you want to add a new language, you must add a new object with the name and the language code (e.g. `{ name: 'Custom', lang: 'cus' }`)
 * and then add the language file in the `assets/lang` folder with the name `cus.json`.
 *
 *
 * @example
 * <ov-videoconference [langOptions]="[{name:'Spanish', lang: 'es'}]"></ov-videoconference>
 */
@Directive({
	selector: 'ov-videoconference[langOptions]',
	standalone: true
})
export class LangOptionsDirective implements OnDestroy {
	/**
	 * @ignore
	 */
	readonly langOptions = input<LangOption[] | undefined>(undefined);

	/**
	 * @ignore
	 */
	public elementRef = inject(ElementRef);
	private readonly translateService = inject(MeetingTranslateService);
	private readonly langOptionsEffect = effect(() => {
		this.update(this.langOptions());
	});

	/**
	 * @ignore
	 */
	ngOnDestroy(): void {
		this.clear();
	}

	/**
	 * @ignore
	 */
	clear() {
		this.update(undefined);
	}

	/**
	 * @ignore
	 */
	update(value: LangOption[] | undefined) {
		this.translateService.updateLanguageOptions(value);
	}
}


/**
 * The **participantName** directive sets the participant name. It can be useful for aplications which doesn't need the prejoin page.
 *
 * It is only available for {@link VideoconferenceComponent}.
 *
 * @example
 * <ov-videoconference [participantName]="'OpenVidu'"></ov-videoconference>
 */
@Directive({
	selector: 'ov-videoconference[participantName]',
	standalone: true
})
export class ParticipantNameDirective implements OnDestroy {
	/**
	 * @ignore
	 */
	readonly participantName = input<string>('');

	/**
	 * @ignore
	 */
	public elementRef = inject(ElementRef);
	private readonly libService = inject(OpenViduComponentsConfigService);
	private readonly participantNameEffect = effect(() => {
		this.update(this.participantName());
	});

	/**
	 * @ignore
	 */
	ngOnDestroy(): void {
		this.clear();
	}

	/**
	 * @ignore
	 */
	clear() {
		this.update('');
	}

	/**
	 * @ignore
	 */
	update(participantName: string) {
		if (participantName) {
			this.libService.updateGeneralConfig({ participantName });
		}
	}
}

/**
 * The **prejoin** directive allows show/hide the prejoin page for selecting media devices.
 *
 * It is only available for {@link VideoconferenceComponent}.
 *
 * Default: `true`
 *
 * @example
 * <ov-videoconference [prejoin]="false"></ov-videoconference>
 */
@Directive({
	selector: 'ov-videoconference[prejoin]',
	standalone: true
})
export class PrejoinDirective implements OnDestroy {
	/**
	 * @ignore
	 */
	readonly prejoin = input<boolean>(true);

	/**
	 * @ignore
	 */
	public elementRef = inject(ElementRef);
	private readonly libService = inject(OpenViduComponentsConfigService);
	private readonly prejoinEffect = effect(() => {
		this.update(this.prejoin());
	});

	/**
	 * @ignore
	 */
	ngOnDestroy(): void {
		this.clear();
	}

	/**
	 * @ignore
	 */
	clear() {
		this.update(true);
	}

	/**
	 * @ignore
	 */
	update(value: boolean) {
		this.libService.updateGeneralConfig({ prejoin: value });
	}
}

/**
 * The **videoEnabled** directive allows to join the meeting with camera enabled or disabled.
 *
 * It is only available for {@link VideoconferenceComponent}.
 *
 * Default: `true`
 *
 *
 * @example
 * <ov-videoconference [videoEnabled]="false"></ov-videoconference>
 */
@Directive({
	selector: 'ov-videoconference[videoEnabled]',
	standalone: true
})
export class VideoEnabledDirective implements OnDestroy {
	/**
	 * @ignore
	 */
	readonly videoEnabled = input<boolean>(true);

	/**
	 * @ignore
	 */
	public elementRef = inject(ElementRef);
	private readonly libService = inject(OpenViduComponentsConfigService);
	private readonly storageService = inject(StorageService);
	private readonly videoEnabledEffect = effect(() => {
		this.update(this.videoEnabled());
	});

	/**
	 * @ignore
	 */
	ngOnDestroy(): void {
		this.clear();
	}

	/**
	 * @ignore
	 */
	clear() {
		this.update(true);
	}

	/**
	 * @ignore
	 */
	update(enabled: boolean) {
		const storageIsEnabled = this.storageService.isCameraEnabled();

		// Determine the final enabled state of the camera
		let finalEnabledState: boolean;
		if (enabled) {
			// If enabled is true, respect the storage value if it's false
			finalEnabledState = storageIsEnabled !== false;
		} else {
			// If enabled is false, disable the camera
			finalEnabledState = false;
		}

		// Update the storage with the final state
		this.storageService.setCameraEnabled(finalEnabledState);

		// Ensure libService state is consistent with the final enabled state
		if (this.libService.isVideoEnabled() !== finalEnabledState) {
			this.libService.updateStreamConfig({ videoEnabled: finalEnabledState });
		}
	}
}

/**
 * The **audioEnabled** directive allows to join the meeting with microphone enabled or disabled.
 *
 * It is only available for {@link VideoconferenceComponent}.
 *
 * Default: `true`
 *
 * @example
 * <ov-videoconference [audioEnabled]="false"></ov-videoconference>
 */

@Directive({
	selector: 'ov-videoconference[audioEnabled]',
	standalone: true
})
export class AudioEnabledDirective implements OnDestroy {
	/**
	 * @ignore
	 */
	readonly audioEnabled = input<boolean>(true);

	/**
	 * @ignore
	 */
	public elementRef = inject(ElementRef);
	private readonly libService = inject(OpenViduComponentsConfigService);
	private readonly storageService = inject(StorageService);
	private readonly audioEnabledEffect = effect(() => {
		this.update(this.audioEnabled());
	});

	ngOnDestroy(): void {
		this.clear();
	}

	/**
	 * @ignore
	 */
	clear() {
		this.update(true);
	}

	/**
	 * @ignore
	 */
	update(enabled: boolean) {
		const storageIsEnabled = this.storageService.isMicrophoneEnabled();

		// Determine the final enabled state of the microphone
		let finalEnabledState: boolean;
		if (enabled) {
			// If enabled is true, respect the storage value if it's false
			finalEnabledState = storageIsEnabled !== false;
		} else {
			// If enabled is false, disable the camera
			finalEnabledState = false;
		}

		// Update the storage with the final state
		this.storageService.setMicrophoneEnabled(finalEnabledState);

		if (this.libService.isAudioEnabled() !== enabled) {
			this.libService.updateStreamConfig({ audioEnabled: enabled });
		}
	}
}

/**
 * The **showDisconnectionDialog** directive allows to show/hide the disconnection dialog when the local participant is disconnected from the room.
 *
 * It is only available for {@link VideoconferenceComponent}.
 *
 * Default: `true`
 *
 * @example
 * <ov-videoconference [showDisconnectionDialog]="false"></ov-videoconference>
 */
@Directive({
	selector: 'ov-videoconference[showDisconnectionDialog]',
	standalone: true
})
export class ShowDisconnectionDialogDirective implements OnDestroy {
	/**
	 * @ignore
	 */
	readonly showDisconnectionDialog = input<boolean>(true);

	/**
	 * @ignore
	 */
	public elementRef = inject(ElementRef);
	private readonly libService = inject(OpenViduComponentsConfigService);
	private readonly showDisconnectionDialogEffect = effect(() => {
		this.update(this.showDisconnectionDialog());
	});

	/**
	 * @ignore
	 */
	ngOnDestroy(): void {
		this.clear();
	}

	/**
	 * @ignore
	 */
	clear() {
		this.update(true);
	}

	/**
	 * @ignore
	 */
	update(value: boolean) {
		if (this.libService.getShowDisconnectionDialog() !== value) {
			this.libService.updateGeneralConfig({ showDisconnectionDialog: value });
		}
	}
}

/**
 * The **recordingStreamBaseUrl** directive sets the base URL for retrieving recording streams.
 * The complete request URL is dynamically constructed by concatenating the supplied URL, the
 * internally managed recordingId, and the `/media` segment.
 *
 * The final URL format will be:
 *
 *    {recordingStreamBaseUrl}/{recordingId}/media
 *
 * Default: `"call/api/recordings/{recordingId}/stream"`
 *
 * Example:
 * Given a recordingStreamBaseUrl of `api/recordings`, the resulting URL for a recordingId of `12345` would be:
 *   `api/recordings/12345/media`
 *
 * It is essential that the resulting route is declared and configured on your backend, as it is
 * used for serving and accessing the recording streams.
 *
 * @example
 * <ov-videoconference [recordingStreamBaseUrl]="'https://myserver.com/api/recordings'">
 * </ov-videoconference>
 */
@Directive({
	selector: 'ov-videoconference[recordingStreamBaseUrl]',
	standalone: true
})
export class RecordingStreamBaseUrlDirective implements OnDestroy {
	/**
	 * @ignore
	 */
	readonly recordingStreamBaseUrl = input<string>('');

	/**
	 * @ignore
	 */
	public elementRef = inject(ElementRef);
	private readonly libService = inject(OpenViduComponentsConfigService);
	private readonly recordingStreamBaseUrlEffect = effect(() => {
		this.update(this.recordingStreamBaseUrl());
	});

	/**
	 * @ignore
	 */
	ngOnDestroy(): void {
		this.clear();
	}

	/**
	 * @ignore
	 */
	clear() {
		this.update('');
	}

	/**
	 * @ignore
	 */
	update(value: string) {
		if (value) this.libService.updateGeneralConfig({ recordingStreamBaseUrl: value });
	}
}

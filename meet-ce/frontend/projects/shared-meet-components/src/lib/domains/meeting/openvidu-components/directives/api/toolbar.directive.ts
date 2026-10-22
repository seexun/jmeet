import { Directive, ElementRef, OnDestroy, effect, inject, input } from '@angular/core';
import { ToolbarAdditionalButtonsPosition } from '../../models/toolbar.model';
import { OpenViduComponentsConfigService } from '../../services/config/directive-config.service';

/**
 * The **cameraButton** directive allows show/hide the camera toolbar button.
 *
 * Default: `true`
 *
 * It can be used in the parent element {@link VideoconferenceComponent} specifying the name of the `toolbar` component:
 *
 * @example
 * <ov-videoconference [toolbarCameraButton]="false"></ov-videoconference>
 *
 * \
 * And it also can be used in the {@link ToolbarComponent}.
 * @example
 * <ov-toolbar [cameraButton]="false"></ov-toolbar>
 */
@Directive({
	selector: 'ov-videoconference[toolbarCameraButton], ov-toolbar[cameraButton]',
	standalone: true
})
export class ToolbarCameraButtonDirective implements OnDestroy {
	/**
	 * @ignore
	 */
	readonly toolbarCameraButton = input<boolean | undefined>(undefined);

	/**
	 * @ignore
	 */
	readonly cameraButton = input<boolean | undefined>(undefined);

	/**
	 * @ignore
	 */
	public elementRef = inject(ElementRef);
	private readonly libService = inject(OpenViduComponentsConfigService);
	private readonly cameraButtonEffect = effect(() => {
		this.update(this.cameraButton() ?? this.toolbarCameraButton() ?? true);
	});

	ngOnDestroy(): void {
		this.clear();
	}

	private clear() {
		this.update(true);
	}

	private update(value: boolean) {
		this.libService.updateToolbarConfig({ camera: value });
	}
}

/**
 * The **microphoneButton** directive allows show/hide the microphone toolbar button.
 *
 * Default: `true`
 *
 * It can be used in the parent element {@link VideoconferenceComponent} specifying the name of the `toolbar` component:
 *
 * @example
 * <ov-videoconference [toolbarMicrophoneButton]="false"></ov-videoconference>
 *
 * \
 * And it also can be used in the {@link ToolbarComponent}.
 * @example
 * <ov-toolbar [microphoneButton]="false"></ov-toolbar>
 */
@Directive({
	selector: 'ov-videoconference[toolbarMicrophoneButton], ov-toolbar[microphoneButton]',
	standalone: true
})
export class ToolbarMicrophoneButtonDirective implements OnDestroy {
	/**
	 * @ignore
	 */
	readonly toolbarMicrophoneButton = input<boolean | undefined>(undefined);

	/**
	 * @ignore
	 */
	readonly microphoneButton = input<boolean | undefined>(undefined);

	/**
	 * @ignore
	 */
	public elementRef = inject(ElementRef);
	private readonly libService = inject(OpenViduComponentsConfigService);
	private readonly microphoneButtonEffect = effect(() => {
		this.update(this.microphoneButton() ?? this.toolbarMicrophoneButton() ?? true);
	});

	ngOnDestroy(): void {
		this.clear();
	}

	private clear() {
		this.update(true);
	}

	private update(value: boolean) {
		this.libService.updateToolbarConfig({ microphone: value });
	}
}

/**
 * The **screenshareButton** directive allows show/hide the screenshare toolbar button.
 *
 * Default: `true`
 *
 * It can be used in the parent element {@link VideoconferenceComponent} specifying the name of the `toolbar` component:
 *
 * @example
 * <ov-videoconference [toolbarScreenshareButton]="false"></ov-videoconference>
 *
 * \
 * And it also can be used in the {@link ToolbarComponent}.
 * @example
 * <ov-toolbar [screenshareButton]="false"></ov-toolbar>
 */
@Directive({
	selector: 'ov-videoconference[toolbarScreenshareButton], ov-toolbar[screenshareButton]',
	standalone: true
})
export class ToolbarScreenshareButtonDirective implements OnDestroy {
	/**
	 * @ignore
	 */
	readonly toolbarScreenshareButton = input<boolean | undefined>(undefined);

	/**
	 * @ignore
	 */
	readonly screenshareButton = input<boolean | undefined>(undefined);

	/**
	 * @ignore
	 */
	public elementRef = inject(ElementRef);
	private readonly libService = inject(OpenViduComponentsConfigService);
	private readonly screenshareButtonEffect = effect(() => {
		this.update(this.screenshareButton() ?? this.toolbarScreenshareButton() ?? true);
	});

	ngOnDestroy(): void {
		this.clear();
	}

	private clear() {
		this.update(true);
	}

	private update(value: boolean) {
		this.libService.updateToolbarConfig({ screenshare: value });
	}
}

/**
 * The **recordingButton** directive allows show/hide the start/stop recording toolbar button.
 *
 * Default: `true`
 *
 * It can be used in the parent element {@link VideoconferenceComponent} specifying the name of the `toolbar` component:
 *
 * @example
 * <ov-videoconference [toolbarRecordingButton]="false"></ov-videoconference>
 *
 * \
 * And it also can be used in the {@link ToolbarComponent}.
 * @example
 * <ov-toolbar [recordingButton]="false"></ov-toolbar>
 */
@Directive({
	selector: 'ov-videoconference[toolbarRecordingButton], ov-toolbar[recordingButton]',
	standalone: true
})
export class ToolbarRecordingButtonDirective implements OnDestroy {
	/**
	 * @ignore
	 */
	readonly toolbarRecordingButton = input<boolean | undefined>(undefined);
	/**
	 * @ignore
	 */
	readonly recordingButton = input<boolean | undefined>(undefined);

	/**
	 * @ignore
	 */
	public elementRef = inject(ElementRef);
	private readonly libService = inject(OpenViduComponentsConfigService);
	private readonly recordingButtonEffect = effect(() => {
		this.update(this.recordingButton() ?? this.toolbarRecordingButton() ?? true);
	});

	ngOnDestroy(): void {
		this.clear();
	}
	private clear() {
		this.update(true);
	}

	private update(value: boolean) {
		this.libService.updateToolbarConfig({ recording: value });
	}
}


/**
 * The **fullscreenButton** directive allows show/hide the fullscreen toolbar button.
 *
 * Default: `true`
 *
 * It can be used in the parent element {@link VideoconferenceComponent} specifying the name of the `toolbar` component:
 *
 * @example
 * <ov-videoconference [toolbarFullscreenButton]="false"></ov-videoconference>
 *
 * \
 * And it also can be used in the {@link ToolbarComponent}.
 * @example
 * <ov-toolbar [fullscreenButton]="false"></ov-toolbar>
 */
@Directive({
	selector: 'ov-videoconference[toolbarFullscreenButton], ov-toolbar[fullscreenButton]',
	standalone: true
})
export class ToolbarFullscreenButtonDirective implements OnDestroy {
	/**
	 * @ignore
	 */
	readonly toolbarFullscreenButton = input<boolean | undefined>(undefined);
	/**
	 * @ignore
	 */
	readonly fullscreenButton = input<boolean | undefined>(undefined);

	/**
	 * @ignore
	 */
	public elementRef = inject(ElementRef);
	private readonly libService = inject(OpenViduComponentsConfigService);
	private readonly fullscreenButtonEffect = effect(() => {
		this.update(this.fullscreenButton() ?? this.toolbarFullscreenButton() ?? true);
	});
	ngOnDestroy(): void {
		this.clear();
	}
	private clear() {
		this.update(true);
	}

	private update(value: boolean) {
		this.libService.updateToolbarConfig({ fullscreen: value });
	}
}

/**
 * The **backgroundEffectsButton** directive allows show/hide the background effects toolbar button.
 *
 * Default: `true`
 *
 * It can be used in the parent element {@link VideoconferenceComponent} specifying the name of the `toolbar` component:
 *
 * @example
 * <ov-videoconference [toolbarBackgroundEffectsButton]="false"></ov-videoconference>
 *
 * \
 * And it also can be used in the {@link ToolbarComponent}.
 * @example
 * <ov-toolbar [backgroundEffectsButton]="false"></ov-toolbar>
 */
@Directive({
	selector: 'ov-videoconference[toolbarBackgroundEffectsButton], ov-toolbar[backgroundEffectsButton]',
	standalone: true
})
export class ToolbarBackgroundEffectsButtonDirective implements OnDestroy {
	/**
	 * @ignore
	 */
	readonly toolbarBackgroundEffectsButton = input<boolean | undefined>(undefined);
	/**
	 * @ignore
	 */
	readonly backgroundEffectsButton = input<boolean | undefined>(undefined);

	/**
	 * @ignore
	 */
	public elementRef = inject(ElementRef);
	private readonly libService = inject(OpenViduComponentsConfigService);
	private readonly backgroundEffectsButtonEffect = effect(() => {
		this.update(this.backgroundEffectsButton() ?? this.toolbarBackgroundEffectsButton() ?? true);
	});
	ngOnDestroy(): void {
		this.clear();
	}
	private clear() {
		this.update(true);
	}

	private update(value: boolean) {
		this.libService.updateToolbarConfig({ backgroundEffects: value });
	}
}

/**
 * The **captionsButton** directive allows show/hide the captions toolbar button.
 *
 * Default: `true`
 *
 * It can be used in the parent element {@link VideoconferenceComponent} specifying the name of the `toolbar` component:
 *
 * @example
 * <ov-videoconference [toolbarCaptionsButton]="false"></ov-videoconference>
 *
 * \
 * And it also can be used in the {@link ToolbarComponent}.
 * @example
 * <ov-toolbar [captionsButton]="false"></ov-toolbar>
 */
//  @Directive({
// 	selector: 'ov-videoconference[toolbarCaptionsButton], ov-toolbar[captionsButton]'
// })
// export class ToolbarCaptionsButtonDirective implements AfterViewInit, OnDestroy {
// 	/**
// 	 * @ignore
// 	 */
// 	@Input() set toolbarCaptionsButton(value: boolean) {
// 		this.captionsButtonValue = value;
// 		this.update(this.captionsButtonValue);
// 	}
// 	/**
// 	 * @ignore
// 	 */
// 	@Input() set captionsButton(value: boolean) {
// 		this.captionsButtonValue = value;
// 		this.update(this.captionsButtonValue);
// 	}

// 	private captionsButtonValue: boolean = true;

// 	/**
// 	 * @ignore
// 	 */
// 	public elementRef = inject(ElementRef);
// 	private readonly libService = inject(OpenViduAngularConfigService);

// 	ngAfterViewInit() {
// 		this.update(this.captionsButtonValue);
// 	}
// 	ngOnDestroy(): void {
// 		this.clear();
// 	}
// 	private clear() {
// 		this.captionsButtonValue = true;
// 		this.update(true);
// 	}

// 	private update(value: boolean) {
// 		if (this.libService.captionsButton.getValue() !== value) {
// 			this.libService.captionsButton.next(value);
// 		}
// 	}
// }

/**
 * The **settingsButton** directive allows show/hide the settings toolbar button.
 *
 * Default: `true`
 *
 * It can be used in the parent element {@link VideoconferenceComponent} specifying the name of the `toolbar` component:
 *
 * @example
 * <ov-videoconference [toolbarSettingsButton]="false"></ov-videoconference>
 *
 * \
 * And it also can be used in the {@link ToolbarComponent}.
 * @example
 * <ov-toolbar [settingsButton]="false"></ov-toolbar>
 */
@Directive({
	selector: 'ov-videoconference[toolbarSettingsButton], ov-toolbar[settingsButton]',
	standalone: true
})
export class ToolbarSettingsButtonDirective implements OnDestroy {
	/**
	 * @ignore
	 */
	readonly toolbarSettingsButton = input<boolean | undefined>(undefined);
	/**
	 * @ignore
	 */
	readonly settingsButton = input<boolean | undefined>(undefined);

	/**
	 * @ignore
	 */
	public elementRef = inject(ElementRef);
	private readonly libService = inject(OpenViduComponentsConfigService);
	private readonly settingsButtonEffect = effect(() => {
		this.update(this.settingsButton() ?? this.toolbarSettingsButton() ?? true);
	});
	ngOnDestroy(): void {
		this.clear();
	}
	private clear() {
		this.update(true);
	}

	private update(value: boolean) {
		this.libService.updateToolbarConfig({ settings: value });
	}
}

/**
 * The **leaveButton** directive allows show/hide the leave toolbar button.
 *
 * Default: `true`
 *
 * It can be used in the parent element {@link VideoconferenceComponent} specifying the name of the `toolbar` component:
 *
 * @example
 * <ov-videoconference [toolbarLeaveButton]="false"></ov-videoconference>
 *
 * \
 * And it also can be used in the {@link ToolbarComponent}.
 * @example
 * <ov-toolbar [leaveButton]="false"></ov-toolbar>
 */
@Directive({
	selector: 'ov-videoconference[toolbarLeaveButton], ov-toolbar[leaveButton]',
	standalone: true
})
export class ToolbarLeaveButtonDirective implements OnDestroy {
	/**
	 * @ignore
	 */
	readonly toolbarLeaveButton = input<boolean | undefined>(undefined);
	/**
	 * @ignore
	 */
	readonly leaveButton = input<boolean | undefined>(undefined);

	/**
	 * @ignore
	 */
	public elementRef = inject(ElementRef);
	private readonly libService = inject(OpenViduComponentsConfigService);
	private readonly leaveButtonEffect = effect(() => {
		this.update(this.leaveButton() ?? this.toolbarLeaveButton() ?? true);
	});

	ngOnDestroy(): void {
		this.clear();
	}
	private clear() {
		this.update(true);
	}

	private update(value: boolean) {
		this.libService.updateToolbarConfig({ leave: value });
	}
}

/**
 * The **participantsPanelButton** directive allows show/hide the participants panel toolbar button.
 *
 * Default: `true`
 *
 * It can be used in the parent element {@link VideoconferenceComponent} specifying the name of the `toolbar` component:
 *
 * @example
 * <ov-videoconference [toolbarParticipantsPanelButton]="false"></ov-videoconference>
 *
 * \
 * And it also can be used in the {@link ToolbarComponent}.
 * @example
 * <ov-toolbar [participantsPanelButton]="false"></ov-toolbar>
 */
@Directive({
	selector: 'ov-videoconference[toolbarParticipantsPanelButton], ov-toolbar[participantsPanelButton]',
	standalone: true
})
export class ToolbarParticipantsPanelButtonDirective implements OnDestroy {
	/**
	 * @ignore
	 */
	readonly toolbarParticipantsPanelButton = input<boolean | undefined>(undefined);

	/**
	 * @ignore
	 */
	readonly participantsPanelButton = input<boolean | undefined>(undefined);

	/**
	 * @ignore
	 */
	public elementRef = inject(ElementRef);
	private readonly libService = inject(OpenViduComponentsConfigService);
	private readonly participantsPanelButtonEffect = effect(() => {
		this.update(this.participantsPanelButton() ?? this.toolbarParticipantsPanelButton() ?? true);
	});

	ngOnDestroy(): void {
		this.clear();
	}
	private clear() {
		this.update(true);
	}

	private update(value: boolean) {
		this.libService.updateToolbarConfig({ participantsPanel: value });
	}
}

/**
 * The **chatPanelButton** directive allows show/hide the chat panel toolbar button.
 *
 * Default: `true`
 *
 * It can be used in the parent element {@link VideoconferenceComponent} specifying the name of the `toolbar` component:
 *
 * @example
 * <ov-videoconference [toolbarChatPanelButton]="false"></ov-videoconference>
 *
 * \
 * And it also can be used in the {@link ToolbarComponent}.
 * @example
 * <ov-toolbar [chatPanelButton]="false"></ov-toolbar>
 */
@Directive({
	selector: 'ov-videoconference[toolbarChatPanelButton], ov-toolbar[chatPanelButton]',
	standalone: true
})
export class ToolbarChatPanelButtonDirective implements OnDestroy {
	/**
	 * @ignore
	 */
	readonly toolbarChatPanelButton = input<boolean | undefined>(undefined);
	/**
	 * @ignore
	 */
	readonly chatPanelButton = input<boolean | undefined>(undefined);

	/**
	 * @ignore
	 */
	public elementRef = inject(ElementRef);
	private readonly libService = inject(OpenViduComponentsConfigService);
	private readonly chatPanelButtonEffect = effect(() => {
		this.update(this.chatPanelButton() ?? this.toolbarChatPanelButton() ?? true);
	});

	ngOnDestroy(): void {
		this.clear();
	}
	private clear() {
		this.update(true);
	}

	private update(value: boolean) {
		this.libService.updateToolbarConfig({ chatPanel: value });
	}
}

/**
 * The **activitiesPanelButton** directive allows show/hide the activities panel toolbar button.
 *
 * Default: `true`
 *
 * It can be used in the parent element {@link VideoconferenceComponent} specifying the name of the `toolbar` component:
 *
 * @example
 * <ov-videoconference [toolbarActivitiesPanelButton]="false"></ov-videoconference>
 *
 * \
 * And it also can be used in the {@link ToolbarComponent}.
 * @example
 * <ov-toolbar [activitiesPanelButton]="false"></ov-toolbar>
 */
@Directive({
	selector: 'ov-videoconference[toolbarActivitiesPanelButton], ov-toolbar[activitiesPanelButton]',
	standalone: true
})
export class ToolbarActivitiesPanelButtonDirective implements OnDestroy {
	/**
	 * @ignore
	 */
	readonly toolbarActivitiesPanelButton = input<boolean | undefined>(undefined);
	/**
	 * @ignore
	 */
	readonly activitiesPanelButton = input<boolean | undefined>(undefined);

	/**
	 * @ignore
	 */
	public elementRef = inject(ElementRef);
	private readonly libService = inject(OpenViduComponentsConfigService);
	private readonly activitiesPanelButtonEffect = effect(() => {
		this.update(this.activitiesPanelButton() ?? this.toolbarActivitiesPanelButton() ?? true);
	});

	ngOnDestroy(): void {
		this.clear();
	}
	private clear() {
		this.update(true);
	}

	private update(value: boolean) {
		this.libService.updateToolbarConfig({ activitiesPanel: value });
	}
}

/**
 * The **displayRoomName** directive allows show/hide the room name.
 *
 * Default: `true`
 *
 * It can be used in the parent element {@link VideoconferenceComponent} specifying the name of the `toolbar` component:
 *
 * @example
 * <ov-videoconference [toolbarDisplayRoomName]="false"></ov-videoconference>
 *
 * \
 * And it also can be used in the {@link ToolbarComponent}.
 * @example
 * <ov-toolbar [displayRoomName]="false"></ov-toolbar>
 */
@Directive({
	selector: 'ov-videoconference[toolbarDisplayRoomName], ov-toolbar[displayRoomName]',
	standalone: true
})
export class ToolbarDisplayRoomNameDirective implements OnDestroy {
	/**
	 * @ignore
	 */
	readonly toolbarDisplayRoomName = input<boolean | undefined>(undefined);
	/**
	 * @ignore
	 */
	readonly displayRoomName = input<boolean | undefined>(undefined);

	/**
	 * @ignore
	 */
	public elementRef = inject(ElementRef);
	private readonly libService = inject(OpenViduComponentsConfigService);
	private readonly displayRoomNameEffect = effect(() => {
		this.update(this.displayRoomName() ?? this.toolbarDisplayRoomName() ?? true);
	});

	ngOnDestroy(): void {
		this.clear();
	}
	private clear() {
		this.update(true);
	}

	private update(value: boolean) {
		this.libService.updateToolbarConfig({ displayRoomName: value });
	}
}

/**
 * The **displayLogo** directive allows show/hide the branding logo.
 *
 * Default: `true`
 *
 * It can be used in the parent element {@link VideoconferenceComponent} specifying the name of the `toolbar` component:
 *
 * @example
 * <ov-videoconference [toolbarDisplayLogo]="false"></ov-videoconference>
 *
 * \
 * And it also can be used in the {@link ToolbarComponent}.
 * @example
 * <ov-toolbar [displayLogo]="false"></ov-toolbar>
 */
@Directive({
	selector: 'ov-videoconference[toolbarDisplayLogo], ov-toolbar[displayLogo]',
	standalone: true
})
export class ToolbarDisplayLogoDirective implements OnDestroy {
	/**
	 * @ignore
	 */
	readonly toolbarDisplayLogo = input<boolean | undefined>(undefined);
	/**
	 * @ignore
	 */
	readonly displayLogo = input<boolean | undefined>(undefined);

	/**
	 * @ignore
	 */
	public elementRef = inject(ElementRef);
	private readonly libService = inject(OpenViduComponentsConfigService);
	private readonly displayLogoEffect = effect(() => {
		this.update(this.displayLogo() ?? this.toolbarDisplayLogo() ?? true);
	});

	ngOnDestroy(): void {
		this.clear();
	}
	private clear() {
		this.update(true);
	}

	private update(value: boolean) {
		this.libService.updateToolbarConfig({ displayLogo: value });
	}
}

/**
 * The **ovToolbarAdditionalButtonsPosition** defines the position where the additional buttons should be inserted.
 *
 * The possible values are: {@link ToolbarAdditionalButtonsPosition}
 * Default: `afterMenu`
 *
 * It can be used in the any element which contains the  structural directive {@link ToolbarAdditionalButtonsDirective}.
 *
 * @example
 * <div *ovToolbarAdditionalButtons [ovToolbarAdditionalButtonsPosition]="'beforeMenu'"></div>
 *
 */
@Directive({
	selector: '[ovToolbarAdditionalButtonsPosition]',
	standalone: true
})
export class ToolbarAdditionalButtonsPossitionDirective implements OnDestroy {
	/**
	 * @ignore
	 */
	readonly ovToolbarAdditionalButtonsPosition = input<ToolbarAdditionalButtonsPosition | undefined>(undefined);

	/**
	 * @ignore
	 */
	public elementRef = inject(ElementRef);
	private readonly libService = inject(OpenViduComponentsConfigService);
	private readonly additionalButtonsPositionEffect = effect(() => {
		const value = this.ovToolbarAdditionalButtonsPosition() ?? ToolbarAdditionalButtonsPosition.AFTER_MENU;
		if (!Object.values(ToolbarAdditionalButtonsPosition).includes(value)) return;

		this.update(value);
	});

	ngOnDestroy(): void {
		this.clear();
	}
	private clear() {
		this.update(ToolbarAdditionalButtonsPosition.AFTER_MENU);
	}

	private update(value: ToolbarAdditionalButtonsPosition) {
		this.libService.updateToolbarConfig({ additionalButtonsPosition: value });
	}
}

import { CommonModule } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	contentChild,
	effect,
	inject,
	OnInit,
	output,
	signal,
	TemplateRef
} from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { SettingsPanelGeneralAdditionalElementsDirective } from '../../../directives/template/internals.directive';
import { CustomDevice } from '../../../models/device.model';
import { LangOption } from '../../../models/lang.model';
import { PanelSettingsOptions, PanelType } from '../../../models/panel.model';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { OpenViduComponentsConfigService } from '../../../services/config/directive-config.service';
import { PanelService } from '../../../services/panel/panel.service';
import { PlatformService } from '../../../services/platform/platform.service';
import { ViewportService } from '../../../services/viewport/viewport.service';
import { AudioDevicesComponent } from '../../settings/audio-devices/audio-devices.component';
import { ParticipantNameInputComponent } from '../../settings/participant-name-input/participant-name-input.component';
import { VideoDevicesComponent } from '../../settings/video-devices/video-devices.component';

/**
 * @internal
 */
@Component({
	selector: 'ov-settings-panel',
	imports: [
		CommonModule,
		NzIconModule,
		NzTooltipModule,
		TranslatePipe,
		ParticipantNameInputComponent,
		VideoDevicesComponent,
		AudioDevicesComponent
	],
	templateUrl: './settings-panel.component.html',
	styleUrls: ['../panel.component.scss', './settings-panel.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true
})
export class SettingsPanelComponent implements OnInit {
	onVideoEnabledChanged = output<boolean>();
	onVideoDeviceChanged = output<CustomDevice>();
	onAudioEnabledChanged = output<boolean>();
	onAudioDeviceChanged = output<CustomDevice>();
	onLangChanged = output<LangOption>();

	private readonly panelService = inject(PanelService);
	private readonly platformService = inject(PlatformService);
	private readonly libService = inject(OpenViduComponentsConfigService);
	public readonly viewportService = inject(ViewportService);

	/**
	 * @internal
	 * ContentChild for custom elements in general section
	 */
	readonly externalGeneralAdditionalElements = contentChild.required(SettingsPanelGeneralAdditionalElementsDirective);

	settingsOptions: typeof PanelSettingsOptions = PanelSettingsOptions;
	readonly isMobile = signal(false);

	readonly showCameraButton = this.libService.cameraButtonSignal;
	readonly showMicrophoneButton = this.libService.microphoneButtonSignal;
	readonly selectedOption = signal<PanelSettingsOptions>(PanelSettingsOptions.GENERAL);

	/**
	 * @internal
	 * Gets the template for additional elements in general section
	 */
	get generalAdditionalElementsTemplate(): TemplateRef<any> | undefined {
		return this.externalGeneralAdditionalElements()?.template;
	}

	readonly isCompactView = computed(() => {
		return this.viewportService.isMobileView() || this.viewportService.isTabletDown();
	});

	readonly isVerticalLayout = computed(() => {
		return this.viewportService.isMobileView();
	});

	readonly shouldHideMenuText = computed(() => {
		return !this.viewportService.isMobileView() && this.viewportService.isTablet();
	});

	private readonly panelTogglingEffect = effect(() => {
		const ev = this.panelService.panelOpened();
		if (ev.panelType === PanelType.SETTINGS && !!ev.subOptionType) {
			this.selectedOption.set(ev.subOptionType as PanelSettingsOptions);
		}
	});

	ngOnInit() {
		this.isMobile.set(this.platformService.isMobile());
	}

	close() {
		this.panelService.togglePanel(PanelType.SETTINGS);
	}
	onSelectionChanged(option: PanelSettingsOptions) {
		this.selectedOption.set(option);
	}

}

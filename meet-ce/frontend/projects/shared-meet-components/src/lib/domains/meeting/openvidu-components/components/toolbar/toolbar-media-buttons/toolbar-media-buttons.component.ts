import { CommonModule } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	TemplateRef,
	computed,
	contentChild,
	effect,
	inject,
	input,
	output,
} from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzIconTypePipe } from '../../../../../../shared/pipes/nz-icon-type.pipe';
import { ToolbarMoreOptionsAdditionalMenuItemsDirective } from '../../../directives/template/internals.directive';
import { RecordingState } from '../../../models/recording.model';
import { ToolbarAdditionalButtonsPosition } from '../../../models/toolbar.model';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { PanelService } from '../../../services/panel/panel.service';
import { ViewportService } from '../../../services/viewport/viewport.service';

/**
 * @internal
 */
@Component({
	selector: 'ov-toolbar-media-buttons',
	imports: [
		CommonModule,
		NzIconModule,
		NzIconTypePipe,
		NzDropDownModule,
		NzTooltipModule,
		TranslatePipe,
		NzMenuModule
	],
	templateUrl: './toolbar-media-buttons.component.html',
	styleUrl: './toolbar-media-buttons.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true
})
export class ToolbarMediaButtonsComponent {
	// In-meeting light/dark theme toggle (more options menu switch)

	// Camera related inputs
	showCameraButton = input<boolean>(true);
	isCameraEnabled = input<boolean>(true);
	cameraMuteChanging = input<boolean>(false);

	// Microphone related inputs
	showMicrophoneButton = input<boolean>(true);
	isMicrophoneEnabled = input<boolean>(true);
	microphoneMuteChanging = input<boolean>(false);

	// Screenshare related inputs
	showScreenshareButton = input<boolean>(true);
	isScreenShareEnabled = input<boolean>(false);
	isFirefoxBrowser = input<boolean>(false);

	// Device availability inputs
	hasVideoDevices = input<boolean>(true);
	hasAudioDevices = input<boolean>(true);

	// Connection state inputs
	isConnectionLost = input<boolean>(false);

	// More options menu inputs
	showMoreOptionsButton = input<boolean>(true);
	showFullscreenButton = input<boolean>(true);
	showRecordingButton = input<boolean>(true);
	showViewRecordingsButton = input<boolean>(false);
	showBackgroundEffectsButton = input<boolean>(true);
	showSettingsButton = input<boolean>(true);

	// Fullscreen state
	isFullscreenActive = input<boolean>(false);

	// Recording related inputs
	recordingStatus = input<RecordingState>(RecordingState.STOPPED);
	hasRoomTracksPublished = input<boolean>(false);


	// Leave button
	showLeaveButton = input<boolean>(true);

	// Additional buttons template
	toolbarAdditionalButtonsTemplate = input<TemplateRef<any> | null>(null);
	additionalButtonsPosition = input<ToolbarAdditionalButtonsPosition | undefined>(undefined);

	// Leave button template
	toolbarLeaveButtonTemplate = input<TemplateRef<any> | null>(null);

	/**
	 * @internal
	 * ContentChild for custom menu items in more options menu
	 */
	readonly externalMoreOptionsAdditionalMenuItems = contentChild.required(
		ToolbarMoreOptionsAdditionalMenuItemsDirective
	);

	/**
	 * @internal
	 * Gets the template for additional menu items in more options
	 */
	get moreOptionsAdditionalMenuItemsTemplate(): TemplateRef<any> | undefined {
		return this.externalMoreOptionsAdditionalMenuItems()?.template;
	}

	// Status enums for template usage
	_recordingStatus = RecordingState;

	// Viewport service for responsive behavior
	private viewportService = inject(ViewportService);
	private readonly panelService = inject(PanelService);

	/** Open state of the "More options" dropdown (NzDropDown two-way visible). */
	moreOptionsMenuOpen = false;

	private readonly closeMenuWhenPanelOpensEffect = effect(() => {
		if (this.panelService.panelOpened().isOpened) {
			queueMicrotask(() => (this.moreOptionsMenuOpen = false));
		}
	});

	// Computed properties for responsive button grouping
	readonly isMobileView = computed(() => this.viewportService.isMobile());
	readonly isTabletView = computed(() => this.viewportService.isTablet());
	readonly isDesktopView = computed(() => this.viewportService.isDesktop());

	// Essential buttons that always stay visible
	readonly showCameraButtonDirect = computed(() => this.showCameraButton());

	readonly showMicrophoneButtonDirect = computed(() => this.showMicrophoneButton());

	// Screenshare button - visible on tablet+ or when already active
	readonly showScreenshareButtonDirect = computed(
		() => this.showScreenshareButton() && (!this.isMobileView() || this.isScreenShareEnabled())
	);

	// More options button - always visible
	readonly showMoreOptionsButtonDirect = computed(() => this.showMoreOptionsButton());

	// Check if there are active features that should show a badge on More Options
	readonly hasActiveFeatures = computed(
		() =>
			this.isScreenShareEnabled() ||
			this.recordingStatus() === this._recordingStatus.STARTED
	);

	// Keep the main toolbar lean (Tencent Meeting–like): never flatten extra/host
	// controls onto the desktop bar — always park them inside "More options".
	readonly showAdditionalButtonsOutside = computed(() => false);

	readonly showAdditionalButtonsInsideMenu = computed(() => !!this.toolbarAdditionalButtonsTemplate());

	// Media button outputs
	readonly cameraToggled = output<void>();
	readonly microphoneToggled = output<void>();
	readonly screenShareToggled = output<void>();
	readonly screenTrackReplaced = output<void>();

	// More options menu outputs
	readonly fullscreenToggled = output<void>();
	readonly recordingToggled = output<void>();
	readonly viewRecordingsClicked = output<void>();
	readonly broadcastingToggled = output<void>();
	readonly backgroundEffectsToggled = output<void>();
	readonly settingsToggled = output<void>();

	// Leave button output
	readonly leaveClicked = output<void>();

	// Event handler methods
	onCameraToggle(): void {
		this.cameraToggled.emit();
	}

	onMicrophoneToggle(): void {
		this.microphoneToggled.emit();
	}

	onScreenShareToggle(): void {
		this.screenShareToggled.emit();
	}

	onScreenTrackReplace(): void {
		this.screenTrackReplaced.emit();
	}

	onFullscreenToggle(): void {
		this.fullscreenToggled.emit();
	}

	onRecordingToggle(): void {
		this.recordingToggled.emit();
	}

	onViewRecordingsClick(): void {
		this.viewRecordingsClicked.emit();
	}

	onBroadcastingToggle(): void {
		this.broadcastingToggled.emit();
	}

	onBackgroundEffectsToggle(): void {
		// nzDisabled 只负责置灰，模板绑定的 (click) 仍会触发，这里按同一条件拦截
		if (!this.isCameraEnabled()) {
			return;
		}
		this.backgroundEffectsToggled.emit();
	}

	onSettingsToggle(): void {
		this.settingsToggled.emit();
	}

	onMoreOptionsVisibleChange(visible: boolean): void {
		this.moreOptionsMenuOpen = visible;
		if (visible) {
			this.onMoreOptionsMenuOpened();
		}
	}

	onMoreOptionsMenuOpened(): void {
		if (this.panelService.isPanelOpened()) {
			this.panelService.closePanel();
		}
	}

	onLeaveClick(): void {
		this.leaveClicked.emit();
	}
}

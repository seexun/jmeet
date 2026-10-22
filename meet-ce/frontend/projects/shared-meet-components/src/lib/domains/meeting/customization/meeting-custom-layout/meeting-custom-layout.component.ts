import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzIconTypePipe } from '../../../../shared/pipes/nz-icon-type.pipe';
import { RuntimeConfigService } from '../../../../shared/services/runtime-config.service';
import { OpenViduComponentsUiModule, PanelService, PanelType } from '../../openvidu-components';
import { SmartLayoutComponent } from '../../openvidu-components/components/layout/smart-layout/smart-layout.component';
import { SmartLayoutService } from '../../openvidu-components/services/layout/smart-layout.service';
import { MeetingContextService } from '../../services/meeting-context.service';
import { MeetingLayoutService } from '../../services/meeting-layout.service';
import { MeetingWaitingPanelComponent } from '../meeting-waiting-panel/meeting-waiting-panel.component';

@Component({
	selector: 'ov-meeting-custom-layout',
	imports: [
		NgClass,
		NzIconModule, NzIconTypePipe,
		OpenViduComponentsUiModule,
		SmartLayoutComponent,
		MeetingWaitingPanelComponent
	],
	templateUrl: './meeting-custom-layout.component.html',
	styleUrl: './meeting-custom-layout.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [{ provide: SmartLayoutService, useExisting: MeetingLayoutService }]
})
export class MeetingCustomLayoutComponent {
	protected meetingContextService = inject(MeetingContextService);
	protected panelService = inject(PanelService);
	private readonly runtimeConfigService = inject(RuntimeConfigService);
	readonly fitVideoToStage = signal(false);

	lkRoom = this.meetingContextService.lkRoom;
	isEmbeddedMode = this.runtimeConfigService.isEmbeddedMode;

	/**
	 * Waiting overlay: embedded modes (webcomponent or iframe) only, shown while alone.
	 * Standalone invite sharing lives in the toolbar and participants panel.
	 */
	shouldShowWaitingOverlay = computed(() => this.isEmbeddedMode() && this.meetingContextService.isAlone());

	shouldShowOverlay = computed(() => this.shouldShowWaitingOverlay());

	showLayoutSelector = computed(() => this.meetingContextService.meetingUI().showLayoutSelector);

	protected toggleParticipantsPanel(): void {
		this.panelService.togglePanel(PanelType.PARTICIPANTS);
	}

	protected toggleVideoFit(): void {
		this.fitVideoToStage.update((fit) => !fit);
	}
}

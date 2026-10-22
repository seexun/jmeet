import { Component, computed, inject } from '@angular/core';
import { ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSliderModule } from 'ng-zorro-antd/slider';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { SmartLayoutMode } from '../../openvidu-components';
import { MeetingContextService } from '../../services/meeting-context.service';
import { MeetingLayoutService } from '../../services/meeting-layout.service';

/**
 * Component for additional settings in the Settings Panel.
 */
@Component({
	selector: 'ov-meeting-settings-extensions',
	imports: [NzIconModule, NzRadioModule, NzSliderModule, FormsModule, TranslatePipe],
	templateUrl: './meeting-settings-extensions.component.html',
	styleUrl: './meeting-settings-extensions.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class MeetingSettingsExtensionsComponent {
	protected readonly meetingContextService = inject(MeetingContextService);
	private readonly layoutService = inject(MeetingLayoutService);

	/** Whether the layout switching feature is allowed */
	showLayoutSelector = computed(() => this.meetingContextService.meetingUI().showLayoutSelector);
	/** Expose LayoutMode enum to template */
	LayoutMode = SmartLayoutMode;
	/** Current layout mode */
	layoutMode = this.layoutService.layoutMode;
	/** Whether smart layout mode is enabled */
	isSmartLayoutEnabled = this.layoutService.isSmartLayoutEnabled;

	/** Minimum number of participants that can be shown when smart layout mode is enabled */
	minParticipants = this.layoutService.MIN_VISIBLE_REMOTE_PARTICIPANTS;
	/** Maximum number of participants that can be shown */
	maxParticipants = this.layoutService.MAX_VISIBLE_REMOTE_PARTICIPANTS_LIMIT;
	/** Current participant count */
	participantCount = this.layoutService.maxVisibleRemoteParticipants;

	/**
	 * Handler for layout mode change
	 */
	onLayoutModeChange(mode: SmartLayoutMode): void {
		this.layoutService.setLayoutMode(mode);
	}

	/**
	 * Handler for participant count change
	 */
	onParticipantCountChange(count: number): void {
		this.layoutService.setMaxVisibleRemoteParticipants(count);
	}

	/**
	 * Format label for the participant count slider
	 */
	formatLabel(value: number): string {
		return `${value}`;
	}
}

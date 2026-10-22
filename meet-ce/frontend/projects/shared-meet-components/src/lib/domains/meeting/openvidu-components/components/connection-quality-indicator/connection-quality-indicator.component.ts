import { ChangeDetectionStrategy, Component, computed, effect, inject, input, OnDestroy, signal } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzIconTypePipe } from '../../../../../shared/pipes/nz-icon-type.pipe';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { ParticipantModel } from '../../models/participant.model';
import { ConnectionQuality } from '../../services/livekit-adapter';
import { MeetingTranslateService } from '../../services/translate/meeting-translate.service';

@Component({
	selector: 'ov-connection-quality-indicator',
	standalone: true,
	imports: [NzIconTypePipe, NzIconModule, NzTooltipModule],
	templateUrl: './connection-quality-indicator.component.html',
	styleUrl: './connection-quality-indicator.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConnectionQualityIndicatorComponent implements OnDestroy {
	readonly participant = input.required<ParticipantModel>();
	readonly transparent = input(false);
	readonly connectionQuality = computed(() => this.participant().connectionQuality);
	readonly participantKey = computed(() => this.participant().sid);
	private readonly translateService = inject(MeetingTranslateService);

	readonly showBadge = computed(() => this.connectionQuality() !== ConnectionQuality.Unknown && this.isVisible());

	readonly tooltipText = computed(() => {
		const label = this.translateService.translate('PANEL.PARTICIPANTS.CONNECTION_QUALITY.LABEL');
		const qualityKey = this.qualityTranslationKey(this.connectionQuality());
		const value = this.translateService.translate(`PANEL.PARTICIPANTS.CONNECTION_QUALITY.${qualityKey}`);
		return `${label}: ${value}`;
	});

	readonly icon = computed(() => {
		switch (this.connectionQuality()) {
			case ConnectionQuality.Excellent:
				return 'signal_wifi_4_bar';
			case ConnectionQuality.Good:
				return 'network_wifi_3_bar';
			case ConnectionQuality.Poor:
				return 'network_wifi_2_bar';
			default:
				return 'signal_wifi_off';
		}
	});

	private readonly BADGE_TIMEOUT = 3000;
	private readonly isVisible = signal(false);
	private visibilityTimeout: ReturnType<typeof setTimeout> | undefined;
	private previousConnectionQuality: ConnectionQuality | undefined;
	private previousParticipantKey: string | undefined;

	private readonly visibilityEffect = effect(() => {
		const participantKey = this.participantKey();
		const quality = this.connectionQuality();

		if (participantKey !== this.previousParticipantKey) {
			this.previousParticipantKey = participantKey;
			this.previousConnectionQuality = undefined;
			this.clearVisibilityTimeout();
			this.isVisible.set(false);
		}

		if (quality === this.previousConnectionQuality) {
			return;
		}

		this.previousConnectionQuality = quality;

		if (quality === ConnectionQuality.Unknown) {
			this.clearVisibilityTimeout();
			this.isVisible.set(false);
			return;
		}

		if (quality === ConnectionQuality.Poor || quality === ConnectionQuality.Lost) {
			this.clearVisibilityTimeout();
			this.isVisible.set(true);
			return;
		}

		if (quality === ConnectionQuality.Good || quality === ConnectionQuality.Excellent) {
			this.isVisible.set(true);
			this.clearVisibilityTimeout();
			this.visibilityTimeout = setTimeout(() => {
				this.isVisible.set(false);
			}, this.BADGE_TIMEOUT);
			return;
		}

		this.clearVisibilityTimeout();
		this.isVisible.set(false);
	});

	ngOnDestroy() {
		this.clearVisibilityTimeout();
	}

	private clearVisibilityTimeout() {
		if (this.visibilityTimeout) {
			clearTimeout(this.visibilityTimeout);
			this.visibilityTimeout = undefined;
		}
	}

	private qualityTranslationKey(quality: ConnectionQuality): string {
		switch (quality) {
			case ConnectionQuality.Excellent: return 'EXCELLENT';
			case ConnectionQuality.Good: return 'GOOD';
			case ConnectionQuality.Poor: return 'POOR';
			default: return 'LOST';
		}
	}
}

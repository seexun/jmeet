import { ChangeDetectionStrategy, Component, computed, effect, inject, output, signal } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import {
	RecordingStartRequestedEvent,
	RecordingState,
	RecordingStopRequestedEvent
} from '../../../../models/recording.model';
import { TranslatePipe } from '../../../../pipes/translate.pipe';
import { OpenViduComponentsConfigService } from '../../../../services/config/directive-config.service';
import { OpenViduService } from '../../../../services/openvidu/openvidu.service';
import { ParticipantService } from '../../../../services/participant/participant.service';
import { RecordingService } from '../../../../services/recording/recording.service';

/**
 * The **RecordingActivityComponent** is the component that allows showing the recording activity.
 */
@Component({
	selector: 'ov-recording-activity',
	imports: [NzIconModule, NzTooltipModule, TranslatePipe],
	templateUrl: './recording-activity.component.html',
	styleUrl: './recording-activity.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true
})
export class RecordingActivityComponent {
	private readonly libService = inject(OpenViduComponentsConfigService);
	private readonly recordingService = inject(RecordingService);
	private readonly participantService = inject(ParticipantService);
	private readonly openviduService = inject(OpenViduService);

	onRecordingStartRequested = output<RecordingStartRequestedEvent>();
	onRecordingStopRequested = output<RecordingStopRequestedEvent>();
	onViewRecordingsClicked = output<void>();
	onViewRecordingClicked = output<string>();

	readonly recordingStatus = signal(RecordingState.STOPPED);
	readonly oldRecordingStatus = signal(RecordingState.STOPPED);
	readonly recStatusEnum = RecordingState;
	readonly recordingAlive = signal(false);
	readonly recordingError = signal<string | undefined>(undefined);
	readonly hasRoomTracksPublished = signal(false);
	readonly showStartStopRecordingButton = this.libService.recordingActivityStartStopRecordingButtonSignal;
	readonly showViewRecordingsButton = this.libService.recordingActivityViewRecordingsButtonSignal;

	readonly statusLabelKey = computed(() => {
		switch (this.recordingStatus()) {
			case RecordingState.STARTED:
				return 'PANEL.RECORDING.STATUS_STARTED';
			case RecordingState.STARTING:
				return 'PANEL.RECORDING.STATUS_STARTING';
			case RecordingState.STOPPING:
				return 'PANEL.RECORDING.STATUS_STOPPING';
			case RecordingState.FAILED:
				return 'PANEL.RECORDING.STATUS_FAILED';
			case RecordingState.READY:
				return 'PANEL.RECORDING.STATUS_READY';
			default:
				return 'PANEL.RECORDING.STATUS_STOPPED';
		}
	});

	private readonly recordingStatusEffect = effect(() => {
		const event = this.recordingService.recordingStatus();
		const { status, error } = event;
		this.recordingStatus.set(status);
		this.recordingError.set(error);
		this.recordingAlive.set(status === RecordingState.STARTED);
		if (status !== RecordingState.FAILED) {
			this.oldRecordingStatus.set(status);
		}
	});

	private readonly roomTracksPublishedEffect = effect(() => {
		this.participantService.localParticipant();
		this.participantService.remoteParticipants();
		this.hasRoomTracksPublished.set(this.openviduService.hasRoomTracksPublished());
	});

	resetStatus(): void {
		const currentStatus = this.recordingService.recordingStatus();
		if (this.oldRecordingStatus() === RecordingState.STARTING) {
			this.recordingService.setRecordingStopped();
		} else if (this.oldRecordingStatus() === RecordingState.STOPPING) {
			this.recordingService.setRecordingStarted(currentStatus.id!, currentStatus.startedAt!.getTime());
		} else {
			this.recordingService.setRecordingStopped();
		}
	}

	startRecording(): void {
		this.onRecordingStartRequested.emit({
			roomName: this.openviduService.getRoomName()
		});
	}

	stopRecording(): void {
		const recId = this.recordingService.recordingStatus().id;
		this.onRecordingStopRequested.emit({
			roomName: this.openviduService.getRoomName(),
			recordingId: recId
		});
	}

	viewAllRecordings(): void {
		this.onViewRecordingsClicked.emit();
	}
}

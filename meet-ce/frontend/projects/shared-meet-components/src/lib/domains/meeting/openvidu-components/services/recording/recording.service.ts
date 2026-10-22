import { inject, Injectable, signal } from '@angular/core';
import { RecordingState, RecordingStateInfo } from '../../models/recording.model';
import { ActionService } from '../action/action.service';
import { OpenViduComponentsConfigService } from '../config/directive-config.service';
import { LoggerService } from '../logger/logger.service';

@Injectable({
	providedIn: 'root'
})
export class RecordingService {
	private readonly actionService = inject(ActionService);
	private readonly libService = inject(OpenViduComponentsConfigService);
	private readonly log = inject(LoggerService).get('RecordingService');

	private recordingTimeInterval: ReturnType<typeof setInterval> | undefined = undefined;
	private recordingStartTimestamp: number | null = null;

	/**
	 * Recording state signal which emits the recording state in every update.
	 */
	readonly recordingStatus = signal<RecordingStateInfo>({
		status: RecordingState.STOPPED,
		startedAt: new Date(0, 0, 0, 0, 0, 0)
	});
	/**
	 * Initializes the recording status with the given parameters and the timer to calculate the elapsed time.
	 * @internal
	 */
	setRecordingStarted(id: string, startDate: number) {
		// Determine the actual start timestamp of the recording
		this.recordingStartTimestamp = startDate;

		// Calculate the elapsed time based on the actual start timestamp
		const recordingElapsedTime = new Date(0, 0, 0, 0, 0, 0);
		if (this.recordingStartTimestamp) {
			const elapsedSeconds = Math.floor((Date.now() - this.recordingStartTimestamp) / 1000);
			recordingElapsedTime.setSeconds(Math.max(0, elapsedSeconds)); // Ensure non-negative
		}

		this.updateStatus({
			id,
			status: RecordingState.STARTED,
			startedAt: recordingElapsedTime
		});

		// Start the timer after updating the initial state
		this.startRecordingTimer();
	}

	/**
	 * Stops the recording timer and updates the recording status to **stopped**.
	 * @internal
	 */
	setRecordingStopped() {
		this.stopRecordingTimer();

		this.updateStatus({
			status: RecordingState.STOPPED,
			startedAt: new Date(0, 0, 0, 0, 0, 0),
			error: undefined
		});

		this.recordingStartTimestamp = null;
	}

	/**
	 * Set the {@link RecordingState} to **starting**.
	 * The `started` stastus will be updated automatically when the recording is actually started.
	 */
	setRecordingStarting(id: string) {
		const { startedAt } = this.recordingStatus();
		this.updateStatus({
			id,
			status: RecordingState.STARTING,
			startedAt
		});
	}

	/**
	 * @internal
	 * @param error
	 */
	setRecordingFailed(error: string) {
		this.stopRecordingTimer();
		const { startedAt } = this.recordingStatus();
		const statusInfo: RecordingStateInfo = {
			status: RecordingState.FAILED,
			startedAt,
			error
		};
		this.updateStatus(statusInfo);
	}

	/**
	 * Set the {@link RecordingState} to **stopping**.
	 * The `stopped` stastus will be updated automatically when the recording is actually stopped.
	 */
	setRecordingStopping() {
		this.updateStatus({
			...this.recordingStatus(),
			status: RecordingState.STOPPING
		});
	}

	/**
	 * Updates the recording status.
	 * @param status {@link RecordingState}
	 */
	private updateStatus(statusInfo: RecordingStateInfo) {
		this.recordingStatus.set(statusInfo);
	}

	private startRecordingTimer() {
		// Don't override the timestamp if it's already set correctly
		if (this.recordingStartTimestamp === null) {
			this.recordingStartTimestamp = Date.now();
		}

		if (this.recordingTimeInterval) {
			clearInterval(this.recordingTimeInterval);
		}

		this.recordingTimeInterval = setInterval(() => {
			if (!this.recordingStartTimestamp) return;

			// Calculate elapsed time based on the actual recording start timestamp
			const elapsedSeconds = Math.floor((Date.now() - this.recordingStartTimestamp) / 1000);
			const startedAt = new Date(0, 0, 0, 0, 0, 0);
			startedAt.setSeconds(Math.max(0, elapsedSeconds)); // Ensure non-negative

			const currentStatus = this.recordingStatus();
			const { status, id } = currentStatus;
			this.updateStatus({
				id,
				status,
				startedAt
			});
		}, 1000);
	}

	private stopRecordingTimer() {
		if (this.recordingTimeInterval) {
			clearInterval(this.recordingTimeInterval);
		}
		const { status, error, id } = this.recordingStatus();
		const statusInfo: RecordingStateInfo = {
			id,
			status,
			startedAt: new Date(0, 0, 0, 0, 0, 0), // Reset elapsed time when stopped
			error
		};
		this.updateStatus(statusInfo);
	}
}

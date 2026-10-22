import {
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	computed,
	inject,
	viewChild
} from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { RecordingDialogData } from '../../models/dialog.model';
import { TranslatePipe } from '../../pipes/translate.pipe';

/**
 * @internal
 * NzModal content component (opened through ActionService.openRecordingPlayerDialog).
 * Closes with `{ manageError: true, error }` when the video element fails so the
 * opener can show the playback error dialog; `{ manageError: false, error: null }`
 * on manual close — same contract as the former Material dialog.
 */
@Component({
    selector: 'app-recording-dialog',
	imports: [TranslatePipe],
    template: `
		<div class="ov-recording-dialog">
			<div class="ov-recording-dialog-body">
				<video #videoElement controls autoplay [src]="src()" (error)="handleError()"></video>
			</div>
			@if (showActionButtons()) {
				<footer class="ov-recording-dialog-footer">
					<button
						type="button"
						class="jmeet-button jmeet-button--primary"
						(click)="close()"
					>
						{{ 'PANEL.CLOSE' | translate }}
					</button>
				</footer>
			}
		</div>
	`,
    styles: `
		video {
			max-height: 64vh;
			max-width: 100%;
		}

		.ov-recording-dialog-footer {
			display: flex;
			justify-content: flex-end;
			gap: 8px;
			padding-top: 12px;
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true
})
export class RecordingDialogComponent {
    readonly nzModalRef = inject(NzModalRef<RecordingDialogComponent>);
    readonly data = inject<RecordingDialogData>(NZ_MODAL_DATA);
    readonly videoElement = viewChild<ElementRef<HTMLVideoElement>>('videoElement');
    readonly src = computed(() => this.data.src);
    readonly showActionButtons = computed(() => this.data.showActionButtons);

	close() {
		this.nzModalRef.close({ manageError: false, error: null });
	}

	handleError() {
		const videoElement = this.videoElement();
		if (!videoElement) return;
		this.nzModalRef.close({ manageError: true, error: videoElement.nativeElement.error });
	}
}

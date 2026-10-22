import {
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	afterNextRender,
	inject,
	viewChild
} from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
import { TranslatePipe } from '../../pipes/translate.pipe';

/**
 * @internal
 * NzModal content component (opened through ActionService.openDeleteRecordingDialog).
 * Resolves `true` when the user confirms the deletion, `false`/undefined otherwise.
 */
@Component({
    selector: 'app-delete-dialog',
	imports: [TranslatePipe],
    template: `
		<div class="ov-dialog">
			<div class="ov-dialog-body">{{ 'PANEL.RECORDING.DELETE_QUESTION' | translate }}</div>
			<footer class="ov-dialog-footer">
				<button type="button" class="jmeet-button jmeet-button--outline" (click)="close()">
					{{ 'PANEL.RECORDING.CANCEL' | translate }}
				</button>
				<button
					type="button"
					class="jmeet-button jmeet-button--danger"
					#confirmButton
					(click)="close(true)"
					id="delete-recording-confirm-btn"
				>
					{{ 'PANEL.RECORDING.DELETE' | translate }}
				</button>
			</footer>
		</div>
	`,
    styles: `
		.ov-dialog {
			display: grid;
			gap: 12px;
		}

		.ov-dialog-body {
			color: var(--jmeet-color-text-secondary, #64748b);
		}

		.ov-dialog-footer {
			display: flex;
			justify-content: flex-end;
			gap: 8px;
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true
})
export class DeleteDialogComponent {
    readonly nzModalRef = inject(NzModalRef<DeleteDialogComponent>);
    readonly confirmButton = viewChild<ElementRef<HTMLButtonElement>>('confirmButton');

    constructor() {
        // Former cdkFocusInitial: the confirm button received initial focus.
        afterNextRender(() => this.confirmButton()?.nativeElement.focus());
    }

	close(success = false) {
		this.nzModalRef.close(success);
	}
}

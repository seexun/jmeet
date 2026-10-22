import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DialogData } from '../../models/dialog.model';
import { TranslatePipe } from '../../pipes/translate.pipe';

/**
 * @internal
 * NzModal content component (opened through ActionService / NotificationService.openModal).
 * Keeps the former Material dialog contract: DialogData in, no result out.
 */

@Component({
    selector: 'ov-dialog-template',
	imports: [TranslatePipe],
    template: `
		<div class="ov-dialog">
			<h2 class="ov-dialog-title">{{ title() }}</h2>
			<div class="ov-dialog-body" id="openvidu-dialog">{{ description() }}</div>
			@if (showActionButtons()) {
				<footer class="ov-dialog-footer">
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
		.ov-dialog {
			display: grid;
			gap: 12px;
		}

		.ov-dialog-title {
			margin: 0;
			color: var(--jmeet-color-text-primary, #0f172a);
			font-size: 16px;
			font-weight: 600;
			line-height: 1.4;
		}

		.ov-dialog-body {
			color: var(--jmeet-color-text-secondary, #64748b);
			overflow-wrap: anywhere;
			white-space: pre-line;
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
export class DialogTemplateComponent {
    readonly nzModalRef = inject(NzModalRef<DialogTemplateComponent>);
    readonly data = inject<DialogData>(NZ_MODAL_DATA);
    readonly title = computed(() => this.data.title);
    readonly description = computed(() => this.data.description);
    readonly showActionButtons = computed(() => this.data.showActionButtons);

    close() {
        this.nzModalRef.close();
    }
}

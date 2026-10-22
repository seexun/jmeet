import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
import { BackgroundEffectsPanelComponent } from '../panel/background-effects-panel/background-effects-panel.component';

/**
 * NzModal content hosting the background effects panel on the pre-join page.
 * The panel keeps its prejoin mode (its close button emits onClose instead of
 * toggling the meeting side panel); this wrapper maps that event to the modal close.
 *
 * @internal
 */
@Component({
	selector: 'ov-prejoin-background-dialog',
	imports: [BackgroundEffectsPanelComponent],
	template: `<ov-background-effects-panel [mode]="'prejoin'" (onClose)="close()" />`,
	styles: `
		:host {
			display: block;
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true
})
export class PrejoinBackgroundDialogComponent {
	private readonly nzModalRef = inject(NzModalRef);

	close(): void {
		this.nzModalRef.close();
	}
}

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzIconTypePipe } from '../../../pipes/nz-icon-type.pipe';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import type { DialogOptions } from '../../../models/notification.model';

@Component({
	selector: 'ov-dialog',
	imports: [NzCheckboxModule, NzIconModule, NzIconTypePipe],
	templateUrl: './confirm-dialog.component.html',
	styleUrl: './confirm-dialog.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfirmDialogComponent {
	readonly nzModalRef = inject(NzModalRef<ConfirmDialogComponent>);
	readonly data = inject(NZ_MODAL_DATA) as DialogOptions;

	force = signal(false);

	close(type: 'confirm' | 'cancel'): void {
		this.nzModalRef.close(type === 'confirm');

		if (type === 'confirm') {
			if (this.force() && this.data.forceConfirmCallback) {
				this.data.forceConfirmCallback();
			} else if (this.data.confirmCallback) {
				this.data.confirmCallback();
			}
		} else if (type === 'cancel' && this.data.cancelCallback) {
			this.data.cancelCallback();
		}
	}

	shouldShowActions(): boolean {
		return this.data.showActions !== false;
	}

	shouldShowConfirmButton(): boolean {
		return this.data.showConfirmButton !== false;
	}

	shouldShowCancelButton(): boolean {
		return this.data.showCancelButton !== false;
	}
}

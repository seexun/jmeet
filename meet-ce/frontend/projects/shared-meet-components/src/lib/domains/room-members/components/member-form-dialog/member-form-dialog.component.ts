import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzIconTypePipe } from '../../../../shared/pipes/nz-icon-type.pipe';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { MeetRoomMemberOptions } from '@openvidu-meet/typings';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { MemberFormDialogData } from '../../models/member-form.model';
import { MemberFormComponent } from '../member-form/member-form.component';

@Component({
	selector: 'ov-member-form-dialog',
	imports: [MemberFormComponent, NzIconModule, NzIconTypePipe, TranslatePipe],
	templateUrl: './member-form-dialog.component.html',
	styleUrl: './member-form-dialog.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberFormDialogComponent {
	readonly nzModalRef = inject<NzModalRef<MemberFormDialogComponent, MeetRoomMemberOptions | null>>(
		NzModalRef
	);
	protected data = inject<MemberFormDialogData>(NZ_MODAL_DATA);

	onMemberSubmitted(options: MeetRoomMemberOptions): void {
		this.nzModalRef.close(options);
	}

	onCancelled(): void {
		this.nzModalRef.close(null);
	}
}

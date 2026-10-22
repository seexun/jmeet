import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { MenuService, NzIsMenuInsideDropdownToken, NzMenuModule } from 'ng-zorro-antd/menu';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { RoomAccessLinkService } from '../../services/room-access-link.service';
import { MeetingContextService } from '../../services/meeting-context.service';
import { MeetingInviteDialogComponent } from '../meeting-invite-dialog/meeting-invite-dialog.component';

/**
 * Toolbar button that copies the meeting speaker (access) link.
 *
 * Purely presentational: its visibility is decided by the parent
 * (MeetingToolbarExtraButtonsComponent). On mobile it renders as a menu item.
 */
@Component({
	selector: 'ov-meeting-toolbar-copy-link-button',
	// 菜单项被 ng-content 投影进工具栏 more-options 菜单，声明视图内没有
	// [nz-menu]/nz-dropdown-menu 的元素级 providers，这里自带一份供 NzMenuItemComponent 注入
	providers: [MenuService, { provide: NzIsMenuInsideDropdownToken, useValue: true }],
	templateUrl: './meeting-toolbar-copy-link-button.component.html',
	styleUrl: './meeting-toolbar-copy-link-button.component.scss',
	imports: [NzIconModule, NzDropDownModule, NzTooltipModule, TranslatePipe, NzMenuModule],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class MeetingToolbarCopyLinkButtonComponent {
	protected roomAccessLinkService = inject(RoomAccessLinkService);
	private readonly meetingContextService = inject(MeetingContextService);
	private readonly modal = inject(NzModalService);

	/** Whether the device is mobile (affects button style) */
	isMobile = input<boolean>(false);

	onCopyLinkClick(): void {
		this.modal.create({
			nzContent: MeetingInviteDialogComponent,
			nzClassName: 'meeting-invite-dialog-panel',
			nzCentered: true,
			nzWidth: '560px',
			nzFooter: null,
			nzClosable: false,
			nzData: {
				roomName: this.meetingContextService.lkRoom()?.name ?? this.meetingContextService.roomId() ?? '会议',
				roomId: this.meetingContextService.roomId() ?? '-',
				roomAccessUrl: this.roomAccessLinkService.speakerPublicLink() ?? ''
			}
		});
	}
}

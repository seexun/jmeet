import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { MenuService, NzIsMenuInsideDropdownToken, NzMenuModule } from 'ng-zorro-antd/menu';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { PanelService, PanelType, ViewportService } from '../../openvidu-components';
import { MeetingContextService } from '../../services/meeting-context.service';

/**
 * Component for additional menu items in the toolbar's "More Options" menu.
 * This component handles custom actions like opening the settings panel for grid layout changes.
 */
@Component({
	selector: 'ov-meeting-toolbar-more-options-menu',
	// 菜单项被 ng-content 投影进工具栏 more-options 菜单，声明视图内没有
	// [nz-menu]/nz-dropdown-menu 的元素级 providers，这里自带一份供 NzMenuItemComponent 注入
	providers: [MenuService, { provide: NzIsMenuInsideDropdownToken, useValue: true }],
	imports: [NzIconModule, NzMenuModule, NzTooltipModule, TranslatePipe],
	templateUrl: './meeting-toolbar-more-options-menu.component.html',
	styleUrl: './meeting-toolbar-more-options-menu.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class MeetingToolbarMoreOptionsMenuComponent {
	private meetingContextService = inject(MeetingContextService);
	private viewportService = inject(ViewportService);
	private panelService = inject(PanelService);

	isMobileView = this.viewportService.isMobile;
	showLayoutSelector = computed(() => this.meetingContextService.meetingUI().showLayoutSelector);

	/**
	 * Opens the settings panel to allow users to change grid layout
	 */
	onOpenSettings(): void {
		this.panelService.togglePanel(PanelType.SETTINGS);
	}

}

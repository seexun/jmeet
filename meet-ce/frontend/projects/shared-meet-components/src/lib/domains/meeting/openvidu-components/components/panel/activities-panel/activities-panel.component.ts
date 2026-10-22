import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { PanelType } from '../../../models/panel.model';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { PanelService } from '../../../services/panel/panel.service';

/**
 * The **ActivitiesPanelComponent** is the component that allows showing the activities panel.
 * 协作工具与录制为开源版不可用能力（企业版提供），面板保留空壳以维持面板体系。
 */
@Component({
	selector: 'ov-activities-panel',
	imports: [NzIconModule, NzTooltipModule, TranslatePipe],
	templateUrl: './activities-panel.component.html',
	styleUrls: ['../panel.component.scss', './activities-panel.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true
})
export class ActivitiesPanelComponent {
	private readonly panelService = inject(PanelService);

	close(): void {
		this.panelService.togglePanel(PanelType.ACTIVITIES);
	}
}

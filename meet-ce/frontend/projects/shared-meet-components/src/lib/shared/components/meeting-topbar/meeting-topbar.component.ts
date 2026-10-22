import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { ConnectionQuality } from '../../../domains/meeting/openvidu-components/services/livekit-adapter';
import { SmartLayoutMode } from '../../../domains/meeting/openvidu-components/models/layout/smart-layout.model';
import { TranslatePipe } from '../../../domains/meeting/openvidu-components/pipes/translate.pipe';
import { NzIconTypePipe } from '../../pipes/nz-icon-type.pipe';

/**
 * The **JmeetMeetingTopbarComponent** is a pure presentational meeting topbar.
 * It renders the room name, recording indicator, layout switch, network quality,
 * secure-meeting marker and elapsed time. Zero service dependencies: all data
 * comes in via inputs, actions leave via outputs.
 */
@Component({
	selector: 'jmeet-meeting-topbar',
	imports: [CommonModule, NzIconModule, NzTooltipModule, TranslatePipe, NzIconTypePipe],
	templateUrl: './meeting-topbar.component.html',
	styleUrl: './meeting-topbar.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class JmeetMeetingTopbarComponent {
	// 模板直接引用枚举成员（与 toolbar.component.ts 同一手法）
	protected readonly SmartLayoutMode = SmartLayoutMode;
	protected readonly ConnectionQuality = ConnectionQuality;

	roomName = input('');
	elapsed = input('');
	recordingStarted = input(false);
	recordingTime = input<Date | undefined | ''>('');
	quality = input<ConnectionQuality>(ConnectionQuality.Unknown);
	layoutMode = input<SmartLayoutMode>(SmartLayoutMode.MOSAIC);

	layoutSelected = output<SmartLayoutMode>();
	activitiesClicked = output<void>();
}

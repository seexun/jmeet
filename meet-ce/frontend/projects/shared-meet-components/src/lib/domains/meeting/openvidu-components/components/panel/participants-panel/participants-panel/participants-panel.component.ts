import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    TemplateRef,
    viewChild
} from '@angular/core';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { PanelType } from '../../../../models/panel.model';
import { TranslatePipe } from '../../../../pipes/translate.pipe';
import { PanelService } from '../../../../services/panel/panel.service';
import { ParticipantService } from '../../../../services/participant/participant.service';
import { TemplateRegistryService } from '../../../../services/template/template-registry.service';
import { ParticipantPanelItemComponent } from '../participant-panel-item/participant-panel-item.component';

/**
 * The **ParticipantsPanelComponent** is hosted inside of the {@link PanelComponent}.
 * It is in charge of displaying the participants connected to the session.
 * This component is composed by the {@link ParticipantPanelItemComponent}.
 */
@Component({
	selector: 'ov-participants-panel',
	imports: [CommonModule, NzIconModule, NzDividerModule, NzTooltipModule, TranslatePipe, ParticipantPanelItemComponent],
	templateUrl: './participants-panel.component.html',
	styleUrls: ['../../panel.component.scss', './participants-panel.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true
})
export class ParticipantsPanelComponent {
	/**
	 * @ignore
	 */
	readonly defaultParticipantPanelItemTemplateQuery = viewChild('defaultParticipantPanelItem', { read: TemplateRef });

	private readonly participantService = inject(ParticipantService);
	private readonly panelService = inject(PanelService);
	private readonly templateRegistry = inject(TemplateRegistryService);

	/**
	 * @ignore
	 */
	readonly localParticipant = this.participantService.localParticipant;
	/**
	 * @ignore
	 */
	readonly remoteParticipants = this.participantService.remoteParticipants;
	readonly participantPanelItemTemplate = computed(
		() => this.templateRegistry.participantPanelItem() ?? this.defaultParticipantPanelItemTemplateQuery()
	);
	readonly participantPanelAfterLocalParticipantTemplate = computed(
		() => this.templateRegistry.participantPanelAfterLocalParticipant()
	);

	close() {
		this.panelService.togglePanel(PanelType.PARTICIPANTS);
	}

}


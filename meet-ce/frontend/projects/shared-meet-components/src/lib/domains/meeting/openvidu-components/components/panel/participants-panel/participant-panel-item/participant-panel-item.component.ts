import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, contentChild, inject, input } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { ParticipantPanelItemElementsDirective } from '../../../../directives/template/openvidu-components-angular.directive';
import { ParticipantPanelParticipantBadgeDirective } from '../../../../directives/template/internals.directive';
import { ParticipantModel } from '../../../../models/participant.model';
import { TranslatePipe } from '../../../../pipes/translate.pipe';
import { OpenViduComponentsConfigService } from '../../../../services/config/directive-config.service';
import { ParticipantService } from '../../../../services/participant/participant.service';
import { MeetingTranslateService } from '../../../../services/translate/meeting-translate.service';
import { TemplateRegistryService } from '../../../../services/template/template-registry.service';
import { ParticipantAvatarComponent } from '../../../participant-avatar/participant-avatar.component';

/**
 * The **ParticipantPanelItemComponent** is hosted inside of the {@link ParticipantsPanelComponent}.
 * It displays participant information with enhanced UI/UX, including support for custom content
 * injection through structural directives.
 */
@Component({
	selector: 'ov-participant-panel-item',
	imports: [CommonModule, NzIconModule, NzTooltipModule, TranslatePipe, ParticipantAvatarComponent],
	templateUrl: './participant-panel-item.component.html',
	styleUrls: ['./participant-panel-item.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true
})
export class ParticipantPanelItemComponent {
	readonly participantInput = input<ParticipantModel | undefined>(undefined, { alias: 'participant' });
	readonly muteButtonInput = input(true, { alias: 'muteButton' });
	private readonly libService = inject(OpenViduComponentsConfigService);
	private readonly participantService = inject(ParticipantService);
	private readonly templateRegistry = inject(TemplateRegistryService);
	private readonly translateSrv = inject(MeetingTranslateService);

	/**
	 * 批次 5 任务 1 删除基座 #mute-btn 后本组件模板已不消费此信号（孤儿）。
	 * 保留理由：库公开模板 API 面（外部宿主自绘 participant-panel-item 模板仍可绑定），
	 * 且上游 *ovParticipantPanelItemMuteButton 指令经 participantItemMuteButtonSignal
	 * 供数——删除即连带 API 失活，收益不抵破坏面。行内实际静音钮由定制 item-content
	 * 的 displayProperties.showMuteButton 自治（批次 5 评估记录）。
	 * @ignore
	 */
	readonly showMuteButton = this.libService.participantItemMuteButtonSignal;
	/**
	 * @ignore
	 */
	readonly showAudioDetection = this.libService.displayAudioDetectionSignal;

	/**
	 * @ignore
	 */
	readonly externalParticipantBadge = contentChild(ParticipantPanelParticipantBadgeDirective);
	readonly externalParticipantPanelItemElements = contentChild(ParticipantPanelItemElementsDirective);
	readonly participantPanelItemElementsTemplate = computed(
		() =>
			this.externalParticipantPanelItemElements()?.template ??
			this.templateRegistry.participantPanelItemElements()
	);
	readonly participantBadgeTemplate = computed(() => this.externalParticipantBadge()?.template);
	readonly isLocalParticipant = computed(() => this.participantInput()?.isLocal || false);
	// 无名参会者（如跳过昵称的访客）兜底显示，避免面板/瓦片出现空白名字
	readonly participantDisplayName = computed(
		() => this.participantInput()?.name || this.translateSrv.translate('PANEL.PARTICIPANTS.GUEST')
	);
	readonly hasExternalElements = computed(() => !!this.participantPanelItemElementsTemplate());
	readonly isScreenSharing = computed(() => !!this.participantInput()?.isScreenShareEnabled);
	readonly isMicrophoneOff = computed(() => {
		const participant = this.participantInput();
		return !!participant && !participant.isMicrophoneEnabled;
	});
	readonly isCameraOff = computed(() => {
		const participant = this.participantInput();
		return !!participant && !participant.isCameraEnabled;
	});

	get _participant(): ParticipantModel | undefined {
		return this.participantInput();
	}

	/**
	 * Toggles the mute state of a remote participant
	 */
	toggleMuteForcibly() {
		const participant = this._participant;
		if (participant && !participant.isLocal) {
			this.participantService.setRemoteMutedForcibly(participant.sid, !participant.isMutedForcibly);
		}
	}
}

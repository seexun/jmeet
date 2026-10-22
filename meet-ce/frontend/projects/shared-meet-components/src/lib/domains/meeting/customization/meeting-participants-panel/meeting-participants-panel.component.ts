import { NgTemplateOutlet } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	signal,
	TemplateRef,
	viewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { MeetRoomMemberUIBadge } from '@openvidu-meet/typings';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { RuntimeConfigService } from '../../../../shared/services/runtime-config.service';
import { PanelType } from '../../openvidu-components/models/panel.model';
import { ParticipantPanelItemComponent } from '../../openvidu-components/components/panel/participants-panel/participant-panel-item/participant-panel-item.component';
import { PanelService } from '../../openvidu-components/services/panel/panel.service';
import { ParticipantService } from '../../openvidu-components/services/participant/participant.service';
import { TemplateRegistryService } from '../../openvidu-components/services/template/template-registry.service';
import { MeetingContextService } from '../../services/meeting-context.service';
import type { CustomParticipantModel } from '../../models/custom-participant.model';
import { MeetingInviteDialogComponent } from '../meeting-invite-dialog/meeting-invite-dialog.component';
import { RoomAccessLinkService } from '../../services/room-access-link.service';
import { RoomMemberContextService } from '../../../room-members/services/room-member-context.service';
import { MeetingService } from '../../services/meeting.service';
import { NotificationService } from '../../../../shared/services/notification.service';

@Component({
	selector: 'ov-meeting-participants-panel',
	imports: [
		NgTemplateOutlet,
		FormsModule,
		NzIconModule,
		NzInputModule,
		NzTooltipModule,
		TranslatePipe,
		ParticipantPanelItemComponent
	],
	templateUrl: './meeting-participants-panel.component.html',
	styleUrls: [
		'../../openvidu-components/components/panel/panel.component.scss',
		'../../openvidu-components/components/panel/participants-panel/participants-panel/participants-panel.component.scss',
		'./meeting-participants-panel.component.scss'
	],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class MeetingParticipantsPanelComponent {
	readonly defaultParticipantPanelItemTemplateQuery = viewChild('defaultParticipantPanelItem', { read: TemplateRef });

	private readonly participantService = inject(ParticipantService);
	private readonly panelService = inject(PanelService);
	private readonly templateRegistry = inject(TemplateRegistryService);
	private readonly meetingContextService = inject(MeetingContextService);
	private readonly runtimeConfigService = inject(RuntimeConfigService);
	private readonly roomAccessLinkService = inject(RoomAccessLinkService);
	private readonly modal = inject(NzModalService);
	private readonly roomMemberContext = inject(RoomMemberContextService);
	private readonly meetingService = inject(MeetingService);
	private readonly notificationService = inject(NotificationService);

	readonly localParticipant = this.participantService.localParticipant;
	readonly remoteParticipants = this.participantService.remoteParticipants;
	readonly totalMembers = computed(() => (this.localParticipant() ? 1 : 0) + this.remoteParticipants().length);
	readonly canManageMembers = computed(() => this.roomMemberContext.hasPermission('canKickParticipants'));
	readonly participantPanelItemTemplate = computed(
		() => this.templateRegistry.participantPanelItem() ?? this.defaultParticipantPanelItemTemplateQuery()
	);
	readonly participantPanelAfterLocalParticipantTemplate = computed(
		() => this.templateRegistry.participantPanelAfterLocalParticipant()
	);
	readonly showInviteButton = computed(
		() => this.meetingContextService.meetingUI().showShareAccessLinks && !this.runtimeConfigService.isEmbeddedMode()
	);

	/** 搜索词（按昵称实时过滤远端成员） */
	readonly searchTerm = signal('');

	private readonly filteredRemotes = computed(() => {
		const term = this.searchTerm().trim().toLowerCase();
		if (!term) return this.remoteParticipants();
		return this.remoteParticipants().filter((p) => (p.name || '').toLowerCase().includes(term));
	});

	/** 过滤后可见的远端人数（搜索无结果提示用） */
	readonly filteredCount = computed(() => this.filteredRemotes().length);

	/** 本地用户归入主持人/管理员节还是参会者节（与远端同规则） */
	/** 远端列表元素实际是 CustomParticipantModel（携带角色徽章）；按运行时能力取值 */
	private badgeOf(participant: { getBadge?: () => MeetRoomMemberUIBadge }): MeetRoomMemberUIBadge {
		return participant.getBadge?.() ?? MeetRoomMemberUIBadge.OTHER;
	}

	private isHostSide(identity: string | undefined, badge: MeetRoomMemberUIBadge): boolean {
		return (
			(!!identity && identity === this.meetingContextService.primaryHostIdentity()) ||
			badge === MeetRoomMemberUIBadge.OWNER ||
			badge === MeetRoomMemberUIBadge.ADMIN ||
			badge === MeetRoomMemberUIBadge.MODERATOR
		);
	}

	/** EP 分组视图：主持人/管理员 在前、参会者在后 */
	readonly hostGroup = computed(() => {
		const host = this.filteredRemotes().filter((p) => this.isHostSide(p.identity, this.badgeOf(p as CustomParticipantModel)));
		if (this.localParticipant() && this.canManageMembers()) return [this.localParticipant()!, ...host];
		return host;
	});

	readonly memberGroup = computed(() => {
		const members = this.filteredRemotes().filter((p) => !this.isHostSide(p.identity, this.badgeOf(p as CustomParticipantModel)));
		// 按名称自然排序（用户裁决：排序依据明确可预期；测试用户2 < 测试用户10）
		const collator = new Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' });
		members.sort((a, b) => collator.compare(a.name || '', b.name || ''));
		if (this.localParticipant() && !this.canManageMembers()) return [this.localParticipant()!, ...members];
		return members;
	});

	close(): void {
		this.panelService.togglePanel(PanelType.PARTICIPANTS);
	}

	onInviteClick(): void {
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

	async muteAll(): Promise<void> {
		const roomId = this.meetingContextService.roomId();
		if (!roomId || !this.canManageMembers()) return;
		// 二次确认（用户裁决）：全体静音为高影响操作——明确作用于全体且成员无法自行解除
		this.notificationService.showDialog({
			title: '全体静音',
			message: `将静音全体参会人（共 ${this.remoteParticipants().length} 人），成员将无法自行解除静音。确认执行？`,
			confirmText: '全体静音',
			cancelText: '取消',
			confirmDanger: true,
			confirmCallback: () => void this.doMuteAll()
		});
	}

	private async doMuteAll(): Promise<void> {
		const roomId = this.meetingContextService.roomId();
		if (!roomId || !this.canManageMembers()) return;
		try {
			const result = await this.meetingService.muteAllParticipants(roomId);
			this.notificationService.showSnackbar(
				result.mutedTracks > 0 ? `已将 ${result.mutedTracks} 路麦克风静音` : '当前没有需要静音的成员'
			);
		} catch {
			this.notificationService.showSnackbar('全体静音失败，请稍后重试');
		}
	}
}

import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { LoggerService, ParticipantService, Room, RoomEvent, Track } from '../openvidu-components';
import { MeetingContextService } from './meeting-context.service';

/** 焦点状态存放在主主持人自己的 LiveKit participant attributes 上：
 * 服务端持久、全员同步、晚加入者可回读；主持人移交/离会时属性随连接消失，焦点自然清空。 */
const SPOTLIGHT_ATTRIBUTE = 'jmeet.spotlight';

/**
 * 全局 Spotlight（主持人聚焦）：主持人为所有人指定一个"焦点"参会者，
 * 各端把该参会者的摄像头画面置为大图（复用本地 pin 渲染通道，但由远端驱动）。
 *
 * 同步机制：主持人写自身 attributes；其余端监听 ParticipantAttributesChanged
 * （仅主主持人的变更）+ 加入/主持人变更时回读快照。
 */
@Injectable({ providedIn: 'root' })
export class MeetingSpotlightService {
	private readonly meetingContext = inject(MeetingContextService);
	private readonly participantService = inject(ParticipantService);
	private readonly loggerService = inject(LoggerService);
	private log = this.loggerService.get('JMeet - MeetingSpotlight');

	private readonly _room = signal<Room | undefined>(undefined);
	/** 本服务注册的监听（销毁时只摘除自己的，避免误伤其他服务的同事件监听） */
	private readonly handlers: { event: RoomEvent; handler: (...args: any[]) => void }[] = [];

	readonly spotlightIdentity = this.meetingContext.spotlightIdentity;
	readonly isSpotlightActive = computed(() => !!this.spotlightIdentity());
	/** 当前端是否可设定焦点（主主持人或联席主持人） */
	readonly canManageSpotlight = computed(() => {
		const local = this.meetingContext.localParticipant();
		return this.meetingContext.isPrimaryHost() || !!local?.promotedModerator;
	});

	/** 加入、主持人就位或主持人属性就绪后回读 attributes 快照（随参与者信息一起下发） */
	private readonly hostSnapshotEffect = effect(() => {
		const room = this._room();
		const hostIdentity = this.meetingContext.primaryHostIdentity();
		if (!room || !hostIdentity) return;
		untracked(() => {
			const host =
				room.localParticipant.identity === hostIdentity
					? room.localParticipant
					: room.getParticipantByIdentity(hostIdentity);
			this.syncSpotlight(host?.attributes?.[SPOTLIGHT_ATTRIBUTE]);
		});
	});

	/** 焦点状态信号 → 本端渲染（pin 大图） */
	private readonly pinEffect = effect(() => {
		const identity = this.spotlightIdentity();
		untracked(() => this.applyPin(identity));
	});

	/** 房间建立后挂载监听（见 MeetingComponent.onRoomCreated） */
	initialize(room: Room): void {
		this.destroy();
		this._room.set(room);

		const onAttributesChanged = (changed: Record<string, string>, participant: { identity: string }): void => {
			if (participant.identity !== this.meetingContext.primaryHostIdentity()) return;
			if (!(SPOTLIGHT_ATTRIBUTE in changed)) return;
			this.syncSpotlight(changed[SPOTLIGHT_ATTRIBUTE]);
		};
		const onParticipantDisconnected = (participant: { identity: string }): void => {
			// 焦点参会者离会 → 焦点失效，本端立即清空
			if (participant.identity === this.spotlightIdentity()) {
				this.meetingContext.setSpotlightIdentity(undefined);
			}
		};

		room.on(RoomEvent.ParticipantAttributesChanged, onAttributesChanged as any);
		room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected as any);
		this.handlers.push(
			{ event: RoomEvent.ParticipantAttributesChanged, handler: onAttributesChanged as any },
			{ event: RoomEvent.ParticipantDisconnected, handler: onParticipantDisconnected as any }
		);
	}
	/** 主持人设定/取消全局焦点。仅 canManageSpotlight 的端可调用。 */
	async setSpotlight(identity: string | undefined): Promise<void> {
		const room = this._room();
		if (!room || !this.canManageSpotlight()) return;
		try {
			// 空串 = 清除（attributes API 只合并键，以空串表示"无焦点"）
			await room.localParticipant.setAttributes({ [SPOTLIGHT_ATTRIBUTE]: identity ?? '' });
			// setAttributes 不向发送端回调事件，本地直接同步
			this.meetingContext.setSpotlightIdentity(identity);
		} catch (error) {
			this.log.e('Error setting spotlight:', error);
		}
	}

	private syncSpotlight(rawValue: string | undefined): void {
		const identity = rawValue?.trim() || undefined;
		// 焦点者必须仍在线（防陈旧快照把焦点指向已离会者）
		const online = identity && this.participantService.getParticipantByIdentity(identity);
		this.meetingContext.setSpotlightIdentity(online ? identity : undefined);
	}

	/** 把焦点参会者的摄像头轨 pin 为大图；清除时恢复普通布局 */
	private applyPin(identity: string | undefined): void {
		this.participantService.resetRemoteStreamsToNormalSize();
		this.participantService.resetLocalStreamsToNormalSize();
		if (!identity) return;
		const target = this.participantService.getParticipantByIdentity(identity);
		target?.setVideoPinnedBySource(Track.Source.Camera, true);
	}

	/** 离开会议/组件销毁时清理监听与焦点状态 */
	destroy(): void {
		const room = this._room();
		if (room) {
			for (const { event, handler } of this.handlers) {
				room.off(event as any, handler as any);
			}
		}
		this.handlers.length = 0;
		this._room.set(undefined);
		this.meetingContext.setSpotlightIdentity(undefined);
	}
}

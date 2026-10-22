import { inject, Injectable } from '@angular/core';
import { LoggerService, OpenViduService, ParticipantService, Room, RoomEvent, StorageService } from '../openvidu-components';
import { NotificationService } from '../../../shared/services/notification.service';

/** 数据通道 topic：主持人请求目标参会者改名（定向投递，仅目标端处理） */
export const MEET_RENAME_REQUESTED_TOPIC = 'meet_rename_requested';

interface RenameRequestPayload {
	roomId: string;
	/** 被改名的参会者 identity（即接收端本人） */
	targetIdentity: string;
	newName: string;
	requestedByName?: string;
	timestamp: number;
}

/**
 * 主持人重命名参会者：主持端通过数据通道定向发送改名请求，目标端确认后调用
 * LiveKit `setName` 服务端改名——名字由服务端下发，全员（含后加入者）可见。
 * 权限前提：token 已带 canUpdateOwnMetadata（当前全员开放，与加入时设置昵称同通道）。
 */
@Injectable({ providedIn: 'root' })
export class MeetingRenameService {
	private readonly participantService = inject(ParticipantService);
	private readonly openviduService = inject(OpenViduService);
	private readonly storageService = inject(StorageService);
	private readonly loggerService = inject(LoggerService);
	private readonly notificationService = inject(NotificationService);
	private log = this.loggerService.get('JMeet - MeetingRename');

	private room?: Room;
	private dataHandler?: (...args: any[]) => void;

	/** 房间建立后挂载数据通道监听（见 MeetingComponent.onRoomCreated） */
	initialize(room: Room): void {
		this.destroy();
		this.room = room;
		const handler = (payload: Uint8Array, _participant?: unknown, _kind?: unknown, topic?: string): void => {
			if (topic !== MEET_RENAME_REQUESTED_TOPIC) return;
			try {
				const request = JSON.parse(new TextDecoder().decode(payload)) as RenameRequestPayload;
				void this.applyRename(request);
			} catch (error) {
				this.log.w('Failed to parse rename request', error);
			}
		};
		this.dataHandler = handler as any;
		room.on(RoomEvent.DataReceived, handler as any);
	}

	/** 主持人端：向目标参会者定向发送改名请求 */
	async requestRename(roomId: string, targetIdentity: string, newName: string): Promise<boolean> {
		const myIdentity = this.participantService.getMyIdentity();
		const myName = this.participantService.getMyName();
		if (!this.room || !myIdentity) return false;
		const payload: RenameRequestPayload = {
			roomId,
			targetIdentity,
			newName,
			requestedByName: myName,
			timestamp: Date.now()
		};
		try {
			await this.participantService.publishData(new TextEncoder().encode(JSON.stringify(payload)), {
				topic: MEET_RENAME_REQUESTED_TOPIC,
				reliable: true,
				destinationIdentities: [targetIdentity]
			});
			return true;
		} catch (error) {
			this.log.e('Error sending rename request:', error);
			return false;
		}
	}

	/** 目标端：确认弹窗后应用服务端改名，并同步本地存储（下次 prejoin 沿用） */
	private async applyRename(request: RenameRequestPayload): Promise<void> {
		const room = this.openviduService.getRoom();
		const myIdentity = this.participantService.getMyIdentity();
		if (!room || myIdentity !== request.targetIdentity || !request.newName?.trim()) return;

		this.notificationService.showDialog({
			title: '主持人修改您的会议昵称',
			icon: 'edit',
			message: `主持人希望将您的昵称改为「${request.newName.trim()}」，是否接受？`,
			confirmText: '接受',
			cancelText: '保留原昵称',
			confirmCallback: () => void this.commitRename(room, request.newName.trim())
		});
	}

	private async commitRename(room: Room, newName: string): Promise<void> {
		try {
			await room.localParticipant.setName(newName);
			this.storageService.setParticipantName(newName);
			this.notificationService.showSnackbar(`昵称已改为「${newName}」`);
		} catch (error) {
			this.log.e('Error applying rename:', error);
			this.notificationService.showSnackbar('昵称修改失败，请稍后重试');
		}
	}

	destroy(): void {
		if (this.room && this.dataHandler) {
			this.room.off(RoomEvent.DataReceived, this.dataHandler);
		}
		this.dataHandler = undefined;
		this.room = undefined;
	}
}

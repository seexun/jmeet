import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { HttpService } from '../../../../shared/services/http.service';

export interface MeetingInviteDialogData {
	roomName: string;
	roomId: string;
	roomAccessUrl: string;
	meetingCode?: string;
}

@Component({
	selector: 'ov-meeting-invite-dialog',
	standalone: true,
	imports: [NzIconModule],
	templateUrl: './meeting-invite-dialog.component.html',
	styleUrl: './meeting-invite-dialog.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class MeetingInviteDialogComponent {
	readonly data = inject<MeetingInviteDialogData>(NZ_MODAL_DATA);
	private readonly dialogRef = inject(NzModalRef<MeetingInviteDialogComponent>);
	private readonly http = inject(HttpService);
	readonly dialIn = signal<{enabled:boolean;phoneNumber?:string;pin?:string}|null>(null);
	// 名称/会议号以后端房间实体为准（调用方传入值仅作兜底）——LiveKit 房间名=roomId，
	// 直接展示会把内部 ID 当会议名称；meetingCode 是数字会议号，roomId 是内部 ID。
	readonly roomName = signal<string|null>(null);
	readonly meetingCode = signal<string|null>(this.data.meetingCode ?? null);
	constructor(){void this.loadDialIn();void this.loadRoom();}
	private async loadDialIn(){try{this.dialIn.set(await this.http.getRequest(`${HttpService.INTERNAL_API_PATH_PREFIX}/meetings/${encodeURIComponent(this.data.roomId)}/dial-in`));}catch{this.dialIn.set(null);}}
	private async loadRoom(){
		try{
			const room=await this.http.getRequest<{roomName?:string;meetingCode?:string}>(`${HttpService.INTERNAL_API_PATH_PREFIX}/meetings/${encodeURIComponent(this.data.roomId)}/summary`);
			this.roomName.set(room?.roomName ?? null);
			this.meetingCode.set(room?.meetingCode ?? this.meetingCode());
		}catch{this.roomName.set(null);}
	}
	nameLabel(): string { return this.roomName() ?? this.data.roomName; }
	codeLabel(): string { return this.meetingCode() ?? this.data.roomId; }

	close(): void {
		this.dialogRef.close();
	}

	async copy(value: string): Promise<void> {
		await navigator.clipboard.writeText(value);
	}

	async share(): Promise<void> {
		const phone=this.dialIn();const dialInText=phone?.enabled?`\n拨入号码：${phone.phoneNumber}${phone.pin?`\n会议 PIN：${phone.pin}`:''}`:'';const shareData = {
			title: `${this.nameLabel()} - JMeet`,
			text: `邀请您参加会议：${this.nameLabel()}\n会议号：${this.codeLabel()}${dialInText}`,
			url: this.data.roomAccessUrl
		};
		if (navigator.share) {
			await navigator.share(shareData);
			return;
		}
		await this.copy(`${shareData.text}\n${shareData.url}`);
	}
}

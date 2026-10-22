import { Clipboard } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { MeetRoomAccess } from '@openvidu-meet/typings';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { NavigationService } from '../../../../shared/services/navigation.service';
import { WizardStepId } from '../../models/wizard.model';

export type RoomAccessType = 'anonymous-moderator' | 'anonymous-speaker' | 'user';

export interface RoomShareDialogData {
	access: MeetRoomAccess;
	roomId?: string;
	canManageRoom?: boolean;
}

@Component({
	selector: 'ov-share-room-dialog',
	imports: [
		FormsModule,
		NzRadioModule,
		TranslatePipe
	],
	templateUrl: './room-share-dialog.component.html',
	styleUrl: './room-share-dialog.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoomShareDialogComponent {
	readonly data = inject<RoomShareDialogData>(NZ_MODAL_DATA);

	private readonly clipboard = inject(Clipboard);
	private readonly navigationService = inject(NavigationService);
	readonly nzModalRef = inject(NzModalRef<RoomShareDialogComponent>);

	copied = signal(false);
	selectedAccessType = signal<RoomAccessType>('user');
	roomUrl = signal<string | undefined>(undefined);

	currentUrl = computed(() => {
		const access = this.data.access;
		switch (this.selectedAccessType()) {
			case 'anonymous-moderator':
				return access.anonymous.moderator.url;
			case 'anonymous-speaker':
				return access.anonymous.speaker.url;
			case 'user':
				return access.user.url;
		}
	});

	constructor() {
		this.syncRoomUrl();
	}

	onAccessTypeChange(accessType: RoomAccessType): void {
		this.selectedAccessType.set(accessType);
		this.copied.set(false);
		this.syncRoomUrl();
	}

	copyToClipboard(): void {
		const url = this.roomUrl();
		if (!url) return;

		this.clipboard.copy(url);
		this.copied.set(true);

		setTimeout(() => {
			this.copied.set(false);
		}, 2000);
	}

	async editRoomAccess(): Promise<void> {
		if (!this.data.canManageRoom || !this.data.roomId) return;
		this.nzModalRef.close();
		await this.navigationService.navigateTo(`/rooms/${this.data.roomId}/edit`, { step: WizardStepId.ROOM_ACCESS });
	}

	private syncRoomUrl(): void {
		this.roomUrl.set(this.isAccessEnabled(this.selectedAccessType()) ? this.currentUrl() : undefined);
	}

	private isAccessEnabled(accessType: RoomAccessType): boolean {
		const access = this.data.access;
		switch (accessType) {
			case 'anonymous-moderator':
				return access.anonymous.moderator.enabled;
			case 'anonymous-speaker':
				return access.anonymous.speaker.enabled;
			case 'user':
				return true;
		}
	}
}

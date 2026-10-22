import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '../../../../shared/services/i18n/translate.service';
import { NavigationService } from '../../../../shared/services/navigation.service';
import { NotificationService } from '../../../../shared/services/notification.service';

/**
 * Deep-link bridge: legacy member add/edit routes redirect to room detail and open the member dialog.
 */
@Component({
	selector: 'ov-add-room-member',
	template: '',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddRoomMemberComponent implements OnInit {
	private route = inject(ActivatedRoute);
	private navigationService = inject(NavigationService);
	private notificationService = inject(NotificationService);
	private readonly translateService = inject(TranslateService);

	async ngOnInit(): Promise<void> {
		const roomId = this.route.snapshot.paramMap.get('room-id');
		if (!roomId) {
			this.notificationService.showSnackbar(this.translateService.translate('ROOM_MEMBERS.ERRORS.ROOM_ID_REQUIRED'));
			await this.navigationService.navigateTo('/rooms');
			return;
		}

		const memberId = this.route.snapshot.paramMap.get('member-id');
		await this.navigationService.navigateTo(
			`/rooms/${roomId}`,
			{
				tab: 'members',
				memberDialog: memberId ? 'edit' : 'add',
				...(memberId ? { memberId } : {})
			},
			true
		);
	}
}

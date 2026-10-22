import { Clipboard } from '@angular/cdk/clipboard';
import { effect, inject, Injectable, signal } from '@angular/core';
import { MeetRoomAccess } from '@openvidu-meet/typings';
import { NotificationService } from '../../../shared/services/notification.service';
import { RoomMemberContextService } from '../../room-members/services/room-member-context.service';
import { RoomService } from '../../rooms/services/room.service';
import { LoggerService } from '../openvidu-components';

@Injectable({
	providedIn: 'root'
})
export class RoomAccessLinkService {
	private readonly clipboard = inject(Clipboard);
	private readonly roomService = inject(RoomService);
	private readonly roomMemberContextService = inject(RoomMemberContextService);
	private readonly notificationService = inject(NotificationService);
	private readonly loggerService = inject(LoggerService);
	private readonly log = this.loggerService.get('JMeet - RoomAccessLinkService');

	private readonly _speakerPublicLink = signal<string | undefined>(undefined);
	private readonly _speakerCopyLink = signal<string | undefined>(undefined);
	private lastFetchedRoomId?: string;

	/** Readonly signal for the speaker link displayed in the UI */
	readonly speakerPublicLink = this._speakerPublicLink.asReadonly();
	/** Readonly signal for the real speaker link used for copy action */
	readonly speakerCopyLink = this._speakerCopyLink.asReadonly();

	constructor() {
		// Keep link state synchronized with permission and room changes.
		effect(() => {
			const canShareAccessLinks = !!this.roomMemberContextService.permissions()?.canShareAccessLinks;
			const roomId = this.roomMemberContextService.roomId();

			if (!canShareAccessLinks || !roomId) {
				this.lastFetchedRoomId = undefined;
				this.clear();
				return;
			}

			if (this.lastFetchedRoomId === roomId) {
				return;
			}

			this.lastFetchedRoomId = roomId;
			void this.refreshSpeakerLinksFromRoom(roomId);
		});
	}

	/**
	 * Refreshes speaker links by requesting room access information.
	 */
	private async refreshSpeakerLinksFromRoom(roomId: string): Promise<void> {
		try {
			const room = await this.roomService.getRoom(roomId, {
				fields: ['access']
			});
			this.setSpeakerLinksFromRoomAccess(room.access);
		} catch (error) {
			this.log.w('Could not refresh speaker links from room access:', error);
			this.lastFetchedRoomId = undefined;
			this.clear();
		}
	}

	/**
	 * Sets speaker links from room access information.
	 * The public link is shown in the UI while the speaker link is used for copy action.
	 */
	private setSpeakerLinksFromRoomAccess(access: MeetRoomAccess): void {
		const publicLink = this.getPublicLinkFromAccessUrl(access.user.url);
		this._speakerPublicLink.set(publicLink);
		this._speakerCopyLink.set(access.anonymous.speaker.url);
	}

	/**
	 * Extracts a public-facing link from the full access URL, if available.
	 * This is used for display purposes, while the full speaker link is used for copying.
	 *
	 * @param accessUrl - The full access URL from which to extract the public link
	 * @returns A simplified public link for display, or undefined if the input URL is invalid
	 */
	private getPublicLinkFromAccessUrl(accessUrl: string): string | undefined {
		try {
			const url = new URL(accessUrl);
			return `${url.host}${url.pathname}`;
		} catch (error) {
			this.log.w('Invalid access URL while building public speaker link', error);
			return undefined;
		}
	}

	/**
	 * Copies the room access link (shared anonymous speaker link) to the clipboard when available.
	 *
	 * @returns Whether the link was copied. `false` when the link is unavailable for the current
	 * permissions or the clipboard write fails — callers surface the failure feedback.
	 */
	async copyRoomAccessLink(): Promise<boolean> {
		let speakerLink = this._speakerCopyLink();

		if (!speakerLink) {
			const roomId = this.roomMemberContextService.roomId();

			if (roomId) {
				await this.refreshSpeakerLinksFromRoom(roomId);
				speakerLink = this._speakerCopyLink();
			}
		}

		if (!speakerLink) {
			this.log.w('Cannot copy speaker link: link is not available for current permissions');
			return false;
		}

		const copied = this.clipboard.copy(speakerLink);
		if (!copied) {
			this.log.w('Could not copy speaker link: clipboard write failed');
			return false;
		}

		this.notificationService.showSnackbar('Room access link copied to clipboard');
		return true;
	}

	clear(): void {
		this._speakerPublicLink.set(undefined);
		this._speakerCopyLink.set(undefined);
	}
}

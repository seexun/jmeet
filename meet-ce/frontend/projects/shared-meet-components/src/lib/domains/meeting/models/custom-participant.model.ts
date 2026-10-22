import { signal } from '@angular/core';
import { MeetRoomMemberTokenMetadata, MeetRoomMemberUIBadge } from '@openvidu-meet/typings';
import { ParticipantModel, ParticipantProperties } from '../openvidu-components/models/participant.model';

/**
 * Interface for computed participant display properties
 */
export interface ParticipantDisplayProperties {
	showBadge: boolean;
	showVerifiedIdentity: boolean;
	showModerationControls: boolean;
	showMakeModeratorButton: boolean;
	showUnmakeModeratorButton: boolean;
	showKickButton: boolean;
	showMuteButton: boolean;
	showRequestUnmuteButton: boolean;
	showStopCameraButton: boolean;
	showStopScreenShareButton: boolean;
	showTransferHostButton: boolean;
}

// Represents a participant in the application.
export class CustomParticipantModel extends ParticipantModel {
	private readonly _badge = signal(MeetRoomMemberUIBadge.OTHER);
	private readonly _isPromotedModerator = signal(false);
	private readonly _identityType = signal<'user' | 'member' | 'guest'>('guest');

	constructor(props: ParticipantProperties) {
		super(props);
		this.updateModerationMetadata(props.participant.metadata);
	}

	set badge(badge: MeetRoomMemberUIBadge) {
		this._badge.set(badge);
	}

	set promotedModerator(isPromoted: boolean) {
		this._isPromotedModerator.set(isPromoted);
	}

	private updateModerationMetadata(metadata: unknown): void {
		const parsedMetadata = parseParticipantMetadata(metadata);
		this._badge.set(parsedMetadata?.badge || MeetRoomMemberUIBadge.OTHER);
		this._isPromotedModerator.set(Boolean(parsedMetadata?.isPromotedModerator));
		this._identityType.set(parsedMetadata?.userId ? 'user' : parsedMetadata?.memberId ? 'member' : 'guest');
	}

	/**
	 * Gets the participant's badge.
	 * @returns The MeetRoomMemberUIBadge representing the participant's badge.
	 */
	getBadge(): MeetRoomMemberUIBadge {
		return this._badge();
	}

	/**
	 * Checks if the participant has a badge other than OTHER.
	 * @returns True if the participant has a badge, false otherwise.
	 */
	hasBadge(): boolean {
		return this._badge() !== MeetRoomMemberUIBadge.OTHER;
	}

	/**
	 * Checks if the participant is a promoted moderator (not an original moderator).
	 * @returns True if the participant is a promoted moderator, false otherwise.
	 */
	isPromotedModerator(): boolean {
		return this._isPromotedModerator();
	}

	isVerifiedIdentity(): boolean {
		return this._identityType() !== 'guest';
	}

	getIdentityLabel(): string {
		return this._identityType() === 'user' ? '企业账号已验证' : this._identityType() === 'member' ? '会议成员已验证' : '外部访客';
	}
}

const parseParticipantMetadata = (metadata: unknown): MeetRoomMemberTokenMetadata | undefined => {
	let parsedMetadata: MeetRoomMemberTokenMetadata | undefined;
	try {
		parsedMetadata = JSON.parse((metadata as string) || '{}');
	} catch (e) {
		console.warn('Failed to parse participant metadata:', e);
	}

	if (!parsedMetadata || typeof parsedMetadata !== 'object') {
		return undefined;
	}

	return parsedMetadata;
};

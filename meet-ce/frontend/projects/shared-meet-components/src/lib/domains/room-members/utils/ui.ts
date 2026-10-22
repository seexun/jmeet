import { MeetRoomMember, MeetRoomMemberRole, MeetRoomMemberType, MeetRoomMemberUIBadge } from '@openvidu-meet/typings';

/**
 * Utility functions for RoomMember-related UI operations.
 * These are pure functions that can be shared across room-member pages and components.
 */
export class RoomMemberUiUtils {
	static readonly AVAILABLE_ROLES: MeetRoomMemberRole[] = [MeetRoomMemberRole.MODERATOR, MeetRoomMemberRole.SPEAKER];

	// ===== ROLE UTILITIES =====

	/**
	 * Gets the i18n key for a room member role label (resolve with the `translate` pipe at render).
	 */
	static getRoleLabel(role: MeetRoomMemberRole): string {
		switch (role) {
			case MeetRoomMemberRole.MODERATOR:
				return 'ROOM_MEMBERS.ROLE.MODERATOR';
			case MeetRoomMemberRole.SPEAKER:
				return 'ROOM_MEMBERS.ROLE.SPEAKER';
			default:
				return role;
		}
	}

	/**
	 * Gets the Material icon name for a room member role.
	 */
	static getRoleIcon(role: MeetRoomMemberRole): string {
		switch (role) {
			case MeetRoomMemberRole.MODERATOR:
				return 'shield_person';
			case MeetRoomMemberRole.SPEAKER:
				return 'record_voice_over';
			default:
				return '';
		}
	}

	/**
	 * Gets the CSS class for a room member role
	 */
	static getRoleClass(role: MeetRoomMemberRole): string {
		switch (role) {
			case MeetRoomMemberRole.MODERATOR:
				return 'moderator';
			case MeetRoomMemberRole.SPEAKER:
				return 'speaker';
			default:
				return '';
		}
	}

	// ===== BADGE UTILITIES =====

	static getParticipantBadgeIcon(badge: MeetRoomMemberUIBadge): string {
		switch (badge) {
			case MeetRoomMemberUIBadge.OWNER:
				return 'crown'; // passkey or location_away
			case MeetRoomMemberUIBadge.ADMIN:
				return 'manage_accounts';
			case MeetRoomMemberUIBadge.MODERATOR:
				return 'shield_person';
			default:
				return '';
		}
	}

	/**
	 * Gets the i18n key for a participant badge tooltip (resolve with the `translate` pipe at render).
	 * Keys live in the meeting bundle (PARTICIPANT_ITEM) because badges render inside the meeting,
	 * which the web component ships (the room-members bundle is SPA-only).
	 */
	static getParticipantBadgeTooltip(badge: MeetRoomMemberUIBadge): string {
		switch (badge) {
			case MeetRoomMemberUIBadge.OWNER:
				return 'PARTICIPANT_ITEM.BADGE_OWNER';
			case MeetRoomMemberUIBadge.ADMIN:
				return 'PARTICIPANT_ITEM.BADGE_ADMIN';
			case MeetRoomMemberUIBadge.MODERATOR:
				return 'PARTICIPANT_ITEM.BADGE_MODERATOR';
			default:
				return '';
		}
	}

	static getParticipantBadgeClass(badge: MeetRoomMemberUIBadge): string {
		switch (badge) {
			case MeetRoomMemberUIBadge.OWNER:
				return 'owner-badge';
			case MeetRoomMemberUIBadge.ADMIN:
				return 'admin-badge';
			case MeetRoomMemberUIBadge.MODERATOR:
				return 'moderator-badge';
			default:
				return '';
		}
	}

	// ===== MEMBER UTILITIES =====

	/**
	 * Checks whether a member is a user (not an identified guest).
	 */
	static isUserMember(member: MeetRoomMember): boolean {
		return member.type === MeetRoomMemberType.USER;
	}

	/**
	 * Gets the i18n key for the member type label (resolve with the `translate` pipe at render).
	 */
	static getMemberTypeLabel(member: MeetRoomMember): string {
		return RoomMemberUiUtils.isUserMember(member)
			? 'ROOM_MEMBERS.MEMBER_TYPE.USER'
			: 'ROOM_MEMBERS.MEMBER_TYPE.GUEST';
	}

	/**
	 * Gets the Material icon name for the member type.
	 */
	static getMemberTypeIcon(member: MeetRoomMember): string {
		return RoomMemberUiUtils.isUserMember(member) ? 'verified_user' : 'person';
	}

	/**
	 * Builds up to two uppercase initials from a member's full name.
	 */
	static getMemberInitials(member: MeetRoomMember): string {
		return member.name
			.split(' ')
			.filter(Boolean)
			.slice(0, 2)
			.map((word) => word[0].toUpperCase())
			.join('');
	}
}

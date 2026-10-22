import { MeetRoomMemberPermissions } from '@openvidu-meet/typings';

export interface PermissionItem {
	key: keyof MeetRoomMemberPermissions;
	/** i18n key — resolve with the `translate` pipe at render. */
	label: string;
	/** i18n key — resolve with the `translate` pipe at render. */
	description: string;
	icon: string;
}

export interface PermissionGroup {
	/** i18n key — resolve with the `translate` pipe at render. */
	label: string;
	icon: string;
	permissions: PermissionItem[];
}

// Labels/descriptions are translation KEYS (resolved at render via the `translate` pipe), not literal
// text — so the permissions UI follows the active language.
export const PERMISSION_GROUPS: PermissionGroup[] = [
	{
		label: 'ROOM_MEMBERS.PERMISSIONS.GROUPS.MEETING',
		icon: 'groups',
		permissions: [
			{
				key: 'canJoinMeeting',
				label: 'ROOM_MEMBERS.PERMISSIONS.ITEMS.canJoinMeeting.LABEL',
				description: 'ROOM_MEMBERS.PERMISSIONS.ITEMS.canJoinMeeting.DESCRIPTION',
				icon: 'login'
			},
			{
				key: 'canEndMeeting',
				label: 'ROOM_MEMBERS.PERMISSIONS.ITEMS.canEndMeeting.LABEL',
				description: 'ROOM_MEMBERS.PERMISSIONS.ITEMS.canEndMeeting.DESCRIPTION',
				icon: 'meeting_room'
			},
			{
				key: 'canMakeModerator',
				label: 'ROOM_MEMBERS.PERMISSIONS.ITEMS.canMakeModerator.LABEL',
				description: 'ROOM_MEMBERS.PERMISSIONS.ITEMS.canMakeModerator.DESCRIPTION',
				icon: 'manage_accounts'
			},
			{
				key: 'canKickParticipants',
				label: 'ROOM_MEMBERS.PERMISSIONS.ITEMS.canKickParticipants.LABEL',
				description: 'ROOM_MEMBERS.PERMISSIONS.ITEMS.canKickParticipants.DESCRIPTION',
				icon: 'person_remove'
			},
			{
				key: 'canShareAccessLinks',
				label: 'ROOM_MEMBERS.PERMISSIONS.ITEMS.canShareAccessLinks.LABEL',
				description: 'ROOM_MEMBERS.PERMISSIONS.ITEMS.canShareAccessLinks.DESCRIPTION',
				icon: 'link'
			}
		]
	},
	{
		label: 'ROOM_MEMBERS.PERMISSIONS.GROUPS.MEDIA',
		icon: 'perm_media',
		permissions: [
			{
				key: 'canPublishVideo',
				label: 'ROOM_MEMBERS.PERMISSIONS.ITEMS.canPublishVideo.LABEL',
				description: 'ROOM_MEMBERS.PERMISSIONS.ITEMS.canPublishVideo.DESCRIPTION',
				icon: 'videocam'
			},
			{
				key: 'canPublishAudio',
				label: 'ROOM_MEMBERS.PERMISSIONS.ITEMS.canPublishAudio.LABEL',
				description: 'ROOM_MEMBERS.PERMISSIONS.ITEMS.canPublishAudio.DESCRIPTION',
				icon: 'mic'
			},
			{
				key: 'canShareScreen',
				label: 'ROOM_MEMBERS.PERMISSIONS.ITEMS.canShareScreen.LABEL',
				description: 'ROOM_MEMBERS.PERMISSIONS.ITEMS.canShareScreen.DESCRIPTION',
				icon: 'screen_share'
			},
			{
				key: 'canChangeVirtualBackground',
				label: 'ROOM_MEMBERS.PERMISSIONS.ITEMS.canChangeVirtualBackground.LABEL',
				description: 'ROOM_MEMBERS.PERMISSIONS.ITEMS.canChangeVirtualBackground.DESCRIPTION',
				icon: 'background_replace'
			}
		]
	},
	{
		label: 'ROOM_MEMBERS.PERMISSIONS.GROUPS.RECORDINGS',
		icon: 'video_library',
		permissions: [
			{
				key: 'canRecord',
				label: 'ROOM_MEMBERS.PERMISSIONS.ITEMS.canRecord.LABEL',
				description: 'ROOM_MEMBERS.PERMISSIONS.ITEMS.canRecord.DESCRIPTION',
				icon: 'fiber_manual_record'
			},
			{
				key: 'canRetrieveRecordings',
				label: 'ROOM_MEMBERS.PERMISSIONS.ITEMS.canRetrieveRecordings.LABEL',
				description: 'ROOM_MEMBERS.PERMISSIONS.ITEMS.canRetrieveRecordings.DESCRIPTION',
				icon: 'play_circle'
			},
			{
				key: 'canDeleteRecordings',
				label: 'ROOM_MEMBERS.PERMISSIONS.ITEMS.canDeleteRecordings.LABEL',
				description: 'ROOM_MEMBERS.PERMISSIONS.ITEMS.canDeleteRecordings.DESCRIPTION',
				icon: 'delete'
			}
		]
	},
	{
		label: 'ROOM_MEMBERS.PERMISSIONS.GROUPS.CHAT',
		icon: 'chat',
		permissions: [
			{
				key: 'canReadChat',
				label: 'ROOM_MEMBERS.PERMISSIONS.ITEMS.canReadChat.LABEL',
				description: 'ROOM_MEMBERS.PERMISSIONS.ITEMS.canReadChat.DESCRIPTION',
				icon: 'visibility'
			},
			{
				key: 'canWriteChat',
				label: 'ROOM_MEMBERS.PERMISSIONS.ITEMS.canWriteChat.LABEL',
				description: 'ROOM_MEMBERS.PERMISSIONS.ITEMS.canWriteChat.DESCRIPTION',
				icon: 'edit'
			}
		]
	}
];

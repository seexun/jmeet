import { MeetRoomMemberOptions, MeetRoomRoles } from '@openvidu-meet/typings';

export type MemberFormMemberType = 'user' | 'identified_guest';

/**
 * Data injected via NZ_MODAL_DATA into MemberFormDialogComponent.
 */
export interface MemberFormDialogData {
	roomRoles: MeetRoomRoles;
	roomOwner: string;
	/** When set, the dialog pre-fills the form to edit an existing pending member. */
	initialData?: MeetRoomMemberOptions;
}

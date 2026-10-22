export type MeetWaitingRoomStatus = 'waiting' | 'approved' | 'rejected' | 'blocked';

export interface MeetWaitingRoomRequest {
	requestId: string;
	roomId: string;
	participantName: string;
	/** Stable applicant identifier used for admission and block-list checks. */
	applicantId: string;
	applicantType: 'user' | 'member' | 'guest';
	/** True when the applicant is backed by a managed user or room-member identity. */
	verified: boolean;
	status: MeetWaitingRoomStatus;
	createdAt: number;
	updatedAt: number;
}

export interface MeetWaitingRoomDecision {
	status: 'approved' | 'rejected' | 'blocked';
}

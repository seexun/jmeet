import { MeetRoomMemberTokenMetadata, MeetRoomMemberUIBadge } from '@openvidu-meet/typings';

export const getMeetingHostRank = (rawMetadata?: string): number => {
	if (!rawMetadata) return 0;
	try {
		const badge = (JSON.parse(rawMetadata) as MeetRoomMemberTokenMetadata).badge;
		return badge === MeetRoomMemberUIBadge.OWNER ? 4 : badge === MeetRoomMemberUIBadge.ADMIN ? 3 : badge === MeetRoomMemberUIBadge.MODERATOR ? 2 : 0;
	} catch { return 0; }
};

export const electEligibleMeetingHost = <T extends { metadata?: string }>(participants: T[]): T | undefined =>
	participants.map((participant) => ({ participant, rank: getMeetingHostRank(participant.metadata) }))
		.filter(({ rank }) => rank > 0).sort((left, right) => right.rank - left.rank)[0]?.participant;

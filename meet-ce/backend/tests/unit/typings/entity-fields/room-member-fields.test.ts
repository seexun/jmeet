import { describe, expect, it } from '@jest/globals';
import { MEET_ROOM_MEMBER_FIELDS, MeetRoomMember } from '@openvidu-meet/typings';
import { AssertReadonlyArrayCoversUnion } from '../type-assertions.utils.js';

describe('MeetRoomMember fields list', () => {
	it('should include all MeetRoomMember properties', () => {
		const assertMeetRoomMemberFieldsCoverage: AssertReadonlyArrayCoversUnion<
			keyof MeetRoomMember,
			typeof MEET_ROOM_MEMBER_FIELDS
		> = true;
		expect(assertMeetRoomMemberFieldsCoverage).toBe(true);
	});
});

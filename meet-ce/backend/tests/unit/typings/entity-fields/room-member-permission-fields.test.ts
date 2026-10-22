import { describe, expect, it } from '@jest/globals';
import { MEET_ROOM_MEMBER_PERMISSIONS_FIELDS, MeetRoomMemberPermissions } from '@openvidu-meet/typings';
import { AssertReadonlyArrayCoversUnion } from '../type-assertions.utils.js';

describe('MeetRoomMemberPermissions fields list', () => {
	it('should include all MeetRoomMemberPermissions properties', () => {
		const assertMeetRoomMemberPermissionsFieldsCoverage: AssertReadonlyArrayCoversUnion<
			keyof MeetRoomMemberPermissions,
			typeof MEET_ROOM_MEMBER_PERMISSIONS_FIELDS
		> = true;
		expect(assertMeetRoomMemberPermissionsFieldsCoverage).toBe(true);
	});
});

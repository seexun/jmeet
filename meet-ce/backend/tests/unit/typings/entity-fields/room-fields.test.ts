import { describe, expect, it } from '@jest/globals';
import { MEET_ROOM_FIELDS, MeetRoom } from '@openvidu-meet/typings';
import { AssertReadonlyArrayCoversUnion } from '../type-assertions.utils.js';

describe('MeetRoom fields list', () => {
	it('should include all MeetRoom properties', () => {
		const assertMeetRoomFieldsCoverage: AssertReadonlyArrayCoversUnion<keyof MeetRoom, typeof MEET_ROOM_FIELDS> =
			true;
		expect(assertMeetRoomFieldsCoverage).toBe(true);
	});
});

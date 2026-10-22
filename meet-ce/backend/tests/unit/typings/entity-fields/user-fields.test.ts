import { describe, expect, it } from '@jest/globals';
import { MEET_USER_FIELDS, MeetUser } from '@openvidu-meet/typings';
import { AssertReadonlyArrayCoversUnion } from '../type-assertions.utils.js';

describe('MeetUser fields list', () => {
	it('should include all MeetUser properties', () => {
		const assertMeetUserFieldsCoverage: AssertReadonlyArrayCoversUnion<keyof MeetUser, typeof MEET_USER_FIELDS> =
			true;
		expect(assertMeetUserFieldsCoverage).toBe(true);
	});
});

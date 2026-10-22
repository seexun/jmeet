import { describe, expect, it } from '@jest/globals';
import {
	MEET_ROOM_MEMBER_DOCUMENT_ONLY_FIELDS,
	MeetRoomMemberDocumentOnlyField
} from '../../../../src/models/mongoose-schemas/room-member.schema.js';
import { AssertReadonlyArrayCoversUnion } from '../type-assertions.utils.js';

describe('MeetRoomMemberDocument-only fields list', () => {
	it('should include all document-only properties', () => {
		const assertRoomMemberDocumentOnlyFieldsCoverage: AssertReadonlyArrayCoversUnion<
			MeetRoomMemberDocumentOnlyField,
			typeof MEET_ROOM_MEMBER_DOCUMENT_ONLY_FIELDS
		> = true;
		expect(assertRoomMemberDocumentOnlyFieldsCoverage).toBe(true);
	});
});

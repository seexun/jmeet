import { describe, expect, it } from '@jest/globals';
import {
	MEET_ROOM_DOCUMENT_ONLY_FIELDS,
	MeetRoomDocumentOnlyField
} from '../../../../src/models/mongoose-schemas/room.schema.js';
import { AssertReadonlyArrayCoversUnion } from '../type-assertions.utils.js';

describe('MeetRoomDocument-only fields list', () => {
	it('should include all document-only properties', () => {
		const assertRoomDocumentOnlyFieldsCoverage: AssertReadonlyArrayCoversUnion<
			MeetRoomDocumentOnlyField,
			typeof MEET_ROOM_DOCUMENT_ONLY_FIELDS
		> = true;
		expect(assertRoomDocumentOnlyFieldsCoverage).toBe(true);
	});
});

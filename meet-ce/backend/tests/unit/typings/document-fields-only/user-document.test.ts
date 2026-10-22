import { describe, expect, it } from '@jest/globals';
import {
	MEET_USER_DOCUMENT_ONLY_FIELDS,
	MeetUserDocumentOnlyField
} from '../../../../src/models/mongoose-schemas/user.schema.js';
import { AssertReadonlyArrayCoversUnion } from '../type-assertions.utils.js';

describe('MeetUserDocument-only fields list', () => {
	it('should include all document-only properties', () => {
		const assertUserDocumentOnlyFieldsCoverage: AssertReadonlyArrayCoversUnion<
			MeetUserDocumentOnlyField,
			typeof MEET_USER_DOCUMENT_ONLY_FIELDS
		> = true;
		expect(assertUserDocumentOnlyFieldsCoverage).toBe(true);
	});
});

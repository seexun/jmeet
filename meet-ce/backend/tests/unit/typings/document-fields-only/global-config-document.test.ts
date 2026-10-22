import { describe, expect, it } from '@jest/globals';
import {
	MEET_GLOBAL_CONFIG_DOCUMENT_ONLY_FIELDS,
	MeetGlobalConfigDocumentOnlyField
} from '../../../../src/models/mongoose-schemas/global-config.schema.js';
import { AssertReadonlyArrayCoversUnion } from '../type-assertions.utils.js';

describe('MeetGlobalConfigDocument-only fields list', () => {
	it('should include all document-only properties', () => {
		const assertGlobalConfigDocumentOnlyFieldsCoverage: AssertReadonlyArrayCoversUnion<
			MeetGlobalConfigDocumentOnlyField,
			typeof MEET_GLOBAL_CONFIG_DOCUMENT_ONLY_FIELDS
		> = true;
		expect(assertGlobalConfigDocumentOnlyFieldsCoverage).toBe(true);
	});
});

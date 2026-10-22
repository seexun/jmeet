import { EmbeddedAttribute } from '@openvidu-meet/typings';
import {
	appendQuery,
	computeServerUrl,
	extractParams,
	getAutoRedirectUrl,
	getReferrerOrigin,
	isValidUrl,
	lastPathSegment,
	queryParam
} from './url.utils';

describe('lastPathSegment', () => {
	it('returns the last non-empty segment of the URL path', () => {
		expect(lastPathSegment('https://demo.openvidu.io/room/my-room')).toBe('my-room');
	});

	it('ignores a trailing slash when selecting the last segment', () => {
		expect(lastPathSegment('https://demo.openvidu.io/room/my-room/')).toBe('my-room');
	});

	it('returns null when the path has no segments', () => {
		expect(lastPathSegment('https://demo.openvidu.io/')).toBeNull();
	});

	it('returns null when the URL cannot be parsed', () => {
		expect(lastPathSegment('not-a-valid-url')).toBeNull();
	});
});

describe('queryParam', () => {
	it('returns the value of the requested query parameter when present', () => {
		expect(queryParam('https://demo.openvidu.io/room/my-room?secret=abc123', 'secret')).toBe('abc123');
	});

	it('returns null when the requested parameter is absent', () => {
		expect(queryParam('https://demo.openvidu.io/room/my-room?secret=abc123', 'missing')).toBeNull();
	});

	it('returns null when the URL cannot be parsed', () => {
		expect(queryParam('not-a-valid-url', 'secret')).toBeNull();
	});
});

describe('computeServerUrl', () => {
	it('returns the base URL up to the marker segment', () => {
		expect(computeServerUrl('http://localhost:6080/meet/room/my-room', '/room/')).toBe('http://localhost:6080/meet');
	});

	it('derives the base URL from the "/recording/" marker', () => {
		expect(computeServerUrl('http://localhost:6080/meet/recording/rec-1', '/recording/')).toBe(
			'http://localhost:6080/meet'
		);
	});

	it('returns null when the URL is empty', () => {
		expect(computeServerUrl('', '/room/')).toBeNull();
	});

	it('returns null when the marker segment is absent from the path', () => {
		expect(computeServerUrl('http://localhost:6080/meet/other/x', '/room/')).toBeNull();
	});

	it('returns null when the URL cannot be parsed', () => {
		expect(computeServerUrl('not-a-valid-url', '/room/')).toBeNull();
	});
});

describe('appendQuery', () => {
	it('appends a defined query param', () => {
		expect(appendQuery('/room/r1', { secret: 'sec' })).toBe('/room/r1?secret=sec');
	});

	it('appends several params in insertion order', () => {
		expect(appendQuery('/recording/rec', { recordingSecret: 's', roomSecret: 'rs' })).toBe(
			'/recording/rec?recordingSecret=s&roomSecret=rs'
		);
	});

	it('omits undefined and empty values', () => {
		expect(appendQuery('/room/r1', { secret: undefined, other: '' })).toBe('/room/r1');
	});

	it('returns the bare path (no "?") when no params are present', () => {
		expect(appendQuery('/login', {})).toBe('/login');
	});

	it('URL-encodes param values', () => {
		expect(appendQuery('/login', { redirectTo: '/recording/rec' })).toBe('/login?redirectTo=%2Frecording%2Frec');
	});
});

describe('isValidUrl', () => {
	it('is true for a well-formed absolute URL', () => {
		expect(isValidUrl('https://demo.openvidu.io/room/x')).toBe(true);
	});

	it('is false for a relative path', () => {
		expect(isValidUrl('/room/x')).toBe(false);
	});

	it('is false for a malformed or empty string', () => {
		expect(isValidUrl('not a url')).toBe(false);
		expect(isValidUrl('')).toBe(false);
	});
});

describe('extractParams', () => {
	it('maps route params + query params onto the entry-parameter bag', () => {
		const result = extractParams({
			params: { 'room-id': 'r1' },
			queryParams: {
				secret: 'sec',
				[EmbeddedAttribute.PARTICIPANT_NAME]: 'Alice',
				[EmbeddedAttribute.LEAVE_REDIRECT_URL]: 'https://back',
				[EmbeddedAttribute.SHOW_ONLY_RECORDINGS]: 'true',
				[EmbeddedAttribute.SHOW_RECORDING]: 'rec-1',
				[EmbeddedAttribute.E2EE_KEY]: 'k'
			}
		});

		expect(result).toEqual({
			roomId: 'r1',
			secret: 'sec',
			participantName: 'Alice',
			leaveRedirectUrl: 'https://back',
			showOnlyRecordings: 'true',
			showRecording: 'rec-1',
			e2eeKey: 'k'
		});
	});

	it('defaults showOnlyRecordings to "false" and leaves absent params undefined', () => {
		const result = extractParams({ params: { 'room-id': 'r1' }, queryParams: {} });
		expect(result.showOnlyRecordings).toBe('false');
		expect(result.secret).toBeUndefined();
		expect(result.participantName).toBeUndefined();
	});
});

// getReferrerOrigin/getAutoRedirectUrl read the host page via document.referrer. Stub it as an own
// property (shadowing the native Document.prototype getter) and delete it afterwards to restore the
// real getter — build-agnostic and isolated per test.
const stubReferrer = (value: string): void => {
	Object.defineProperty(document, 'referrer', { configurable: true, get: () => value });
};
const restoreReferrer = (): void => {
	delete (document as { referrer?: string }).referrer;
};

describe('getReferrerOrigin', () => {
	afterEach(restoreReferrer);

	it('returns the origin of the referrer when present', () => {
		stubReferrer('https://host.example.com/embed/page?x=1');
		expect(getReferrerOrigin()).toBe('https://host.example.com');
	});

	it('returns null when there is no referrer', () => {
		stubReferrer('');
		expect(getReferrerOrigin()).toBeNull();
	});

	it('returns null when the referrer cannot be parsed', () => {
		stubReferrer('not a url');
		expect(getReferrerOrigin()).toBeNull();
	});
});

describe('getAutoRedirectUrl', () => {
	afterEach(restoreReferrer);

	it('returns the full referrer when it is on a different origin', () => {
		stubReferrer('https://other.example.com/landing');
		expect(getAutoRedirectUrl()).toBe('https://other.example.com/landing');
	});

	it('returns null for a same-origin referrer', () => {
		stubReferrer(`${window.location.origin}/previous-page`);
		expect(getAutoRedirectUrl()).toBeNull();
	});

	it('returns null when there is no referrer', () => {
		stubReferrer('');
		expect(getAutoRedirectUrl()).toBeNull();
	});
});

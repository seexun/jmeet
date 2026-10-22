export enum NavigationErrorReason {
	CLOSED_ROOM = 'closed-room',
	ANONYMOUS_ACCESS_DISABLED = 'anonymous-access-disabled',
	ANONYMOUS_RECORDING_ACCESS_DISABLED = 'anonymous-recording-access-disabled',
	INVALID_ROOM_SECRET = 'invalid-room-secret',
	INVALID_RECORDING_SECRET = 'invalid-recording-secret',
	INVALID_ROOM = 'invalid-room',
	INVALID_RECORDING = 'invalid-recording',
	INVALID_MEMBER = 'invalid-member',
	FORBIDDEN_ROOM_ACCESS = 'forbidden-room-access',
	FORBIDDEN_ROOM_RECORDINGS_ACCESS = 'forbidden-room-recordings-access',
	FORBIDDEN_RECORDING_ACCESS = 'forbidden-recording-access',
	ROOM_ACCESS_REVOKED = 'room-access-revoked',
	TOO_MANY_REQUESTS = 'too-many-requests',
	/** A webcomponent-specific failure (e.g. a missing/invalid `room-url`/`recording-url` attribute). */
	EMBEDDED_ERROR = 'embedded-error',
	INTERNAL_ERROR = 'internal-error'
}

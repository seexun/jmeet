import {
	MeetRoom,
	MeetRoomMember,
	MeetRoomMemberOptions,
	MeetRoomMemberRole,
	MeetRoomOptions,
	MeetUserDTO,
	MeetUserOptions
} from '@openvidu-meet/typings';

// ---------------------------------------------------------------------------
// Environment / URL helpers
// ---------------------------------------------------------------------------

const buildDefaultApiBaseUrl = (meetBaseUrl: string, internal = false): string => {
	const base = new URL(meetBaseUrl);
	const normalizedPath = base.pathname.replace(/\/$/, '');
	base.pathname = internal ? `${normalizedPath}/internal-api/v1` : `${normalizedPath}/api/v1`;
	return base.toString().replace(/\/$/, '');
};

export const MEET_BASE_URL = process.env['E2E_BASE_URL'] || 'http://localhost:6081/meet';
const API_BASE_URL = process.env['E2E_API_BASE_URL'] || buildDefaultApiBaseUrl(MEET_BASE_URL);
const INTERNAL_API_BASE_URL = process.env['E2E_INTERNAL_API_BASE_URL'] || buildDefaultApiBaseUrl(MEET_BASE_URL, true);
const API_KEY = process.env['E2E_API_KEY'] || 'meet-api-key';

const withApiPath = (path: string): string => {
	return `${API_BASE_URL}${path}`;
};

const withInternalApiPath = (path: string): string => {
	return `${INTERNAL_API_BASE_URL}${path}`;
};

const assertOk = (response: Response, responseText: string, operation: string): void => {
	if (!response.ok) {
		throw new Error(`Meet API request failed (${operation}) with status ${response.status}: ${responseText}`);
	}
};

// ---------------------------------------------------------------------------
// Public API helpers
// ---------------------------------------------------------------------------

/**
 * Creates a room with the given options.
 */
export const createRoom = async (options: MeetRoomOptions = {}): Promise<MeetRoom> => {
	const response = await fetch(withApiPath('/rooms'), {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-api-key': API_KEY
		},
		body: JSON.stringify(options)
	});

	const responseText = await response.text();
	assertOk(response, responseText, 'create room');

	return JSON.parse(responseText) as MeetRoom;
};

/**
 * Creates a room authenticated as a user (via their access token) instead of the API key, which
 * makes that user the room owner.
 */
export const createRoomAsUser = async (accessToken: string, options: MeetRoomOptions = {}): Promise<MeetRoom> => {
	const response = await fetch(withApiPath('/rooms'), {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: `Bearer ${accessToken}`
		},
		body: JSON.stringify(options)
	});

	const responseText = await response.text();
	assertOk(response, responseText, 'create room as user');

	return JSON.parse(responseText) as MeetRoom;
};

/**
 * Adds a member to the specified room with the given options.
 */
export const createRoomMember = async (roomId: string, options: MeetRoomMemberOptions): Promise<MeetRoomMember> => {
	const response = await fetch(withApiPath(`/rooms/${encodeURIComponent(roomId)}/members`), {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-api-key': API_KEY
		},
		body: JSON.stringify(options)
	});

	const responseText = await response.text();
	assertOk(response, responseText, 'create room member');

	return JSON.parse(responseText) as MeetRoomMember;
};

/**
 * Convenience helper that creates a room, adds one member, and returns the
 * member's fully-qualified access URL.
 */
export const createRoomAndGetAnonymousAccessUrl = async (
	roomOptions: MeetRoomOptions = {},
	accessUrlType: 'moderator' | 'speaker' = 'moderator',
	queryParams?: Record<string, string>
): Promise<{ room: MeetRoom; accessUrl: string }> => {
	const room = await createRoom(roomOptions);
	const accessUrl = new URL(room.access.anonymous[accessUrlType].url);

	for (const [key, value] of Object.entries(queryParams ?? {})) {
		accessUrl.searchParams.set(key, value);
	}

	return { room, accessUrl: accessUrl.toString() };
};

/**
 * Convenience helper that creates a room, adds one member, and returns the
 * member's fully-qualified access URL.
 */
export const createRoomAndGetMemberAccessUrl = async (
	roomOptions: MeetRoomOptions = {},
	memberOptions: MeetRoomMemberOptions = {
		name: `member-${Date.now()}`,
		baseRole: MeetRoomMemberRole.MODERATOR
	},
	queryParams?: Record<string, string>
): Promise<{ room: MeetRoom; member: MeetRoomMember; accessUrl: string }> => {
	const room = await createRoom(roomOptions);
	const member = await createRoomMember(room.roomId, memberOptions);

	const accessUrl = new URL(member.accessUrl);

	for (const [key, value] of Object.entries(queryParams ?? {})) {
		accessUrl.searchParams.set(key, value);
	}

	return { room, member, accessUrl: accessUrl.toString() };
};

/**
 * Deletes the specified rooms.
 */
export const deleteRooms = async (roomIds: string[]): Promise<void> => {
	const ids = roomIds.filter((roomId) => roomId.trim().length > 0);

	if (ids.length === 0) {
		return;
	}

	const response = await fetch(
		withApiPath(`/rooms?roomIds=${ids.map(encodeURIComponent).join(',')}&withMeeting=force`),
		{
			method: 'DELETE',
			headers: {
				'x-api-key': API_KEY
			}
		}
	);

	const responseText = await response.text();
	assertOk(response, responseText, `delete rooms ${ids.join(',')}`);
};

// ---------------------------------------------------------------------------
// User / authentication helpers
// ---------------------------------------------------------------------------

/**
 * Creates a user with the given options.
 */
export const createUser = async (options: MeetUserOptions): Promise<MeetUserDTO> => {
	const response = await fetch(withApiPath('/users'), {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-api-key': API_KEY
		},
		body: JSON.stringify(options)
	});

	const responseText = await response.text();
	assertOk(response, responseText, 'create user');

	return JSON.parse(responseText) as MeetUserDTO;
};

/**
 * Deletes the specified users (best-effort; failures — e.g. the protected admin — are ignored).
 */
export const deleteUsers = async (userIds: string[]): Promise<void> => {
	const ids = userIds.filter((userId) => userId.trim().length > 0);

	if (ids.length === 0) {
		return;
	}

	const response = await fetch(withApiPath(`/users?userIds=${ids.map(encodeURIComponent).join(',')}`), {
		method: 'DELETE',
		headers: {
			'x-api-key': API_KEY
		}
	});

	const responseText = await response.text();
	assertOk(response, responseText, `delete users ${ids.join(',')}`);
};

type LoginResult = { accessToken: string; refreshToken?: string; mustChangePassword?: boolean };

/**
 * Logs in via the REST API, returning the issued tokens and whether a password change is required.
 */
export const loginUser = async (loginName: string, password: string): Promise<LoginResult> => {
	const response = await fetch(withInternalApiPath('/auth/login'), {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ loginName, password })
	});

	const responseText = await response.text();
	assertOk(response, responseText, 'login user');

	return JSON.parse(responseText) as LoginResult;
};

/**
 * Changes a user's password via the REST API and returns the fresh (full) access token.
 */
export const changeUserPassword = async (
	accessToken: string,
	currentPassword: string,
	newPassword: string
): Promise<string> => {
	const response = await fetch(withInternalApiPath('/users/change-password'), {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: `Bearer ${accessToken}`
		},
		body: JSON.stringify({ currentPassword, newPassword })
	});

	const responseText = await response.text();
	assertOk(response, responseText, 'change password');

	return (JSON.parse(responseText) as { accessToken: string }).accessToken;
};

/**
 * Logs a user in and returns a usable (full) access token. Freshly created users must change their
 * password on first login (the login token is temporary), so this performs the change to
 * {@link newPassword} when required — after which {@link newPassword} is the user's current password.
 */
export const getUserAccessToken = async (loginName: string, password: string, newPassword: string): Promise<string> => {
	const login = await loginUser(loginName, password);

	if (login.mustChangePassword) {
		return changeUserPassword(login.accessToken, password, newPassword);
	}

	return login.accessToken;
};

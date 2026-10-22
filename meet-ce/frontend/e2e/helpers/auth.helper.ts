import {
	MeetRoom,
	MeetRoomMember,
	MeetRoomMemberPermissions,
	MeetRoomMemberRole,
	MeetRoomOptions,
	MeetUserRole
} from '@openvidu-meet/typings';
import { expect, type Page } from '@playwright/test';
import { createRoomAsUser, createRoomMember, createUser, getUserAccessToken, MEET_BASE_URL } from './meet-api.helper';
import { click } from './ui-utils.helper';

// Monotonic counter guaranteeing unique user ids even when users are created within the same
// millisecond (e.g. via Promise.all in a test's beforeAll).
let userSequence = 0;

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * Credentials for logging a registered user into the JMeet application.
 */
export interface LoginOptions {
	/** Internal user id, retained for API operations and cleanup. */
	userId: string;
	/** Account name used by the login form. */
	loginName?: string;
	/** Current password. */
	password: string;
	/** New password to set when the app forces a password change on the user's first login. */
	newPassword?: string;
}

/**
 * A user whose credentials are ready for a direct UI login (the mandatory first-login password
 * change has already been performed), so `password` logs in without a change-password step.
 */
export interface ReadyUser {
	userId: string;
	loginName: string;
	name: string;
	password: string;
}

const INITIAL_PASSWORD = 'changeme1';
const READY_PASSWORD = 'changed11';

// ─── Login steps ─────────────────────────────────────────────────────────────

/**
 * Changes the password when the app forces a password change (a user's first login). The step is
 * auto-detected from the change-password form, so this is a no-op when no change is required.
 */
const performPasswordChange = async (page: Page, login: LoginOptions): Promise<void> => {
	const newPasswordInput = page.locator('input[formcontrolname="newPassword"]');
	const passwordChangeRequired = await newPasswordInput
		.waitFor({ state: 'visible', timeout: 5_000 })
		.then(() => true)
		.catch(() => false);

	if (!passwordChangeRequired) {
		return;
	}

	if (!login.newPassword) {
		throw new Error('The user must change their password on first login, but no `newPassword` was provided');
	}

	await page.locator('input[formcontrolname="currentPassword"]').fill(login.password);
	await newPasswordInput.fill(login.newPassword);
	await page.locator('input[formcontrolname="confirmPassword"]').fill(login.newPassword);
	await click(page.locator('button[type="submit"].primary-button'), 10_000);
};

/**
 * Logs a registered user in when the app requests it. The login form is auto-detected (the app
 * shows it when authentication is required), so this is a no-op when no login is presented — for
 * example when the user is already authenticated or the room allows anonymous access. Handles the
 * forced password-change step of a first login.
 */
export const performLogin = async (page: Page, login: LoginOptions): Promise<void> => {
	const loginButton = page.locator('#login-button');
	const loginRequired = await loginButton
		.waitFor({ state: 'visible', timeout: 5_000 })
		.then(() => true)
		.catch(() => false);

	if (!loginRequired) {
		return;
	}

	await page.locator('#userId-input').fill(login.loginName ?? login.userId);
	await page.locator('#password-input').fill(login.password);
	await click(loginButton, 10_000);

	await performPasswordChange(page, login);
};

/**
 * Establishes an authenticated session by logging in from the JMeet home page, which
 * redirects to the login form when not authenticated.
 */
export const authenticate = async (page: Page, login: LoginOptions): Promise<void> => {
	await page.goto(MEET_BASE_URL, { waitUntil: 'domcontentloaded' });
	await performLogin(page, login);
	// Confirm the login succeeded (the login form is gone once authenticated).
	await expect(page.locator('#login-button')).toHaveCount(0, { timeout: 15_000 });
};

// ─── Login-page assertions ─────────────────────────────────────────────────────

/**
 * Asserts that no login page is presented (the target page is reached directly).
 */
export const expectNoLoginPage = async (page: Page): Promise<void> => {
	await expect(page.locator('#login-button')).toHaveCount(0);
};

/**
 * Asserts that the login page is presented (login is required to proceed).
 */
export const expectLoginPage = async (page: Page): Promise<void> => {
	await expect(page.locator('#login-button')).toBeVisible({ timeout: 10_000 });
};

// ─── User creation ──────────────────────────────────────────────────────────────

/**
 * Creates a user and returns credentials ready for a UI login: the mandatory first-login password
 * change is performed up front (via the API), so the returned `password` logs in directly without a
 * change-password step. Defaults to an admin, who always has room/recording access regardless of
 * the room's user-access setting.
 */
export const createReadyUser = async (name: string, role: MeetUserRole = MeetUserRole.ADMIN): Promise<ReadyUser> => {
	const loginName = `user${Date.now()}_${userSequence++}`;
	const user = await createUser({ loginName, name, role, password: INITIAL_PASSWORD });
	await getUserAccessToken(loginName, INITIAL_PASSWORD, READY_PASSWORD);
	return { userId: user.userId, loginName, name, password: READY_PASSWORD };
};

/**
 * Creates a ready-to-login {@link MeetUserRole.ROOM_MANAGER} user and a room owned by them
 * (created via their access token). Returns the user, the owned room, and a usable access token.
 * A room manager (rather than an admin) is used so the OWNER badge/permissions can be distinguished
 * from the ADMIN short-circuit.
 */
export const createReadyOwner = async (
	name = 'Room Owner',
	roomOptions: MeetRoomOptions = {}
): Promise<{ user: ReadyUser; room: MeetRoom; accessToken: string }> => {
	const user = await createReadyUser(name, MeetUserRole.ROOM_MANAGER);
	const accessToken = await getUserAccessToken(user.loginName, user.password, user.password);
	const room = await createRoomAsUser(accessToken, roomOptions);
	return { user, room, accessToken };
};

/**
 * Creates a ready-to-login user (defaults to {@link MeetUserRole.ROOM_MEMBER}) and registers them as
 * a USER-type member of the given room. The member's access URL is the plain room URL (`/room/:id`),
 * which requires the user to log in. Returns the user and the created member.
 */
export const createReadyMemberUser = async (
	roomId: string,
	options: {
		name?: string;
		role?: MeetUserRole;
		baseRole?: MeetRoomMemberRole;
		customPermissions?: Partial<MeetRoomMemberPermissions>;
	} = {}
): Promise<{ user: ReadyUser; member: MeetRoomMember }> => {
	const {
		name = 'Member User',
		role = MeetUserRole.ROOM_MEMBER,
		baseRole = MeetRoomMemberRole.SPEAKER,
		customPermissions
	} = options;

	const user = await createReadyUser(name, role);
	const member = await createRoomMember(roomId, { userId: user.userId, baseRole, customPermissions });
	return { user, member };
};

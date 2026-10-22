import { expect, type Page } from '@playwright/test';
import { performLogin, type LoginOptions } from './auth.helper';
import { ensurePrejoinAudioState, ensurePrejoinVideoState } from './media-controls.helper';
import { click } from './ui-utils.helper';

// ─── Internal lobby / prejoin steps ─────────────────────────────────────────

/**
 * Fills the lobby form (participant name + optional E2EE key) and submits it.
 * Waits for the relevant inputs to be visible before interacting.
 */
const completeLobby = async (page: Page, options?: { name?: string; e2eeKey?: string }): Promise<void> => {
	const nameSubmit = page.locator('#participant-name-submit');
	const nameInput = page.locator('#participant-name-input');
	await expect(nameSubmit).toBeVisible({ timeout: 10_000 });
	if (await nameInput.isVisible()) {
		if (options?.name && (await nameInput.isEditable())) {
			await nameInput.fill(options.name);
		} else if (!(await nameInput.inputValue())) {
			await nameInput.fill(`pw-${Date.now()}`);
		}
	} else {
		// Authenticated and invited members confirm their bound identity instead.
		await expect(page.locator('.jmeet-lobby-identity')).toBeVisible();
	}

	if (options?.e2eeKey) {
		const e2eeInput = page.locator('#participant-e2eekey-input');
		await expect(e2eeInput).toBeVisible({ timeout: 10_000 });
		await expect(e2eeInput).toBeEditable({ timeout: 10_000 });
		await e2eeInput.fill(options.e2eeKey);
	}

	await click(nameSubmit, 10_000);
};

/**
 * Clicks the join button in the prejoin screen after it becomes visible.
 */
const clickJoinMeeting = async (page: Page): Promise<void> => {
	const joinButton = page.locator('#join-button');
	await expect(joinButton).toBeVisible({ timeout: 10_000 });
	await click(joinButton, 10_000);
};

// ─── Navigation entry-points ────────────────────────────────────────────────

/**
 * Navigates to the access URL, completes the lobby, clicks join, and waits for
 * the meeting layout to be fully loaded.
 *
 * @param options.name     - Participant display name (auto-generated when omitted).
 * @param options.e2eeKey  - End-to-end encryption passphrase.
 * @param options.videoEnabled - Whether the participant should have their video enabled at join.
 * @param options.audioEnabled - Whether the participant should have their audio enabled at join.
 * @param options.timeoutMs - Maximum wait time for each visibility assertion.
 */
export const openMeeting = async (
	page: Page,
	accessUrl: string,
	options?: {
		timeoutMs?: number;
		name?: string;
		e2eeKey?: string;
		videoEnabled?: boolean;
		audioEnabled?: boolean;
		/** Skip prejoin video/audio state checks (e.g. when media permissions are denied). */
		skipPrejoinMediaCheck?: boolean;
		/** Log the given registered user in (as an authenticated user) before accessing the room. */
		login?: LoginOptions;
	}
): Promise<void> => {
	const {
		timeoutMs = 15_000,
		videoEnabled = true,
		audioEnabled = true,
		skipPrejoinMediaCheck = false
	} = options ?? {};

	await openPrejoin(page, accessUrl, options);

	if (!skipPrejoinMediaCheck) {
		await ensurePrejoinVideoState(page, videoEnabled);
		await ensurePrejoinAudioState(page, audioEnabled);
	}

	await clickJoinMeeting(page);

	await expect(page.locator('#layout-container')).toBeVisible({ timeout: timeoutMs });
	await expect(page.locator('#media-buttons-container')).toBeVisible({ timeout: timeoutMs });
};

/**
 * Navigates to the access URL, completes the lobby, and stops at the prejoin
 * screen (camera / microphone preview) without joining the room.
 *
 * @param options.name     - Participant display name (auto-generated when omitted).
 * @param options.e2eeKey  - End-to-end encryption passphrase.
 * @param options.timeoutMs - Maximum wait time for each visibility assertion.
 * @param options.login    - Log the given registered user in (as an authenticated user) before accessing the room.
 */
export const openPrejoin = async (
	page: Page,
	accessUrl: string,
	options?: { timeoutMs?: number; name?: string; e2eeKey?: string; login?: LoginOptions }
): Promise<void> => {
	const timeoutMs = options?.timeoutMs ?? 15_000;

	await openLobby(page, accessUrl, options);
	await completeLobby(page, options);

	await expect(page.locator('#join-button')).toBeVisible({ timeout: timeoutMs });
};

/**
 * Navigates to the access URL and (by default) waits for the lobby name-input to appear, without
 * filling it or proceeding further. This is the single entry point that performs the user login:
 * when `options.login` credentials are given and the app presents the login form (auto-detected),
 * the user is logged in — including the forced password change on a first login — before the lobby.
 *
 * Set `options.checkNameInput` to `false` to skip waiting for the name input — useful to assert an
 * intermediate state first (e.g. that the login form is shown) before logging in.
 */
export const openLobby = async (
	page: Page,
	accessUrl: string,
	options?: { timeoutMs?: number; login?: LoginOptions; checkNameInput?: boolean }
): Promise<void> => {
	const timeoutMs = options?.timeoutMs ?? 15_000;
	const checkNameInput = options?.checkNameInput ?? true;

	await page.goto(accessUrl, { waitUntil: 'domcontentloaded' });

	// Log in only when the app actually presents the login form (auto-detected). Credentials being
	// supplied is not enough on its own — an already-authenticated or anonymous guest shows no login.
	if (options?.login) {
		await performLogin(page, options.login);
	}

	if (checkNameInput) {
		await expect(page.locator('#participant-name-input, .jmeet-lobby-identity').first()).toBeVisible({ timeout: timeoutMs });
	}
};

// ─── Leave / end-meeting assertions (canEndMeeting) ─────────────────────────────

/**
 * Asserts that the "end meeting" option is available (the `canEndMeeting` permission is granted):
 * the leave button opens a menu exposing the end-meeting action. Opens the menu, asserts, then
 * closes it without ending the meeting.
 */
export const expectEndMeetingOption = async (page: Page): Promise<void> => {
	await page.locator('#leave-btn').click();
	await expect(page.locator('#end-meeting-option')).toBeVisible({ timeout: 10_000 });
	await page.keyboard.press('Escape');
};

/**
 * Asserts that the "end meeting" option is not available (the `canEndMeeting` permission is denied):
 * the leave button is the plain variant with no menu, so the leave-menu component is not rendered.
 * Non-destructive — does not click the leave button (which would leave the meeting directly).
 */
export const expectNoEndMeetingOption = async (page: Page): Promise<void> => {
	await expect(page.locator('#leave-btn')).toBeVisible({ timeout: 10_000 });
	await expect(page.locator('ov-meeting-toolbar-leave-button #leave-btn')).toHaveCount(0);
};

/**
 * Clicks the leave button (and the secondary confirmation if it appears) and
 * waits until the meeting layout is removed from the DOM.
 *
 * If a sidenav panel is open, it is closed first — the panel uses
 * fixedInViewport which causes it to cover the toolbar leave button.
 */
export const leaveMeeting = async (page: Page, timeoutMs = 10_000): Promise<void> => {
	const panelCloseButton = page.locator('.panel-close-button').first();

	if (await panelCloseButton.isVisible()) {
		await panelCloseButton.click();
		await expect(page.locator('.sidenav-menu')).not.toBeVisible({ timeout: 5_000 });
	}

	await page.locator('#leave-btn').click();

	const leaveOption = page.locator('#leave-option');
	const leaveDropdownVisible = await leaveOption
		.waitFor({ state: 'visible', timeout: 3_000 })
		.then(() => true)
		.catch(() => false);

	if (leaveDropdownVisible) {
		await leaveOption.click();
	}

	await expect(page.locator('#layout-container')).toHaveCount(0, { timeout: timeoutMs });
};

/**
 * Ends the room for every participant and waits for the local client to reach
 * the disconnected screen.
 */
export const endMeeting = async (page: Page, timeoutMs = 15_000): Promise<void> => {
	const panelCloseButton = page.locator('.panel-close-button').first();

	if (await panelCloseButton.isVisible()) {
		await panelCloseButton.click();
		await expect(page.locator('.sidenav-menu')).not.toBeVisible({ timeout: 5_000 });
	}

	await page.locator('#leave-btn').click();
	await expect(page.locator('#end-meeting-option')).toBeVisible({ timeout: 10_000 });
	await page.locator('#end-meeting-option').click();
	await page.locator('.ant-modal .confirm-button').click();

	await expect(page.locator('#layout-container')).toHaveCount(0, { timeout: timeoutMs });
	await expect(page.locator('.disconnected-container')).toBeVisible({ timeout: timeoutMs });
};

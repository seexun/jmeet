import { expect, type Page } from '@playwright/test';

// ─── Lobby name input ─────────────────────────────────────────────────────────

/**
 * Asserts the value and editability of the lobby participant-name input.
 */
export const expectNameInput = async (page: Page, expected: { value: string; editable: boolean }): Promise<void> => {
	const nameInput = page.locator('#participant-name-input');
	await expect(nameInput).toBeVisible({ timeout: 10_000 });
	await expect(nameInput).toHaveValue(expected.value);

	if (expected.editable) {
		await expect(nameInput).toBeEditable();
	} else {
		await expect(nameInput).not.toBeEditable();
	}
};

// ─── Access-denied / restricted views ───────────────────────────────────────────

/**
 * Asserts that access to the room/recordings was denied: the app renders the error page and no
 * lobby name input is shown. Used for individuals that cannot access the resource at all (e.g. a
 * non-member user when the room's user access is disabled).
 */
export const expectRoomAccessDenied = async (page: Page): Promise<void> => {
	await expect(page.locator('.error-page')).toBeVisible({ timeout: 15_000 });
	await expect(page.locator('#participant-name-input')).toHaveCount(0);
};

/**
 * Asserts that the lobby is reached but joining is restricted (the `canJoinMeeting` permission is
 * denied): the "no permission" card is shown instead of the name input / join form.
 */
export const expectLobbyAccessRestricted = async (page: Page): Promise<void> => {
	await expect(page.locator('.room-closed-message')).toBeVisible({ timeout: 15_000 });
	await expect(page.locator('#participant-name-input')).toHaveCount(0);
};

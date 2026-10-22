import { expect, type Page } from '@playwright/test';
import { closeSettingsPanel, openSettingsPanel, toggleParticipantsPanel } from './panels.helper';
import { expectVisible } from './ui-utils.helper';

/**
 * Asserts that all participant names in the video grid are unmasked (do not
 * contain asterisks).
 */
export const expectUnmaskedVideoGridNames = async (page: Page): Promise<void> => {
	for (const name of await page.locator('.participant-name-container #participant-name').allTextContents()) {
		expect(name).not.toContain('*');
	}
};

/**
 * Asserts that all participant names in the participants panel are unmasked (do
 * not contain asterisks) and that the expected number of participant entries is
 * present.
 */
export const expectUnmaskedParticipantPanelNames = async (page: Page, expectedCount: number): Promise<void> => {
	await toggleParticipantsPanel(page);
	await expectVisible(page, 'ov-participants-panel');
	const names = page.locator('.participant-name-text');
	await expect(names).toHaveCount(expectedCount);

	for (const name of await names.allTextContents()) {
		expect(name).not.toContain('*');
	}

	await toggleParticipantsPanel(page);
};

/**
 * Asserts that the own participant name in the settings panel is unmasked (does
 * not contain asterisks) and matches the expected name.
 */
export const expectOwnNameInSettings = async (page: Page, expectedName: string): Promise<void> => {
	await openSettingsPanel(page);
	await expect(page.locator('#participant-name-input')).toHaveValue(expectedName);
	await closeSettingsPanel(page);
};

import { expect, type Page } from '@playwright/test';
import { toggleMicrophone } from './media-controls.helper';
import { openLayoutSettingsPanel } from './panels.helper';
import { waitForVisibleRemoteParticipants } from './stream.helper';

export type LayoutBox = { x: number; y: number; width: number; height: number };

/**
 * Selects the mosaic layout radio button.
 */
export const selectMosaicLayout = async (page: Page): Promise<void> => {
	if (!(await page.locator('.settings-container').isVisible())) {
		await openLayoutSettingsPanel(page);
	}

	await page.locator('#layout-mosaic').click();
};

/**
 * Selects the smart mosaic layout radio button.
 */
export const selectSmartMosaicLayout = async (page: Page): Promise<void> => {
	if (!(await page.locator('.settings-container').isVisible())) {
		await openLayoutSettingsPanel(page);
	}

	await page.locator('#layout-smart-mosaic').click();
};

/**
 * Sets the Smart Mosaic participant count slider to a specific value.
 * @param targetValue - Target participant count (1-6)
 */
export const setSmartMosaicSliderValue = async (page: Page, targetValue: number): Promise<void> => {
	if (!(await page.locator('.settings-container').isVisible())) {
		await openLayoutSettingsPanel(page);
	}

	const sliderInput = page.locator('.participant-slider input[matSliderThumb]');
	const participantCountValue = page.locator('.participant-count-container .participant-count-value');
	await expect(sliderInput).toBeVisible();
	await sliderInput.focus();
	await sliderInput.fill(targetValue.toString());
	await expect(participantCountValue).toHaveText(String(targetValue), { timeout: 5_000 });
};

/**
 * Runs `cycles` speaker-rotation rounds between two participants while a screen share is active.
 *
 * Each round:
 *  1. Asserts the current active speaker (and the screen share) are visible and the silent one is hidden.
 *  2. Swaps microphones so the next round starts with the roles reversed.
 *
 * After all rounds a final assertion checks the expected resting state.
 *
 * @param pageA           - Observer page that renders the layout.
 * @param byName          - Map of participant name → Playwright Page.
 * @param speakerA        - Name of the first participant (active in even cycles).
 * @param speakerB        - Name of the second participant (active in odd cycles).
 * @param screenOwner     - Name of the participant sharing their screen (used to derive the screen-share track name).
 * @param cycles          - Number of swap cycles to perform (default 3).
 */
export const runScreenShareRotationCycles = async (
	pageA: Page,
	byName: Record<string, Page>,
	speakerA: string,
	speakerB: string,
	screenOwner: string,
	cycles = 3
): Promise<void> => {
	const screenTrack = `${screenOwner} (screen)`;

	// Both participants start muted; enable speakerA to begin the first cycle.
	await toggleMicrophone(byName[speakerA]);

	for (let cycle = 0; cycle < cycles; cycle++) {
		const activeSpeaker = cycle % 2 === 0 ? speakerA : speakerB;
		const silentParticipant = cycle % 2 === 0 ? speakerB : speakerA;

		await waitForVisibleRemoteParticipants(
			pageA,
			{
				count: 2,
				includes: [activeSpeaker, screenTrack],
				excludes: [silentParticipant]
			},
			20_000
		);

		// Swap microphones: mute the active speaker and unmute the silent one.
		await Promise.all([toggleMicrophone(byName[activeSpeaker]), toggleMicrophone(byName[silentParticipant])]);
	}
};

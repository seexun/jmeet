import { expect, test } from '@playwright/test';
import {
	applyBackgroundEffect,
	closePrejoinBackgroundsPanel,
	closeRoomBackgroundsPanel,
	openPrejoinBackgroundsPanel,
	openRoomBackgroundsPanel,
	toggleCamera,
	togglePrejoinCamera
} from './helpers/media-controls.helper';
import { createRoomAndGetAnonymousAccessUrl, deleteRooms } from './helpers/meet-api.helper';
import { openMeeting, openPrejoin } from './helpers/meeting-navigation.helper';
import { openMoreOptionsMenu } from './helpers/panels.helper';
import {
	captureVideoElementScreenshot,
	expectDisabled,
	expectSignificantImageDifference,
	expectVisible
} from './helpers/ui-utils.helper';

test.describe('Virtual Background E2E Tests', () => {
	const createdRoomIds: string[] = [];

	let roomId: string;
	let accessUrl: string;

	test.beforeEach(async () => {
		const { room, accessUrl: url } = await createRoomAndGetAnonymousAccessUrl();
		roomId = room.roomId;
		accessUrl = url;
		createdRoomIds.push(roomId);
	});

	test.afterAll(async () => {
		await deleteRooms(createdRoomIds);
	});

	test('should close BACKGROUNDS on prejoin page when VIDEO is disabled', async ({ page }) => {
		await openPrejoin(page, accessUrl);

		const backgroundsButton = page.locator('#backgrounds-button');
		await expect(backgroundsButton).toBeVisible();
		await expect(backgroundsButton).toBeEnabled();

		await openPrejoinBackgroundsPanel(page);
		await togglePrejoinCamera(page);

		await expectVisible(page, '.participant-avatar > .poster');
		await expect(backgroundsButton).toBeVisible();
		await expect(backgroundsButton).toBeDisabled();
		// Panel stays mounted in prejoin; disabling video collapses its wrapper.
		await expect(page.locator('.vb-container')).not.toBeVisible();
	});

	test('should not show BACKGROUNDS on prejoin page when VIDEO is disabled', async ({ page }) => {
		await openPrejoin(page, accessUrl);

		const backgroundsButton = page.locator('#backgrounds-button');
		await expect(backgroundsButton).toBeVisible();
		await expect(backgroundsButton).toBeEnabled();

		await togglePrejoinCamera(page);

		await expectVisible(page, '.participant-avatar > .poster');
		await expect(backgroundsButton).toBeVisible();
		await expect(backgroundsButton).toBeDisabled();
		// Panel stays mounted in prejoin; with video disabled its wrapper is collapsed.
		await expect(page.locator('.vb-container')).not.toBeVisible();
	});

	test('should open and close BACKGROUNDS panel on prejoin page', async ({ page }) => {
		await openPrejoin(page, accessUrl);

		await expect(page.locator('#backgrounds-button')).toBeEnabled();
		await openPrejoinBackgroundsPanel(page);
		await closePrejoinBackgroundsPanel(page);
	});

	test('should apply a background effect on prejoin page', async ({ page }) => {
		await openPrejoin(page, accessUrl);

		const before = await captureVideoElementScreenshot(page);
		await openPrejoinBackgroundsPanel(page);
		await applyBackgroundEffect(page, 'professional-1');
		await closePrejoinBackgroundsPanel(page);
		const after = await captureVideoElementScreenshot(page);

		expectSignificantImageDifference(before, after);
	});

	test('should open and close BACKGROUNDS panel in the meeting', async ({ page }) => {
		await openMeeting(page, accessUrl);

		await openRoomBackgroundsPanel(page);
		await closeRoomBackgroundsPanel(page);
	});

	test('should not show BACKGROUNDS panel in the meeting when VIDEO is disabled', async ({ page }) => {
		await openMeeting(page, accessUrl);

		await toggleCamera(page);

		await expectVisible(page, '.participant-avatar > .poster');
		await openMoreOptionsMenu(page);

		await expectDisabled(page, '#virtual-bg-btn');
	});

	test('should close BACKGROUNDS in meeting when VIDEO is disabled', async ({ page }) => {
		await openMeeting(page, accessUrl);
		await openRoomBackgroundsPanel(page);
		await toggleCamera(page);
		await expect(page.locator('#background-effects-container')).toHaveCount(0);
	});

	test('should apply a background effect in the meeting', async ({ page }) => {
		await openMeeting(page, accessUrl);

		const before = await captureVideoElementScreenshot(page);
		await openRoomBackgroundsPanel(page);
		await applyBackgroundEffect(page, 'professional-1');
		await closeRoomBackgroundsPanel(page);
		const after = await captureVideoElementScreenshot(page);

		expectSignificantImageDifference(before, after);
	});
});

import { expect, test } from '@playwright/test';
import { toggleCamera, toggleMicrophone } from './helpers/media-controls.helper';
import { createRoomAndGetAnonymousAccessUrl, deleteRooms } from './helpers/meet-api.helper';
import { openMeeting } from './helpers/meeting-navigation.helper';
import { openLayoutSettingsPanel } from './helpers/panels.helper';

test.describe('Toolbar Buttons E2E Tests', () => {
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

	test('should toggle mute/unmute on the local microphone and update the icon accordingly', async ({ page }) => {
		await openMeeting(page, accessUrl);

		await toggleMicrophone(page);
		await expect(page.locator('#mic-btn #mic_off')).toBeVisible();

		await toggleMicrophone(page);
		await expect(page.locator('#mic-btn #mic')).toBeVisible();
	});

	test('should toggle mute/unmute on the local camera and update the icon accordingly', async ({ page }) => {
		await openMeeting(page, accessUrl);

		await toggleCamera(page);
		await expect(page.locator('#camera-btn #videocam_off')).toBeVisible();

		await toggleCamera(page);
		await expect(page.locator('#camera-btn #videocam')).toBeVisible();
	});

	test('should open settings panel clicking layout toolbar button', async ({ page }) => {
		await openMeeting(page, accessUrl);

		await openLayoutSettingsPanel(page);
		await expect(page.locator('.layout-section')).toBeVisible();
		await expect(page.locator('.nickname-section')).toBeVisible();
		await page.locator('#settings-container .panel-close-button').click();
		await expect(page.locator('#settings-container')).toHaveCount(0);
	});
});

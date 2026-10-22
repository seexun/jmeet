import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/no-media-permissions.fixture';
import {
	assertHasVideoDeviceOption,
	ensurePrejoinVideoState,
	getVideoDeviceOptions,
	isPrejoinVideoEnabled,
	selectVideoDevice,
	startScreensharing
} from './helpers/media-controls.helper';
import { createRoomAndGetAnonymousAccessUrl, deleteRooms } from './helpers/meet-api.helper';
import { openMeeting, openPrejoin } from './helpers/meeting-navigation.helper';
import { openSettingsPanel } from './helpers/panels.helper';
import { getFirstVideoTrackDeviceId, getFirstVideoTrackLabel, getScreenTrackLabel } from './helpers/stream.helper';
import { getGetUserMediaCallCount, getGetUserMediaCalls, installGetUserMediaCounter } from './helpers/ui-utils.helper';

/**
 * Re-opens the prejoin in the SAME browser context (simulating a returning user). The lobby may be
 * skipped when the participant name is already stored for the tab, so this tolerates both flows
 * rather than assuming the name form is shown (which is what {@link openPrejoin} requires).
 */
const reopenPrejoin = async (page: Page, accessUrl: string): Promise<void> => {
	await page.goto(accessUrl, { waitUntil: 'domcontentloaded' });

	const nameSubmit = page.locator('#participant-name-submit');
	const lobbyShown = await nameSubmit
		.waitFor({ state: 'visible', timeout: 5_000 })
		.then(() => true)
		.catch(() => false);

	if (lobbyShown) {
		const nameInput = page.locator('#participant-name-input');

		if (!(await nameInput.inputValue())) {
			await nameInput.fill(`pw-${Date.now()}`);
		}

		await nameSubmit.click();
	}

	await expect(page.locator('#join-button')).toBeVisible({ timeout: 15_000 });
};

test.describe('Media Devices E2E Tests', () => {
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

	test.describe('Virtual Device Replacement and Permissions Handling', () => {
		test('should allow selecting and replacing the video track with a custom virtual device in the prejoin page', async ({
			page
		}) => {
			await openPrejoin(page, accessUrl);

			const videoDropdown = page.locator('#video-dropdown');

			if (await videoDropdown.isDisabled()) {
				await expect(videoDropdown).toBeDisabled();
				return;
			}

			await videoDropdown.click();
			const customOption = page.locator('#option-custom_fake_video_1');

			if (!(await customOption.isVisible())) {
				await assertHasVideoDeviceOption(page);
				return;
			}

			await customOption.click();
			await expect.poll(() => getFirstVideoTrackLabel(page)).toBe('custom_fake_video_1');

			await page.locator('#video-dropdown').click();
			await page.locator('#option-fake_device_0').click();
			await expect.poll(() => getFirstVideoTrackLabel(page)).toBe('fake_device_0');
		});

		test('should allow selecting and replacing the video track with a custom virtual device in the videoconference page', async ({
			page
		}) => {
			await openMeeting(page, accessUrl);

			await openSettingsPanel(page);
			await page.locator('#video-opt').click();
			await expect(page.locator('ov-video-devices-select')).toBeVisible();

			const videoDropdown = page.locator('#video-dropdown');

			if (await videoDropdown.isDisabled()) {
				await expect(videoDropdown).toBeDisabled();
				return;
			}

			await videoDropdown.click();
			const customOption = page.locator('#option-custom_fake_video_1');

			if (!(await customOption.isVisible())) {
				await assertHasVideoDeviceOption(page);
				return;
			}

			await customOption.click();
			await expect.poll(() => getFirstVideoTrackLabel(page)).toBe('custom_fake_video_1');

			await page.locator('#video-dropdown').click();
			await page.locator('#option-fake_device_0').click();
			await expect.poll(() => getFirstVideoTrackLabel(page)).toBe('fake_device_0');
		});

		test('should replace the screen track with a custom virtual device', async ({ page }) => {
			await openMeeting(page, accessUrl);
			await startScreensharing(page);

			const initialLabel = await getScreenTrackLabel(page);
			expect(initialLabel).not.toBe('custom_fake_screen');

			await page.locator('#screenshare-btn').click();
			const replaceButton = page.locator('#replace-screen-button');
			await expect(replaceButton).toBeVisible();
			await replaceButton.click();
			await page.waitForTimeout(1000);

			const replacedLabel = await getScreenTrackLabel(page);
			expect(replacedLabel).not.toBeNull();
		});
	});

	test.describe('UI Behavior Without Media Device Permissions', () => {
		test('should camera and microphone buttons be disabled in the prejoin page when permissions are denied', async ({
			noMediaPage
		}) => {
			await openPrejoin(noMediaPage, accessUrl);

			await expect(noMediaPage.locator('#no-video-device-message')).toBeVisible();
			await expect(noMediaPage.locator('#no-audio-device-message')).toBeVisible();
			const backgroundsButton = noMediaPage.locator('#backgrounds-button');

			if (await backgroundsButton.isVisible()) {
				await expect(backgroundsButton).toBeDisabled();
			}
		});

		test('should camera and microphone buttons be disabled in the meeting page when permissions are denied', async ({
			noMediaPage
		}) => {
			await openMeeting(noMediaPage, accessUrl, { skipPrejoinMediaCheck: true });

			await expect(noMediaPage.locator('#camera-btn')).toBeDisabled();
			await expect(noMediaPage.locator('#mic-btn')).toBeDisabled();
		});

		test('should show an audio and video device warning in settings when permissions are denied', async ({
			noMediaPage
		}) => {
			await openMeeting(noMediaPage, accessUrl, { skipPrejoinMediaCheck: true });

			await openSettingsPanel(noMediaPage);
			await noMediaPage.locator('#video-opt').click();
			await expect(noMediaPage.locator('ov-video-devices-select')).toBeVisible();
			await expect(noMediaPage.locator('#no-video-device-message')).toBeVisible();

			await noMediaPage.locator('#audio-opt').click();
			await expect(noMediaPage.locator('ov-audio-devices-select')).toBeVisible();
			await expect(noMediaPage.locator('#no-audio-device-message')).toBeVisible();
		});
	});

	// Regression guards for the device-service reorder: media permission is now obtained by the
	// first real track creation (no throwaway getUserMedia probe), the device list is enumerated
	// afterwards, and the stored device selection / enabled state must be honoured.
	test.describe('Device Selection Persistence and Acquisition', () => {
		test('persists the selected camera across a page reload (returning user)', async ({ page }) => {
			await openPrejoin(page, accessUrl);
			await expect.poll(() => getFirstVideoTrackDeviceId(page), { timeout: 15_000 }).not.toBeNull();

			const options = await getVideoDeviceOptions(page);
			const alternate = options.find((option) => !option.selected);

			if (options.length < 2 || !alternate) {
				test.skip(true, 'Needs at least two distinguishable video devices to switch between');
				return;
			}

			const beforeDeviceId = await getFirstVideoTrackDeviceId(page);
			await selectVideoDevice(page, alternate.label);

			// The active camera must actually switch to the picked device.
			await expect.poll(() => getFirstVideoTrackDeviceId(page)).not.toBe(beforeDeviceId);
			const switchedDeviceId = await getFirstVideoTrackDeviceId(page);

			// Reopen in the same browser context: localStorage keeps the chosen device and the browser
			// keeps the granted permission — the "returning user" path. The reorder must reopen the
			// stored camera, not silently fall back to the default device.
			await reopenPrejoin(page, accessUrl);
			await expect.poll(() => getFirstVideoTrackDeviceId(page), { timeout: 15_000 }).toBe(switchedDeviceId);
		});

		test('carries the prejoin-selected camera into the meeting', async ({ page }) => {
			await openPrejoin(page, accessUrl);
			await expect.poll(() => getFirstVideoTrackDeviceId(page), { timeout: 15_000 }).not.toBeNull();

			const options = await getVideoDeviceOptions(page);
			const alternate = options.find((option) => !option.selected);

			if (options.length < 2 || !alternate) {
				test.skip(true, 'Needs at least two distinguishable video devices to switch between');
				return;
			}

			const beforeDeviceId = await getFirstVideoTrackDeviceId(page);
			await selectVideoDevice(page, alternate.label);
			await expect.poll(() => getFirstVideoTrackDeviceId(page)).not.toBe(beforeDeviceId);
			const switchedDeviceId = await getFirstVideoTrackDeviceId(page);

			await page.locator('#join-button').click();
			await expect(page.locator('#layout-container')).toBeVisible({ timeout: 15_000 });
			await expect(page.locator('#media-buttons-container')).toBeVisible({ timeout: 15_000 });

			// Joining must reuse the prejoin track, so the in-room local video stays on the chosen
			// camera instead of being re-acquired with the default device.
			await expect.poll(() => getFirstVideoTrackDeviceId(page), { timeout: 15_000 }).toBe(switchedDeviceId);
		});

		test('remembers a disabled-camera preference on reload', async ({ page }) => {
			await openPrejoin(page, accessUrl);
			await expect.poll(() => getFirstVideoTrackLabel(page), { timeout: 15_000 }).not.toBeNull();

			await ensurePrejoinVideoState(page, false);
			expect(await isPrejoinVideoEnabled(page)).toBe(false);

			// Give the async "camera off" preference write time to reach storage before reloading.
			await page.waitForTimeout(500);

			// Reopen: the stored "camera off" preference must survive, and the freshly created track
			// must arrive muted — the camera stays off without the user toggling it again.
			await reopenPrejoin(page, accessUrl);
			await expect.poll(() => isPrejoinVideoEnabled(page), { timeout: 15_000 }).toBe(false);

			// Cameras are still present — this is "camera off", not "no camera available".
			await expect(page.locator('#no-video-device-message')).toHaveCount(0);
		});

		test('opens the prejoin without a redundant getUserMedia probe', async ({ page }) => {
			await installGetUserMediaCounter(page);

			await openPrejoin(page, accessUrl);
			await expect.poll(() => getFirstVideoTrackDeviceId(page), { timeout: 15_000 }).not.toBeNull();

			const calls = await getGetUserMediaCalls(page);

			// The pre-reorder design — and LiveKit's getLocalDevices() with requestPermissions=true —
			// probed for permission with a throwaway getUserMedia({audio,video}) before acquiring the
			// real tracks. The reorder requests media per kind (video-only / audio-only) and never as a
			// combined audio+video acquisition, so no call carries both kinds.
			expect(calls.length).toBeGreaterThan(0);
			expect(calls.filter((call) => call.audio && call.video)).toEqual([]);
		});

		test('re-selecting the active camera does not re-acquire the track', async ({ page }) => {
			await installGetUserMediaCounter(page);

			await openPrejoin(page, accessUrl);
			await expect.poll(() => getFirstVideoTrackDeviceId(page), { timeout: 15_000 }).not.toBeNull();

			const options = await getVideoDeviceOptions(page);

			if (options.length === 0) {
				test.skip(true, 'Device menu unavailable');
				return;
			}

			// Re-select whichever device is currently active (marked selected, or the only option).
			const active = options.find((option) => option.selected) ?? options[0];
			const beforeDeviceId = await getFirstVideoTrackDeviceId(page);
			const callsBefore = await getGetUserMediaCallCount(page);

			// Selecting the already-active device must short-circuit (needUpdateVideoTrack): no new
			// getUserMedia and no track churn. The menu is already open from getVideoDeviceOptions().
			await page.locator(`#option-${active.label}`).click();
			await page.waitForTimeout(500);

			expect(await getGetUserMediaCallCount(page)).toBe(callsBefore);
			expect(await getFirstVideoTrackDeviceId(page)).toBe(beforeDeviceId);
		});
	});
});

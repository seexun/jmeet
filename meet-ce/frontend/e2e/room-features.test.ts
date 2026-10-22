import { expect, test } from '@playwright/test';
import { applyBackgroundEffect, openRoomBackgroundsPanel } from './helpers/media-controls.helper';
import { createRoomAndGetAnonymousAccessUrl, deleteRooms } from './helpers/meet-api.helper';
import { leaveMeeting, openMeeting } from './helpers/meeting-navigation.helper';
import { openMoreOptionsMenu, toggleActivitiesPanel } from './helpers/panels.helper';
import { expectHidden, expectVisible } from './helpers/ui-utils.helper';

test.describe('Room UI Features E2E Tests', () => {
	const createdRoomIds: string[] = [];

	test.afterAll(async () => {
		await deleteRooms(createdRoomIds);
	});

	test.describe('Chat Feature', () => {
		test('should show chat button when chat is enabled', async ({ page }) => {
			const { room, accessUrl } = await createRoomAndGetAnonymousAccessUrl({
				config: { chat: { enabled: true } }
			});
			createdRoomIds.push(room.roomId);

			await openMeeting(page, accessUrl);
			await expectVisible(page, '#chat-panel-btn');
		});

		test('should hide chat button when chat is disabled', async ({ page }) => {
			const { room, accessUrl } = await createRoomAndGetAnonymousAccessUrl({
				config: { chat: { enabled: false } }
			});
			createdRoomIds.push(room.roomId);

			await openMeeting(page, accessUrl);
			await expectHidden(page, '#chat-panel-btn');
		});
	});

	test.describe('Recording Feature', () => {
		test('should show recording controls in activities panel when recording is enabled', async ({ page }) => {
			const { room, accessUrl } = await createRoomAndGetAnonymousAccessUrl({
				config: { recording: { enabled: true } }
			});
			createdRoomIds.push(room.roomId);

			await openMeeting(page, accessUrl);

			await toggleActivitiesPanel(page);
			await expectVisible(page, '#whiteboard-button');
			await expectVisible(page, 'ov-recording-activity');
		});

		test('should hide recording activity but keep apps panel when recording is disabled', async ({ page }) => {
			const { room, accessUrl } = await createRoomAndGetAnonymousAccessUrl({
				config: { recording: { enabled: false } }
			});
			createdRoomIds.push(room.roomId);

			await openMeeting(page, accessUrl);

			await toggleActivitiesPanel(page);
			await expectVisible(page, '#whiteboard-button');
			await expectHidden(page, 'ov-recording-activity');
		});
	});

	test.describe('Virtual Background Feature', () => {
		test('should show virtual background button when enabled', async ({ page }) => {
			const { room, accessUrl } = await createRoomAndGetAnonymousAccessUrl({
				config: { virtualBackground: { enabled: true } }
			});
			createdRoomIds.push(room.roomId);

			await openMeeting(page, accessUrl);

			await openRoomBackgroundsPanel(page);
			await expectVisible(page, '#background-effects-container');
		});

		test('should hide virtual background button when disabled', async ({ page }) => {
			const { room, accessUrl } = await createRoomAndGetAnonymousAccessUrl({
				config: { virtualBackground: { enabled: false } }
			});
			createdRoomIds.push(room.roomId);

			await openMeeting(page, accessUrl);

			await openMoreOptionsMenu(page);
			await expectHidden(page, '#virtual-bg-btn');
		});

		test('should not apply virtual background when saved in local storage and feature is disabled', async ({
			page
		}) => {
			// Step 1: Join a room with VB enabled and apply a background (saves preference to localStorage)
			const { room: room1, accessUrl: accessUrl1 } = await createRoomAndGetAnonymousAccessUrl({
				config: { virtualBackground: { enabled: true } }
			});
			createdRoomIds.push(room1.roomId);

			await openMeeting(page, accessUrl1);
			await openRoomBackgroundsPanel(page);
			await applyBackgroundEffect(page, 'professional-1');
			await leaveMeeting(page);

			// Step 2: Join a room with VB disabled and verify the saved preference is not applied
			const { room: room2, accessUrl: accessUrl2 } = await createRoomAndGetAnonymousAccessUrl({
				config: { virtualBackground: { enabled: false } }
			});
			createdRoomIds.push(room2.roomId);

			await openMeeting(page, accessUrl2);
			await expect(page.locator('#background-effects-container')).toHaveCount(0);

			await openMoreOptionsMenu(page);
			await expectHidden(page, '#virtual-bg-btn');
		});
	});
});

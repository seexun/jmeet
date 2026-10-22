import { expect, test } from '@playwright/test';
import { createRoomAndGetAnonymousAccessUrl, deleteRooms } from './helpers/meet-api.helper';
import { openMeeting } from './helpers/meeting-navigation.helper';
import { toggleParticipantsPanel } from './helpers/panels.helper';

/**
 * The connection-quality badge is surfaced only transiently: when LiveKit reports a
 * quality for the local participant — under e2e's fake media this is consistently
 * "excellent" — the badge appears and then auto-hides after a short delay (the
 * component's BADGE_TIMEOUT, 3s).
 *
 * These tests just assert that appear → auto-hide cycle in the two places the indicator
 * is rendered: the local video tile (stream component) and the participants panel. They
 * don't force any specific quality value, so they need no dev-only debug API and no
 * app-side test hooks — they run against the production build CI serves.
 */
test.describe('Connection Quality Indicator E2E Tests', () => {
	const createdRoomIds: string[] = [];

	let accessUrl: string;

	test.beforeEach(async () => {
		const { room, accessUrl: url } = await createRoomAndGetAnonymousAccessUrl();
		accessUrl = url;
		createdRoomIds.push(room.roomId);
	});

	test.afterAll(async () => {
		await deleteRooms(createdRoomIds);
	});

	test('shows the badge on the local video tile, then auto-hides it', async ({ page }) => {
		await openMeeting(page, accessUrl, { videoEnabled: true, audioEnabled: true });

		const badge = page.locator('.OV_stream.local #connection-quality-badge');
		await expect(badge).toBeVisible({ timeout: 15_000 });
		await expect(badge).toBeHidden({ timeout: 10_000 });
	});

	test('shows the badge in the participants panel, then auto-hides it', async ({ page }) => {
		await openMeeting(page, accessUrl, { videoEnabled: true, audioEnabled: true });
		await toggleParticipantsPanel(page);

		const badge = page.locator('.local-participant-container #connection-quality-badge');
		await expect(badge).toBeVisible({ timeout: 15_000 });
		await expect(badge).toBeHidden({ timeout: 10_000 });
	});
});

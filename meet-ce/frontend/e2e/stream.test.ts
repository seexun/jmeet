import { expect, test } from '@playwright/test';
import { type LayoutBox } from './helpers/layout.helper';
import {
	muteRemoteParticipant,
	startScreensharing,
	stopScreensharing,
	toggleCamera,
	toggleMicrophone,
	unmuteRemoteParticipant
} from './helpers/media-controls.helper';
import { createRoomAndGetAnonymousAccessUrl, deleteRooms } from './helpers/meet-api.helper';
import { leaveMeeting, openMeeting } from './helpers/meeting-navigation.helper';
import { disconnectAllBrowserFakeParticipants, joinParticipants } from './helpers/participant-management.helper';
import {
	clickZoomControl,
	countMutedRemoteAudios,
	dockStream,
	dragStream,
	expectLocalStreamCount,
	expectScreenShareCount,
	expectStreamCount,
	floatStream,
	getZoomControlOrder,
	hoverScreenShareStream,
	readZoomPercent,
	resizeStream,
	screenShareStream,
	waitForRemoteStream,
	waitForVisibleRemoteParticipants,
	zoomInScreenShare
} from './helpers/stream.helper';
import { getElementBoundingBox, hoverStream } from './helpers/ui-utils.helper';

test.describe('Stream E2E Tests', () => {
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
		await Promise.all([disconnectAllBrowserFakeParticipants(), deleteRooms(createdRoomIds)]);
	});

	test.describe('Stream rendering - Single participant scenarios', () => {
		test('should render video element when joining with video enabled', async ({ page }) => {
			await openMeeting(page, accessUrl, { videoEnabled: true, audioEnabled: true });
			await expectStreamCount(page, 1);
			await expectLocalStreamCount(page, { video: 1, audio: 0 });
		});

		test('should keep local media elements rendered when joining with video disabled', async ({ page }) => {
			await openMeeting(page, accessUrl, { videoEnabled: false, audioEnabled: true });
			await expectStreamCount(page, 1);
			await expectLocalStreamCount(page, { video: 1, audio: 0 });
		});

		test('should keep local media elements rendered when joining with audio disabled', async ({ page }) => {
			await openMeeting(page, accessUrl, { videoEnabled: true, audioEnabled: false });
			await expectStreamCount(page, 1);
			await expectLocalStreamCount(page, { video: 1, audio: 0 });
		});

		test('should toggle microphone off and on', async ({ page }) => {
			await openMeeting(page, accessUrl, { videoEnabled: true, audioEnabled: true });
			await expectLocalStreamCount(page, { video: 1, audio: 0 });

			// Toggle off
			await toggleMicrophone(page);
			await page.waitForTimeout(500);
			await expectLocalStreamCount(page, { video: 1, audio: 0 });

			// Toggle back on
			await toggleMicrophone(page);
			await page.waitForTimeout(500);
			await expectLocalStreamCount(page, { video: 1, audio: 0 });
		});

		test('should add screen share when sharing with all media enabled', async ({ page }) => {
			await openMeeting(page, accessUrl, { videoEnabled: true, audioEnabled: true });
			await expectStreamCount(page, 1);

			await startScreensharing(page);
			await expect(page.locator('.local_participant.OV_screen')).toBeVisible();
			await expectStreamCount(page, 2);
			await expectScreenShareCount(page, 1);

			await stopScreensharing(page);
			await expectStreamCount(page, 1);
			await expectScreenShareCount(page, 0);
		});

		test('should add screen share even when video is disabled', async ({ page }) => {
			await openMeeting(page, accessUrl, { videoEnabled: false, audioEnabled: true });
			await expectStreamCount(page, 1);

			await startScreensharing(page);
			await expect(page.locator('.local_participant.OV_screen')).toBeVisible();
			await expectStreamCount(page, 2);
			await expectScreenShareCount(page, 1);

			await stopScreensharing(page);
			await expectStreamCount(page, 1);
			await expectScreenShareCount(page, 0);
		});

		test('should add screen share even when audio is disabled', async ({ page }) => {
			await openMeeting(page, accessUrl, { videoEnabled: true, audioEnabled: false });
			await expectStreamCount(page, 1);

			await startScreensharing(page);
			await expect(page.locator('.local_participant.OV_screen')).toBeVisible();
			await expectStreamCount(page, 2);
			await expectScreenShareCount(page, 1);

			await stopScreensharing(page);
			await expectStreamCount(page, 1);
			await expectScreenShareCount(page, 0);
		});

		test('should add screen share even when all media is disabled', async ({ page }) => {
			await openMeeting(page, accessUrl, { videoEnabled: false, audioEnabled: false });
			await expectStreamCount(page, 1);

			await startScreensharing(page);
			await expect(page.locator('.OV_screen .local')).toBeVisible();
			await expectStreamCount(page, 2);
			await expectScreenShareCount(page, 1);

			await stopScreensharing(page);
			await expectStreamCount(page, 1);
			await expectScreenShareCount(page, 0);
		});
	});

	test.describe('Stream rendering - Multi participant scenarios', () => {
		test('should render both participant streams', async ({ browser }) => {
			const { pages, removeAllParticipants } = await joinParticipants(browser, {
				roomId,
				accessUrl,
				participants: [{ name: 'participant-0' }, { name: 'participant-1', headless: true }]
			});
			const [pageA, pageB] = pages;

			try {
				await expectStreamCount(pageA, 2);
				await expectStreamCount(pageB, 2);
			} finally {
				await removeAllParticipants();
			}
		});

		test('should handle screen share from muted participant to other participant', async ({ browser }) => {
			const { pages, removeAllParticipants } = await joinParticipants(browser, {
				roomId,
				accessUrl,
				participants: [{ name: 'participant-0' }, { name: 'participant-1', headless: true }]
			});
			const [pageA, pageB] = pages;

			try {
				await expectStreamCount(pageA, 2);
				await expectStreamCount(pageB, 2);

				// B shares screen
				await startScreensharing(pageB);
				await expect(pageB.locator('.OV_screen .local')).toBeVisible();
				await expectStreamCount(pageB, 3);
				await expectStreamCount(pageA, 3);
				await expectScreenShareCount(pageB, 1);
				await expectScreenShareCount(pageA, 1);

				await stopScreensharing(pageB);
				await expectStreamCount(pageB, 2);
				await expectStreamCount(pageA, 2);
				await expectScreenShareCount(pageB, 0);
				await expectScreenShareCount(pageA, 0);
			} finally {
				await removeAllParticipants();
			}
		});

		test('should handle screen share with full media enabled', async ({ browser }) => {
			const { pages, removeAllParticipants } = await joinParticipants(browser, {
				roomId,
				accessUrl,
				participants: [{ name: 'participant-0' }, { name: 'participant-1', headless: true }]
			});
			const [pageA, pageB] = pages;

			try {
				await expectStreamCount(pageA, 2);
				await expectStreamCount(pageB, 2);

				// B shares screen
				await startScreensharing(pageB);
				await expect(pageB.locator('.OV_screen .local')).toBeVisible();
				await expectStreamCount(pageB, 3);
				await expectStreamCount(pageA, 3);
				await expectScreenShareCount(pageB, 1);
				await expectScreenShareCount(pageA, 1);

				await stopScreensharing(pageB);
				await expectStreamCount(pageB, 2);
				await expectStreamCount(pageA, 2);
			} finally {
				await removeAllParticipants();
			}
		});

		test('should sync remote participant media state changes', async ({ browser }) => {
			const { pages, removeAllParticipants } = await joinParticipants(browser, {
				roomId,
				accessUrl,
				participants: [{ name: 'participant-0' }, { name: 'participant-1', headless: true }]
			});
			const [pageA, pageB] = pages;

			try {
				// Both have video and audio
				await expect(pageA.locator('.OV_publisher .OV_stream_video.local .OV_video-element')).toHaveCount(1);
				await expect(pageA.locator('.OV_stream.remote .OV_video-element')).toHaveCount(1);

				// pageB disables camera
				await toggleCamera(pageB);
				await pageB.waitForTimeout(1000);

				// pageA should see pageB's video poster
				await expect(pageA.locator('.OV_stream.remote .participant-avatar > .poster')).toHaveCount(1);

				// pageB re-enables camera
				await toggleCamera(pageB);
				await pageB.waitForTimeout(1000);

				// pageA should see pageB's video restored
				await expect(pageA.locator('.OV_stream.remote ov-participant-avatar > .poster')).toHaveCount(0);
			} finally {
				await removeAllParticipants();
			}
		});
	});

	test.describe('Stream rendering - Three or more participants', () => {
		test('should render three participant streams when three join', async ({ browser }) => {
			const { pages, removeAllParticipants } = await joinParticipants(browser, {
				roomId,
				accessUrl,
				participants: [
					{ name: 'participant-0' },
					{ name: 'participant-1', headless: true },
					{ name: 'participant-2', headless: true }
				]
			});

			try {
				// Each participant sees the other 2 as remote streams and their own as local stream (total 3)
				await Promise.all(pages.map((page) => expectStreamCount(page, 3)));
			} finally {
				await removeAllParticipants();
			}
		});

		test('should handle participant leaving and streams being removed', async ({ browser }) => {
			const { pages, removeAllParticipants } = await joinParticipants(browser, {
				roomId,
				accessUrl,
				participants: [
					{ name: 'participant-0' },
					{ name: 'participant-1', headless: true },
					{ name: 'participant-2', headless: true }
				]
			});
			const [pageA, pageB, pageC] = pages;

			try {
				// Each participant sees the other 2 as remote streams and their own as local stream (total 3)
				await Promise.all(pages.map((page) => expectStreamCount(page, 3)));

				// C leaves
				await leaveMeeting(pageC);
				await pageB.waitForTimeout(1000);

				// A and B each now see only the other as a remote stream (total 2)
				await Promise.all([pageA, pageB].map((page) => expectStreamCount(page, 2)));
			} finally {
				await removeAllParticipants();
			}
		});

		test('should maintain stream order after rapid joins/leaves', async ({ browser }) => {
			const { pages, removeAllParticipants } = await joinParticipants(browser, {
				roomId,
				accessUrl,
				participants: [
					{ name: 'participant-0' },
					{ name: 'participant-1', headless: true },
					{ name: 'participant-2', headless: true }
				]
			});
			const [pageA, pageB] = pages;

			try {
				// B leaves
				await leaveMeeting(pageB);
				await pageA.waitForTimeout(500);

				// A should now see only C's stream (total 2)
				await expectStreamCount(pageA, 2);

				// B rejoins
				await openMeeting(pageB, accessUrl);

				// Back to seeing both B and C as remote streams (total 3)
				await expectStreamCount(pageA, 3);
			} finally {
				await removeAllParticipants();
			}
		});

		test('should handle rapid video/audio toggles from multiple participants', async ({ browser }) => {
			const { pages, removeAllParticipants } = await joinParticipants(browser, {
				roomId,
				accessUrl,
				participants: [{ name: 'participant-0' }, { name: 'participant-1', headless: true }]
			});
			const [pageA, pageB] = pages;

			try {
				// Both have 2 streams with video
				await expect(pageA.locator('.OV_publisher .OV_stream_video.local .OV_video-element')).toHaveCount(1);
				await expect(pageA.locator('.OV_stream.remote .OV_video-element')).toHaveCount(1);

				// Rapid toggles on A
				await toggleCamera(pageA);
				await pageA.waitForTimeout(100);
				await toggleCamera(pageA);
				await pageA.waitForTimeout(100);

				// Should still have 2 video streams
				await expect(pageA.locator('.OV_stream .OV_video-element')).toHaveCount(2);

				// Rapid toggles on B simultaneously
				await toggleCamera(pageB);
				await pageB.waitForTimeout(100);
				await toggleCamera(pageB);

				// A should still see remote video
				await expect(pageA.locator('.OV_stream.remote .OV_video-element')).toHaveCount(1);
			} finally {
				await removeAllParticipants();
			}
		});
	});

	test.describe('Stream UI controls - Float and dock', () => {
		test('should show the FLOAT button ONLY over the LOCAL video', async ({ page }) => {
			await openMeeting(page, accessUrl);
			await expectStreamCount(page, 1);

			// Hover over local stream - float button should appear
			await hoverStream(page, '.OV_publisher .OV_stream_video.local');
			await expect(page.locator('#float-btn')).toBeVisible();

			// Create second participant to verify float button doesn't appear on remote
			const pageB = await page.context().newPage();
			await openMeeting(pageB, accessUrl);
			await waitForRemoteStream(pageB);

			// Hover over remote stream - float button should NOT appear
			await hoverStream(pageB, '.OV_stream_video.remote');
			await expect(pageB.locator('#float-btn')).toHaveCount(0);

			// Hover over local stream - float button should appear
			await hoverStream(pageB, '.OV_stream_video.local');
			await expect(pageB.locator('#float-btn')).toBeVisible();

			await pageB.close();
		});

		test('should NOT show the FLOAT button on the local SCREEN SHARE tile', async ({ page }) => {
			await openMeeting(page, accessUrl, { videoEnabled: true, audioEnabled: true });
			await startScreensharing(page);
			await expectScreenShareCount(page, 1);

			// The local screen-share tile must not offer float/dock — that's a camera self-view affordance.
			const screenContainer = page.locator('.local_participant.OV_screen').first();
			await expect(screenContainer).toBeVisible({ timeout: 10_000 });
			await screenContainer.hover();
			await expect(screenContainer.locator('#float-btn')).toHaveCount(0);

			// …but the local CAMERA tile still shows it.
			const cameraContainer = page.locator('.local_participant:not(.OV_screen)').first();
			await cameraContainer.hover();
			await expect(cameraContainer.locator('#float-btn')).toBeVisible();

			await stopScreensharing(page);
			await page.close();
		});

		test('should label the LOCAL screen-share tile as "(your screen)" while remote viewers see "(screen)"', async ({
			page
		}) => {
			await openMeeting(page, accessUrl, { name: 'sharer', videoEnabled: true, audioEnabled: true });
			await startScreensharing(page);
			await expectScreenShareCount(page, 1);

			// The local screen-share tile is labelled "(your screen)", not "(screen)".
			const localScreen = screenShareStream(page);
			await expect(localScreen).toBeVisible({ timeout: 10_000 });
			await expect(localScreen.locator('.participant-screen-label')).toHaveText('(your screen)');

			// A remote viewer still sees the sharer's screen labelled "(screen)".
			const pageB = await page.context().newPage();
			await openMeeting(pageB, accessUrl, { name: 'viewer' });
			await waitForVisibleRemoteParticipants(pageB, { includes: ['sharer (screen)'] });

			await stopScreensharing(page);
			await pageB.close();
			await page.close();
		});

		test('should float the LOCAL video', async ({ page }) => {
			await openMeeting(page, accessUrl);

			// Get initial stream dimensions
			const localContainer = page.locator('.local_participant:has(.OV_stream_video.local)').first();
			const initialBox = await getElementBoundingBox(page, '.local_participant .OV_stream_video.local');
			expect(initialBox).not.toBeNull();

			// Hover and click float
			await floatStream(page);
			await page.waitForTimeout(1000);

			// Verify stream is floating
			await expect(localContainer).toHaveClass(/OV_floating/);
			const floatingBox = await getElementBoundingBox(page, '.local_participant .OV_stream_video.local');
			expect(floatingBox).not.toBeNull();

			// Video should be positioned at the bottom-right corner of the layout
			const layoutBox = await getElementBoundingBox(page, '#layout');
			expect(layoutBox).not.toBeNull();
			// Flush to the right edge (within the 5px margin) and the bottom, not the left.
			expect(floatingBox!.x + floatingBox!.width).toBeCloseTo(layoutBox!.x + layoutBox!.width - 5, -1);
			expect(floatingBox!.x).toBeGreaterThan(layoutBox!.x + 100);
			expect(floatingBox!.y + floatingBox!.height).toBeCloseTo(layoutBox!.y + layoutBox!.height, -1);
			// Floats at the minimum allowed size (~160px wide).
			expect(floatingBox!.width).toBeCloseTo(160, -1);
			expect(floatingBox!.height).toBeGreaterThan(0);

			await page.close();
		});

		test('should DOCK the local video (restore to layout)', async ({ page }) => {
			await openMeeting(page, accessUrl);

			const localContainer = page.locator('.local_participant:has(.OV_stream_video.local)').first();

			// Get initial stream dimensions
			const initialBox = await getElementBoundingBox(page, '.local_participant .OV_stream_video.local');
			expect(initialBox).not.toBeNull();

			// Float the stream
			await hoverStream(page, '.local_participant .OV_stream_video.local');
			await floatStream(page);
			await page.waitForTimeout(800);
			await expect(localContainer).toHaveClass(/OV_floating/);

			// Verify floating
			const floatingBox = await getElementBoundingBox(page, '.local_participant .OV_stream_video.local');
			expect(floatingBox).not.toBeNull();

			// Dock (restore) the stream
			await hoverStream(page, '.local_participant .OV_stream_video.local');
			await dockStream(page);
			await page.waitForTimeout(1500);
			await expect(localContainer).not.toHaveClass(/OV_floating/);

			// Verify stream is restored to layout
			const restoredBox = await getElementBoundingBox(page, '.local_participant .OV_stream_video.local');
			expect(restoredBox).not.toBeNull();

			// Restored video should be back at the top of the layout (far from bottom-right floating position)
			expect(restoredBox!.y).toBeLessThan(floatingBox!.y);
			expect(restoredBox!.width).toBeGreaterThan(floatingBox!.width);
			expect(restoredBox!.height).toBeGreaterThan(floatingBox!.height);

			await page.close();
		});

		test('should be able to drag the floating LOCAL video', async ({ page }) => {
			await openMeeting(page, accessUrl);

			// Float stream
			await hoverStream(page, '.local_participant .OV_stream_video.local');
			await floatStream(page);
			await page.waitForTimeout(500);

			const beforeDragBox = await getElementBoundingBox(page, '.local_participant .OV_stream_video.local');
			expect(beforeDragBox).not.toBeNull();

			// Drag to new position
			await dragStream(page, '.local_participant', 300, 300);
			await page.waitForTimeout(500);

			// Verify stream was dragged
			const streamBox = await getElementBoundingBox(page, '.local_participant .OV_stream_video.local');
			expect(streamBox).not.toBeNull();
			expect(Math.abs(streamBox!.x - beforeDragBox!.x)).toBeGreaterThan(40);
			expect(Math.abs(streamBox!.y - beforeDragBox!.y)).toBeGreaterThan(40);

			await page.close();
		});

		test('should be the FLOATING video ALWAYS VISIBLE when toggling panels', async ({ page }) => {
			await openMeeting(page, accessUrl);

			// Float stream
			await hoverStream(page, '.local_participant .OV_stream_video.local');
			await floatStream(page);
			await page.waitForTimeout(500);

			// Drag to right
			await dragStream(page, '.local_participant', 900, 0);
			await page.waitForTimeout(500);

			// Verify position after drag — video must remain fully visible inside the layout
			let streamBox = await getElementBoundingBox(page, '.local_participant .OV_stream_video.local');
			const layoutBox = await getElementBoundingBox(page, '#layout');
			expect(streamBox).not.toBeNull();
			expect(layoutBox).not.toBeNull();
			expect(streamBox!.y).toBeGreaterThanOrEqual(layoutBox!.y - 1);
			expect(streamBox!.y + streamBox!.height).toBeLessThanOrEqual(layoutBox!.y + layoutBox!.height + 1);

			// Open chat panel
			await page.locator('#chat-panel-btn').click();
			await page.waitForTimeout(1000);

			// Stream should adjust position when panel opens
			streamBox = await getElementBoundingBox(page, '.local_participant .OV_stream_video.local');
			expect(streamBox).not.toBeNull();
			const xWithPanelOpen = streamBox!.x;
			expect(xWithPanelOpen).toBeGreaterThanOrEqual(0);

			// Close chat panel
			await page.locator('#chat-panel-btn').click();
			await page.waitForTimeout(1000);

			// Stream should return to right side
			streamBox = await getElementBoundingBox(page, '.local_participant .OV_stream_video.local');
			expect(streamBox).not.toBeNull();
			expect(streamBox!.x).toBeGreaterThanOrEqual(xWithPanelOpen);

			await page.close();
		});

		test('should be the FLOATING video go to the right when panel closes', async ({ page }) => {
			await openMeeting(page, accessUrl);

			// Open chat panel first
			await page.locator('#chat-panel-btn').click();
			await page.waitForTimeout(1000);

			// Float stream
			await hoverStream(page, '.local_participant .OV_stream_video.local');
			await floatStream(page);
			await page.waitForTimeout(1000);

			// Drag to right
			await dragStream(page, '.local_participant', 600, 0);
			await page.waitForTimeout(1000);

			// Verify position after drag
			let streamBox = await getElementBoundingBox(page, '.local_participant .OV_stream_video.local');
			expect(streamBox).not.toBeNull();
			const draggedX = streamBox!.x;

			// Close chat panel
			await page.locator('#chat-panel-btn').click();
			await page.waitForTimeout(1000);

			// Stream should move to right
			streamBox = await getElementBoundingBox(page, '.local_participant .OV_stream_video.local');
			expect(streamBox).not.toBeNull();
			expect(streamBox!.x).toBeGreaterThanOrEqual(draggedX);

			await page.close();
		});

		test('should be the FLOATING video ALWAYS VISIBLE when toggling from small to bigger panel', async ({
			page
		}) => {
			await openMeeting(page, accessUrl);

			// Float stream
			await hoverStream(page, '.local_participant .OV_stream_video.local');
			await floatStream(page);
			await page.waitForTimeout(500);

			// Drag to right
			await dragStream(page, '.local_participant', 900, 0);
			await page.waitForTimeout(500);

			// Open chat panel
			await page.locator('#chat-panel-btn').click();
			await page.waitForTimeout(1000);
			let streamBox = await getElementBoundingBox(page, '.local_participant .OV_stream_video.local');
			expect(streamBox).not.toBeNull();
			const posXChat = streamBox!.x;

			// Open settings panel
			await page.locator('#more-options-btn').click();
			await expect(page.locator('.ant-dropdown-menu')).toBeVisible();
			await page.waitForTimeout(500);

			streamBox = await getElementBoundingBox(page, '.local_participant .OV_stream_video.local');
			expect(streamBox).not.toBeNull();
			const posXSettings = streamBox!.x;

			// Settings panel should push video further left
			expect(posXSettings).toBeLessThanOrEqual(posXChat);

			// Close all panels
			await page.keyboard.press('Escape');
			await page.waitForTimeout(500);

			// Stream should move back to right
			streamBox = await getElementBoundingBox(page, '.local_participant .OV_stream_video.local');
			expect(streamBox).not.toBeNull();
			expect(streamBox!.x).toBeGreaterThanOrEqual(posXSettings);

			await page.close();
		});

		test('should DOCK the local video after drag (reset position to layout)', async ({ page }) => {
			await openMeeting(page, accessUrl);

			await page.waitForTimeout(1000);
			// Get initial layout stream position
			const initialBox = await getElementBoundingBox(page, '.local_participant .OV_stream_video.local');
			expect(initialBox).not.toBeNull();

			// Float stream
			await hoverStream(page, '.local_participant .OV_stream_video.local');
			await floatStream(page);
			await page.waitForTimeout(500);

			// Drag to right
			await dragStream(page, '.local_participant', 300, 300);
			await page.waitForTimeout(500);

			// Verify stream was dragged — while floating it is the small (~160px) PiP tile.
			let streamBox = await getElementBoundingBox(page, '.local_participant .OV_stream_video.local');
			expect(streamBox).not.toBeNull();
			const floatedWidth = streamBox!.width;

			// Dock (restore)
			await hoverStream(page, '.local_participant .OV_stream_video.local');
			await dockStream(page);
			await page.waitForTimeout(1500);

			// Stream should be reset to the layout flow: back to its full in-layout tile size and row,
			// no longer the floating PiP nor stuck at the dragged float position. (Its x can differ from
			// the pre-float value because the mosaic re-centers the single tile — only size/row are stable.)
			streamBox = await getElementBoundingBox(page, '.local_participant .OV_stream_video.local');
			expect(streamBox).not.toBeNull();
			await expect(page.locator('.local_participant:has(.OV_stream_video.local)').first()).not.toHaveClass(
				/OV_floating/
			);
			expect(streamBox!.width).toBeGreaterThan(floatedWidth + 50);
			expect(streamBox!.width).toBeCloseTo(initialBox!.width, -1);
			expect(streamBox!.y).toBeCloseTo(initialBox!.y, -1);

			await page.close();
		});

		test('should keep the SCREEN SHARE fixed in the layout when floating and dragging the LOCAL video', async ({
			page
		}) => {
			await openMeeting(page, accessUrl, { videoEnabled: true, audioEnabled: true });
			await expectStreamCount(page, 1);

			// Start screen sharing — now the local participant has camera + screen streams
			await startScreensharing(page);
			await expect(page.locator('.local_participant.OV_screen')).toBeVisible();
			await expectStreamCount(page, 2);
			await expectScreenShareCount(page, 1);
			await page.waitForTimeout(500);

			const cameraContainer = page.locator('.local_participant:not(.OV_screen)').first();
			const screenContainer = page.locator('.local_participant.OV_screen').first();

			// Capture initial screen share position (baseline before any float)
			const initialScreenBox = await getElementBoundingBox(page, '.local_participant.OV_screen');
			expect(initialScreenBox).not.toBeNull();

			// Hover the LOCAL CAMERA (not the screen share) and click its scoped float button
			await cameraContainer.hover();
			const cameraFloatBtn = cameraContainer.locator('#float-btn');
			await expect(cameraFloatBtn).toBeVisible();
			await cameraFloatBtn.click();
			await page.waitForTimeout(1000);

			// Camera should be floating, screen share should NOT be floating
			await expect(cameraContainer).toHaveClass(/OV_floating/);
			await expect(screenContainer).not.toHaveClass(/OV_floating/);

			// Capture screen share position after camera float (this is the reference for drag invariance)
			const screenBoxAfterFloat = await getElementBoundingBox(page, '.local_participant.OV_screen');
			expect(screenBoxAfterFloat).not.toBeNull();

			// Screen share should still be visible and have non-zero dimensions
			expect(screenBoxAfterFloat!.width).toBeGreaterThan(0);
			expect(screenBoxAfterFloat!.height).toBeGreaterThan(0);

			// Record camera position before dragging
			const cameraBoxBeforeDrag = await getElementBoundingBox(page, '.local_participant:not(.OV_screen)');
			expect(cameraBoxBeforeDrag).not.toBeNull();

			// Drag the floating camera to a new position
			await dragStream(page, '.local_participant:not(.OV_screen)', 400, 300);
			await page.waitForTimeout(500);

			// Verify camera was actually moved — otherwise the screen-share invariance is trivial
			const cameraBoxAfterDrag = await getElementBoundingBox(page, '.local_participant:not(.OV_screen)');
			expect(cameraBoxAfterDrag).not.toBeNull();
			expect(Math.abs(cameraBoxAfterDrag!.x - cameraBoxBeforeDrag!.x)).toBeGreaterThan(40);
			expect(Math.abs(cameraBoxAfterDrag!.y - cameraBoxBeforeDrag!.y)).toBeGreaterThan(40);

			// Screen share position must NOT have changed because of the camera drag
			const screenBoxAfterDrag = await getElementBoundingBox(page, '.local_participant.OV_screen');
			expect(screenBoxAfterDrag).not.toBeNull();
			expect(screenBoxAfterDrag!.x).toBeCloseTo(screenBoxAfterFloat!.x, 0);
			expect(screenBoxAfterDrag!.y).toBeCloseTo(screenBoxAfterFloat!.y, 0);
			expect(screenBoxAfterDrag!.width).toBeCloseTo(screenBoxAfterFloat!.width, 0);
			expect(screenBoxAfterDrag!.height).toBeCloseTo(screenBoxAfterFloat!.height, 0);

			// Screen share must still NOT be floating after dragging the local video
			await expect(screenContainer).not.toHaveClass(/OV_floating/);

			await stopScreensharing(page);
			await page.close();
		});

		test('should AUTO-FLOAT the local video when the first remote participant joins', async ({ browser }) => {
			const { pages, removeAllParticipants } = await joinParticipants(browser, {
				roomId,
				accessUrl,
				participants: [{ name: 'participant-0' }, { name: 'participant-1', headless: true }]
			});
			const [pageA] = pages;

			try {
				// Wait until participant-0 sees the remote stream from participant-1
				await waitForRemoteStream(pageA);

				// Local video should have been auto-floated and placed at the bottom-right
				const localContainer = pageA.locator('.local_participant:has(.OV_stream_video.local)').first();
				await expect(localContainer).toHaveClass(/OV_floating/, { timeout: 5_000 });
				await pageA.waitForTimeout(500);

				const floatingBox = await getElementBoundingBox(pageA, '.local_participant .OV_stream_video.local');
				const layoutBox = await getElementBoundingBox(pageA, '#layout');
				expect(floatingBox).not.toBeNull();
				expect(layoutBox).not.toBeNull();
				expect(floatingBox!.x + floatingBox!.width).toBeCloseTo(layoutBox!.x + layoutBox!.width - 5, -1);
				expect(floatingBox!.x).toBeGreaterThan(layoutBox!.x + 100);
				expect(floatingBox!.y + floatingBox!.height).toBeCloseTo(layoutBox!.y + layoutBox!.height, -1);
			} finally {
				await removeAllParticipants();
			}
		});

		test('should reposition the AUTO-FLOATED local video when a panel opens so it is not hidden behind it', async ({
			browser
		}) => {
			const { pages, removeAllParticipants } = await joinParticipants(browser, {
				roomId,
				accessUrl,
				participants: [{ name: 'participant-0' }, { name: 'participant-1', headless: true }]
			});
			const [pageA] = pages;

			try {
				await waitForRemoteStream(pageA);

				// Local video auto-floated to the bottom-right corner.
				const localContainer = pageA.locator('.local_participant:has(.OV_stream_video.local)').first();
				await expect(localContainer).toHaveClass(/OV_floating/, { timeout: 5_000 });
				await pageA.waitForTimeout(1000);

				const beforeBox = await getElementBoundingBox(pageA, '.local_participant .OV_stream_video.local');
				expect(beforeBox).not.toBeNull();

				// Open a right-side panel WITHOUT dragging the tile first — this is the repro.
				await pageA.locator('#chat-panel-btn').click();
				await pageA.waitForTimeout(1500);

				// The panel shrinks the visible layout (#layout) from the right. The floating tile must
				// have followed that edge instead of being left hidden behind the panel.
				const layoutBox = await getElementBoundingBox(pageA, '#layout');
				const afterBox = await getElementBoundingBox(pageA, '.local_participant .OV_stream_video.local');
				expect(layoutBox).not.toBeNull();
				expect(afterBox).not.toBeNull();

				// Its right edge stays within the visible (panel-excluded) layout area…
				expect(afterBox!.x + afterBox!.width).toBeLessThanOrEqual(layoutBox!.x + layoutBox!.width + 5);
				// …i.e. it actually moved left when the panel opened.
				expect(afterBox!.x).toBeLessThan(beforeBox!.x - 20);
			} finally {
				await removeAllParticipants();
			}
		});

		test('should resize the floating LOCAL video using the SE corner handle', async ({ page }) => {
			await openMeeting(page, accessUrl);
			await floatStream(page);
			await page.waitForTimeout(500);

			const beforeBox = await page.locator('.local_participant:has(.OV_stream_video.local)').first().boundingBox();
			expect(beforeBox).not.toBeNull();

			await resizeStream(page, 'resize-se', 80, 45);
			await page.waitForTimeout(300);

			const afterBox = await page.locator('.local_participant:has(.OV_stream_video.local)').first().boundingBox();
			expect(afterBox).not.toBeNull();
			expect(afterBox!.width).toBeGreaterThan(beforeBox!.width);
			expect(afterBox!.height).toBeGreaterThan(beforeBox!.height);

			await page.close();
		});

		test('should maintain the 16:9 aspect ratio after resizing the floating video', async ({ page }) => {
			await openMeeting(page, accessUrl);
			await floatStream(page);
			await page.waitForTimeout(500);

			await resizeStream(page, 'resize-se', 100, 0);
			await page.waitForTimeout(300);

			const box = await page.locator('.local_participant:has(.OV_stream_video.local)').first().boundingBox();
			expect(box).not.toBeNull();

			const ratio = box!.width / box!.height;
			const expectedRatio = 16 / 9;
			// Allow 5% tolerance
			expect(Math.abs(ratio - expectedRatio) / expectedRatio).toBeLessThan(0.05);

			await page.close();
		});

		test('should RESET the floating video size to default after dock and re-float', async ({ page }) => {
			await openMeeting(page, accessUrl);
			await floatStream(page);
			await page.waitForTimeout(500);

			// Record the default floating size
			const defaultBox = await page.locator('.local_participant:has(.OV_stream_video.local)').first().boundingBox();
			expect(defaultBox).not.toBeNull();

			// Resize to a larger size
			await resizeStream(page, 'resize-se', 100, 56);
			await page.waitForTimeout(300);

			const resizedBox = await page.locator('.local_participant:has(.OV_stream_video.local)').first().boundingBox();
			expect(resizedBox!.width).toBeGreaterThan(defaultBox!.width + 50);

			// Dock then re-float
			await dockStream(page);
			await page.waitForTimeout(800);
			await floatStream(page);
			await page.waitForTimeout(500);

			// Size should be back to the default minimum (~160px wide)
			const resetBox = await page.locator('.local_participant:has(.OV_stream_video.local)').first().boundingBox();
			expect(resetBox).not.toBeNull();
			expect(Math.abs(resetBox!.width - defaultBox!.width)).toBeLessThan(20);
			expect(Math.abs(resetBox!.height - defaultBox!.height)).toBeLessThan(20);

			await page.close();
		});
	});

	test.describe('Stream UI controls - PIN and silence buttons', () => {
		test('should show the PIN button over the LOCAL video', async ({ page }) => {
			await openMeeting(page, accessUrl);

			await hoverStream(page, '.OV_publisher .OV_stream_video.local');
			await expect(page.locator('#pin-btn')).toBeVisible();

			await page.close();
		});

		test('should show the PIN button over the REMOTE video', async ({ browser }) => {
			const { pages, removeAllParticipants } = await joinParticipants(browser, {
				roomId,
				accessUrl,
				participants: [{ name: 'participant-0' }, { name: 'participant-1', headless: true }]
			});
			const [pageA] = pages;

			try {
				// Hover over remote stream
				await hoverStream(pageA, '.OV_stream.remote');
				await expect(pageA.locator('#pin-btn')).toBeVisible();
			} finally {
				await removeAllParticipants();
			}
		});

		test('should show the SILENCE button ONLY over the REMOTE video', async ({ browser }) => {
			const { pages, removeAllParticipants } = await joinParticipants(browser, {
				roomId,
				accessUrl,
				participants: [{ name: 'participant-0' }, { name: 'participant-1', headless: true }]
			});
			const [pageA] = pages;

			try {
				// Local stream should NOT have silence button
				await hoverStream(pageA, '.OV_publisher .OV_stream_video.local');
				await pageA.waitForTimeout(500);
				await expect(pageA.locator('.OV_publisher .OV_stream_video.local #mute-btn')).toHaveCount(0);

				// Remote stream should have silence button
				await hoverStream(pageA, '.OV_stream.remote');
				await expect(pageA.locator('#mute-btn')).toBeVisible();
			} finally {
				await removeAllParticipants();
			}
		});

		test('should NOT show the SILENCE button on a remote camera stream without an audio track', async ({
			browser
		}) => {
			const { pages, removeAllParticipants } = await joinParticipants(browser, {
				roomId,
				accessUrl,
				// participant-1 joins WITHOUT a microphone — `stopMicTrackOnMute: true` means no audio
				// publication ever reaches participant-0, so the silence button has nothing to mute.
				participants: [
					{ name: 'participant-0' },
					{ name: 'participant-1', headless: true, audioEnabled: false }
				]
			});
			const [pageA] = pages;

			try {
				const remoteCamera = pageA.locator('.OV_stream.remote.camera-source').first();
				await expect(remoteCamera).toBeVisible({ timeout: 10_000 });
				await remoteCamera.hover();
				await pageA.waitForTimeout(500);

				// PIN button still appears (no audio dependency)…
				await expect(remoteCamera.locator('#pin-btn')).toBeVisible();
				// …but the mute button must be hidden when there's no audio track to mute.
				await expect(remoteCamera.locator('#mute-btn')).toHaveCount(0);
			} finally {
				await removeAllParticipants();
			}
		});
	});

	test.describe('Audio detection - Speaking indicator', () => {
		test('should show the audio detection elements when participant is speaking', async ({ browser }) => {
			const { pages, removeAllParticipants } = await joinParticipants(browser, {
				roomId,
				accessUrl,
				participants: [{ name: 'participant-0' }, { name: 'participant-1', headless: true }]
			});
			const [pageA] = pages;

			try {
				// Wait for audio detection on remote stream (speaking indicator)
				await expect
					.poll(
						async () => {
							const count = await pageA.locator('.OV_stream.remote.speaking').count();
							return count >= 1;
						},
						{ timeout: 10_000 }
					)
					.toBeTruthy();
			} finally {
				await removeAllParticipants();
			}
		});
	});

	test.describe('Mute Participant - Local participant can mute remote audio', () => {
		test('should successfully mute remote participant audio for local user only', async ({ browser }) => {
			const { pages, removeAllParticipants } = await joinParticipants(browser, {
				roomId,
				accessUrl,
				participants: [{ name: 'participant-0' }, { name: 'participant-1', headless: true }]
			});
			const [pageA, pageB] = pages;

			try {
				// Wait for exactly 1 remote stream (placeholder with no-size may still be in DOM briefly)
				await expect(pageA.locator('.OV_stream.remote')).toHaveCount(1, { timeout: 10_000 });
				await expect(pageA.locator('.OV_stream.remote .OV_media-element')).toHaveCount(1);

				// Audio is managed by SmartLayoutComponent in a hidden <audio data-participant> element
				expect(await countMutedRemoteAudios(pageA)).toBe(0);

				// Mute the remote participant
				await muteRemoteParticipant(pageA, '.OV_stream.remote');
				await pageA.waitForTimeout(500);

				// Verify the persistent audio element is now muted
				expect(await countMutedRemoteAudios(pageA)).toBe(1);
				await expect(pageA.locator('.OV_stream.remote .status-icons #muted-forcibly')).toHaveCount(1);

				// Verify remote participant B can still hear themselves and send audio
				// (this is only a local mute, not affecting the remote participant's transmission)
				await expect(pageB.locator('.OV_stream.local')).toBeVisible();
				// No audio elements inside the local stream container
				await expect(pageB.locator('.OV_stream.local .OV_audio-element')).toHaveCount(0);

				// Unmute the remote participant
				await unmuteRemoteParticipant(pageA, '.OV_stream.remote');
				await pageA.waitForTimeout(500);

				// Verify the persistent audio element is unmuted again
				expect(await countMutedRemoteAudios(pageA)).toBe(0);
				await expect(pageA.locator('.OV_stream.remote .status-icons #muted-forcibly')).toHaveCount(0);
			} finally {
				await removeAllParticipants();
			}
		});

		test('should toggle mute state multiple times without issues', async ({ browser }) => {
			const { pages, removeAllParticipants } = await joinParticipants(browser, {
				roomId,
				accessUrl,
				participants: [{ name: 'participant-0' }, { name: 'participant-1', headless: true }]
			});
			const [pageA, pageB] = pages;

			try {
				// Perform multiple rapid mute/unmute toggles
				await muteRemoteParticipant(pageA, '.OV_stream.remote');
				await pageA.waitForTimeout(200);

				await unmuteRemoteParticipant(pageA, '.OV_stream.remote');
				await pageA.waitForTimeout(200);

				await muteRemoteParticipant(pageA, '.OV_stream.remote');
				await pageA.waitForTimeout(200);

				await unmuteRemoteParticipant(pageA, '.OV_stream.remote');
				await pageA.waitForTimeout(200);

				// Final state should be unmuted — audio lives in the hidden persistent audio layer
				expect(await countMutedRemoteAudios(pageA)).toBe(0);
				await expect(pageA.locator('.OV_stream.remote .OV_audio-element')).toHaveCount(0);

				// Verify remote stream is still visible and functional
				await expect(pageA.locator('.OV_stream.remote')).toBeVisible();
				await expect(pageB.locator('.OV_stream.local')).toBeVisible();
			} finally {
				await removeAllParticipants();
			}
		});

		test('should maintain mute state when switching between multiple remote participants', async ({ browser }) => {
			const { pages, removeAllParticipants } = await joinParticipants(browser, {
				roomId,
				accessUrl,
				participants: [
					{ name: 'participant-0' },
					{ name: 'participant-1', headless: true },
					{ name: 'participant-2', headless: true }
				]
			});
			const [pageA] = pages;

			try {
				// Verify A sees 2 remote streams
				await expect(pageA.locator('.OV_stream.remote')).toHaveCount(2);

				// Mute first remote stream (should be B)
				const firstRemote = pageA.locator('.OV_stream.remote').first();
				await firstRemote.hover();
				const firstSilenceBtn = firstRemote.locator('#mute-btn').first();
				await expect(firstSilenceBtn).toBeVisible();
				await firstSilenceBtn.click();
				await pageA.waitForTimeout(300);

				// Verify exactly 1 remote audio element is muted in the persistent audio layer
				expect(await countMutedRemoteAudios(pageA)).toBe(1);

				// Mute second remote stream (should be C)
				const secondRemote = pageA.locator('.OV_stream.remote').nth(1);
				await secondRemote.hover();
				const secondSilenceBtn = secondRemote.locator('#mute-btn').first();
				await expect(secondSilenceBtn).toBeVisible();
				await secondSilenceBtn.click();
				await pageA.waitForTimeout(300);

				// Verify both remote audio elements are muted in the persistent audio layer
				expect(await countMutedRemoteAudios(pageA)).toBe(2);
				await expect(pageA.locator('.OV_stream.remote .OV_audio-element')).toHaveCount(0);

				// Unmute first remote
				await firstRemote.hover();
				await firstSilenceBtn.click();
				await pageA.waitForTimeout(300);

				// Verify exactly 1 audio element is still muted (the second); the first is now unmuted
				expect(await countMutedRemoteAudios(pageA)).toBe(1);
			} finally {
				await removeAllParticipants();
			}
		});

		test('should toggle the MUTED icon on a remote SCREEN SHARE stream when clicking its mute button', async ({
			browser
		}) => {
			const { pages, removeAllParticipants } = await joinParticipants(browser, {
				roomId,
				accessUrl,
				participants: [{ name: 'participant-0' }, { name: 'participant-1', headless: true }]
			});
			const [pageA, pageB] = pages;

			try {
				// B starts screen sharing — A should see it as a remote screen-share stream
				await startScreensharing(pageB);
				await expectScreenShareCount(pageA, 1);
				await expectScreenShareCount(pageB, 1);

				const remoteScreenSelector = '.remote-participant.OV_screen .OV_stream.remote.screen-source';
				const remoteCameraSelector = '.remote-participant:not(.OV_screen) .OV_stream.remote.camera-source';
				await expect(pageA.locator(remoteScreenSelector)).toBeVisible({ timeout: 10_000 });
				await expect(pageA.locator(remoteCameraSelector)).toBeVisible({ timeout: 10_000 });

				const screenMutedIcon = pageA.locator(`${remoteScreenSelector} .status-icons #muted-forcibly`);
				const cameraMutedIcon = pageA.locator(`${remoteCameraSelector} .status-icons #muted-forcibly`);

				// Initially neither stream shows the muted icon
				await expect(screenMutedIcon).toHaveCount(0);
				await expect(cameraMutedIcon).toHaveCount(0);

				// Click mute on B's screen share — only the screen-share stream should show the icon.
				// The screen share behaves as an independent sub-stream of the participant, so the
				// camera stream's status must remain untouched.
				await muteRemoteParticipant(pageA, remoteScreenSelector);
				await pageA.waitForTimeout(500);
				await expect(screenMutedIcon).toHaveCount(1);
				await expect(screenMutedIcon).toBeVisible();
				await expect(cameraMutedIcon).toHaveCount(0);

				// Click mute again (unmute) — screen-share icon should disappear, camera still untouched
				await unmuteRemoteParticipant(pageA, remoteScreenSelector);
				await pageA.waitForTimeout(500);
				await expect(screenMutedIcon).toHaveCount(0);
				await expect(cameraMutedIcon).toHaveCount(0);

				// Now mute B's CAMERA stream — only the camera should show the icon
				await muteRemoteParticipant(pageA, remoteCameraSelector);
				await pageA.waitForTimeout(500);
				await expect(cameraMutedIcon).toHaveCount(1);
				await expect(cameraMutedIcon).toBeVisible();
				await expect(screenMutedIcon).toHaveCount(0);

				// Unmute the camera — both icons should now be absent
				await unmuteRemoteParticipant(pageA, remoteCameraSelector);
				await pageA.waitForTimeout(500);
				await expect(cameraMutedIcon).toHaveCount(0);
				await expect(screenMutedIcon).toHaveCount(0);
			} finally {
				await removeAllParticipants();
			}
		});
	});

	test.describe('Stream UI controls - Screen-share zoom', () => {
		test('should show ONLY the zoom-in button before any zoom is applied', async ({ page }) => {
			await openMeeting(page, accessUrl, { videoEnabled: true, audioEnabled: true });
			await startScreensharing(page);

			const container = await hoverScreenShareStream(page);

			// At 1x, zoom-in is the single zoom control…
			await expect(container.locator('#zoom-in-btn')).toBeVisible();
			// …zoom-out, reset and the percentage label must NOT exist until the stream is zoomed.
			await expect(container.locator('#zoom-out-btn')).toHaveCount(0);
			await expect(container.locator('#reset-zoom-btn')).toHaveCount(0);
			await expect(container.locator('#zoom-level')).toHaveCount(0);

			await page.close();
		});

		test('should reveal zoom-out, reset and the percentage label after zooming in', async ({ page }) => {
			await openMeeting(page, accessUrl, { videoEnabled: true, audioEnabled: true });
			await startScreensharing(page);

			await zoomInScreenShare(page, 1);
			const container = screenShareStream(page);

			await expect(container.locator('#reset-zoom-btn')).toBeVisible();
			await expect(container.locator('#zoom-out-btn')).toBeVisible();
			await expect(container.locator('#zoom-in-btn')).toBeVisible();
			// The percentage label is now shown and reflects a zoom above the 1x (100%) base.
			await expect(container.locator('#zoom-level')).toBeVisible();
			await expect(container.locator('#zoom-level')).toHaveText(/^\d+%$/);
			expect(await readZoomPercent(page)).toBeGreaterThan(100);

			await page.close();
		});

		test('should order the zoom group as reset, zoom-out, percentage, zoom-in', async ({ page }) => {
			await openMeeting(page, accessUrl, { videoEnabled: true, audioEnabled: true });
			await startScreensharing(page);

			await zoomInScreenShare(page, 1);

			// Reset sits to the LEFT of zoom-out, and the percentage label sits BETWEEN
			// the zoom-out and zoom-in buttons.
			expect(await getZoomControlOrder(page)).toEqual([
				'reset-zoom-btn',
				'zoom-out-btn',
				'zoom-level',
				'zoom-in-btn'
			]);

			await page.close();
		});

		test('should update the percentage on zoom-out and clear it on reset', async ({ page }) => {
			await openMeeting(page, accessUrl, { videoEnabled: true, audioEnabled: true });
			await startScreensharing(page);

			const container = screenShareStream(page);

			// Two zoom-in steps land above the 1x base.
			await zoomInScreenShare(page, 2);
			const zoomedInPercent = await readZoomPercent(page);
			expect(zoomedInPercent).toBeGreaterThan(100);

			// One zoom-out step lowers the percentage but stays zoomed: the reset button
			// (which only renders while zoomed) must still be present, and the percentage drops.
			await clickZoomControl(page, 'zoom-out-btn');
			await expect(container.locator('#reset-zoom-btn')).toBeVisible();
			await expect.poll(() => readZoomPercent(page)).toBeLessThan(zoomedInPercent);
			expect(await readZoomPercent(page)).toBeGreaterThan(100);

			// Reset returns to 1x: zoom-out, reset and the percentage disappear, leaving only zoom-in.
			await clickZoomControl(page, 'reset-zoom-btn');
			await expect(container.locator('#zoom-level')).toHaveCount(0);
			await expect(container.locator('#zoom-out-btn')).toHaveCount(0);
			await expect(container.locator('#reset-zoom-btn')).toHaveCount(0);
			await expect(container.locator('#zoom-in-btn')).toBeVisible();

			await page.close();
		});

		test('should keep the controls visible while the pointer rests on them', async ({ page }) => {
			await openMeeting(page, accessUrl, { videoEnabled: true, audioEnabled: true });
			await startScreensharing(page);

			const container = await hoverScreenShareStream(page);
			const controls = container.locator('.stream-video-controls');
			const zoomIn = container.locator('#zoom-in-btn');

			// Park the pointer on the controls and let well over the 2s auto-hide window pass
			// WITHOUT moving the mouse.
			await controls.hover();
			await page.waitForTimeout(3_000);

			// The controls must NOT have auto-hidden while the pointer was interacting with them.
			await expect(controls).toBeVisible();
			await expect(zoomIn).toBeVisible();

			await page.close();
		});
	});
});

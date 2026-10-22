import { expect, test } from '@playwright/test';
import { startScreensharing, stopScreensharing, toggleCamera, toggleMicrophone } from './helpers/media-controls.helper';
import { createRoomAndGetAnonymousAccessUrl, deleteRooms } from './helpers/meet-api.helper';
import { openMeeting } from './helpers/meeting-navigation.helper';
import { disconnectAllBrowserFakeParticipants, joinParticipants } from './helpers/participant-management.helper';
import {
	expectPinnedStreamCount,
	expectScreenSourceCount,
	expectVideoCount,
	getScreenSourceTracks,
	unpinCurrentPinnedStream
} from './helpers/stream.helper';

test.describe('Screensharing E2E Tests', () => {
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

	test('should toggle screensharing on and off twice, updating video count', async ({ page }) => {
		await openMeeting(page, accessUrl);

		await startScreensharing(page);
		await expectScreenSourceCount(page, 1);
		await expectPinnedStreamCount(page, 1);
		await expectVideoCount(page, 2);

		await stopScreensharing(page);
		await expectScreenSourceCount(page, 0);
		await expectVideoCount(page, 1);

		await startScreensharing(page);
		await expectScreenSourceCount(page, 1);
		await expectPinnedStreamCount(page, 1);
		await expectVideoCount(page, 2);

		await stopScreensharing(page);
		await expectScreenSourceCount(page, 0);
		await expectVideoCount(page, 1);
	});

	test('should show screenshare and muted camera (camera off, screenshare on)', async ({ page }) => {
		await openMeeting(page, accessUrl);

		await toggleCamera(page);
		await startScreensharing(page);
		await expectScreenSourceCount(page, 1);
		await expectPinnedStreamCount(page, 1);
		await expectVideoCount(page, 2);

		await stopScreensharing(page);
		await expectScreenSourceCount(page, 0);
		await expectVideoCount(page, 1);
	});

	test('should display screensharing with a single pinned video', async ({ page }) => {
		await openMeeting(page, accessUrl);

		await startScreensharing(page);
		await expectScreenSourceCount(page, 1);
		await expectPinnedStreamCount(page, 1);
	});

	test('should replace pinned video when a second participant starts screensharing', async ({ browser }) => {
		const { pages, removeAllParticipants } = await joinParticipants(browser, {
			roomId,
			accessUrl,
			participants: [{ name: 'participant-0' }, { name: 'participant-1', headless: true }]
		});
		const [pageA, pageB] = pages;

		try {
			await startScreensharing(pageA);
			await expectPinnedStreamCount(pageA, 1);

			await startScreensharing(pageB);
			await expectVideoCount(pageB, 4);
			await expectPinnedStreamCount(pageB, 1);

			await expectVideoCount(pageA, 4);
			await expectPinnedStreamCount(pageA, 1);
		} finally {
			await removeAllParticipants();
		}
	});

	test('should unpin screensharing and restore previous pinned video when disabled', async ({ browser }) => {
		const { pages, removeAllParticipants } = await joinParticipants(browser, {
			roomId,
			accessUrl,
			participants: [{ name: 'participant-0' }, { name: 'participant-1', headless: true }]
		});
		const [pageA, pageB] = pages;

		try {
			await startScreensharing(pageA);
			await expectPinnedStreamCount(pageA, 1);

			await startScreensharing(pageB);
			await expectVideoCount(pageB, 4);
			await expectPinnedStreamCount(pageB, 1);

			await stopScreensharing(pageB);
			await expectVideoCount(pageB, 3);
			await expectPinnedStreamCount(pageB, 1);

			await expectVideoCount(pageA, 3);
			await expectPinnedStreamCount(pageA, 1);
		} finally {
			await removeAllParticipants();
		}
	});

	test('should correctly share screen with microphone muted and maintain proper track state', async ({ page }) => {
		await openMeeting(page, accessUrl);

		await toggleMicrophone(page);
		await startScreensharing(page);
		await expectScreenSourceCount(page, 1);
		await expectVideoCount(page, 2);

		const screenTracks = await getScreenSourceTracks(page);
		expect(screenTracks.length).toBe(1);
		expect(screenTracks[0].kind).toBe('video');
		expect(screenTracks[0].enabled).toBe(true);

		await stopScreensharing(page);
		await expectScreenSourceCount(page, 0);
		await expectVideoCount(page, 1);
	});

	test('should keep single pinned stream when second participant joins without sharing screen', async ({
		browser
	}) => {
		const { pages, addParticipant, removeAllParticipants } = await joinParticipants(browser, {
			roomId,
			accessUrl,
			participants: [{ name: 'local', screenShare: true }]
		});
		const [pageA] = pages;

		try {
			await expectPinnedStreamCount(pageA, 1);

			const pageB = await addParticipant({
				name: 'remote',
				headless: true
			});
			await expectVideoCount(pageB, 3);
			await expectPinnedStreamCount(pageB, 1);
			await expectScreenSourceCount(pageB, 1);

			await expectPinnedStreamCount(pageA, 1);
			await expectScreenSourceCount(pageA, 1);
		} finally {
			await removeAllParticipants();
		}
	});

	test('should NOT have multiple screens pinned when both participants share screen', async ({ browser }) => {
		// const [pageA, pageB] = await Promise.all([browser.newPage(), browser.newPage()]);
		const { pages, addParticipant, removeAllParticipants } = await joinParticipants(browser, {
			roomId,
			accessUrl,
			participants: [{ name: 'local', screenShare: true }]
		});
		const [pageA] = pages;

		try {
			await expectPinnedStreamCount(pageA, 1);

			const pageB = await addParticipant({
				name: 'remote',
				headless: true
			});
			await expectVideoCount(pageB, 3);
			await expectPinnedStreamCount(pageB, 1);

			await startScreensharing(pageB);
			await expectVideoCount(pageB, 4);
			await expectPinnedStreamCount(pageB, 1);

			await expectVideoCount(pageA, 4);
			await expectPinnedStreamCount(pageA, 1);
		} finally {
			await removeAllParticipants();
		}
	});

	test('should NOT re-pin unpinned screen when new participant joins', async ({ browser }) => {
		const { pages, addParticipant, removeAllParticipants } = await joinParticipants(browser, {
			roomId,
			accessUrl,
			participants: [
				{ name: 'local' },
				{
					name: 'sharer',
					headless: true,
					screenShare: true
				}
			]
		});
		const [pageA] = pages;

		try {
			await expectVideoCount(pageA, 3);
			await expectPinnedStreamCount(pageA, 1);
			await unpinCurrentPinnedStream(pageA);

			await addParticipant({
				name: 'new-participant',
				headless: true
			});

			await expectVideoCount(pageA, 4);
			await expectPinnedStreamCount(pageA, 0);
		} finally {
			await removeAllParticipants();
		}
	});
});

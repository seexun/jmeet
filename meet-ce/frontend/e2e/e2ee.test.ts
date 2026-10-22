import { expect, test } from '@playwright/test';
import {
	expectOwnNameInSettings,
	expectUnmaskedParticipantPanelNames,
	expectUnmaskedVideoGridNames
} from './helpers/e2ee.helper';
import { createRoomAndGetAnonymousAccessUrl, deleteRooms } from './helpers/meet-api.helper';
import { openLobby, openMeeting } from './helpers/meeting-navigation.helper';
import {
	expectChatMessageCount,
	expectChatMessageTextAt,
	openMoreOptionsMenu,
	sendChatMessage,
	toggleActivitiesPanel,
	toggleChatPanel,
	toggleParticipantsPanel
} from './helpers/panels.helper';
import { waitForRemoteStream } from './helpers/stream.helper';
import { expectHidden, expectVisible } from './helpers/ui-utils.helper';

test.describe('E2EE E2E Tests', () => {
	const createdRoomIds: string[] = [];

	const createE2eeRoom = async (enabled = true): Promise<string> => {
		const { room, accessUrl } = await createRoomAndGetAnonymousAccessUrl({
			config: { e2ee: { enabled } }
		});
		createdRoomIds.push(room.roomId);
		return accessUrl;
	};

	test.afterAll(async () => {
		await deleteRooms(createdRoomIds);
	});

	test.describe('E2EE Lobby Elements', () => {
		test('should show E2EE key input and badge in lobby when E2EE is enabled', async ({ page }) => {
			const accessUrl = await createE2eeRoom();

			await openLobby(page, accessUrl);

			// Check for encryption badge with correct text
			await expectVisible(page, '.encryption-badge');
			await expect(page.locator('.encryption-badge')).toContainText('end-to-end encrypted');

			// Check for E2EE key input field with correct attributes
			await expectVisible(page, '#participant-e2eekey-input');
			await expect(page.locator('#participant-e2eekey-input')).toHaveAttribute('type', 'password');
			await expect(page.locator('#participant-e2eekey-input')).toHaveAttribute('required', '');
		});

		test('should hide E2EE elements in lobby when E2EE is disabled', async ({ page }) => {
			const accessUrl = await createE2eeRoom(false);

			await openLobby(page, accessUrl);

			await expectHidden(page, '.encryption-badge');
			await expectHidden(page, '#participant-e2eekey-input');
		});
	});

	test.describe('E2EE in Meeting', () => {
		test('should allow participants to see and hear each other with correct E2EE key', async ({
			page,
			browser
		}) => {
			const e2eeKey = 'test-encryption-key-123';
			const accessUrl = await createE2eeRoom();

			const page2 = await browser.newPage();

			try {
				await Promise.all([
					openMeeting(page, accessUrl, { e2eeKey }),
					openMeeting(page2, accessUrl, { e2eeKey })
				]);
				await Promise.all([waitForRemoteStream(page), waitForRemoteStream(page2)]);

				await expect.poll(() => page.locator('.OV_video-element').count()).toBeGreaterThanOrEqual(2);
				await expect.poll(() => page2.locator('.OV_video-element').count()).toBeGreaterThanOrEqual(2);

				// Check that no encryption error posters are shown
				await expectHidden(page, '.encryption-error-poster');
				await expectHidden(page2, '.encryption-error-poster');
			} finally {
				await page2.close();
			}
		});

		test('should show encryption error poster when using wrong E2EE key', async ({ page, browser }) => {
			const key1 = 'correct-key-abc';
			const key2 = 'wrong-key-xyz';
			const accessUrl = await createE2eeRoom();

			const [page2, page3] = await Promise.all([browser.newPage(), browser.newPage()]);

			try {
				// P1 and P3 use key1 (correct), P2 uses key2 (wrong)
				await Promise.all([
					openMeeting(page, accessUrl, { e2eeKey: key1 }),
					openMeeting(page2, accessUrl, { e2eeKey: key2 })
				]);

				// P1 and P2 each see one encryption error poster for the other
				await expect(page.locator('.encryption-error-poster')).toHaveCount(1);
				await expect(page2.locator('.encryption-error-poster')).toHaveCount(1);
				// The undecryptable remote tile renders ONLY the poster: its <video> is removed from
				// the DOM (not merely hidden). Neither viewer has a remote video element mounted.
				await expect(page.locator('.OV_stream.remote .OV_video-element')).toHaveCount(0);
				await expect(page2.locator('.OV_stream.remote .OV_video-element')).toHaveCount(0);

				// P3 joins with key1 (same as P1)
				await openMeeting(page3, accessUrl, { e2eeKey: key1 });

				// P1 and P3 see each other without errors
				await Promise.all([
					waitForRemoteStream(page, 2, { videoCount: 1 }),
					waitForRemoteStream(page3, 2, { videoCount: 1 })
				]);

				// P3 sees encryption error only for P2
				await expect(page3.locator('.encryption-error-poster')).toHaveCount(1);

				// P2 sees errors for both P1 and P3
				await expect(page2.locator('.encryption-error-poster')).toHaveCount(2);

				// Remote <video> elements exist only for correctly-keyed remotes: P1 sees P3 (1, P2 has
				// none), P3 sees P1 (1, P2 has none), P2 (wrong key) can decrypt neither (0).
				await expect(page.locator('.OV_stream.remote .OV_video-element')).toHaveCount(1);
				await expect(page3.locator('.OV_stream.remote .OV_video-element')).toHaveCount(1);
				await expect(page2.locator('.OV_stream.remote .OV_video-element')).toHaveCount(0);
			} finally {
				await Promise.all([page2.close(), page3.close()]);
			}
		});

		test('should decrypt participant names and chat messages with correct E2EE key', async ({ page, browser }) => {
			const e2eeKey = 'shared-encryption-key-456';
			const participant1Name = 'Alice';
			const participant2Name = 'Bob';
			const accessUrl = await createE2eeRoom();

			const page2 = await browser.newPage();

			try {
				await Promise.all([
					openMeeting(page, accessUrl, { e2eeKey, name: participant1Name }),
					openMeeting(page2, accessUrl, { e2eeKey, name: participant2Name })
				]);
				await Promise.all([waitForRemoteStream(page), waitForRemoteStream(page2)]);

				// Check names in video grid
				await expectUnmaskedVideoGridNames(page);
				await expectUnmaskedVideoGridNames(page2);

				// Check names in participants panel
				await expectUnmaskedParticipantPanelNames(page, 2);
				await expectUnmaskedParticipantPanelNames(page2, 2);

				// Check own name in settings panel
				await expectOwnNameInSettings(page, participant1Name);
				await expectOwnNameInSettings(page2, participant2Name);

				// Check chat messages
				await toggleChatPanel(page);
				await toggleChatPanel(page2);

				const testMessage1 = `Hello from ${participant1Name}!`;
				await sendChatMessage(page, testMessage1);
				await expectChatMessageCount(page2, 1);
				await expectChatMessageTextAt(page2, 0, testMessage1);

				const testMessage2 = `Hi from ${participant2Name}!`;
				await sendChatMessage(page2, testMessage2);
				await expectChatMessageCount(page, 2);
				await expectChatMessageTextAt(page, 1, testMessage2);
			} finally {
				await page2.close();
			}
		});

		test('should show masked names and unreadable messages for participant with wrong E2EE key', async ({
			page,
			browser
		}) => {
			const correctKey = 'correct-shared-key-789';
			const wrongKey = 'wrong-key-999';
			const participant1Name = 'Charlie';
			const participant2Name = 'David';
			const participant3Name = 'Eve';
			const accessUrl = await createE2eeRoom();

			const [page2, page3] = await Promise.all([browser.newPage(), browser.newPage()]);

			try {
				// P1 and P2 use correctKey, P3 uses wrongKey
				await Promise.all([
					openMeeting(page, accessUrl, { e2eeKey: correctKey, name: participant1Name }),
					openMeeting(page2, accessUrl, { e2eeKey: correctKey, name: participant2Name }),
					openMeeting(page3, accessUrl, { e2eeKey: wrongKey, name: participant3Name })
				]);
				await Promise.all([
					waitForRemoteStream(page, 2, { videoCount: 1 }),
					waitForRemoteStream(page2, 2, { videoCount: 1 }),
					waitForRemoteStream(page3, 2, { videoCount: 0 })
				]);

				// P3 (wrong key) cannot decrypt either remote: both remote tiles show the encryption
				// poster and no remote <video> is mounted.
				await expect(page3.locator('.encryption-error-poster')).toHaveCount(2);
				await expect(page3.locator('.OV_stream.remote .OV_video-element')).toHaveCount(0);
				// P1 and P2 (correct key) each see one error poster (for P3) and keep the other
				// correctly-keyed remote's video.
				await expect(page.locator('.encryption-error-poster')).toHaveCount(1);
				await expect(page2.locator('.encryption-error-poster')).toHaveCount(1);
				await expect(page.locator('.OV_stream.remote .OV_video-element')).toHaveCount(1);
				await expect(page2.locator('.OV_stream.remote .OV_video-element')).toHaveCount(1);

				// P3 sees masked names for P1 and P2 in video grid
				const nameElements3 = page3.locator('.participant-name-container #participant-name');
				await expect(nameElements3).toHaveCount(3);
				const names3 = await nameElements3.allTextContents();
				expect(names3.filter((n) => n.includes('*'))).toHaveLength(2);
				expect(names3).toContain(participant3Name);
				expect(names3.join(' ')).not.toContain(participant1Name);
				expect(names3.join(' ')).not.toContain(participant2Name);

				// P3 sees masked names in participants panel
				await toggleParticipantsPanel(page3);
				await expectVisible(page3, 'ov-participants-panel');
				const panelNames3 = page3.locator('.participant-name-text');
				await expect(panelNames3).toHaveCount(3);
				const panelNamesText3 = await panelNames3.allTextContents();
				expect(panelNamesText3.filter((n) => n.includes('*'))).toHaveLength(2);
				expect(panelNamesText3).toContain(participant3Name);
				await toggleParticipantsPanel(page3);

				// P3 own name in settings is not masked
				await expectOwnNameInSettings(page3, participant3Name);

				// P1 sends message — P2 sees it, P3 does not
				await Promise.all([toggleChatPanel(page), toggleChatPanel(page2), toggleChatPanel(page3)]);

				const secretMessage = `Secret from ${participant1Name}`;
				await sendChatMessage(page, secretMessage);

				// P2 (correct key) receives the message
				await expectChatMessageCount(page2, 1);

				// P3 (wrong key) should see no messages
				await expect(page3.locator('.message')).toHaveCount(0, { timeout: 5_000 });

				// P1 and P2 still see each other's names
				const names1 = await page.locator('.participant-name-container #participant-name').allTextContents();
				expect(names1.join(' ')).toContain(participant2Name);

				const names2 = await page2.locator('.participant-name-container #participant-name').allTextContents();
				expect(names2.join(' ')).toContain(participant1Name);
			} finally {
				await Promise.all([page2.close(), page3.close()]);
			}
		});
	});

	test.describe('E2EE and Recording', () => {
		test('should hide recording activity when E2EE is enabled', async ({ page }) => {
			const accessUrl = await createE2eeRoom();

			await openMeeting(page, accessUrl, { e2eeKey: 'test-key-recording' });

			// dock 形态：sidenav 关闭时 tab 条渲染隐藏，经 panels.helper 的现行入口路径打开
			await toggleActivitiesPanel(page);
			await expectHidden(page, 'ov-recording-activity');
			await expectVisible(page, '#whiteboard-button');
		});
	});
});

import { expect, test } from '@playwright/test';
import {
	runScreenShareRotationCycles,
	selectMosaicLayout,
	selectSmartMosaicLayout,
	setSmartMosaicSliderValue
} from './helpers/layout.helper';
import { startScreensharing, stopScreensharing, toggleMicrophone } from './helpers/media-controls.helper';
import { createRoomAndGetAnonymousAccessUrl, deleteRooms } from './helpers/meet-api.helper';
import { leaveMeeting, openMeeting } from './helpers/meeting-navigation.helper';
import { closeSettingsPanel, openLayoutSettingsPanel } from './helpers/panels.helper';
import { disconnectAllBrowserFakeParticipants, joinParticipants } from './helpers/participant-management.helper';
import {
	getVisibleRemoteParticipantNames,
	toggleStreamPin,
	waitForRemoteStream,
	waitForVisibleRemoteParticipants
} from './helpers/stream.helper';
import { expectHidden, expectVisible } from './helpers/ui-utils.helper';

test.describe('Layout E2E Tests', () => {
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

	test.describe('Meeting UI elements', () => {
		test.afterEach(async ({ page }) => {
			await leaveMeeting(page);
		});

		test('should show layout settings in settings panel', async ({ page }) => {
			await openMeeting(page, accessUrl);

			await openLayoutSettingsPanel(page);
			await expect(page.locator('#layout-mosaic')).toBeVisible();
		});

		test('should have smart-mosaic selected by default and show participant count of 4', async ({ page }) => {
			await openMeeting(page, accessUrl);

			await openLayoutSettingsPanel(page);
			await expect(page.locator('#layout-smart-mosaic')).toContainClass('ant-radio-wrapper-checked');
			await expect(page.locator('.participant-count-container')).toBeVisible();
			await expect(page.locator('.participant-count-value')).toHaveText('4');
		});

		test('should hide participant count container when mosaic layout is selected', async ({ page }) => {
			await openMeeting(page, accessUrl);

			await openLayoutSettingsPanel(page);
			await expect(page.locator('.participant-count-container')).toBeVisible();
			await page.locator('#layout-mosaic').click();
			await expectHidden(page, '.participant-count-container');
		});
	});

	test.describe('Mosaic Layout', () => {
		test('should display all remote participants in mosaic layout without filtering', async ({ browser }) => {
			const { pages, removeAllParticipants } = await joinParticipants(browser, {
				roomId,
				accessUrl,
				participants: [
					{ name: 'viewer', audioEnabled: false },
					{ name: 'remote-a', headless: true, audioEnabled: false },
					{ name: 'remote-b', headless: true, audioEnabled: false },
					{ name: 'remote-c', headless: true, audioEnabled: false }
				]
			});
			const [pageA] = pages;

			try {
				await openLayoutSettingsPanel(pageA);
				await selectMosaicLayout(pageA);

				await waitForRemoteStream(pageA, 3);
				await expect(pageA.locator('.OV_stream_video.remote')).toHaveCount(3, { timeout: 15_000 });
				await expectHidden(pageA, 'ov-hidden-participants-indicator');
			} finally {
				await removeAllParticipants();
			}
		});

		test('should display screen sharing as pinned in mosaic layout', async ({ browser }) => {
			const { pages, byName, removeAllParticipants } = await joinParticipants(browser, {
				roomId,
				accessUrl,
				participants: [
					{ name: 'viewer', audioEnabled: false },
					{ name: 'sharer', headless: true, audioEnabled: false },
					{ name: 'remote-b', headless: true, audioEnabled: false }
				]
			});
			const [pageA] = pages;

			try {
				await openLayoutSettingsPanel(pageA);
				await selectMosaicLayout(pageA);

				await waitForRemoteStream(pageA, 2);

				await startScreensharing(byName['sharer']);

				await expect(pageA.locator('.OV_stream.remote.screen-source')).toHaveCount(1, { timeout: 20_000 });
				await waitForVisibleRemoteParticipants(
					pageA,
					{
						includes: ['sharer', 'sharer (screen)', 'remote-b']
					},
					20_000
				);

				await stopScreensharing(byName['sharer']);
				await expect(pageA.locator('.OV_stream.remote.screen-source')).toHaveCount(0, { timeout: 20_000 });
				await waitForVisibleRemoteParticipants(
					pageA,
					{
						count: 2,
						includes: ['sharer', 'remote-b']
					},
					20_000
				);
			} finally {
				await removeAllParticipants();
			}
		});

		test('should keep all participants visible after screen share stops in mosaic layout', async ({ browser }) => {
			const { pages, byName, removeAllParticipants } = await joinParticipants(browser, {
				roomId,
				accessUrl,
				participants: [
					{ name: 'local', audioEnabled: false },
					{ name: 'remote-A', headless: true, audioEnabled: false, screenShare: true },
					{ name: 'remote-B', headless: true, audioEnabled: false, screenShare: true },
					{ name: 'remote-C', headless: true, audioEnabled: false }
				]
			});
			const [pageA] = pages;

			try {
				await selectMosaicLayout(pageA);

				// All 3 remotes + 3 screen shares should be visible
				await waitForVisibleRemoteParticipants(pageA, {
					count: 3 + 2, // 3 remotes + 2 screen shares
					includes: [`remote-A`, `remote-A (screen)`, `remote-B`, `remote-B (screen)`, `remote-C`]
				});

				await selectSmartMosaicLayout(pageA);
				await waitForVisibleRemoteParticipants(pageA, {
					count: 3 + 2, // 3 remotes + 2 screen shares (never hide screen shares in smart mosaic)
					includes: [`remote-A (screen)`, `remote-B (screen)`]
				});

				await selectMosaicLayout(pageA);

				// All 3 remotes + 3 screen shares should be visible
				await waitForVisibleRemoteParticipants(pageA, {
					count: 3 + 2,
					includes: [`remote-A`, `remote-A (screen)`, `remote-B`, `remote-B (screen)`, `remote-C`]
				});
				// B stops screen sharing — DOM indices shift for later participants.
				// All remaining participants must stay visible.
				await stopScreensharing(byName[`remote-B`]);

				await waitForVisibleRemoteParticipants(pageA, {
					count: 3 + 1, // 3 remotes + 1 screen share
					includes: [`remote-A`, `remote-A (screen)`, `remote-B`, `remote-C`]
				});

				await expect(pageA.locator('.OV_stream.remote.screen-source')).toHaveCount(1, { timeout: 10_000 });
			} finally {
				await removeAllParticipants();
			}
		});

		test('should update participant count correctly after join and leave in mosaic layout', async ({ browser }) => {
			const { pages, addParticipant, removeParticipant, removeAllParticipants } = await joinParticipants(
				browser,
				{
					roomId,
					accessUrl,
					participants: [
						{ name: 'viewer', audioEnabled: false },
						{ name: 'remote-a', headless: true, audioEnabled: false }
					]
				}
			);
			const [pageA] = pages;

			try {
				await openLayoutSettingsPanel(pageA);
				await selectMosaicLayout(pageA);

				await waitForRemoteStream(pageA, 1);
				await expect(pageA.locator('.OV_stream_video.remote')).toHaveCount(1, { timeout: 15_000 });

				await addParticipant({ name: 'remote-b', headless: true, audioEnabled: false });

				await expect(pageA.locator('.OV_stream_video.remote')).toHaveCount(2, { timeout: 20_000 });

				await removeParticipant('remote-a');
				await expect(pageA.locator('.OV_stream_video.remote')).toHaveCount(1, { timeout: 20_000 });
			} finally {
				await removeAllParticipants();
			}
		});
	});

	test.describe('Smart Mosaic Layout', () => {
		test.describe('Participant filter', () => {
			test('should filter out remote participants when the smart mosaic limit is reduced', async ({
				browser
			}) => {
				const { pages, removeAllParticipants } = await joinParticipants(browser, {
					roomId,
					accessUrl,
					participants: [
						{ name: 'viewer' },
						{ name: 'remote-a', headless: true },
						{ name: 'remote-b', headless: true }
					]
				});
				const [pageA] = pages;

				try {
					// Participant A should see 3 streams: 1 local + 2 remote
					await expect(pageA.locator('.OV_stream_video')).toHaveCount(3, { timeout: 20_000 });
					await expect(pageA.locator('.OV_stream_video.local')).toHaveCount(1);
					await expect(pageA.locator('.OV_stream_video.remote')).toHaveCount(2);

					// Open layout settings and reduce participant count to 1

					await setSmartMosaicSliderValue(pageA, 1);

					// Participant A should now see only 2 streams: 1 local + 1 remote
					await expect(pageA.locator('.OV_stream_video')).toHaveCount(2, { timeout: 15_000 });
					await expect(pageA.locator('.OV_stream_video.local')).toHaveCount(1);
					await expect(pageA.locator('.OV_stream_video.remote')).toHaveCount(1);
					await expectVisible(pageA, 'ov-hidden-participants-indicator');
					await expect(
						pageA.locator('.hidden-participants-container .participant-count-value')
					).toContainText('+1');
				} finally {
					await removeAllParticipants();
				}
			});

			test('should restore hidden remote participants with active video when the smart mosaic limit is raised again', async ({
				browser
			}) => {
				const { pages, removeAllParticipants } = await joinParticipants(browser, {
					roomId,
					accessUrl,
					participants: [
						{ name: 'viewer' },
						{ name: 'remote-a', headless: true },
						{ name: 'remote-b', headless: true },
						{ name: 'remote-c', headless: true }
					]
				});
				const [pageA] = pages;

				try {
					await waitForRemoteStream(pageA, 3, { audioCount: 3 });

					await setSmartMosaicSliderValue(pageA, 2);
					await waitForRemoteStream(pageA, 2, { audioCount: 3 });
					await expect(
						pageA.locator('.hidden-participants-container .participant-count-value')
					).toContainText('+1');

					await setSmartMosaicSliderValue(pageA, 1);
					await waitForRemoteStream(pageA, 1, { audioCount: 3 });
					await expectVisible(pageA, 'ov-hidden-participants-indicator');
					await expect(
						pageA.locator('.hidden-participants-container .participant-count-value')
					).toContainText('+2');

					await setSmartMosaicSliderValue(pageA, 4);
					await waitForRemoteStream(pageA, 3, { audioCount: 3 });
					await expectHidden(pageA, 'ov-hidden-participants-indicator');
				} finally {
					await removeAllParticipants();
				}
			});

			test('should filter remote participants after screen sharing', async ({ browser }) => {
				const { pages, byName, removeAllParticipants } = await joinParticipants(browser, {
					roomId,
					accessUrl,
					participants: [
						{ name: 'viewer' },
						{ name: 'screen-share', headless: true },
						{ name: 'remote-hidden', headless: true }
					]
				});
				const [pageA] = pages;

				try {
					await Promise.all([
						startScreensharing(byName['screen-share']),
						waitForRemoteStream(pageA, 3, { audioCount: 3 })
					]);

					await setSmartMosaicSliderValue(pageA, 1);

					// Expect 1 remote + screen share
					await waitForRemoteStream(pageA, 2, { audioCount: 3 });
					await expectVisible(pageA, '.OV_stream.remote.screen-source');

					await expectVisible(pageA, 'ov-hidden-participants-indicator');
					await expect(
						pageA.locator('.hidden-participants-container .participant-count-value')
					).toContainText('+1');

					await setSmartMosaicSliderValue(pageA, 2);

					await waitForRemoteStream(pageA, 3, { audioCount: 3 });
					await expectHidden(pageA, 'ov-hidden-participants-indicator');
				} finally {
					await removeAllParticipants();
				}
			});
		});

		test.describe('Screen sharing visibility', () => {
			test('should retain screen sharing participant regardless smart-mosaic limit', async ({ browser }) => {
				const { pages, byName, addParticipant, removeAllParticipants } = await joinParticipants(browser, {
					roomId,
					accessUrl,
					participants: [
						{ name: 'local', audioEnabled: false },
						{ name: 'remote-screen', headless: true, audioEnabled: false }
					]
				});
				const [pageA] = pages;

				try {
					await setSmartMosaicSliderValue(pageA, 1);

					await startScreensharing(byName['remote-screen']);

					await waitForRemoteStream(pageA, 2, { audioCount: 2 }); // screen + 1 remote
					await expect(pageA.locator('.OV_stream.remote.screen-source')).toHaveCount(1, { timeout: 20_000 });

					expect(await pageA.locator('.OV_stream_video').count()).toBe(3); // local + remote + remote screen

					await waitForVisibleRemoteParticipants(
						pageA,
						{
							count: 2,
							includes: ['remote-screen', 'remote-screen (screen)']
						},
						20_000
					);

					await addParticipant({
						name: 'remote-speaker',
						audioEnabled: true,
						videoEnabled: true,
						headless: true
					});

					// await toggleMicrophone(byName['remote-speaker']);
					await waitForVisibleRemoteParticipants(
						pageA,
						{
							count: 2,
							includes: ['remote-speaker', 'remote-screen (screen)'],
							excludes: ['remote-screen']
						},
						20_000
					);

					expect(await pageA.locator('.OV_stream_video').count()).toBe(3); // local + remote speaker + remote screen

					await stopScreensharing(byName['remote-screen']);
					await waitForVisibleRemoteParticipants(
						pageA,
						{
							count: 1,
							includes: ['remote-speaker'],
							excludes: ['remote-screen']
						},
						20_000
					);

					expect(await pageA.locator('.OV_stream_video').count()).toBe(2); // local + remote speaker
				} finally {
					await removeAllParticipants();
				}
			});

			test('should show screen-sharing when joining an already active screen share with smart mosaic limit at 1', async ({
				browser
			}) => {
				const { addParticipant, removeAllParticipants } = await joinParticipants(browser, {
					roomId,
					accessUrl,
					participants: [
						{ name: 'remote-screen', headless: true, audioEnabled: false, screenShare: true },
						{ name: 'remote-a', headless: true, audioEnabled: false },
						{ name: 'remote-b', headless: true }
					]
				});

				try {
					const pageA = await addParticipant({ name: 'local' });

					await waitForVisibleRemoteParticipants(
						pageA,
						{
							count: 4,
							includes: ['remote-a', 'remote-b', 'remote-screen', 'remote-screen (screen)']
						},
						20_000
					);
					await setSmartMosaicSliderValue(pageA, 1);

					await waitForVisibleRemoteParticipants(
						pageA,
						{
							count: 2,
							includes: ['remote-b', 'remote-screen (screen)']
						},
						20_000
					);
				} finally {
					await removeAllParticipants();
				}
			});

			test('should show two screen-sharing when joining an already active screen share with smart mosaic limit at 1', async ({
				browser
			}) => {
				const { addParticipant, removeAllParticipants } = await joinParticipants(browser, {
					roomId,
					accessUrl,
					participants: [
						{ name: 'remote-screen', headless: true, audioEnabled: false, screenShare: true },
						{ name: 'remote-a', headless: true, audioEnabled: false, screenShare: true },
						{ name: 'remote-b', headless: true }
					]
				});

				try {
					const pageA = await addParticipant({ name: 'local' });

					await waitForVisibleRemoteParticipants(
						pageA,
						{
							count: 5,
							includes: [
								'remote-a',
								'remote-a (screen)',
								'remote-b',
								'remote-screen',
								'remote-screen (screen)'
							]
						},
						20_000
					);
					await setSmartMosaicSliderValue(pageA, 1);

					await waitForVisibleRemoteParticipants(
						pageA,
						{
							count: 3,
							includes: ['remote-b', 'remote-a (screen)', 'remote-screen (screen)']
						},
						20_000
					);
				} finally {
					await removeAllParticipants();
				}
			});

			test('should show a screen-sharing participant over silent ones', async ({ browser }) => {
				const { pages, byName, addParticipant, removeAllParticipants } = await joinParticipants(browser, {
					roomId,
					accessUrl,
					participants: [
						{ name: 'local', audioEnabled: false },
						{ name: 'remote-b', headless: true, audioEnabled: false },
						{ name: 'remote-c', headless: true, audioEnabled: false }
					]
				});
				const [pageA] = pages;

				try {
					await setSmartMosaicSliderValue(pageA, 2);

					await waitForVisibleRemoteParticipants(pageA, {
						count: 2,
						includes: ['remote-b', 'remote-c']
					});

					await addParticipant({
						name: 'remote-screen',
						audioEnabled: false,
						headless: true
					});

					await startScreensharing(byName['remote-screen']);
					await waitForVisibleRemoteParticipants(
						pageA,
						{
							count: 3,
							includes: ['remote-b', 'remote-c', 'remote-screen (screen)'],
							excludes: ['remote-screen']
						},
						20_000
					);

					const participantCount = await pageA.locator('.OV_stream_video').count();
					expect(participantCount).toBe(4);
				} finally {
					await removeAllParticipants();
				}
			});

			test('should exclude screen-sharing stream of rotation logic', async ({ browser }) => {
				const { pages, byName, removeAllParticipants } = await joinParticipants(browser, {
					roomId,
					accessUrl,
					participants: [
						{ name: 'local', audioEnabled: false },
						{ name: 'remote-a', headless: true, audioEnabled: false },
						{ name: 'remote-b', headless: true, audioEnabled: false }
					]
				});
				const [pageA] = pages;

				try {
					await waitForRemoteStream(pageA, 2); //2 remotes
					await setSmartMosaicSliderValue(pageA, 1);

					await waitForRemoteStream(pageA, 1, { audioCount: 2 }); //1 remote

					await startScreensharing(byName['remote-b']);

					await expect(pageA.locator('.OV_stream.remote.screen-source')).toHaveCount(1, { timeout: 20_000 });

					await runScreenShareRotationCycles(pageA, byName, 'remote-a', 'remote-b', 'remote-b', 5);
				} finally {
					await removeAllParticipants();
				}
			});
		});

		test.describe('Hidden participants indicator', () => {
			test('should show hidden participants indicator when remote participants exceed the visible limit', async ({
				browser
			}) => {
				const { pages, removeAllParticipants } = await joinParticipants(browser, {
					roomId,
					accessUrl,
					participants: [
						{ name: 'viewer' },
						{ name: 'remote-a', headless: true },
						{ name: 'remote-b', headless: true }
					]
				});
				const [pageA] = pages;

				try {
					// Limit to 1 visible remote on A's view: 2 remotes present, 1 is hidden
					await setSmartMosaicSliderValue(pageA, 1);
					await waitForRemoteStream(pageA, 1, { audioCount: 2 });

					// The hidden participants indicator must be present and show "+1 more participant"
					await Promise.all([
						expect(pageA.locator('ov-hidden-participants-indicator')).toBeVisible({ timeout: 10_000 }),
						expect(pageA.locator('.hidden-participants-container .participant-count-value')).toContainText(
							'+1'
						)
					]);
				} finally {
					await removeAllParticipants();
				}
			});

			test('should switch indicator to standard mode when the visible remote participant is pinned', async ({
				browser
			}) => {
				const { pages, removeAllParticipants } = await joinParticipants(browser, {
					roomId,
					accessUrl,
					participants: [
						{ name: 'viewer' },
						{ name: 'remote-a', headless: true },
						{ name: 'remote-b', headless: true, audioEnabled: false }
					]
				});
				const [pageA] = pages;

				try {
					// Wait for both remotes to be live before adjusting the slider
					await waitForRemoteStream(pageA, 2, { audioCount: 2});

					// Set limit to 1 so the indicator appears in topbar mode initially
					await setSmartMosaicSliderValue(pageA, 1);
					await expect(pageA.locator('.hidden-participants-container.horizontal')).toBeVisible({
						timeout: 10_000
					});

					// Close the layout settings panel before interacting with the layout streams
					await closeSettingsPanel(pageA);
					await expectHidden(pageA, '#settings-container');

					// Pin the visible remote participant: hasPinnedParticipant becomes true
					// → showTopBarHiddenParticipantsIndicator() returns false → indicator moves to OV_last
					await toggleStreamPin(pageA, '.OV_stream_video.remote');
					await Promise.all([
						expect(pageA.locator('.hidden-participants-container.vertical')).toBeVisible({
							timeout: 10_000
						}),
						expectHidden(pageA, '.hidden-participants-container.horizontal')
					]);
					await toggleStreamPin(pageA, '.OV_stream_video.remote');
					await Promise.all([
						expect(pageA.locator('.hidden-participants-container.horizontal')).toBeVisible({
							timeout: 10_000
						}),
						expectHidden(pageA, '.hidden-participants-container.vertical')
					]);
				} finally {
					await removeAllParticipants();
				}
			});

			test('should hide the indicator when switching from smart mosaic to standard mosaic layout', async ({
				browser
			}) => {
				const { pages, removeAllParticipants } = await joinParticipants(browser, {
					roomId,
					accessUrl,
					participants: [
						{ name: 'viewer' },
						{ name: 'remote-a', headless: true },
						{ name: 'remote-b', headless: true }
					]
				});
				const [pageA] = pages;

				try {
					// Set limit to 1 so the hidden indicator appears

					await setSmartMosaicSliderValue(pageA, 1);
					await Promise.all([
						expect(pageA.locator('ov-hidden-participants-indicator')).toBeVisible({ timeout: 10_000 }),
						expect(pageA.locator('.OV_stream_video.remote')).toHaveCount(1, { timeout: 15_000 })
					]);

					// Switch to standard mosaic: all remotes become visible, indicator must disappear
					await selectMosaicLayout(pageA);
					await Promise.all([
						expectHidden(pageA, 'ov-hidden-participants-indicator'),
						expect(pageA.locator('.OV_stream_video.remote')).toHaveCount(2, { timeout: 15_000 })
					]);

					await selectSmartMosaicLayout(pageA);
					await waitForRemoteStream(pageA, 1, { audioCount: 2 });
					await Promise.all([
						expect(pageA.locator('ov-hidden-participants-indicator')).toBeVisible({ timeout: 10_000 }),
						expect(pageA.locator('.OV_stream_video.remote')).toHaveCount(1, { timeout: 15_000 })
					]);
				} finally {
					await removeAllParticipants();
				}
			});

			test('should update indicator count correctly when the smart mosaic limit is raised', async ({
				browser
			}) => {
				const { pages, removeAllParticipants } = await joinParticipants(browser, {
					roomId,
					accessUrl,
					participants: [
						{ name: 'viewer' },
						{ name: 'remote-a', headless: true },
						{ name: 'remote-b', headless: true },
						{ name: 'remote-c', headless: true }
					]
				});
				const [pageA] = pages;

				try {
					// Limit 1: 3 remotes present, 1 visible, 2 hidden → indicator shows "+2"

					await setSmartMosaicSliderValue(pageA, 1);
					await expect(
						pageA.locator('.hidden-participants-container .participant-count-value')
					).toContainText('+2', {
						timeout: 10_000
					});

					// Raise limit to 2: 2 visible, 1 hidden → indicator shows "+1"
					await setSmartMosaicSliderValue(pageA, 2);
					await expect(
						pageA.locator('.hidden-participants-container .participant-count-value')
					).toContainText('+1', {
						timeout: 10_000
					});
				} finally {
					await removeAllParticipants();
				}
			});
		});

		test.describe('Speaker priority', () => {
			test('should prioritize an active speaker over a muted remote participant when the limit is 1', async ({
				browser
			}) => {
				const { pages, byName, removeAllParticipants } = await joinParticipants(browser, {
					roomId,
					accessUrl,
					participants: [
						{ name: 'local', audioEnabled: false },
						{ name: 'remote-a', headless: true, audioEnabled: false },
						{ name: 'remote-b', headless: true, audioEnabled: false }
					]
				});
				const [pageA] = pages;

				try {
					await setSmartMosaicSliderValue(pageA, 1);
					await waitForVisibleRemoteParticipants(pageA, { count: 1 });

					await toggleMicrophone(byName['remote-a']);

					await waitForVisibleRemoteParticipants(pageA, {
						count: 1,
						includes: ['remote-a'],
						excludes: ['remote-b']
					});
				} finally {
					await removeAllParticipants();
				}
			});

			test('should keep the two most recent active speakers visible when the limit is exceeded', async ({
				browser
			}) => {
				const { pages, byName, removeAllParticipants } = await joinParticipants(browser, {
					roomId,
					accessUrl,
					participants: [
						{ name: 'local', audioEnabled: false },
						{ name: 'remote-a', headless: true },
						{ name: 'remote-b', headless: true, audioEnabled: false },
						{ name: 'remote-c', headless: true, audioEnabled: false }
					]
				});
				const [pageA] = pages;

				try {
					await setSmartMosaicSliderValue(pageA, 2);

					await waitForVisibleRemoteParticipants(pageA, {
						count: 2,
						includes: ['remote-a']
					});

					await Promise.all([
						toggleMicrophone(byName['remote-a']),
						toggleMicrophone(byName['remote-b']),
						toggleMicrophone(byName['remote-c'])
					]);

					await waitForVisibleRemoteParticipants(
						pageA,
						{
							count: 2,
							includes: ['remote-b', 'remote-c'],
							excludes: ['remote-a']
						},
						20_000
					);
				} finally {
					await removeAllParticipants();
				}
			});

			test('should display the three active remote speakers and keep silent participants hidden when the limit is 3', async ({
				browser
			}) => {
				const { pages, byName, removeAllParticipants } = await joinParticipants(browser, {
					roomId,
					accessUrl,
					participants: [
						{ name: 'local', audioEnabled: false },
						{ name: 'remote-a', headless: true },
						{ name: 'remote-b', headless: true, audioEnabled: false },
						{ name: 'remote-c', headless: true, audioEnabled: false },
						{ name: 'remote-d', headless: true, audioEnabled: false }
					]
				});
				const [pageA] = pages;

				try {
					await setSmartMosaicSliderValue(pageA, 3);

					await waitForVisibleRemoteParticipants(pageA, { includes: ['remote-a'] }, 20_000);

					// Ensure remote-a has accumulated ≥ MIN_SPEAKING_DURATION_MS (2s) so it enters
					// _speakerPriorityOrder before the toggle. Otherwise, in parallel join mode
					// where remote-a may be a filler rather than the qualified speaker, toggling
					// before it qualifies prevents it from being preserved in the priority tail.
					await pageA.waitForTimeout(3_000);

					await Promise.all([
						toggleMicrophone(byName['remote-a']),
						toggleMicrophone(byName['remote-b']),
						toggleMicrophone(byName['remote-c'])
					]);

					await waitForVisibleRemoteParticipants(
						pageA,
						{
							count: 3,
							includes: ['remote-a', 'remote-b', 'remote-c'],
							excludes: ['remote-d']
						},
						20_000
					);
				} finally {
					await removeAllParticipants();
				}
			});

			test('should keep the first visible speaker stable when another continuous speaker becomes active at limit 1', async ({
				browser
			}) => {
				const { pages, byName, removeAllParticipants } = await joinParticipants(browser, {
					roomId,
					accessUrl,
					participants: [
						{ name: 'local', audioEnabled: false },
						{ name: 'remote-a', headless: true, audioEnabled: false },
						{ name: 'remote-b', headless: true, audioEnabled: false }
					]
				});
				const [pageA] = pages;

				try {
					await setSmartMosaicSliderValue(pageA, 1);
					await toggleMicrophone(byName['remote-a']);
					await waitForVisibleRemoteParticipants(pageA, {
						count: 1,
						includes: ['remote-a'],
						excludes: ['remote-b']
					});

					await toggleMicrophone(byName['remote-b']);

					for (let i = 0; i < 5; i++) {
						await waitForVisibleRemoteParticipants(pageA, {
							count: 1,
							includes: ['remote-a'],
							excludes: ['remote-b']
						});
						await pageA.waitForTimeout(500);
					}
				} finally {
					await removeAllParticipants();
				}
			});

			test('should prioritize a newly joined speaking participant over already connected silent participants', async ({
				browser
			}) => {
				const { pages, addParticipant, removeAllParticipants } = await joinParticipants(browser, {
					roomId,
					accessUrl,
					participants: [
						{ name: 'local', audioEnabled: false },
						{ name: 'remote-a', headless: true, audioEnabled: false },
						{ name: 'remote-b', headless: true, audioEnabled: false }
					]
				});
				const [pageA] = pages;

				try {
					await setSmartMosaicSliderValue(pageA, 1);

					await waitForVisibleRemoteParticipants(pageA, { count: 1 });

					await addParticipant({ name: 'remote-c', headless: true });

					await waitForVisibleRemoteParticipants(
						pageA,
						{
							count: 1,
							includes: ['remote-c'],
							excludes: ['remote-a', 'remote-b']
						},
						20_000
					);
				} finally {
					await removeAllParticipants();
				}
			});
		});

		test.describe('Participant Join/Leave Handling', () => {
			test('should update visible participants when an active speaker leaves', async ({ browser }) => {
				const { pages, byName, removeAllParticipants } = await joinParticipants(browser, {
					roomId,
					accessUrl,
					participants: [
						{ name: 'local', audioEnabled: false },
						{ name: 'remote-a', headless: true },
						{ name: 'remote-b', headless: true, audioEnabled: false },
						{ name: 'remote-c', headless: true, audioEnabled: false }
					]
				});
				const [pageA] = pages;

				try {
					await setSmartMosaicSliderValue(pageA, 1);

					await waitForVisibleRemoteParticipants(
						pageA,
						{
							count: 1,
							includes: ['remote-a']
						},
						20_000
					);

					await leaveMeeting(byName['remote-a']);
					await waitForVisibleRemoteParticipants(
						pageA,
						{
							count: 1,
							excludes: ['remote-a']
						},
						20_000
					);
				} finally {
					await removeAllParticipants();
				}
			});

			test('should not promote newly joined silent participants when a speaker is already visible', async ({
				browser
			}) => {
				const { pages, addParticipant, removeAllParticipants } = await joinParticipants(browser, {
					roomId,
					accessUrl,
					participants: [
						{ name: 'local', audioEnabled: false },
						{ name: 'remote-a', headless: true },
						{ name: 'remote-b', headless: true, audioEnabled: false }
					]
				});
				const [pageA] = pages;

				try {
					await setSmartMosaicSliderValue(pageA, 1);

					await waitForVisibleRemoteParticipants(pageA, {
						count: 1,
						includes: ['remote-a'],
						excludes: ['remote-b']
					});

					await addParticipant({ name: 'remote-c', headless: true, audioEnabled: false });

					await waitForVisibleRemoteParticipants(
						pageA,
						{
							count: 1,
							includes: ['remote-a'],
							excludes: ['remote-b', 'remote-c']
						},
						20_000
					);
				} finally {
					await removeAllParticipants();
				}
			});
		});

		test.describe('Audio Level and Duration Filtering', () => {
			test('should keep the layout stable when a low-volume participant joins', async ({ browser }) => {
				const { pages, addParticipant, removeAllParticipants } = await joinParticipants(browser, {
					roomId,
					accessUrl,
					participants: [{ name: 'local', audioEnabled: false }]
				});
				const [pageA] = pages;

				try {
					await setSmartMosaicSliderValue(pageA, 1);
					await addParticipant({
						name: 'remote-silence',
						headless: true,
						audioFile: 'complete_silence.wav'
					});
					await waitForVisibleRemoteParticipants(pageA, {
						count: 1,
						includes: ['remote-silence']
					});

					await addParticipant({
						name: 'remote-low',
						headless: true,
						audioFile: 'low_volume_speech.wav'
					});

					await pageA.waitForTimeout(4_000);

					for (let i = 0; i < 5; i++) {
						await waitForVisibleRemoteParticipants(pageA, {
							count: 1,
							includes: ['remote-silence'],
							excludes: ['remote-low']
						});

						await pageA.waitForTimeout(500);
					}
				} finally {
					await removeAllParticipants();
				}
			});

			test('should remain stable with multiple low-volume speakers', async ({ browser }) => {
				const { pages, addParticipant, removeAllParticipants } = await joinParticipants(browser, {
					roomId,
					accessUrl,
					participants: [{ name: 'local', audioEnabled: false }]
				});
				const [pageA] = pages;

				try {
					await setSmartMosaicSliderValue(pageA, 1);
					await addParticipant({
						name: 'remote-silence',
						headless: true,
						audioFile: 'complete_silence.wav'
					});

					await waitForVisibleRemoteParticipants(pageA, {
						count: 1,
						includes: ['remote-silence']
					});

					await Promise.all([
						addParticipant({
							name: 'remote-low-a',
							headless: true,
							audioFile: 'ambient_pink_noise.wav'
						}),
						addParticipant({
							name: 'remote-low-b',
							headless: true,
							audioFile: 'ambient_pink_noise.wav'
						})
					]);

					await pageA.waitForTimeout(3_000);

					const initialVisibleNames = await getVisibleRemoteParticipantNames(pageA);
					let previousNames = [...initialVisibleNames];
					let swapCount = 0;

					for (let i = 0; i < 5; i++) {
						await pageA.waitForTimeout(500);
						const currentNames = await getVisibleRemoteParticipantNames(pageA);

						const hasSwap = !previousNames.every((name) => currentNames.includes(name));

						if (hasSwap) {
							swapCount += 1;
						}

						previousNames = [...currentNames];
					}

					expect(swapCount).toBe(0);
				} finally {
					await removeAllParticipants();
				}
			});

			test('should filter out brief sounds under minimum duration', async ({ browser }) => {
				const { pages, addParticipant, removeAllParticipants } = await joinParticipants(browser, {
					roomId,
					accessUrl,
					participants: [{ name: 'local', audioEnabled: false }]
				});
				const [pageA] = pages;

				try {
					await setSmartMosaicSliderValue(pageA, 1);
					await addParticipant({
						name: 'remote-silence',
						headless: true,
						audioFile: 'complete_silence.wav'
					});

					await waitForVisibleRemoteParticipants(pageA, {
						count: 1,
						includes: ['remote-silence'],
						excludes: ['remote-cough']
					});

					await addParticipant({
						name: 'remote-cough',
						headless: true,
						audioFile: 'brief_cough_at_5s.wav'
					});

					await pageA.waitForTimeout(5_000);

					for (let i = 0; i < 5; i++) {
						await waitForVisibleRemoteParticipants(pageA, {
							count: 1,
							includes: ['remote-silence'],
							excludes: ['remote-cough']
						});
						await pageA.waitForTimeout(500);
					}
				} finally {
					await removeAllParticipants();
				}
			});

			test('should not swap to a speaker that only produces a one-second burst', async ({ browser }) => {
				const { pages, addParticipant, removeAllParticipants } = await joinParticipants(browser, {
					roomId,
					accessUrl,
					participants: [{ name: 'local', audioEnabled: false }]
				});
				const [pageA] = pages;

				try {
					await setSmartMosaicSliderValue(pageA, 1);
					await addParticipant({
						name: 'remote-silence',
						headless: true,
						audioFile: 'complete_silence.wav'
					});

					await waitForVisibleRemoteParticipants(pageA, {
						count: 1,
						includes: ['remote-silence'],
						excludes: ['remote-brief']
					});

					await addParticipant({
						name: 'remote-brief',
						headless: true,
						audioFile: 'brief_sound_1s_at_5s.wav'
					});

					await pageA.waitForTimeout(5_000);

					for (let i = 0; i < 5; i++) {
						await waitForVisibleRemoteParticipants(pageA, {
							count: 1,
							includes: ['remote-silence'],
							excludes: ['remote-brief']
						});
						await pageA.waitForTimeout(500);
					}
				} finally {
					await removeAllParticipants();
				}
			});
		});

		test.describe('Mute participants', () => {
			test('should keep a muted participant visible after muting and unmuting cycles', async ({ browser }) => {
				const { pages, byName, removeAllParticipants } = await joinParticipants(browser, {
					roomId,
					accessUrl,
					participants: [
						{ name: 'local', audioEnabled: false },
						{ name: 'remote-a', headless: true },
						{ name: 'remote-b', headless: true, audioEnabled: false }
					]
				});
				const [pageA] = pages;

				try {
					await setSmartMosaicSliderValue(pageA, 1);

					await waitForVisibleRemoteParticipants(pageA, {
						count: 1,
						includes: ['remote-a'],
						excludes: ['remote-b']
					});

					await Promise.all([toggleMicrophone(byName['remote-a']), toggleMicrophone(byName['remote-b'])]);

					await waitForVisibleRemoteParticipants(
						pageA,
						{
							count: 1,
							includes: ['remote-b'],
							excludes: ['remote-a']
						},
						20_000
					);

					await toggleMicrophone(byName['remote-a']);

					await waitForVisibleRemoteParticipants(pageA, {
						count: 1,
						includes: ['remote-b']
					});
				} finally {
					await removeAllParticipants();
				}
			});

			test('should hide a participant when they become audio-muted and promote the other active speaker', async ({
				browser
			}) => {
				const { pages, byName, removeAllParticipants } = await joinParticipants(browser, {
					roomId,
					accessUrl,
					participants: [
						{ name: 'local', audioEnabled: false },
						{ name: 'remote-a', audioEnabled: false },
						{ name: 'remote-b', audioEnabled: false }
					]
				});
				const [pageA] = pages;

				try {
					await setSmartMosaicSliderValue(pageA, 1);

					await toggleMicrophone(byName['remote-a']);
					await waitForVisibleRemoteParticipants(pageA, {
						count: 1,
						includes: ['remote-a'],
						excludes: ['remote-b']
					});

					await toggleMicrophone(byName['remote-b']);
					await pageA.waitForTimeout(1_000);

					await toggleMicrophone(byName['remote-a']);

					await waitForVisibleRemoteParticipants(
						pageA,
						{
							count: 1,
							includes: ['remote-b'],
							excludes: ['remote-a']
						},
						20_000
					);
				} finally {
					await removeAllParticipants();
				}
			});
		});

		test.describe('Smart Mosaic Layout Edge Cases', () => {
			test('should keep remaining participants visible when a displayed participant disconnects and budget decreases', async ({
				browser
			}) => {
				const { pages, removeParticipant, removeAllParticipants } = await joinParticipants(browser, {
					roomId,
					accessUrl,
					participants: [
						{ name: 'viewer', audioEnabled: false },
						{ name: 'A', headless: true },
						{ name: 'B', headless: true },
						{ name: 'C', headless: true },
						{ name: 'D', headless: true, audioEnabled: false }
					]
				});
				const [pageA] = pages;

				try {
					// Set limit to 3 so A, B, C are visible, D is hidden
					await setSmartMosaicSliderValue(pageA, 3);
					await waitForVisibleRemoteParticipants(
						pageA,
						{
							count: 3,
							includes: ['A', 'B', 'C'],
							excludes: ['D']
						},
						20_000
					);

					// Remove A (interior position) and simultaneously reduce budget to 2
					// This creates a net-removal scenario: departures exceed arrivals in syncDisplayOrder
					await removeParticipant('A');
					await setSmartMosaicSliderValue(pageA, 2);

					// B and C (or B/C + promoted D) must remain visible without layout errors
					await waitForVisibleRemoteParticipants(
						pageA,
						{
							count: 2,
							excludes: ['A']
						},
						20_000
					);

					// Verify that the remaining visible participants have active video
					await waitForRemoteStream(pageA, 2, { videoCount: 2, audioCount: 3 });
				} finally {
					await removeAllParticipants();
				}
			});

			test('should handle multiple simultaneous disconnects without breaking the layout', async ({ browser }) => {
				const { pages, removeParticipant, removeAllParticipants } = await joinParticipants(browser, {
					roomId,
					accessUrl,
					participants: [
						{ name: 'viewer', audioEnabled: false },
						{ name: 'A', headless: true },
						{ name: 'B', headless: true },
						{ name: 'C', headless: true },
						{ name: 'D', headless: true }
					]
				});
				const [pageA] = pages;

				try {
					await setSmartMosaicSliderValue(pageA, 4);
					await waitForVisibleRemoteParticipants(
						pageA,
						{
							count: 4,
							includes: ['A', 'B', 'C', 'D']
						},
						20_000
					);

					// Remove two interior participants simultaneously — forces syncDisplayOrder to
					// handle multiple splice shifts
					await Promise.all([removeParticipant('B'), removeParticipant('C')]);

					await waitForVisibleRemoteParticipants(
						pageA,
						{
							count: 2,
							includes: ['A', 'D'],
							excludes: ['B', 'C']
						},
						20_000
					);

					await waitForRemoteStream(pageA, 2, { audioCount: 2 });
				} finally {
					await removeAllParticipants();
				}
			});

			test('should remain stable when switching from mosaic to smart mosaic after screen share stops', async ({
				browser
			}) => {
				const { pages, byName, removeAllParticipants } = await joinParticipants(browser, {
					roomId,
					accessUrl,
					participants: [
						{ name: 'viewer', audioEnabled: false },
						{ name: 'sharer', headless: true, screenShare: true },
						{ name: 'remote-b', headless: true, audioEnabled: false }
					]
				});
				const [pageA] = pages;

				try {
					// Start in mosaic mode — all participants and screen share visible
					await openLayoutSettingsPanel(pageA);
					await selectMosaicLayout(pageA);

					await waitForVisibleRemoteParticipants(
						pageA,
						{
							includes: ['sharer', 'sharer (screen)', 'remote-b']
						},
						20_000
					);

					// Stop screen sharing while in mosaic mode — triggers DOM reorder in orderedStreams
					await stopScreensharing(byName['sharer']);
					await waitForVisibleRemoteParticipants(
						pageA,
						{
							count: 2,
							includes: ['sharer', 'remote-b']
						},
						20_000
					);

					// Switch to smart mosaic — the displayedCameraOrder is fresh, no stale entries
					await selectSmartMosaicLayout(pageA);
					await setSmartMosaicSliderValue(pageA, 1);

					await waitForVisibleRemoteParticipants(
						pageA,
						{
							count: 1
						},
						20_000
					);

					await waitForRemoteStream(pageA, 1, { audioCount: 2 });
				} finally {
					await removeAllParticipants();
				}
			});
		});
	});

	test.describe('Mosaic Layout and Smart Mosaic Layout Switching', () => {
		test('should filter remote participants after switching from mosaic to smart mosaic', async ({ browser }) => {
			const { pages, removeAllParticipants } = await joinParticipants(browser, {
				roomId,
				accessUrl,
				participants: [
					{ name: 'viewer' },
					{ name: 'remote-a', headless: true },
					{ name: 'remote-b', headless: true },
					{ name: 'remote-c', headless: true }
				]
			});
			const [pageA] = pages;

			try {
				await waitForRemoteStream(pageA, 3, { audioCount: 3 });

				await setSmartMosaicSliderValue(pageA, 2);
				await waitForRemoteStream(pageA, 2, { audioCount: 3 });
				await expect(pageA.locator('.hidden-participants-container .participant-count-value')).toContainText(
					'+1'
				);

				// Switch to mosaic and verify all remotes are visible
				await selectMosaicLayout(pageA);
				await waitForRemoteStream(pageA, 3, { audioCount: 3 });
				await expectHidden(pageA, 'ov-hidden-participants-indicator');

				// Switch back to smart mosaic and verify the previous limit is applied (2 visible remotes, 1 hidden)
				await selectSmartMosaicLayout(pageA);
				await waitForRemoteStream(pageA, 2, { audioCount: 3 });
				await expect(pageA.locator('.hidden-participants-container .participant-count-value')).toContainText(
					'+1'
				);

				await setSmartMosaicSliderValue(pageA, 1);
				await waitForRemoteStream(pageA, 1, { audioCount: 3 });
				await expectVisible(pageA, 'ov-hidden-participants-indicator');
				await expect(pageA.locator('.hidden-participants-container .participant-count-value')).toContainText(
					'+2'
				);

				await setSmartMosaicSliderValue(pageA, 4);
				await waitForRemoteStream(pageA, 3, { audioCount: 3 });
				await expectHidden(pageA, 'ov-hidden-participants-indicator');
			} finally {
				await removeAllParticipants();
			}
		});

		test('should maintain the same visible participants when switching between mosaic and smart mosaic', async ({
			browser
		}) => {
			const { pages, addParticipant, removeAllParticipants } = await joinParticipants(browser, {
				roomId,
				accessUrl,
				participants: [
					{ name: 'remote-a', headless: true, screenShare: true },
					{ name: 'remote-b', headless: true }
				]
			});

			try {
				await waitForRemoteStream(pages[1], 2, { audioCount: 2 });

				const pageA = await addParticipant({ name: 'local' });

				await waitForVisibleRemoteParticipants(pageA, {
					count: 3,
					includes: ['remote-a', 'remote-b', 'remote-a (screen)']
				});

				// Switch to mosaic and verify the same participants are visible
				await selectMosaicLayout(pageA);
				await pageA.waitForTimeout(1_000);
				await waitForVisibleRemoteParticipants(pageA, {
					count: 3,
					includes: ['remote-a', 'remote-b', 'remote-a (screen)']
				});

				// Switch back to smart mosaic and verify the same participants are visible
				await selectSmartMosaicLayout(pageA);
				await pageA.waitForTimeout(1_000);
				await waitForVisibleRemoteParticipants(pageA, {
					count: 3,
					includes: ['remote-a', 'remote-b', 'remote-a (screen)']
				});
			} finally {
				await removeAllParticipants();
			}
		});
	});
});

import { expect, test } from '@playwright/test';
import { createRoomAndGetAnonymousAccessUrl, deleteRooms } from './helpers/meet-api.helper';
import { openMeeting } from './helpers/meeting-navigation.helper';
import {
	openSettingsPanel,
	toggleActivitiesPanel,
	toggleChatPanel,
	toggleParticipantsPanel
} from './helpers/panels.helper';
import { expectHidden, expectVisible } from './helpers/ui-utils.helper';

test.describe('Panels E2E Tests', () => {
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

	test.describe('UI Navigation and Section Switching', () => {
		test('should switch between PARTICIPANTS and CHAT panels and verify correct content is shown', async ({
			page
		}) => {
			await openMeeting(page, accessUrl);

			await toggleChatPanel(page);
			await expectVisible(page, '.sidenav-menu');
			await expectVisible(page, '#chat-input');
			await expectVisible(page, '#chat-container .messages-container');

			await toggleParticipantsPanel(page);
			// 成员行锚点：现行成员面板（customization/meeting-participants-panel）成员列表为
			// [role=listitem]（旧 .local-participant-container 属 dormant 旧版面板，零实例）
			await expectVisible(page, '#participants-container [role="listitem"]');
			await expectVisible(page, 'ov-participant-panel-item');
			await expectHidden(page, '#chat-input');
			await expectHidden(page, '#chat-container .messages-container');

			await toggleChatPanel(page);
			await expectVisible(page, '#chat-input');
			await expectVisible(page, '#chat-container .messages-container');
			await expectHidden(page, '#participants-container [role="listitem"]');
			await expectHidden(page, 'ov-participant-panel-item');
		});
	});

	test('adapts panels and toolbar to a resized meeting container inside a desktop page', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await openMeeting(page, accessUrl);
		await toggleChatPanel(page);
		const drawer = page.locator('.sidenav-menu');
		// Side/over mode is signaled by .sidenav-over on .sidenav-container (session.component).
		const sidenavContainer = page.locator('.sidenav-container');
		await expect(sidenavContainer).not.toHaveClass(/sidenav-over/);

		// Simulate a narrow embedded host without resizing the browser viewport.
		const meeting = page.locator('#vc-container');
		await meeting.evaluate((element) => {
			element.style.width = '390px';
			element.style.height = '720px';
			element.style.marginLeft = '80px';
		});
		await expect(sidenavContainer).toHaveClass(/sidenav-over/);
		// 窄容器下面板入口仍可见：旧折叠菜单触发器（.fab-menu-trigger）已随 tab 条重绘删除，
		// 新解剖下面板 tab 常驻（聊天 tab 为面板入口代表）
		await expect(page.locator('#chat-panel-btn')).toBeVisible();
		await expect
			.poll(async () => {
				const host = await meeting.boundingBox();
				const panel = await drawer.boundingBox();
				return !!host && !!panel && panel.x >= host.x - 1 && panel.x + panel.width <= host.x + host.width + 1;
			})
			.toBe(true);

		await toggleChatPanel(page, 'close');
		for (const selector of ['#camera-btn', '#mic-btn', '#leave-btn']) {
			await expect(page.locator(selector)).toBeVisible();
			await expect
				.poll(async () => {
					const host = await meeting.boundingBox();
					const button = await page.locator(selector).boundingBox();
					return !!host && !!button && button.x >= host.x && button.x + button.width <= host.x + host.width;
				})
				.toBe(true);
		}
		await expect
			.poll(async () => {
				const host = await meeting.boundingBox();
				const stage = await page.locator('.sidenav-main').boundingBox();
				return !!host && !!stage && Math.abs(host.width - stage.width) <= 1;
			})
			.toBe(true);

		await meeting.evaluate((element) => {
			element.style.width = '';
			element.style.height = '';
			element.style.marginLeft = '';
		});
		// 面板已关：dock 形态可见入口是聊天胶囊（tab 条随 sidenav 关闭渲染隐藏）
		await expect(page.locator('#toolbar-chat-entry-btn')).toBeVisible();
		await toggleChatPanel(page);
		await expect(sidenavContainer).not.toHaveClass(/sidenav-over/);
	});

	test.describe('Settings Panel', () => {
		test('should open the SETTINGS panel and verify its content', async ({ page }) => {
			await openMeeting(page, accessUrl);

			await openSettingsPanel(page);
			await expectVisible(page, '#default-settings-panel');
		});

		test('should switch between sections in the SETTINGS panel and verify correct content is shown', async ({
			page
		}) => {
			await openMeeting(page, accessUrl);

			await openSettingsPanel(page);
			await expectVisible(page, '.sidenav-menu');

			await page.locator('#general-opt').click();
			await expectVisible(page, 'ov-participant-name-input');

			await page.locator('#video-opt').click();
			await expectVisible(page, 'ov-video-devices-select');

			await page.locator('#audio-opt').click();
			await expectVisible(page, 'ov-audio-devices-select');
		});
	});

	test.describe('Chat Panel', () => {
		test('should open and close the CHAT panel and verify its content', async ({ page }) => {
			await openMeeting(page, accessUrl);

			await toggleChatPanel(page, 'open');
			await expectVisible(page, '#chat-input');
			await expectVisible(page, '#chat-container .messages-container');

			await toggleChatPanel(page, 'close');
		});
	});

	test.describe('Participants Panel', () => {
		test('should open and close the PARTICIPANTS panel and verify its content', async ({ page }) => {
			await openMeeting(page, accessUrl);

			await toggleParticipantsPanel(page);
			await expectVisible(page, '.sidenav-menu');
			// 成员行锚点对齐现行成员面板（见「UI Navigation」用例注）
			await expectVisible(page, '#participants-container [role="listitem"]');
			await expectVisible(page, 'ov-participant-panel-item');

			await toggleParticipantsPanel(page);
			await expectHidden(page, '#participants-container [role="listitem"]');
			await expectHidden(page, 'ov-participant-panel-item');
		});
	});

	test.describe('Activities Panel', () => {
		test('should open and close the ACTIVITIES panel and verify its content', async ({ page }) => {
			await openMeeting(page, accessUrl);

			await toggleActivitiesPanel(page);
			await expectVisible(page, '.sidenav-menu');
			await expectVisible(page, '#activities-container');
			await expectVisible(page, '#recording-activity');

			await toggleActivitiesPanel(page);
			await expectHidden(page, '#activities-container');
			await expectHidden(page, '#recording-activity');
		});
	});
});

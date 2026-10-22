import { expect, type Page } from '@playwright/test';
import { click, expectHidden } from './ui-utils.helper';

// ─── More-options menu ──────────────────────────────────────────────────────

/**
 * Opens the "more options" toolbar menu and waits for its content to appear.
 */
export const openMoreOptionsMenu = async (page: Page): Promise<void> => {
	const moreOptionsButton = page.locator('#more-options-btn');
	await expect(moreOptionsButton).toBeVisible();
	await click(moreOptionsButton, 10_000);
	await expect(page.locator('.ant-dropdown-menu')).toBeVisible();
};

// ─── Chat panel ─────────────────────────────────────────────────────────────

/**
 * Ensures the chat panel is open or closed, clicking the appropriate control
 * only when the panel is not already in the desired state.
 */
export const toggleChatPanel = async (page: Page, action: 'open' | 'close' = 'open'): Promise<void> => {
	const chatInput = page.locator('#chat-input');

	if (action === 'open') {
		if (!(await chatInput.isVisible())) {
			const dockEntry = page.locator('#toolbar-chat-entry-btn');

			if (await dockEntry.isVisible()) {
				await dockEntry.click();
			} else {
				await page.locator('#chat-panel-btn').click();
			}
		}

		await expect(page.locator('#chat-container')).toBeVisible({ timeout: 10_000 });
		await expect(chatInput).toBeVisible({ timeout: 10_000 });
		return;
	}

	if (await chatInput.isVisible()) {
		const closeButton = page.locator('#chat-container .panel-close-button');
		const buttonToClick = (await closeButton.isVisible()) ? closeButton : page.locator('#chat-panel-btn');
		await buttonToClick.click();
	}

	await expect(page.locator('#chat-container')).toHaveCount(0, { timeout: 10_000 });
	await expect(chatInput).toHaveCount(0, { timeout: 10_000 });
};

/**
 * Fills the chat input and clicks the send button.
 */
export const sendChatMessage = async (page: Page, message: string): Promise<void> => {
	await page.locator('#chat-input').fill(message);
	await page.locator('#send-btn').click();
};

/**
 * Asserts that the chat contains exactly {@link count} messages.
 */
export const expectChatMessageCount = async (page: Page, count: number): Promise<void> => {
	await expect(page.locator('.message')).toHaveCount(count);
};

/**
 * Asserts that the first chat message was sent by {@link senderName}.
 */
export const expectFirstMessageSender = async (page: Page, senderName: string): Promise<void> => {
	await expect(page.locator('.participant-name-container > p').first()).toContainText(senderName);
};

/**
 * Asserts the number of clickable links inside chat messages.
 */
export const expectChatLinkCount = async (page: Page, count: number): Promise<void> => {
	await expect(page.locator('.chat-message a')).toHaveCount(count);
};

/**
 * Asserts that the chat message at {@link index} contains {@link text}.
 */
export const expectChatMessageTextAt = async (page: Page, index: number, text: string): Promise<void> => {
	await expect(page.locator('.chat-message').nth(index)).toContainText(text);
};

/**
 * Asserts that the link inside the chat message at {@link index} has an `href`
 * attribute matching the given substring.
 */
export const expectChatLinkHrefContains = async (
	page: Page,
	index: number,
	expectedHrefPart: string
): Promise<void> => {
	await expect(page.locator('.chat-message a').nth(index)).toHaveAttribute('href', new RegExp(expectedHrefPart));
};

/**
 * Asserts that a chat panel entry is available (`canReadChat` granted): the
 * dock chat pill is the always-visible entry in the dock-era form.
 */
export const expectChatAvailable = async (page: Page): Promise<void> => {
	await expect(page.locator('#toolbar-chat-entry-btn')).toBeVisible({ timeout: 10_000 });
};

/**
 * Asserts that no chat panel entry renders (`canReadChat` denied): neither the
 * dock pill nor the panel tab exists.
 */
export const expectNoChat = async (page: Page): Promise<void> => {
	await expect(page.locator('#toolbar-chat-entry-btn')).toHaveCount(0);
	await expect(page.locator('#chat-panel-btn')).toHaveCount(0);
};

// ─── Panel entries (dock-era form) ──────────────────────────────────────────
//
// 遗留清扫口径对齐（2026-10-14，积压清理批；同 share-link.test.ts 的 dock 优先模式）：
// 桌面 dock 形态下可见面板入口是两胶囊（成员 `#toolbar-participants-entry-btn` /
// 聊天 `#toolbar-chat-entry-btn`，toolbar.component.html 投影进媒体按钮组）；顶部 tab 条
// （`#activities-panel-btn`/`#participants-panel-btn`/`#chat-panel-btn`）挂在面板 sidenav 内，
// sidenav 关闭时整条渲染隐藏（Playwright 实探 visibility:hidden），面板打开后才可见。
// 故：成员/聊天优先点 dock 胶囊（开/关/切换皆可），tab 条作回退；activities 无 dock 胶囊，
// 其入口路径 = tab 条可见时直点，否则先经成员胶囊展开面板再点 activities tab。

/**
 * Clicks the participants panel entry, preferring the visible dock pill and
 * falling back to the panel tab (visible while the sidenav is open).
 */
export const toggleParticipantsPanel = async (page: Page): Promise<void> => {
	const dockEntry = page.locator('#toolbar-participants-entry-btn');

	if (await dockEntry.isVisible()) {
		await dockEntry.click();
		return;
	}

	await page.locator('#participants-panel-btn').click();
};

// ─── Activities panel ───────────────────────────────────────────────────────

/**
 * Toggles the activities side-panel open/closed. The activities tab lives in
 * the panel sidenav's tab strip: click it directly when visible (panel open),
 * otherwise expand the sidenav via the participants dock entry first.
 */
export const toggleActivitiesPanel = async (page: Page): Promise<void> => {
	const activitiesTab = page.locator('#activities-panel-btn');

	if (!(await activitiesTab.isVisible())) {
		await toggleParticipantsPanel(page);
	}

	await activitiesTab.click();
};

/**
 * Opens the activities panel and clicks a collaboration launcher card.
 */
export const openCollaborationFromActivities = async (page: Page, buttonId: string): Promise<void> => {
	await toggleActivitiesPanel(page);
	await expect(page.locator('#activities-container')).toBeVisible();
	await click(page.locator(`#${buttonId}`), 5_000);
};

// ─── Settings panel ─────────────────────────────────────────────────────────

/**
 * Opens the settings panel from the more-options menu and waits for the
 * sidenav to be visible.
 */
export const openSettingsPanel = async (page: Page): Promise<void> => {
	await openMoreOptionsMenu(page);
	await page.locator('#toolbar-settings-btn').click();
	await expect(page.locator('.sidenav-menu')).toBeVisible();
};

/**
 * Opens the layout settings via the settings panel (general tab extensions).
 */
export const openLayoutSettingsPanel = async (page: Page): Promise<void> => {
	await openSettingsPanel(page);
	await expect(page.locator('#layout-mosaic')).toBeVisible();
	await expect(page.locator('#settings-container')).toBeVisible();
};

/**
 * Closes the currently-open settings panel.
 */
export const closeSettingsPanel = async (page: Page): Promise<void> => {
	await page.locator('.panel-close-button').click();
	await expectHidden(page, '#settings-container');
};

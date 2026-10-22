import { type Page } from '@playwright/test';
import { expectHidden, expectVisible } from './ui-utils.helper';

/**
 * 遗留清扫口径对齐（2026-10-14，随 share-link.test.ts 同口径）：旧选择器 `#participants-invite-btn`
 * 与 `#share-link-overlay` 在现行 UI 零实例（运行时不渲染）。现行参与者面板的分享链接入口为
 * `canShareAccessLinks` 驱动的 `@if (showInviteButton())` 两个邀请钮：
 *  - 面板底部「邀请」`.participants-footer .invite-button`（有远端成员时唯一入口）；
 *  - 成员空态「立即邀请」`.members-empty-invite-btn`（独自入会时入口）。
 */

/**
 * Opens the participants panel. At the desktop dock the visible entry is the pill button
 * (`#toolbar-participants-entry-btn`); the top tab strip (`#participants-panel-btn`) renders
 * hidden in this layout, so prefer the dock entry and fall back to the tab (同
 * share-link.test.ts 的 openParticipantsPanel).
 */
const openParticipantsPanel = async (page: Page): Promise<void> => {
	const dockEntry = page.locator('#toolbar-participants-entry-btn');

	if (await dockEntry.isVisible()) {
		await dockEntry.click();
		return;
	}

	await page.locator('#participants-panel-btn').click();
};

/**
 * Asserts that sharing access links is available (`canShareAccessLinks` granted): both current
 * invite entries of the participants panel are shown.
 */
export const expectShareAccessLinkAvailable = async (page: Page): Promise<void> => {
	await openParticipantsPanel(page);
	await expectVisible(page, '.participants-footer .invite-button');
	await expectVisible(page, '.members-empty-invite-btn');
};

/**
 * Asserts that sharing access links is not available (`canShareAccessLinks` denied): no invite
 * entry renders in the participants panel.
 */
export const expectNoShareAccessLink = async (page: Page): Promise<void> => {
	await openParticipantsPanel(page);
	await expectHidden(page, '.participants-footer .invite-button');
	await expectHidden(page, '.members-empty-invite-btn');
};

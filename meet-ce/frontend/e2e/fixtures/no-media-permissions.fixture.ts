import { test as base, chromium, type Page } from '@playwright/test';

/**
 * Extends the base Playwright test with a `noMediaPage` fixture.
 *
 * `noMediaPage` launches a dedicated Chromium instance that has no
 * `--use-fake-ui-for-media-stream` flag and no media permissions granted.
 * This ensures `getUserMedia()` is properly blocked by the browser, regardless
 * of the project-level launch flags used by the rest of the test suite.
 */
export const test = base.extend<{ noMediaPage: Page }>({
	noMediaPage: async ({}, use, testInfo) => {
		const browser = await chromium.launch({
			headless: testInfo.project.use.headless,
			args: ['--window-size=1366,900']
		});
		const context = await browser.newContext({
			permissions: [],
			viewport: { width: 1366, height: 900 }
		});
		const page = await context.newPage();

		await use(page);

		await context.close();
		await browser.close();
	}
});

export { expect } from '@playwright/test';

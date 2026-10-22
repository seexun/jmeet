import { expect, type Locator, type Page } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

// ─── Low-level click / hover ────────────────────────────────────────────────

/**
 * Clicks a locator within the given timeout.
 */
export const click = async (locator: Locator, timeoutMs = 5_000): Promise<void> => {
	await locator.click({ timeout: timeoutMs });
};

/**
 * Clicks a control button identified by CSS selector after verifying it is visible.
 */
export const clickControlButton = async (page: Page, selector: string, timeoutMs = 5_000): Promise<void> => {
	const button = page.locator(selector);
	await expect(button).toBeVisible({ timeout: timeoutMs });
	await click(button, timeoutMs);
};

/**
 * Hovers over a stream element so that overlay controls become visible.
 *
 * @param selector - CSS selector for the stream element. Defaults to the local stream.
 */
export const hoverStream = async (page: Page, selector = '.OV_stream_video.local'): Promise<void> => {
	await page.locator(selector).first().hover();
};

// ─── Visibility assertions ──────────────────────────────────────────────────

/**
 * Asserts that at least one element matching {@link selector} is visible.
 */
export const expectVisible = async (page: Page, selector: string): Promise<void> => {
	await expect(page.locator(selector)).toBeVisible();
};

export const expectDisabled = async (page: Page, selector: string): Promise<void> => {
	const locator = page.locator(selector);
	await expect(locator).toBeVisible();
	await expect(locator).toBeDisabled();
};

/**
 * Asserts that no element matching {@link selector} is visible (either absent or hidden).
 */
export const expectHidden = async (page: Page, selector: string): Promise<void> => {
	const locator = page.locator(selector);

	await expect
		.poll(
			async () => {
				const count = await locator.count();

				if (count === 0) {
					return true;
				}

				for (let index = 0; index < count; index += 1) {
					if (await locator.nth(index).isVisible()) {
						return false;
					}
				}

				return true;
			},
			{ timeout: 10_000 }
		)
		.toBeTruthy();
};

/**
 * Asserts that a snackbar notification is currently visible.
 */
export const expectSnackbarNotification = (page: Page): Promise<void> => {
	return expectVisible(page, '.snackbarNotification');
};

// ─── Clipboard ──────────────────────────────────────────────────────────────

/**
 * Installs a `copy` event listener that captures clipboard text into
 * `window.__ovCopiedText`. Call once per page before triggering copy actions.
 */
export const installClipboardCapture = async (page: Page): Promise<void> => {
	await page.evaluate(() => {
		const w = window as Window & {
			__ovCopiedText?: string;
			__ovClipboardCaptureInstalled?: boolean;
		};

		if (w.__ovClipboardCaptureInstalled) {
			return;
		}

		w.__ovClipboardCaptureInstalled = true;
		w.__ovCopiedText = '';

		document.addEventListener(
			'copy',
			() => {
				const activeElement = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
				const activeValue =
					activeElement && typeof activeElement.value === 'string' ? activeElement.value.trim() : '';
				const selectedText = document.getSelection()?.toString().trim() ?? '';

				w.__ovCopiedText = selectedText || activeValue || w.__ovCopiedText || '';
			},
			true
		);
	});
};

/**
 * Returns the text most recently captured by {@link installClipboardCapture},
 * falling back to the native clipboard API.
 */
export const getCopiedText = async (page: Page): Promise<string> => {
	return await page.evaluate(async () => {
		const w = window as Window & { __ovCopiedText?: string };
		const capturedText = w.__ovCopiedText?.trim() ?? '';

		if (capturedText) {
			return capturedText;
		}

		try {
			return (await navigator.clipboard.readText()).trim();
		} catch {
			return '';
		}
	});
};

/**
 * Polls until the captured clipboard text looks like a URL.
 */
export const expectCopiedUrl = async (page: Page, timeoutMs = 5_000): Promise<void> => {
	await expect.poll(async () => await getCopiedText(page), { timeout: timeoutMs }).toMatch(/^https?:\/\//);
};

/**
 * Polls until the captured clipboard text exactly matches {@link expectedText}.
 */
export const expectCopiedText = async (page: Page, expectedText: string, timeoutMs = 5_000): Promise<void> => {
	await expect.poll(async () => await getCopiedText(page), { timeout: timeoutMs }).toBe(expectedText);
};

// ─── Screenshot / image comparison ──────────────────────────────────────────

/**
 * Takes a screenshot of the first `.OV_video-element` on the page.
 */
export const captureVideoElementScreenshot = async (page: Page): Promise<Buffer> => {
	const videoLocator = page.locator('.OV_video-element').first();
	await expect(videoLocator).toBeVisible({ timeout: 5_000 });
	return await videoLocator.screenshot({ timeout: 10_000 });
};

/**
 * Asserts that two PNG buffers differ by more than a minimum number of pixels,
 * useful for verifying that a visual change (e.g. background effect) was applied.
 */
export const expectSignificantImageDifference = (
	beforePngBuffer: Buffer,
	afterPngBuffer: Buffer,
	options?: { threshold?: number; minDiffPixels?: number }
): void => {
	const beforeImg = PNG.sync.read(beforePngBuffer);
	const afterImg = PNG.sync.read(afterPngBuffer);
	const width = Math.min(beforeImg.width, afterImg.width);
	const height = Math.min(beforeImg.height, afterImg.height);
	const normalizedBefore = new PNG({ width, height });
	const normalizedAfter = new PNG({ width, height });
	PNG.bitblt(beforeImg, normalizedBefore, 0, 0, width, height, 0, 0);
	PNG.bitblt(afterImg, normalizedAfter, 0, 0, width, height, 0, 0);
	const diff = new PNG({ width, height });

	const numDiffPixels = pixelmatch(normalizedBefore.data, normalizedAfter.data, diff.data, width, height, {
		threshold: options?.threshold ?? 0.4
	});

	expect(numDiffPixels).toBeGreaterThan(options?.minDiffPixels ?? 500);
};

// ─── Bounding box ───────────────────────────────────────────────────────────

/**
 * Returns the bounding box of the first element matching {@link selector}, or
 * `null` if the element is not found or not visible.
 */
export const getElementBoundingBox = async (
	page: Page,
	selector: string
): Promise<{ x: number; y: number; width: number; height: number } | null> => {
	const locator = page.locator(selector).first();
	await expect(locator).toBeVisible({ timeout: 5_000 });

	const box = await locator.boundingBox();

	if (!box) {
		return null;
	}

	return {
		x: box.x,
		y: box.y,
		width: box.width,
		height: box.height
	};
};

// ─── getUserMedia instrumentation ────────────────────────────────────────────

/**
 * Wraps `navigator.mediaDevices.getUserMedia` *before any application code runs* so its
 * invocations can be counted. Must be called before navigating to the app — it registers an init
 * script that re-installs the wrapper on every navigation. Read the tally with
 * {@link getGetUserMediaCallCount}.
 */
export const installGetUserMediaCounter = async (page: Page): Promise<void> => {
	await page.addInitScript(() => {
		const w = window as Window & { __ovGumCalls?: Array<{ audio: boolean; video: boolean }> };
		w.__ovGumCalls = [];

		const mediaDevices = navigator.mediaDevices;

		if (!mediaDevices?.getUserMedia) {
			return;
		}

		const original = mediaDevices.getUserMedia.bind(mediaDevices);

		mediaDevices.getUserMedia = (constraints?: MediaStreamConstraints) => {
			// Record only whether each kind was requested — enough to tell a per-kind acquisition
			// apart from a combined {audio,video} permission probe, and trivially serialisable.
			w.__ovGumCalls?.push({
				audio: Boolean(constraints?.audio),
				video: Boolean(constraints?.video)
			});
			return original(constraints as MediaStreamConstraints);
		};
	});
};

/**
 * Returns how many times `navigator.mediaDevices.getUserMedia` has been called since
 * {@link installGetUserMediaCounter} was installed for the current page load.
 */
export const getGetUserMediaCallCount = async (page: Page): Promise<number> => {
	return (await getGetUserMediaCalls(page)).length;
};

/**
 * Returns one entry per `navigator.mediaDevices.getUserMedia` call since
 * {@link installGetUserMediaCounter} was installed, each flagging whether audio/video was requested.
 * A combined `{ audio: true, video: true }` entry is the signature of the old permission probe.
 */
export const getGetUserMediaCalls = async (page: Page): Promise<Array<{ audio: boolean; video: boolean }>> => {
	return await page.evaluate(
		() => (window as Window & { __ovGumCalls?: Array<{ audio: boolean; video: boolean }> }).__ovGumCalls ?? []
	);
};

import { expect, type Locator, type Page } from '@playwright/test';
import { hoverStream } from './ui-utils.helper';

/**
 * Polls the bounding box of {@link locator} until it stops moving / resizing or
 * the timeout elapses. Used to gate clicks on tiles that are mid-reflow (e.g. the
 * settings panel just closed, or the smart-layout slider just changed): without
 * this, the click target keeps reporting "element is not stable" or detaches
 * from the DOM right when the click is dispatched.
 */
const waitForBoundingBoxStable = async (
	locator: Locator,
	{ samples = 4, intervalMs = 100, timeoutMs = 5_000 }: { samples?: number; intervalMs?: number; timeoutMs?: number } = {}
): Promise<void> => {
	const deadline = Date.now() + timeoutMs;
	let stableHits = 0;
	let prev = await locator.boundingBox();

	while (Date.now() < deadline) {
		await locator.page().waitForTimeout(intervalMs);
		const next = await locator.boundingBox();

		const matches =
			!!prev &&
			!!next &&
			Math.abs(prev.x - next.x) < 1 &&
			Math.abs(prev.y - next.y) < 1 &&
			Math.abs(prev.width - next.width) < 1 &&
			Math.abs(prev.height - next.height) < 1;

		stableHits = matches ? stableHits + 1 : 0;
		prev = next;

		if (stableHits >= samples) return;
	}
};

// ─── Remote stream waiting ──────────────────────────────────────────────────

/**
 * Waits until the expected number of remote streams are visible, the specified
 * number have playable video tracks, and the expected number of remote audio
 * elements are mounted (hidden) in the persistent audio layer.
 *
 * Audio is no longer attached to the `<video>` element — `SmartLayoutComponent`
 * mounts a dedicated `<audio data-participant data-source>` per remote audio
 * track inside a `[hidden]` container so playback survives layout changes and
 * works on Safari. We assert those elements exist with live tracks.
 *
 * @param count   - Total visible remote streams expected.
 * @param options.videoCount - How many of the streams must have playable video.
 *   Defaults to {@link count}. Lower when some participants have camera off.
 * @param options.audioCount - How many hidden remote `<audio>` elements with
 *   live tracks are expected. Defaults to {@link count}. Override for cases
 *   where audio and visible-stream counts diverge (e.g. screen-share without
 *   audio, or a remote with mic off).
 */
export const waitForRemoteStream = async (
	page: Page,
	count = 1,
	options?: { videoCount?: number; audioCount?: number }
): Promise<void> => {
	const expectedVideoCount = options?.videoCount ?? count;
	const expectedAudioCount = options?.audioCount ?? count;

	await expect
		.poll(
			async () =>
				await page.evaluate(() => {
					const remoteStreams = Array.from(document.querySelectorAll('.OV_stream.remote')) as HTMLElement[];
					const visibleRemoteStreams = remoteStreams.filter((stream) => {
						const rect = stream.getBoundingClientRect();
						const style = window.getComputedStyle(stream);
						return (
							rect.width > 0 &&
							rect.height > 0 &&
							style.display !== 'none' &&
							style.visibility !== 'hidden' &&
							style.opacity !== '0' &&
							!stream.classList.contains('no-size')
						);
					});

					const playableRemoteVideos = visibleRemoteStreams.filter((stream) => {
						const video = stream.querySelector('video') as HTMLVideoElement | null;

						if (
							!video ||
							!video.srcObject ||
							video.paused ||
							video.readyState < 2 ||
							video.videoWidth <= 0
						) {
							return false;
						}

						const mediaStream = video.srcObject as MediaStream;
						const liveVideoTracks = mediaStream
							.getVideoTracks()
							.filter((track) => track.readyState === 'live');

						return liveVideoTracks.length > 0;
					});

					const audioElements = Array.from(
						document.querySelectorAll('audio[data-participant]')
					) as HTMLAudioElement[];
					const hiddenLiveRemoteAudios = audioElements.filter((audio) => {
						if (!audio.closest('[hidden]')) return false;

						const stream = audio.srcObject as MediaStream | null;

						if (!stream) return false;

						return stream.getAudioTracks().some((track) => track.readyState === 'live');
					});

					return {
						visibleRemoteStreams: visibleRemoteStreams.length,
						playableRemoteVideos: playableRemoteVideos.length,
						hiddenLiveRemoteAudios: hiddenLiveRemoteAudios.length
					};
				}),
			{ timeout: 15_000 }
		)
		.toEqual({
			visibleRemoteStreams: count,
			playableRemoteVideos: expectedVideoCount,
			hiddenLiveRemoteAudios: expectedAudioCount
		});
};

// ─── Remote participant name helpers ────────────────────────────────────────

/**
 * Returns the deduplicated display names of all visible remote participants.
 */
export const getVisibleRemoteParticipantNames = async (page: Page): Promise<string[]> => {
	return await page.evaluate(() => {
		const names = Array.from(document.querySelectorAll('.OV_stream_video.remote'))
			.filter((stream) => {
				const element = stream as HTMLElement;
				const rect = element.getBoundingClientRect();
				const style = window.getComputedStyle(element);
				return (
					rect.width > 0 &&
					rect.height > 0 &&
					style.display !== 'none' &&
					style.visibility !== 'hidden' &&
					style.opacity !== '0' &&
					!element.classList.contains('no-size')
				);
			})
			.map((stream) => stream.querySelector('#participant-name-container')?.textContent?.trim() ?? '')
			.filter((name) => name.length > 0);

		return [...new Set(names)];
	});
};

/**
 * Polls until the visible remote participant names satisfy the given constraints
 * (count, includes, excludes).
 */
export const waitForVisibleRemoteParticipants = async (
	page: Page,
	options: { includes?: string[]; excludes?: string[]; count?: number },
	timeout = 20_000
): Promise<void> => {
	await expect
		.poll(
			async () => {
				const names = await getVisibleRemoteParticipantNames(page);

				return {
					matchesCount: options.count === undefined || names.length === options.count,
					matchesIncludes: (options.includes ?? []).every((name) => names.includes(name)),
					matchesExcludes: (options.excludes ?? []).every((name) => !names.includes(name))
				};
			},
			{ timeout }
		)
		.toEqual({
			matchesCount: true,
			matchesIncludes: true,
			matchesExcludes: true
		});
};

// ─── Element count assertions ───────────────────────────────────────────────

/**
 * Asserts the total number of `<video>` elements on the page.
 */
export const expectVideoCount = async (page: Page, count: number): Promise<void> => {
	await expect(page.locator('video')).toHaveCount(count);
};

/**
 * Asserts the number of publisher stream containers.
 */
export const expectStreamCount = async (page: Page, count: number): Promise<void> => {
	await expect(page.locator('.OV_publisher .OV_stream')).toHaveCount(count);
};

/**
 * Asserts the number of screen-share stream elements.
 */
export const expectScreenShareCount = async (page: Page, count: number): Promise<void> => {
	await expect(page.locator('.OV_screen')).toHaveCount(count);
};

/**
 * Asserts the number of `.screen-source` elements.
 */
export const expectScreenSourceCount = async (page: Page, count: number): Promise<void> => {
	await expect(page.locator('.OV_video-element.screen-source')).toHaveCount(count, { timeout: 10_000 });
};

/**
 * Asserts expected counts for local video and/or audio elements.
 */
export const expectLocalStreamCount = async (page: Page, counts: { video?: number; audio?: number }): Promise<void> => {
	if (counts.video !== undefined) {
		await expect(page.locator('.OV_stream.local .OV_video-element')).toHaveCount(counts.video);
		await expect(page.locator('video')).toHaveCount(counts.video);
	}

	if (counts.audio !== undefined) {
		await expect(page.locator('.OV_stream.local .OV_audio-element')).toHaveCount(counts.audio);
		await expect(page.locator('audio')).toHaveCount(counts.audio);
	}
};

// ─── Persistent audio layer ─────────────────────────────────────────────────

/**
 * Returns the number of `<audio data-participant>` elements in the hidden
 * audio container that currently have `muted === true`.
 */
export const countMutedRemoteAudios = async (page: Page): Promise<number> => {
	return await page.evaluate(() => {
		const audios = Array.from(document.querySelectorAll('audio[data-participant]')) as HTMLAudioElement[];

		return audios.filter((a) => a.muted).length;
	});
};

// ─── Pinning ────────────────────────────────────────────────────────────────

/**
 * Asserts the number of currently-pinned streams.
 */
export const expectPinnedStreamCount = async (page: Page, count: number): Promise<void> => {
	await expect(page.locator('.OV_big .OV_stream')).toHaveCount(count, { timeout: 10_000 });
};

/**
 * Toggles the pin state of a stream by clicking on the element matching {@link selector}
 * and then clicking the pin/unpin button that appears.
 * Automatically detects whether the stream is currently pinned and clicks the appropriate button.
 */
export const toggleStreamPin = async (page: Page, selector: string, timeoutMs = 10_000): Promise<void> => {
	const target = page.locator(selector).first();
	await target.waitFor({ state: 'visible', timeout: timeoutMs });

	// Tests routinely call this right after closing the settings panel or moving the
	// smart-mosaic slider — both of which trigger layout reflows that keep moving the
	// tile (and re-mounting its inner controls) for a few hundred ms. Without a settle
	// wait, the click reports "element is not stable" repeatedly and eventually
	// "element was detached from the DOM".
	await waitForBoundingBoxStable(target);

	await target.hover();

	// Scope pin/unpin lookup to the target stream — `#pin-btn` is duplicated
	// across streams, and an unrelated (e.g. local) stream's button may be
	// momentarily visible.
	const pinButton = target.locator('#pin-btn');
	const unpinButton = target.locator('#unpin-btn');

	await expect(pinButton.or(unpinButton)).toBeVisible({ timeout: timeoutMs });

	const willPin = await pinButton.isVisible();
	const buttonToClick = willPin ? pinButton : unpinButton;

	// Re-hover immediately before the click. Between the visibility check and the
	// click, the stream-component's HOVER_TIMEOUT (2s) can elapse and hide the
	// controls — re-hovering keeps the button in the DOM long enough to land the click.
	await target.hover();
	await buttonToClick.click();

	if (willPin) {
		await expect(page.locator('.OV_big .OV_stream').first()).toBeVisible({ timeout: timeoutMs });
	} else {
		await expect(page.locator('.OV_big .OV_stream')).toHaveCount(0, { timeout: timeoutMs });
	}
};

/**
 * Unpins the currently-pinned stream by clicking it and toggling the pin button.
 */
export const unpinCurrentPinnedStream = async (page: Page, timeoutMs = 10_000): Promise<void> => {
	const pinnedStream = page.locator('.OV_big').first();
	await pinnedStream.click({ force: true });

	const unpinButton = pinnedStream.locator('#unpin-btn').first();
	await expect(unpinButton).toBeVisible({ timeout: timeoutMs });
	await unpinButton.click();
	await expect(page.locator('.OV_big .OV_stream')).toHaveCount(0, { timeout: timeoutMs });
};

// ─── Track label inspection ──────────────────────────────────────────────────

/**
 * Returns the label of the first video track on the page, or `null` if none exists.
 */
export const getFirstVideoTrackLabel = async (page: Page): Promise<string | null> => {
	return await page.evaluate(() => {
		const video = document.querySelector('video') as HTMLVideoElement | null;
		const stream = video?.srcObject as MediaStream | null;
		const track = stream?.getVideoTracks()?.[0];
		return track?.label ?? null;
	});
};

/**
 * Returns the `deviceId` actually backing the first video track on the page, or `null` if none
 * exists. Unlike the track label, the deviceId is a stable identifier for the underlying camera and
 * is what device-selection comparisons should key on.
 */
export const getFirstVideoTrackDeviceId = async (page: Page): Promise<string | null> => {
	return await page.evaluate(() => {
		const video = document.querySelector('video') as HTMLVideoElement | null;
		const stream = video?.srcObject as MediaStream | null;
		const track = stream?.getVideoTracks()?.[0];
		return track?.getSettings?.().deviceId ?? null;
	});
};

/**
 * Returns the label of the screen-share video track, or `null` if none exists.
 */
export const getScreenTrackLabel = async (page: Page): Promise<string | null> => {
	return await page.evaluate(() => {
		const screenVideo = document.querySelector('.OV_video-element.screen-source') as HTMLVideoElement | null;
		const stream = screenVideo?.srcObject as MediaStream | null;
		const track = stream?.getVideoTracks()?.[0];
		return track?.label ?? null;
	});
};

// ─── Screen-source track inspection ─────────────────────────────────────────

/**
 * Returns metadata for every track inside the first `.screen-source` video element.
 */
export const getScreenSourceTracks = async (
	page: Page
): Promise<Array<{ kind: string; enabled: boolean; id: string; label: string }>> => {
	return await page.evaluate(() => {
		const video = document.querySelector('.OV_video-element.screen-source') as HTMLVideoElement | null;

		if (!video || !video.srcObject) {
			return [];
		}

		const stream = video.srcObject as MediaStream;

		return stream.getTracks().map((track: MediaStreamTrack) => ({
			kind: track.kind,
			enabled: track.enabled,
			id: track.id,
			label: track.label
		}));
	});
};

// ─── Stream layout (float / dock / drag) ─────────────────────────────

/**
 * Floats the local stream by hovering and clicking the float button.
 */
export const floatStream = async (page: Page): Promise<void> => {
	await hoverStream(page, '.OV_publisher .OV_stream_video.local');
	await expect(page.locator('#float-btn')).toBeVisible();
	await page.locator('#float-btn').click();
};

/**
 * Docks (restores) the local stream by hovering and clicking the
 * float/dock toggle button.
 */
export const dockStream = async (page: Page): Promise<void> => {
	await hoverStream(page, '.local_participant .OV_stream_video.local');
	await expect(page.locator('#float-btn')).toBeVisible();
	await page.locator('#float-btn').click();
};

/**
 * Drags a resize handle on the floating local video by the given pixel delta.
 * {@link handleClass} should be one of: resize-se, resize-sw, resize-ne, resize-nw.
 */
export const resizeStream = async (page: Page, handleClass: string, deltaX: number, deltaY: number): Promise<void> => {
	const handle = page.locator(`.OV_floating .resize-handle.${handleClass}`).first();
	await expect(handle).toBeVisible({ timeout: 5_000 });
	const box = await handle.boundingBox();

	if (!box) throw new Error(`Resize handle .${handleClass} not found`);

	const startX = box.x + box.width / 2;
	const startY = box.y + box.height / 2;
	await page.mouse.move(startX, startY);
	await page.mouse.down();
	await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 10 });
	await page.mouse.up();
};

// ─── Screen-share zoom controls ─────────────────────────────────────────────

/**
 * Locator for the local screen-share stream container.
 */
export const screenShareStream = (page: Page): Locator => page.locator('.local_participant.OV_screen').first();

/**
 * Hovers the local screen-share stream so its overlay controls (pin + the zoom
 * feature group) become visible, and returns the screen-share container locator.
 *
 * Sharing your own screen pops the "share this link" panel and reflows the
 * layout, so a single `.hover()` can land while the tile is still moving and
 * never trigger the overlay. Retrying the hover until `.stream-video-controls`
 * is actually visible makes the helper robust against that reflow.
 */
export const hoverScreenShareStream = async (page: Page): Promise<Locator> => {
	const container = screenShareStream(page);
	await expect(container).toBeVisible({ timeout: 10_000 });

	const controls = container.locator('.stream-video-controls');
	await expect(async () => {
		await container.hover();
		await expect(controls).toBeVisible({ timeout: 1_000 });
	}).toPass({ timeout: 15_000 });

	return container;
};

/**
 * Reads the screen-share zoom percentage from the `#zoom-level` label. Returns
 * 100 when no label is present (i.e. the stream is at its 1x base, where the
 * label is intentionally hidden).
 */
export const readZoomPercent = async (page: Page): Promise<number> => {
	const label = screenShareStream(page).locator('#zoom-level');

	if ((await label.count()) === 0) {
		return 100;
	}

	const text = (await label.textContent())?.trim() ?? '';
	const value = Number.parseInt(text.replace('%', ''), 10);
	return Number.isNaN(value) ? 100 : value;
};

/**
 * Clicks the screen-share zoom-in button {@link times} times, verifying the
 * displayed percentage strictly increases on each step. Re-hovers and retries
 * each click because the button shifts position as the reset/zoom-out buttons
 * and the percentage label appear on the first zoom step, which can otherwise
 * race a click against the re-render.
 */
export const zoomInScreenShare = async (page: Page, times = 1): Promise<void> => {
	const container = await hoverScreenShareStream(page);
	const zoomIn = container.locator('#zoom-in-btn');

	// Thread the last confirmed percentage forward instead of re-reading a fresh
	// baseline each iteration: a fresh read can momentarily see the label detached
	// (returning 100) and let a no-op click "pass", silently dropping a step.
	let confirmed = await readZoomPercent(page);

	for (let i = 0; i < times; i += 1) {
		const previous = confirmed;

		await expect(async () => {
			await container.hover();
			await expect(zoomIn).toBeVisible({ timeout: 1_000 });
			await zoomIn.click();
			// The percentage is driven by a signal; give Angular a tick to flush the text.
			await expect.poll(() => readZoomPercent(page), { timeout: 1_000 }).toBeGreaterThan(previous);
		}).toPass({ timeout: 10_000 });

		confirmed = await readZoomPercent(page);
	}
};

/**
 * Clicks a scoped zoom control (e.g. `#zoom-out-btn`, `#reset-zoom-btn`) on the
 * screen-share stream, re-hovering first so the auto-hide timer can't remove it.
 */
export const clickZoomControl = async (page: Page, buttonId: string): Promise<void> => {
	const container = await hoverScreenShareStream(page);
	const button = container.locator(`#${buttonId}`);
	await expect(button).toBeVisible({ timeout: 5_000 });
	await button.click();
};

/**
 * Returns the ordered ids of the elements inside the screen-share zoom control
 * group, e.g. `['reset-zoom-btn', 'zoom-out-btn', 'zoom-level', 'zoom-in-btn']`.
 */
export const getZoomControlOrder = async (page: Page): Promise<string[]> => {
	const container = await hoverScreenShareStream(page);

	return await container
		.locator('.stream-video-controls .control-group > *')
		.evaluateAll((elements) => elements.map((element) => element.id).filter((id) => id.length > 0));
};

/**
 * Drags a stream element to a new viewport position.
 */
export const dragStream = async (page: Page, selector: string, targetX: number, targetY: number): Promise<void> => {
	const element =
		selector === '.local_participant'
			? page.locator('.local_participant:has(.OV_stream_video.local)').first()
			: page.locator(selector).first();

	await expect(element).toBeVisible({ timeout: 5_000 });
	const box = await element.boundingBox();

	if (!box) {
		throw new Error('Element not found for dragging');
	}

	await element.hover();
	await page.mouse.down();
	await page.mouse.move(targetX, targetY, { steps: 10 });
	await page.mouse.up();
};

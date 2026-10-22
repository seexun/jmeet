import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from './runtime-config.service';

/**
 * Centralizes resolution of bundled static asset URLs (images, sounds, virtual
 * backgrounds, …).
 *
 * Components and services should depend on this service instead of injecting
 * {@link RuntimeConfigService} and hardcoding `assets/...` paths. Asset filenames
 * live here as the single source of truth, so renaming or re-encoding an asset
 * (e.g. PNG → WebP) is a one-line change.
 *
 * URLs are resolved through `RuntimeConfigService.resolveUrl()`, so they are
 * correct in both SPA and webcomponent modes. The members are getters that
 * read the runtime config's `serverBaseUrl` signal lazily; wrap them in a
 * `computed()` where reactivity to a late-resolved server URL is required (e.g.
 * the webcomponent shell, constructed before the server URL is known).
 */
@Injectable({
	providedIn: 'root'
})
export class AssetsService {
	private readonly runtimeConfig = inject(RuntimeConfigService);

	// ── Images ──────────────────────────────────────────────────────────────

	/** Default brand logo (J mark, PNG). */
	get logo(): string {
		return this.resolve('assets/images/jmeet-logo.png');
	}

	/** Recording panel empty-state illustration. */
	get recordingPlaceholder(): string {
		return this.resolve('assets/images/recording-placeholder.webp');
	}

	// ── Sounds ──────────────────────────────────────────────────────────────

	/** Notification played when a participant joins the meeting. */
	get participantJoinedSound(): string {
		return this.resolve('assets/sounds/participant-joined.mp3');
	}

	/** Notification played when a participant's role is upgraded. */
	get roleUpgradedSound(): string {
		return this.resolve('assets/sounds/role-upgraded.wav');
	}

	/** Notification played when a participant's role is downgraded. */
	get roleDowngradedSound(): string {
		return this.resolve('assets/sounds/role-downgraded.wav');
	}

	/** Notification played when a chat message arrives. */
	get chatMessageSound(): string {
		return this.resolve('assets/sounds/chat-message.mp3');
	}

	// ── Workers ───────────────────────────────────────────────────────────────

	/** LiveKit client E2EE worker module. */
	get e2eeWorker(): string {
		return this.resolve('assets/livekit/livekit-client.e2ee.worker.mjs');
	}

	// ── Virtual backgrounds ───────────────────────────────────────────────────

	/**
	 * Resolves a virtual-background asset under `assets/backgrounds/`.
	 * @param path background-relative path, e.g. `professional/professional-1.webp`
	 */
	background(path: string): string {
		return this.resolve(`assets/backgrounds/${path}`);
	}

	// ── Generic ───────────────────────────────────────────────────────────────

	/** Resolves an arbitrary app-relative asset path to a deployment-correct URL. */
	resolve(path: string): string {
		return this.runtimeConfig.resolveUrl(path);
	}
}

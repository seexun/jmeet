import {
	ChangeDetectionStrategy,
	Component,
	computed,
	contentChildren,
	effect,
	ElementRef,
	inject,
	input,
	OnDestroy,
	output,
	signal,
	untracked,
	viewChild
} from '@angular/core';
import { LayoutAdditionalElementsDirective } from '../../../directives/template/internals.directive';
import { ParticipantModel, ParticipantStream } from '../../../models/participant.model';
import { SmartLayoutService } from '../../../services/layout/smart-layout.service';
import { ParticipantService } from '../../../services/participant/participant.service';
import { Track } from '../../../services/livekit-adapter';
import { HiddenParticipantsIndicatorComponent } from '../../hidden-participants-indicator/hidden-participants-indicator.component';
import { BaseLayoutComponent } from '../base-layout.component';

interface PersistentAudioEntry {
	element: HTMLAudioElement;
	track: Track;
	mounted: boolean;
}

@Component({
	selector: 'ov-smart-layout',
	imports: [
		BaseLayoutComponent,
		LayoutAdditionalElementsDirective,
		HiddenParticipantsIndicatorComponent
	],
	templateUrl: './smart-layout.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true
})
export class SmartLayoutComponent implements OnDestroy {
	readonly layoutService = inject(SmartLayoutService);
	private readonly participantService = inject(ParticipantService);

	/** `*ovLayoutAdditionalElements` directives projected from the parent. */
	readonly projectedAdditionalElements = contentChildren(LayoutAdditionalElementsDirective);

	/** Whether smart-layout mode is allowed by the host. Defaults to `true`. */
	readonly ovSmartLayoutAllowed = input(true);

	/** Whether to show the hidden-participants indicator badge. Defaults to `true`. */
	readonly ovShowHiddenParticipantsIndicator = input(true);

	/** Emits when the user clicks the hidden-participants indicator. */
	readonly hiddenParticipantsIndicatorClicked = output<void>();

	/** Hidden container that hosts the persistent `<audio>` elements (DOM-mounted for Safari). */
	private readonly audioContainer = viewChild<ElementRef<HTMLElement>>('audioContainer');

	readonly remoteParticipants = this.participantService.remoteParticipants;
	readonly localParticipant = this.participantService.localParticipant;

	/** True when both the host allows smart layout and the service has it enabled. */
	readonly isSmartLayoutActive = computed(
		() => this.ovSmartLayoutAllowed() && this.layoutService.isSmartLayoutEnabled()
	);

	/**
	 * Previous-frame identity order for the camera-stream `@for` loop.
	 * Pure backing state for {@link displayedCameraOrder}; never mutated from computeds.
	 * In-place replacements (departing → arriving at the same index) let Angular see
	 * INSERT+REMOVE at the same slot rather than a DOM MOVE, preventing layout crashes.
	 */
	private readonly _displayedCameraOrder = signal<string[]>([]);

	/**
	 * Derives the next identity order from the current inputs and the previous order.
	 * Pure — does not mutate `_displayedCameraOrder`; {@link orderSyncEffect} persists the
	 * result back so the next evaluation sees the up-to-date previous frame.
	 */
	private readonly displayedCameraOrder = computed<string[]>(() => {
		const allRemotes = this.remoteParticipants();
		const isSmart = this.isSmartLayoutActive();
		const previous = untracked(() => this._displayedCameraOrder());

		if (!isSmart) {
			// Mosaic mode: preserve previous order across smart↔mosaic transitions so existing
			// DOM nodes keep their positions. Newcomers are appended at the end.
			const allIds = allRemotes.map((p) => p.identity);
			const allIdSet = new Set(allIds);
			const mosaicOrder = previous.filter((id) => allIdSet.has(id));
			const orderSet = new Set(mosaicOrder);
			for (const p of allRemotes) {
				if (!orderSet.has(p.identity)) mosaicOrder.push(p.identity);
			}
			return mosaicOrder;
		}

		const availableIds = new Set(allRemotes.map((p) => p.identity));
		const toDisplayIds = this.layoutService.computeParticipantsToDisplay(availableIds);
		// In-place swaps: departing participants are replaced by arriving ones at the same index,
		// so Angular @for sees INSERT+REMOVE instead of MOVE.
		return this.syncDisplayOrder(previous, toDisplayIds, availableIds);
	});

	/** Persists the latest computed order into `_displayedCameraOrder` for the next frame. */
	private readonly orderSyncEffect = effect(() => {
		const next = this.displayedCameraOrder();
		untracked(() => {
			const current = this._displayedCameraOrder();
			if (current.length === next.length && current.every((v, i) => v === next[i])) return;
			this._displayedCameraOrder.set(next);
		});
	});

	private readonly visibleState = computed(() => {
		const order = this.displayedCameraOrder();
		const allRemotes = this.remoteParticipants();
		const isSmart = this.isSmartLayoutActive();
		const targetIds = new Set<string>(order);
		const streams: ParticipantStream[] = [];

		const participantMap = new Map(allRemotes.map((p) => [p.identity, p]));

		// Displayed participants: push all streams (camera + screen).
		// LayoutComponent splits them into separate camera/screen @for loops,
		// so interleaving here is safe — only within-category order matters.
		for (const id of order) {
			const p = participantMap.get(id);
			if (p) streams.push(...p.streams());
		}

		if (isSmart) {
			// Non-displayed screen-sharing participants: add their screen stream only
			// so their video is rendered without occupying a camera slot.
			// (Their screen audio is handled by the persistent audio layer regardless.)
			for (const p of allRemotes) {
				if (!targetIds.has(p.identity) && p.isScreenShareEnabled) {
					const screen = p.streams().find((s) => s.isScreenStream);
					if (screen) streams.push(screen);
				}
			}
		}

		return { streams, targetIds };
	});

	/** Streams to pass to {@link BaseLayoutComponent} via `ovRemoteStreams`. */
	readonly visibleRemoteStreams = computed(() => this.visibleState().streams);

	/** Number of remote participants hidden from the layout (smart layout only). */
	readonly hiddenParticipantsCount = computed(() => {
		const total = this.remoteParticipants().length;
		return Math.max(0, total - this.visibleState().targetIds.size);
	});

	/** Display names of the hidden remote participants, for tooltip rendering. */
	readonly hiddenParticipantNames = computed(() => {
		const { targetIds } = this.visibleState();
		return this.remoteParticipants()
			.filter((p) => !targetIds.has(p.identity))
			.map((p) => p.name || 'Unknown');
	});

	/** Whether to render the hidden-participants indicator in the layout. */
	readonly shouldShowHiddenParticipantsIndicator = computed(
		() => this.ovShowHiddenParticipantsIndicator() && this.isSmartLayoutActive() && this.hiddenParticipantsCount() > 0
	);

	/**
	 * When `true`, the indicator is rendered in the toolbar row rather than below the grid.
	 * This happens when no participant is pinned and the visible slot count is below the maximum,
	 * meaning there is room in the top bar.
	 */
	readonly showTopBarHiddenParticipantsIndicator = computed(() => {
		const hasPinnedParticipant =
			!!this.localParticipant()?.isPinned || this.remoteParticipants().some((p) => p.isPinned);
		const visibleCount = this.visibleState().targetIds.size;
		return !hasPinnedParticipant && visibleCount < this.layoutService.MAX_VISIBLE_REMOTE_PARTICIPANTS_LIMIT;
	});

	/**
	 * Returns a new identity order applying in-place replacements:
	 * each departing participant (present in `previousOrder` but absent from `targetIds`)
	 * is replaced by an arriving one at the same index, keeping all others at stable positions.
	 *
	 * @param previousOrder - Ordered identity list from the previous evaluation.
	 * @param targetIds - Identities that should be visible after this update.
	 * @param availableIds - Identities of all currently connected participants.
	 */
	private syncDisplayOrder(previousOrder: string[], targetIds: Set<string>, availableIds: Set<string>): string[] {
		const order = previousOrder.filter((id) => availableIds.has(id));
		const currentSet = new Set(order);

		const departing = order.filter((id) => !targetIds.has(id));
		const arriving = [...targetIds].filter((id) => !currentSet.has(id));

		for (const dep of departing) {
			const replacement = arriving.shift();
			const idx = order.indexOf(dep);
			if (idx === -1) continue;
			if (replacement) {
				order[idx] = replacement;
			} else {
				order.splice(idx, 1);
			}
		}

		for (const arr of arriving) {
			if (order.length < targetIds.size) order.push(arr);
		}

		return order;
	}

	/**
	 * Persistent `<audio>` elements for every remote audio track (camera + screen-share).
	 * Keyed by `${identity}:${source}` so that a track re-publish (new `trackSid` under the
	 * same participant + source) reuses the same `<audio>` element via attach/detach swap,
	 * preventing the audible gap that would otherwise occur on tear-down + rebuild.
	 */
	private audioElements = new Map<string, PersistentAudioEntry>();

	/**
	 * Manages persistent `<audio>` elements for every remote audio track (camera + screen).
	 * Audio lifecycle is decoupled from layout visibility to prevent glitches during rotation.
	 * `streams()` is read before `untracked` to register track-publish/unpublish as reactive dependencies.
	 */
	private readonly audioElementsEffect = effect(() => {
		const allRemotes = this.remoteParticipants();
		// Read streams() for every remote participant to register track changes as dependencies.
		allRemotes.forEach((p) => p.streams());
		// Track the container so we re-run once viewChild resolves and can mount queued elements.
		const container = this.audioContainer()?.nativeElement ?? null;

		untracked(() => this.manageAudioTracks(allRemotes, container));
	});

	/** Removes disconnected participants from the speaker-priority list. */
	private readonly participantCleanupEffect = effect(() => {
		if (!this.isSmartLayoutActive()) return;

		const currentIds = new Set(this.remoteParticipants().map((p) => p.identity));
		untracked(() => this.layoutService.removeDisconnectedSpeakers(currentIds));
	});

	ngOnDestroy(): void {
		this.cleanupAudioElements(new Set());
	}

	private manageAudioTracks(participants: ParticipantModel[], container: HTMLElement | null): void {
		const activeKeys = new Set<string>();

		for (const participant of participants) {
			for (const stream of participant.streams()) {
				const audioTrack = stream.audioTrack;
				const track = audioTrack?.track;
				if (!track || typeof track.attach !== 'function') continue;

				const key = `${participant.identity}:${stream.source}`;
				activeKeys.add(key);

				let entry = this.audioElements.get(key);
				if (!entry) {
					const element = document.createElement('audio');
					element.autoplay = true;
					element.setAttribute('data-participant', participant.identity);
					element.setAttribute('data-source', stream.source);
					track.attach(element);
					entry = { element, track, mounted: false };
					this.audioElements.set(key, entry);
				} else if (entry.track !== track) {
					// Track re-publish under the same participant+source: swap the underlying
					// source without recreating the element, so playback never gaps.
					entry.track.detach(entry.element);
					track.attach(entry.element);
					entry.track = track;
				}

				if (container && !entry.mounted) {
					container.appendChild(entry.element);
					entry.mounted = true;
				}

				entry.element.muted = stream.isMutedForcibly;
			}
		}

		this.cleanupAudioElements(activeKeys);
	}

	private cleanupAudioElements(activeKeys: Set<string>): void {
		for (const [key, entry] of this.audioElements) {
			if (!activeKeys.has(key)) {
				entry.track.detach(entry.element);
				entry.element.remove();
				this.audioElements.delete(key);
			}
		}
	}
}

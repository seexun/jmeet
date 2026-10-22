import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { SmartLayoutMode } from '../../models/layout/smart-layout.model';
import { Participant } from '../../services/livekit-adapter';
import { LoggerService } from '../logger/logger.service';
import { SessionRoomEventsService } from '../session/session-room-events.service';
import { ViewportService } from '../viewport/viewport.service';
import { BaseLayoutService } from './layout.service';

@Injectable({
	providedIn: 'root'
})
export class SmartLayoutService extends BaseLayoutService {
	private readonly loggerService = inject(LoggerService);
	private readonly sessionRoomEventsService = inject(SessionRoomEventsService);
	private readonly viewportService = inject(ViewportService);
	private readonly INITIAL_VISIBLE_PARTICIPANTS_COUNT = 4;
	readonly MIN_VISIBLE_REMOTE_PARTICIPANTS = 1;
	readonly MAX_VISIBLE_REMOTE_PARTICIPANTS_LIMIT = 6;

	private readonly AUDIO_LEVEL_THRESHOLD = 0.1;
	private readonly MIN_SPEAKING_DURATION_MS = 2000;
	private readonly SPEAKING_GRACE_PERIOD_MS = 3000;

	private readonly _layoutMode = signal<SmartLayoutMode>(SmartLayoutMode.SMART_MOSAIC);
	readonly layoutMode = this._layoutMode.asReadonly();

	private readonly _maxVisibleRemoteParticipants = signal<number>(this.INITIAL_VISIBLE_PARTICIPANTS_COUNT);
	readonly maxVisibleRemoteParticipants = this._maxVisibleRemoteParticipants.asReadonly();

	readonly isSmartLayoutEnabled = computed(() => this._layoutMode() === SmartLayoutMode.SMART_MOSAIC);

	private readonly _speakerPriorityOrder = signal<string[]>([]);
	readonly speakerPriorityOrder = this._speakerPriorityOrder.asReadonly();

	private speakingStartTimes = new Map<string, number>();
	private speakingStopTimes = new Map<string, number>();

	private readonly smartLayoutUpdateEffect = effect(() => {
		if (this.isSmartLayoutEnabled()) {
			this.update();
		}
	});

	/**
	 * Speaker tracking runs in **every** layout mode, not just Smart Mosaic.
	 * Keeping the priority list warm in Mosaic mode means a user who was already
	 * speaking is immediately promoted when the host flips back to Smart Mosaic,
	 * instead of being eclipsed by the first-N iteration order for {@link MIN_SPEAKING_DURATION_MS}.
	 */
	private readonly activeSpeakersTrackingEffect = effect(() => {
		const speakers = this.sessionRoomEventsService.activeSpeakers();
		untracked(() => this.processActiveSpeakersChanged(speakers));
	});

	constructor() {
		super();
		this.log = this.loggerService.get('SmartLayoutService');

		const viewportInfo = this.viewportService.viewportInfo();
		const isMobileOrTablet = viewportInfo.isPhysicalMobile || viewportInfo.isPhysicalTablet;
		if (isMobileOrTablet) this._maxVisibleRemoteParticipants.set(2);
	}

	setLayoutMode(mode: SmartLayoutMode): void {
		if (!Object.values(SmartLayoutMode).includes(mode)) {
			this.log.w(`Invalid layout mode: ${mode}`);
			return;
		}

		if (this._layoutMode() === mode) return;

		this._layoutMode.set(mode);
		this.update();
	}

	setMaxVisibleRemoteParticipants(count: number): void {
		if (count < this.MIN_VISIBLE_REMOTE_PARTICIPANTS || count > this.MAX_VISIBLE_REMOTE_PARTICIPANTS_LIMIT) {
			this.log.w(
				`Invalid participant count: ${count}. Range: ${this.MIN_VISIBLE_REMOTE_PARTICIPANTS}-${this.MAX_VISIBLE_REMOTE_PARTICIPANTS_LIMIT}`
			);
			return;
		}

		if (this._maxVisibleRemoteParticipants() === count) return;

		this._maxVisibleRemoteParticipants.set(count);
		if (this.isSmartLayoutEnabled()) this.update();
	}

	resetSpeakerTrackingState(): void {
		this._speakerPriorityOrder.set([]);
		this.speakingStartTimes.clear();
		this.speakingStopTimes.clear();
	}

	removeDisconnectedSpeakers(connectedParticipantIds: Set<string>): void {
		const currentOrder = this._speakerPriorityOrder();
		const filteredOrder = currentOrder.filter((id) => connectedParticipantIds.has(id));

		if (filteredOrder.length !== currentOrder.length) {
			this._speakerPriorityOrder.set(filteredOrder);
		}

		for (const id of this.speakingStartTimes.keys()) {
			if (!connectedParticipantIds.has(id)) this.speakingStartTimes.delete(id);
		}
		for (const id of this.speakingStopTimes.keys()) {
			if (!connectedParticipantIds.has(id)) this.speakingStopTimes.delete(id);
		}
	}

	/**
	 * Returns the set of participant IDs to render fully (camera + optional screen).
	 * Priority: (1) recent speakers → (2) silent fillers.
	 *
	 * Screen-sharing participants are **not** given camera-slot priority because their
	 * screen tile is always rendered by the layout regardless of whether they appear
	 * in this set (see the non-displayed screen-sharing participants block in `visibleState`),
	 * so the participant limit controls camera slots only.
	 */
	computeParticipantsToDisplay(availableIds: Set<string>): Set<string> {
		const maxCount = this._maxVisibleRemoteParticipants();
		const speakerOrder = this._speakerPriorityOrder();

		const recentSpeakers = speakerOrder.filter((id) => availableIds.has(id)).slice(0, maxCount);
		if (recentSpeakers.length >= maxCount) return new Set(recentSpeakers);

		const recentSpeakerSet = new Set(recentSpeakers);
		const remaining = maxCount - recentSpeakers.length;

		// Fill remaining slots with non-speaker participants (screen sharers are not
		// given camera-slot priority because their screen tile is always rendered
		// separately via the non-displayed screen-sharing block in visibleState).
		const regularFillers = [...availableIds].filter((id) => !recentSpeakerSet.has(id)).slice(0, remaining);

		return new Set([...recentSpeakers, ...regularFillers]);
	}

	private processActiveSpeakersChanged(speakers: Participant[]): void {
		const now = Date.now();
		const activeSpeakerIds = new Set(
			speakers
				.filter((p) => !p.isLocal && p.audioLevel >= this.AUDIO_LEVEL_THRESHOLD)
				.map((p) => p.identity)
		);

		this.updateSpeakerActivityTimers(activeSpeakerIds, now);

		const qualifiedSpeakers = [...this.speakingStartTimes.entries()]
			.filter(([id, startTime]) => {
				const stopTime = this.speakingStopTimes.get(id);
				const endTime = activeSpeakerIds.has(id) ? now : (stopTime ?? now);
				return endTime - startTime >= this.MIN_SPEAKING_DURATION_MS;
			})
			.map(([id]) => id);

		this.updateSpeakerPriority(qualifiedSpeakers, activeSpeakerIds);
	}

	private updateSpeakerActivityTimers(activeSpeakerIds: Set<string>, now: number): void {
		for (const id of activeSpeakerIds) {
			const stopTime = this.speakingStopTimes.get(id);
			this.speakingStopTimes.delete(id);

			const startTime = this.speakingStartTimes.get(id);
			if (startTime === undefined) {
				this.speakingStartTimes.set(id, now);
			} else if (stopTime !== undefined) {
				// Resumed after a silent gap. Advance startTime by the gap so that
				// `endTime - startTime` measures cumulative active time rather than
				// wall-clock span — otherwise brief sub-threshold peaks scattered
				// across the 3s grace window can falsely qualify.
				this.speakingStartTimes.set(id, startTime + (now - stopTime));
			}
		}

		for (const id of this.speakingStartTimes.keys()) {
			if (!activeSpeakerIds.has(id)) {
				if (!this.speakingStopTimes.has(id)) this.speakingStopTimes.set(id, now);

				const stopTime = this.speakingStopTimes.get(id);
				if (stopTime && now - stopTime >= this.SPEAKING_GRACE_PERIOD_MS) {
					this.speakingStartTimes.delete(id);
					this.speakingStopTimes.delete(id);
				}
			}
		}
	}

	private updateSpeakerPriority(qualifiedSpeakerIds: string[], activeSpeakerIds: Set<string> = new Set()): void {
		const currentOrder = this._speakerPriorityOrder();
		const qualifiedSet = new Set(qualifiedSpeakerIds);
		const currentSet = new Set(currentOrder);

		// Participants currently sending audio above the threshold
		const activelySpeakingSet = new Set(qualifiedSpeakerIds.filter((id) => activeSpeakerIds.has(id)));

		// Group 1a: already-visible active speakers (preserve relative order for stability)
		const existingActiveSpeakers = currentOrder.filter((id) => activelySpeakingSet.has(id));
		// Group 1b: newly-qualified active speakers (first time reaching the threshold)
		const newActiveSpeakers = qualifiedSpeakerIds.filter((id) => activeSpeakerIds.has(id) && !currentSet.has(id));
		// Group 2a: grace-period speakers already in the order (they stopped but haven't expired)
		const gracePeriodExisting = currentOrder.filter((id) => qualifiedSet.has(id) && !activelySpeakingSet.has(id));
		// Group 2b: participants that first qualified exactly as they stopped (edge case)
		const newGracePeriod = qualifiedSpeakerIds.filter((id) => !activeSpeakerIds.has(id) && !currentSet.has(id));
		// Group 3: no longer qualified — keep at the tail for ordered removal
		const inactive = currentOrder.filter((id) => !qualifiedSet.has(id));

		const updated = [...existingActiveSpeakers, ...newActiveSpeakers, ...gracePeriodExisting, ...newGracePeriod, ...inactive];
		this._speakerPriorityOrder.set(updated.slice(0, this._maxVisibleRemoteParticipants() * 2));
	}
}
import { computed, signal } from '@angular/core';
import type { OVLocalParticipant, OVRemoteParticipant, OVRoom, OVTrackPublication } from '../services/livekit-adapter';
import {
	AudioCaptureOptions,
	ConnectionQuality,
	DataPublishOptions,
	LocalParticipant,
	LocalTrack,
	LocalTrackPublication,
	ScreenShareCaptureOptions,
	Track,
	TrackPublishOptions,
	VideoCaptureOptions
} from '../services/livekit-adapter';
import { DeviceType } from './device.model';
import { ScreenZoomState } from './screen-zoom.model';

type AugmentedTrackPublication = OVTrackPublication & {
	participant: ParticipantModel;
	isPinned: boolean;
	isFloating: boolean;
	isCameraTrack: boolean;
	isScreenTrack: boolean;
	isAudioTrack: boolean;
	isMutedForcibly?: boolean;
};

export interface ParticipantLeftEvent {
	roomName: string;
	participantName: string;
	identity: string;
	reason: ParticipantLeftReason;
}

export enum ParticipantLeftReason {
	// User-initiated disconnections
	LEAVE = 'LEAVE', // The participant left the room voluntarily
	BROWSER_UNLOAD = 'browser_unload', // The participant was disconnected due to a browser unload event

	// Network-related disconnections
	NETWORK_DISCONNECT = 'network_disconnect', // The participant was disconnected due to a network error
	SIGNAL_CLOSE = 'websocket_closed', // The participant was disconnected due to a websocket error

	// Server-initiated disconnections
	SERVER_SHUTDOWN = 'server_shutdown', // The server was shut down
	PARTICIPANT_REMOVED = 'participant_removed', // The participant was removed from the room
	ROOM_DELETED = 'room_deleted', // The room was deleted

	// Permission/policy-based disconnections
	DUPLICATE_IDENTITY = 'duplicate_identity', // The participant was disconnected due to a duplicate identity

	OTHER = 'other' // The participant was disconnected for an unknown reason
}
/**
 * Interface that represents a combined audio+video stream for a single visual element.
 * A camera stream groups the camera video track and the microphone audio track.
 * A screen-share stream groups the screen-share video track and the screen-share audio track.
 */
export interface ParticipantStream {
	/** The participant who owns this stream. */
	participant: ParticipantModel;
	/** Primary source of this stream (Camera or ScreenShare). */
	source: Track.Source;
	/** Video track publication, undefined when no video is published (avatar will be shown). */
	videoTrack: OVTrackPublication | undefined;
	/** Associated audio track publication, undefined when no audio is published. */
	audioTrack: OVTrackPublication | undefined;
	/** True when this is the camera/mic stream. */
	isCameraStream: boolean;
	/** True when this is the screen-share stream. */
	isScreenStream: boolean;
	/** Stable identifier used for @for trackBy — videoTrack SID or a synthetic fallback. */
	streamId: string;
	/** Mirrors the videoTrack isPinned state. */
	isPinned: boolean;
	/** Mirrors the videoTrack isFloating state. */
	isFloating: boolean;
	/** Mirrors the audioTrack isMutedForcibly state. */
	isMutedForcibly: boolean;
	/**
	 * Per-viewer zoom/pan state for screen-share streams. Only present on screen streams;
	 * the same instance is reused across stream recomputations so the zoom persists for the
	 * lifetime of the underlying screen track.
	 */
	zoom?: ScreenZoomState;
}

/**
 * Interface defining properties of a participant.
 */
export interface ParticipantProperties {
	/**
	 * The participant instance, which can be either a local participant or a remote participant.
	 */
	participant: OVLocalParticipant | OVRemoteParticipant;

	/**
	 * The room in which the participant is located, applicable only for local participants.
	 */
	room?: OVRoom;

	/**
	 * The color profile associated with the participant.
	 * It specifies the visual representation of the participant in the user interface.
	 */
	colorProfile?: string;

	/**
	 * This property allows to know what screen track is the last one published for enlarging it
	 * Map <trackSid, publicationDate>
	 * @internal
	 **/
	screenTrackPublicationDate?: Map<string, number>;
}

/**
 * Class that represents a participant in the room.
 */
export class ParticipantModel {
	/** @internal Synthetic placeholder SID used when no real camera track exists. */
	private static readonly CUSTOM_VIDEO_SID = 'customVideoTrack';

	/**
	 * This property allows to know what screen track is the last one published for enlarging it
	 * Map <trackSid, publicationDate>
	 * @internal
	 **/
	screenTrackPublicationDate: Map<string, number>;
	/**
	 * The color profile associated with the participant.
	 * It specifies the visual representation of the participant in the user interface.
	 */
	colorProfile: string;
	private participant: OVLocalParticipant | OVRemoteParticipant;
	private room: OVRoom | undefined;
	private customVideoTrack: Partial<AugmentedTrackPublication>;

	// ── Reactive state ──────────────────────────────────────────────────────────────────────────
	// These signals replace plain boolean fields. Getters that read them are automatically tracked
	// by Angular templates and effects, eliminating the need to clone ParticipantModel or spread
	// the participants array in ParticipantService every time state changes.
	private readonly _speaking = signal(false);
	private readonly _hasEncryptionError = signal(false);
	private readonly _decryptedName = signal<string | undefined>(undefined);
	private readonly _connectionQuality = signal<ConnectionQuality>(ConnectionQuality.Unknown);
	/**
	 * Revision counter — bumped via bump() whenever the underlying LiveKit participant object is
	 * mutated in-place (track published/unpublished, isCameraEnabled changes, etc.) or when
	 * augmented-track properties (isPinned, isFloating, isMutedForcibly) are written.
	 * Reading _revision() inside augmentedTracks propagates the dependency to every getter and
	 * computed that calls it — so streams, isFloating, isPinned, etc. all react automatically.
	 */
	private readonly _revision = signal(0);

	/**
	 * Per-viewer screen-share zoom state, keyed by screen stream id. Kept outside the stream
	 * snapshots (which are rebuilt on every revision) so a participant's zoom survives unrelated
	 * track/state changes and only resets when the screen track itself changes.
	 */
	private readonly screenZoomStates = new Map<string, ScreenZoomState>();

	constructor(props: ParticipantProperties) {
		this.participant = props.participant;
		this.colorProfile = props.colorProfile ?? `hsl(${Math.random() * 360}, 45%, 85%)`;
		this.room = props.room;
		this.screenTrackPublicationDate = props.screenTrackPublicationDate ?? new Map<string, number>();

		this.customVideoTrack = {
			participant: this,
			kind: Track.Kind.Video,
			trackName: ParticipantModel.CUSTOM_VIDEO_SID,
			trackSid: ParticipantModel.CUSTOM_VIDEO_SID,
			source: Track.Source.Camera,
			isPinned: false,
			isFloating: false,
			isMutedForcibly: false,
			isCameraTrack: true,
			isScreenTrack: false,
			isAudioTrack: false
		};
	}

	/**
	 * @internal
	 */
	get identity() {
		return this.participant.identity;
	}

	/**
	 * Returns the server assigned unique identifier for the participant.
	 * @returns string
	 */
	get sid(): string {
		return this.participant.sid;
	}

	/**
	 * Returns the participant name.
	 * @returns string
	 */
	get name(): string | undefined {
		return this._decryptedName() ?? this.participant.name;
	}

	/**
	 * Returns the room name where the participant is.
	 * @return string | undefined
	 * @internal
	 */
	get roomName(): string | undefined {
		return this.room?.name;
	}

	/**
	 * Returns if the participant has enabled its camera.
	 */
	get isCameraEnabled(): boolean {
		this._revision(); // reactive: re-evaluates in effects/computed when bump() is called
		return this.participant.isCameraEnabled;
	}

	/**
	 * Returns if the participant has enabled its microphone.
	 */
	get isMicrophoneEnabled(): boolean {
		this._revision();
		return this.participant.isMicrophoneEnabled;
	}

	/**
	 * Returns if the participant has enabled its screen share.
	 */
	get isScreenShareEnabled(): boolean {
		this._revision();
		return this.participant.isScreenShareEnabled;
	}

	/**
	 * Returns if the participant is speaking.
	 */
	get isSpeaking(): boolean {
		// There is a bug when a participant mutes its microphone, it is still considered as speaking
		// that's why we need to check if the microphone is enabled
		return this._speaking() && this.isMicrophoneEnabled;
	}

	/**
	 * Returns all the participant tracks.
	 * @internal
	 */
	private get augmentedTracks(): AugmentedTrackPublication[] {
		// Reading _revision() registers it as a reactive dependency for any computed/effect/template
		// that calls this getter — consumers re-evaluate automatically when bump() is called.
		this._revision();
		const defaultTracks = this.participant.getTrackPublications().map((track: OVTrackPublication) => {
			const augmented = track as AugmentedTrackPublication;
			augmented.participant = this;
			augmented.isMutedForcibly = augmented.isMutedForcibly || false;
			augmented.isCameraTrack = track.source === Track.Source.Camera;
			augmented.isScreenTrack = track.source === Track.Source.ScreenShare;
			augmented.isAudioTrack = track.kind === Track.Kind.Audio;
			return augmented;
		});

		const hasCameraTrack = defaultTracks.some((track) => track.source === Track.Source.Camera);
		if (!hasCameraTrack) {
			/**
			 * If default tracks does not contain camera track, we add a custom video track with the aim of showing the
			 * participant's name and avatar. If we don't add this track, the participant's
			 * name and avatar will not be shown in the video grid and the participant would be a
			 * ghost in the room.
			 **/
			defaultTracks.push(this.customVideoTrack as AugmentedTrackPublication);
		}
		return defaultTracks;
	}

	/**
	 * Returns all the participant tracks.
	 * @internal
	 */
	get tracks(): OVTrackPublication[] {
		return this.augmentedTracks;
	}

	/**
	 * Returns the participant streams grouped by source (camera and screen share).
	 * Each stream bundles a video track and its paired audio track so they can be
	 * rendered into a single <video> element, eliminating the separate <audio> element
	 * and the audio/video de-sync risk that came with it.
	 *
	 * A camera stream is **always** produced (even when there is no camera track) so
	 * that the participant avatar is always visible. This mirrors the previous
	 * behaviour that injected a synthetic `customVideoTrack` placeholder.
	 *
	 * NOTE: This getter intentionally calls `this.tracks` so that any Proxy that wraps
	 * the participant (e.g. the SmartMosaic video-only proxy in MeetingCustomLayoutComponent)
	 * is transparently applied via the JS Proxy receiver mechanism.
	 *
	 * Reactive: declared as an Angular `computed` signal. LayoutComponent's template reads
	 * `participant.streams()` — Angular tracks `_revision` (via augmentedTracks) and only
	 * re-evaluates when track structure or augmented-track properties actually change.
	 * State-only changes (speaking, encryptionError) are tracked independently per StreamComponent
	 * via the signal-backed getters (isSpeaking, hasEncryptionError, etc.).
	 */
	readonly streams = computed(() => {
		const allTracks = this.tracks as AugmentedTrackPublication[];

		// Real camera video publication (excludes the synthetic placeholder)
		const cameraVideoTrack = allTracks.find(
			(t) =>
				t.source === Track.Source.Camera && !t.isAudioTrack && t.trackSid !== ParticipantModel.CUSTOM_VIDEO_SID
		);
		const micAudioTrack = allTracks.find((t) => t.source === Track.Source.Microphone);
		const screenVideoTrack = allTracks.find((t) => t.source === Track.Source.ScreenShare && !t.isAudioTrack);
		const screenAudioTrack = allTracks.find((t) => t.source === Track.Source.ScreenShareAudio);

		const result: ParticipantStream[] = [];

		// Camera stream — always present so the participant is always visible in the grid.
		// When there is no real camera track, the MediaElement renders the avatar instead.
		result.push({
			participant: this,
			source: Track.Source.Camera,
			videoTrack: cameraVideoTrack,
			audioTrack: micAudioTrack,
			isCameraStream: true,
			isScreenStream: false,
			streamId: cameraVideoTrack?.trackSid ?? `camera-${this.identity}`,
			isPinned: cameraVideoTrack?.isPinned ?? false,
			isFloating: cameraVideoTrack?.isFloating ?? false,
			isMutedForcibly: micAudioTrack?.isMutedForcibly ?? false
		});

		// Screen share stream — only when screen sharing is active
		if (screenVideoTrack || screenAudioTrack) {
			const screenStreamId = screenVideoTrack?.trackSid ?? `screen-${this.identity}`;
			result.push({
				participant: this,
				source: Track.Source.ScreenShare,
				videoTrack: screenVideoTrack,
				audioTrack: screenAudioTrack,
				isCameraStream: false,
				isScreenStream: true,
				streamId: screenStreamId,
				isPinned: screenVideoTrack?.isPinned ?? false,
				isFloating: false,
				isMutedForcibly: (screenAudioTrack ?? screenVideoTrack)?.isMutedForcibly ?? false,
				zoom: this.resolveScreenZoom(screenStreamId)
			});
		}

		return result;
	});

	/**
	 * Returns the persistent {@link ScreenZoomState} for the given screen stream, creating it on
	 * first use and discarding state for any screen track that is no longer present. This keeps the
	 * zoom stable across stream recomputations while resetting it when a new screen share starts.
	 */
	private resolveScreenZoom(streamId: string): ScreenZoomState {
		for (const key of this.screenZoomStates.keys()) {
			if (key !== streamId) {
				this.screenZoomStates.delete(key);
			}
		}
		let state = this.screenZoomStates.get(streamId);
		if (!state) {
			state = new ScreenZoomState();
			this.screenZoomStates.set(streamId, state);
		}
		return state;
	}

	/**
	 * Returns if the participant is local.
	 */
	get isLocal(): boolean {
		return this.participant.isLocal;
	}

	/**
	 * Returns if the participant has any track forcibly muted.
	 * @internal
	 */
	get isMutedForcibly() {
		return this.augmentedTracks.some((track) => track.isMutedForcibly);
	}

	/**
	 * Returns if the participant has any track floating
	 * @internal
	 */
	get isFloating(): boolean {
		return this.augmentedTracks.some((track) => track.isFloating);
	}

	/**
	 * @returns ParticipantProperties
	 * @internal
	 */
	getProperties(): ParticipantProperties {
		return {
			participant: this.participant,
			room: this.room,
			colorProfile: this.colorProfile,
			screenTrackPublicationDate: this.screenTrackPublicationDate
		};
	}

	/**
	 *
	 * Creates a screen capture tracks with getDisplayMedia(). A LocalVideoTrack is always created and returned.
	 * @param options
	 * @returns Promise<LocalTrack[]>
	 * @internal
	 */
	createScreenTracks(options: ScreenShareCaptureOptions): Promise<LocalTrack[]> {
		if (this.participant instanceof LocalParticipant) {
			return this.participant.createScreenTracks(options);
		}
		return Promise.reject("Remote participant can't create screen tracks");
	}

	/**
	 *
	 * Publishes a track to the room
	 * @param track
	 * @returns
	 */
	publishTrack(track: LocalTrack, options?: TrackPublishOptions): Promise<LocalTrackPublication> {
		if (this.participant instanceof LocalParticipant) {
			return this.participant.publishTrack(track, options);
		}
		return Promise.reject("Remote participant can't publish tracks");
	}

	/**
	 * Unpublishes a local track. `stopOnUnpublish=false` keeps the underlying
	 * MediaStreamTrack alive so it can be republished with different options
	 * (e.g. music-mode encoding switch) without re-acquiring the device.
	 * @internal
	 */
	async unpublishTrack(track: LocalTrack, stopOnUnpublish = false): Promise<void> {
		if (this.participant instanceof LocalParticipant) {
			await this.participant.unpublishTrack(track, stopOnUnpublish);
			return;
		}
		return Promise.reject("Remote participant can't unpublish tracks");
	}

	/**
	 * Enable or disable a participant's camera track.
	 * @param enabled
	 * @returns Promise<LocalTrackPublication | undefined>
	 * @internal
	 */
	setCameraEnabled(
		enabled: boolean,
		options?: VideoCaptureOptions,
		publishOptions?: TrackPublishOptions
	): Promise<LocalTrackPublication | undefined> {
		if (this.participant instanceof LocalParticipant) {
			return this.participant.setCameraEnabled(enabled, options, publishOptions);
		}
		return Promise.reject("Remote participant can't enable camera");
	}

	/**
	 * Enable or disable a participant's microphone track.
	 * @param enabled
	 * @returns Promise<LocalTrackPublication | undefined>
	 * @internal
	 */
	setMicrophoneEnabled(
		enabled: boolean,
		options?: AudioCaptureOptions,
		publishOptions?: TrackPublishOptions
	): Promise<LocalTrackPublication | undefined> {
		if (this.participant instanceof LocalParticipant) {
			return this.participant.setMicrophoneEnabled(enabled, options, publishOptions);
		}
		return Promise.reject("Remote participant can't enable microphone");
	}

	/**
	 * Start or stop sharing a participant's screen
	 * @param enabled
	 * @returns Promise<LocalTrackPublication | undefined>
	 * @internal
	 */
	setScreenShareEnabled(
		enabled: boolean,
		options: ScreenShareCaptureOptions,
		publishOptions?: TrackPublishOptions
	): Promise<LocalTrackPublication | undefined> {
		if (this.participant instanceof LocalParticipant) {
			return this.participant.setScreenShareEnabled(enabled, options, publishOptions);
		}
		return Promise.reject("Remote participant can't enable screen share");
	}

	/**
	 * Sets the participant's speaking status.
	 * @param speaking
	 * @internal
	 */
	setSpeaking(speaking: boolean) {
		this._speaking.set(speaking);
	}

	/**
	 * Switches the active camera track used in this room to the given device id.
	 * @param deviceId
	 * @returns Promise<void>
	 * @internal
	 */
	async switchCamera(deviceId: string): Promise<void> {
		if (this.room) {
			await this.room.switchActiveDevice(DeviceType.VIDEO_INPUT, deviceId);
		}
	}

	/**
	 * Switches the active microphone track used in this room to the given device id.
	 * @param deviceId
	 * @returns Promise<void>
	 * @internal
	 */
	async switchMicrophone(deviceId: string): Promise<void> {
		if (this.room) {
			await this.room.switchActiveDevice(DeviceType.AUDIO_INPUT, deviceId);
		}
	}

	/**
	 * Switches the active screen share track showing a native browser dialog to select a screen or window.
	 * @param newTrack [LocalTrack](https://docs.livekit.io/client-sdk-js/classes/LocalTrack.html)
	 * @returns Promise<void>
	 * @internal
	 */
	async switchScreenshare(newTrack: LocalTrack): Promise<void> {
		if (!(this.participant instanceof LocalParticipant)) {
			return Promise.reject("Remote participant can't switch screen share");
		}

		const screenTrack = this.augmentedTracks.find((track) => track.source === Track.Source.ScreenShare);
		if (!screenTrack || !screenTrack.videoTrack) {
			return Promise.reject('No active screen share track to switch');
		}

		const currentTrack = screenTrack.videoTrack as LocalTrack;

		await currentTrack.replaceTrack(newTrack.mediaStreamTrack);
		return Promise.resolve();
	}

	/**
	 * Publish a new data payload to the room. Data will be forwarded to each participant in the room if the destination field in publishOptions is empty.
	 * @param data
	 * @param {DataPublishOptions} publishOptions [DataPublishOptions](https://docs.livekit.io/client-sdk-js/types/DataPublishOptions.html)
	 * @returns Promise that is resolved if the data was successfully sent, or rejected with an Error object if not.
	 * @internal
	 */
	async publishData(data: Uint8Array, publishOptions: DataPublishOptions): Promise<void> {
		if (this.participant instanceof LocalParticipant) {
			return this.participant.publishData(data, publishOptions);
		}
		return Promise.reject("Remote participant can't publish data");
	}

	/**
	 * @returns The participant active connection types
	 * @internal
	 */
	getTracksPublishedTypes(): Track.Source[] {
		const tracksPublishedTypes: Track.Source[] = [];
		if (this.isCameraEnabled) tracksPublishedTypes.push(Track.Source.Camera);
		if (this.isScreenShareEnabled) tracksPublishedTypes.push(Track.Source.ScreenShare);
		if (this.isMicrophoneEnabled) tracksPublishedTypes.push(Track.Source.Microphone);

		return tracksPublishedTypes;
	}

	/**
	 * Sets the participant's name.
	 * @param name
	 * @internal
	 * As updating name requires that the participant has the `canUpdateOwnMetadata` to true in server side, which is a little bit insecure,
	 * we decided to not allow this feature for now.
	 */
	// setName(name: string) {
	// 	if (this.participant instanceof LocalParticipant) {
	// 		this.participant.setName(name);
	// 	}
	// }

	/**
	 * Sets all video track elements to pinned or unpinned given a boolean value
	 * @param pinned
	 * @internal
	 */
	setAllVideoPinned(pinned: boolean) {
		this.augmentedTracks.forEach((track) => (track.isPinned = pinned));
		this.bump();
	}

	/**
	 * Toggle the pinned status of a video track element
	 * @param trackSid
	 * @internal
	 */
	toggleVideoPinned(trackSid: string): void {
		const track = this.augmentedTracks.find((track) => track.trackSid === trackSid);
		if (track) {
			track.isPinned = !track.isPinned;
			this.bump();
		}
	}

	/**
	 * Gets whether this participant is pinned.
	 * This indicates that the participant's video is fixed in place in the UI.
	 * @returns boolean
	 */
	get isPinned(): boolean {
		return this.augmentedTracks.some((track) => track.isPinned);
	}

	/**
	 * Sets all video track elements from a specific source to pinned or unpinned given a boolean value
	 * @param source The source of the track to be pinned or unpinned (e.g., 'camera', 'screenShare').
	 * @param pinned
	 * @internal
	 */
	setVideoPinnedBySource(source: Track.Source, pinned: boolean) {
		this.augmentedTracks
			.filter((track) => track.source === source && track.kind === Track.Kind.Video)
			.forEach((track) => (track.isPinned = pinned));
		this.bump();
	}

	/**
	 * Toggle the floating status of a video track element
	 * @param trackSid
	 * @returns
	 * @internal
	 */
	toggleVideoFloating(trackSid: string): void {
		const track = this.augmentedTracks.find((track) => track.trackSid === trackSid);
		if (track) {
			track.isFloating = !track.isFloating;
			this.bump();
		}
	}

	/**
	 * Sets the publication date of a screen track
	 * @param trackSid
	 * @param publicationDate
	 * @internal
	 */
	setScreenTrackPublicationDate(trackSid: string, publicationDate: number) {
		if (publicationDate === -1) {
			this.screenTrackPublicationDate.delete(trackSid);
		} else {
			this.screenTrackPublicationDate.set(trackSid, publicationDate);
		}
		this.bump();
	}

	/**
	 * Forcibly mutes (or un-mutes) this participant's tracks.
	 *
	 * Calling without {@link source} mutes every track on the participant
	 *
	 * @internal
	 */
	setMutedForcibly(muted: boolean, source?: Track.Source) {
		const matchesScope = (track: AugmentedTrackPublication): boolean => {
			if (source === Track.Source.Camera) {
				return track.source === Track.Source.Camera || track.source === Track.Source.Microphone;
			}
			if (source === Track.Source.ScreenShare) {
				return track.source === Track.Source.ScreenShare || track.source === Track.Source.ScreenShareAudio;
			}
			return true;
		};

		this.augmentedTracks.filter(matchesScope).forEach((track) => (track.isMutedForcibly = muted));
		this.bump();
	}

	/**
	 * Gets whether this participant has an encryption error.
	 * This indicates that the participant cannot decrypt the video stream due to an incorrect encryption key.
	 * @returns boolean
	 */
	get hasEncryptionError(): boolean {
		return this._hasEncryptionError();
	}

	/**
	 * Sets the encryption error state for this participant.
	 * @param hasError - Whether the participant has an encryption error
	 * @internal
	 */
	setEncryptionError(hasError: boolean) {
		this._hasEncryptionError.set(hasError);
	}

	/**
	 * Returns the connection quality of this participant.
	 */
	get connectionQuality(): ConnectionQuality {
		return this._connectionQuality();
	}

	/**
	 * Sets the connection quality for this participant.
	 * @param quality
	 * @internal
	 */
	setConnectionQuality(quality: ConnectionQuality) {
		this._connectionQuality.set(quality);
	}

	/**
	 * Sets the decrypted name for this participant.
	 * @param decryptedName - The decrypted participant name
	 * @internal
	 */
	setDecryptedName(decryptedName: string | undefined) {
		this._decryptedName.set(decryptedName);
	}

	/**
	 * Bumps the internal revision signal, causing `streams` and all reactive getters
	 * (isCameraEnabled, isFloating, isPinned, etc.) to re-evaluate in templates and effects.
	 * Call this after any operation that mutates the underlying LiveKit participant in-place
	 * (e.g. after setCameraEnabled, setMicrophoneEnabled, publishTrack).
	 * @internal
	 */
	bump(): void {
		this._revision.update((v) => v + 1);
	}
}

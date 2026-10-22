import { Injectable, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { ParticipantModel, ParticipantProperties } from '../../models/participant.model';
import { OpenViduComponentsConfigService } from '../config/directive-config.service';
import { GlobalConfigService } from '../config/global-config.service';
import { E2eeService } from '../e2ee/e2ee.service';
import type {
	OVAudioCaptureOptions,
	OVDataPublishOptions,
	OVLocalParticipant,
	OVLocalTrackPublication,
	OVParticipant,
	OVRemoteParticipant,
	OVScreenShareCaptureOptions,
	OVTrackPublishOptions,
	OVVideoCaptureOptions
} from '../livekit-adapter';
import { DeviceService } from '../device/device.service';
import { AudioPresets, ConnectionQuality, Track, VideoEncoding, VideoPresets } from '../livekit-adapter';
import { ParticipantKind } from 'livekit-client';
import type { LocalAudioTrack } from 'livekit-client';
import { LoggerService } from '../logger/logger.service';
import { OpenViduService } from '../openvidu/openvidu.service';
import { StorageService } from '../storage/storage.service';

/** 音乐模式发布参数：128kbps 双声道,关闭 DTX/RED(两者都以单声道语音为优化目标) */
const MUSIC_MODE_AUDIO_PUBLISH_OPTIONS: OVTrackPublishOptions = {
	audioPreset: AudioPresets.musicStereo,
	dtx: false,
	red: false,
	forceStereo: true
};

/**
 * 基础设施进程（如实时字幕 ASR 代理，identity 形如 agent-AJ_xxx、无名字）
 * 不属于会议成员：成员列表、计数徽标、踢人列表一律不显示。
 * SIP 电话入会是真人，保留。
 */
export function shouldHideParticipant(participant: { kind?: ParticipantKind }): boolean {
	return participant.kind === ParticipantKind.AGENT;
}

@Injectable({
	providedIn: 'root'
})
export class ParticipantService {
	private readonly globalService = inject(GlobalConfigService);
	private readonly directiveService = inject(OpenViduComponentsConfigService);
	private readonly openviduService = inject(OpenViduService);
	private readonly storageSrv = inject(StorageService);
	private readonly deviceSrv = inject(DeviceService);
	private readonly e2eeService = inject(E2eeService);
	private readonly log = inject(LoggerService).get('ParticipantService');

	/**
	 * Local participant Signal for reactive programming with Angular signals.
	 */
	localParticipant: Signal<ParticipantModel | undefined>;
	private _localParticipant: WritableSignal<ParticipantModel | undefined> = signal<ParticipantModel | undefined>(
		undefined
	);
	readonly localParticipantNameSignal = computed(() => this._localParticipant()?.name ?? '');
	readonly localParticipantIdentitySignal = computed(() => this._localParticipant()?.identity ?? '');

	/**
	 * Remote participants Signal for reactive programming with Angular signals.
	 * This is a modern alternative to remoteParticipants$ Observable.
	 * @since Angular 16+
	 */
	remoteParticipants: Signal<ParticipantModel[]>;
	private _remoteParticipants: WritableSignal<ParticipantModel[]> = signal<ParticipantModel[]>([]);
	readonly totalParticipantsSignal = computed(
		() => (this._localParticipant() ? 1 : 0) + this._remoteParticipants().length
	);
	readonly hasRemoteEncryptionErrorsSignal = computed(() =>
		this._remoteParticipants().some((participant) => participant.hasEncryptionError)
	);

	/**
	 * @internal
	 */
	constructor() {
		this.localParticipant = this._localParticipant.asReadonly();
		this.remoteParticipants = this._remoteParticipants.asReadonly();
	}

	/**
	 * @internal
	 */
	clear(): void {
		this._localParticipant.set(undefined);
		this._remoteParticipants.set([]);
	}

	/**
	 * @internal
	 * Setting up the local participant object.
	 * @param participant
	 */
	setLocalParticipant(participant: OVLocalParticipant) {
		const room = this.openviduService.getRoom();
		const newParticipant = this.newParticipant({ participant, room });
		this._localParticipant.set(newParticipant);
	}

	/**
	 * Connects to the room and publishes the local tracks.
	 * @internal
	 */
	async connect(): Promise<void> {
		let prejoinTracks = this.openviduService.getLocalTracks();

		if (prejoinTracks.length === 0) {
			// No prejoin page ran, so the local tracks have not been created yet. Decide what to open
			// from the user's stored preferences (availability-independent: on first visit the device
			// list is empty until permission is granted by this very call). This is the single
			// getUserMedia of the no-prejoin path.
			const wantCamera = this.directiveService.isVideoEnabled() && this.storageSrv.isCameraEnabled();
			const wantMicrophone = this.directiveService.isAudioEnabled() && this.storageSrv.isMicrophoneEnabled();

			if (wantCamera || wantMicrophone) {
				prejoinTracks = await this.openviduService.createLocalTracks(wantCamera, wantMicrophone);

				// Permission may have just been granted → populate the device list and align the
				// selection with the opened devices so the in-room selectors work.
				await this.deviceSrv.syncDevicesAfterTrackCreation(prejoinTracks);
			}
		}

		await this.openviduService.connectRoom();
		this.setLocalParticipant(this.openviduService.getRoom().localParticipant);

		const localParticipant = this.localParticipant();
		const videoTrack = prejoinTracks.find((track) => track.kind === Track.Kind.Video);
		const audioTrack = prejoinTracks.find((track) => track.kind === Track.Kind.Audio);

		const promises: Promise<OVLocalTrackPublication>[] = [];
		if (localParticipant && videoTrack) {
			promises.push(localParticipant.publishTrack(videoTrack));
		}
		if (localParticipant && audioTrack) {
			promises.push(localParticipant?.publishTrack(audioTrack));
		}

		await Promise.all(promises);
		this._localParticipant()?.bump();
		// if(!isCameraEnabled) await this.setCameraEnabled(isCameraEnabled);
		// if(!isMicrophoneEnabled) await this.setMicrophoneEnabled(isMicrophoneEnabled);
		// Once the Room is created, the temporary tracks are not longer needed.
		this.log.d('Connected to room', this.openviduService.getRoom());
		this.openviduService.getRoom().remoteParticipants.forEach((p) => {
			this.addRemoteParticipant(p);
		});
	}

	/**
	 * Publishes a new data payload to the room. Data will be forwarded to each participant in the room if the destination field in publishOptions is empty.
	 * @param data
	 * @param {DataPublishOptions} publishOptions [DataPublishOptions](https://docs.livekit.io/client-sdk-js/types/DataPublishOptions.html)
	 */
	publishData(data: Uint8Array, publishOptions: OVDataPublishOptions): Promise<void> {
		const localParticipant = this.localParticipant();
		if (localParticipant) {
			return localParticipant.publishData(data, publishOptions);
		}
		return Promise.reject('Local participant not found');
	}

	/**
	 * Switches the active camera track used in this room to the given device id.
	 * @param deviceId
	 */
	async switchCamera(deviceId: string): Promise<void> {
		if (this.openviduService.isRoomConnected()) {
			const localParticipant = this.localParticipant();
			await localParticipant?.switchCamera(deviceId);
		} else {
			await this.openviduService.switchCamera(deviceId);
		}
		// this.updateLocalParticipant();
	}

	/**
	 * Switches the active microphone track used in this room to the given device id.
	 * @param deviceId
	 */
	async switchMicrophone(deviceId: string): Promise<void> {
		if (this.openviduService.isRoomConnected()) {
			const localParticipant = this.localParticipant();
			await localParticipant?.switchMicrophone(deviceId);
		} else {
			await this.openviduService.switchMicrophone(deviceId);
		}
		// this.updateLocalParticipant();
	}

	/**
	 * Switches the active screen share track showing a native browser dialog to select a screen or window.
	 */
	async switchScreenShare(): Promise<void> {
		const localParticipant = this.localParticipant();
		if (!localParticipant) {
			this.log.e('Local participant is undefined when switching screenshare');
			return;
		}

		// Chrome / Safari: seamless replaceTrack keeps the same publication SID.
		const options = this.getScreenCaptureOptions();
		const [newTrack] = await localParticipant.createScreenTracks(options);
		if (newTrack) {
			newTrack.addListener('ended', async () => {
				this.log.d('Clicked native stop button. Stopping screen sharing');
				await this.setScreenShareEnabled(false);
			});

			try {
				await localParticipant.switchScreenshare(newTrack);
			} catch (error) {
				newTrack.stop();
				throw error;
			}
		}

		// this.updateLocalParticipant();
	}

	/**
	 * Sets the local participant camera enabled or disabled.
	 * Capture resolution / publish encoding follow the user's stored video-quality tier
	 * (default h720; see StorageKeys.VIDEO_QUALITY).
	 * @param enabled
	 */
	async setCameraEnabled(enabled: boolean): Promise<void> {
		if (this.openviduService.isRoomConnected()) {
			const storageDevice = this.storageSrv.getVideoDevice();
			const { resolution, encoding } = this.getVideoQualityOptions();
			let options: OVVideoCaptureOptions | undefined;
			if (storageDevice) {
				options = {
					deviceId: storageDevice.device,
					facingMode: 'user',
					resolution
				};
			} else {
				options = { resolution };
			}
			await this._localParticipant()?.setCameraEnabled(enabled, options, encoding ? { videoEncoding: encoding } : undefined);
			this._localParticipant()?.bump();
		} else {
			await this.openviduService.setVideoTrackEnabled(enabled);
		}
	}

	/** 视频清晰度档位 → 采集分辨率与发布编码；'auto' 沿用默认（h720 + 房间默认编码） */
	private getVideoQualityOptions(): { resolution: typeof VideoPresets.h720.resolution; encoding?: VideoEncoding } {
		switch (this.storageSrv.getVideoQuality()) {
			case '360p':
				return { resolution: VideoPresets.h360.resolution, encoding: VideoPresets.h360.encoding };
			case '1080p':
				return { resolution: VideoPresets.h1080.resolution, encoding: VideoPresets.h1080.encoding };
			case '720p':
				return { resolution: VideoPresets.h720.resolution, encoding: VideoPresets.h720.encoding };
			default:
				return { resolution: VideoPresets.h720.resolution, encoding: undefined };
		}
	}

	/**
	 * 音乐模式（高保真音频）：关闭回声消除/噪声抑制/自动增益并切换到双声道高码率发布；
	 * 关闭时恢复会议默认的语音优化链路。与 AI 降噪互斥（调用方负责先关降噪）。
	 */
	async setMusicModeEnabled(enabled: boolean): Promise<boolean> {
		if (!this.openviduService.isRoomConnected()) {
			this.storageSrv.setMusicModeEnabled(enabled);
			return enabled;
		}
		const localParticipant = this._localParticipant();
		const publication = localParticipant?.tracks.find(
			(track) => track.source === Track.Source.Microphone && track.kind === Track.Kind.Audio
		);
		const micTrack = (publication?.track ?? undefined) as LocalAudioTrack | undefined;
		if (!localParticipant || !micTrack) {
			this.storageSrv.setMusicModeEnabled(enabled);
			return enabled;
		}

		const captureOptions = enabled
			? { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 2 }
			: { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
		try {
			// restartTrack 原位替换底层 MediaStreamTrack，保留发布关系
			await micTrack.restartTrack(captureOptions as OVAudioCaptureOptions);
			// 编码档位需重发布才能生效：unpublish 时显式不停止轨道
			await localParticipant.unpublishTrack(micTrack, false);
			await localParticipant.publishTrack(micTrack, enabled ? MUSIC_MODE_AUDIO_PUBLISH_OPTIONS : {});
			this._localParticipant()?.bump();
			this.storageSrv.setMusicModeEnabled(enabled);
			return true;
		} catch (error) {
			this.log.e('Error switching music mode:', error);
			return false;
		}
	}

	/**
	 * Sets the local participant microphone enabled or disabled.
	 * @param enabled
	 */
	async setMicrophoneEnabled(enabled: boolean): Promise<void> {
		if (this.openviduService.isRoomConnected()) {
			const storageDevice = this.storageSrv.getAudioDevice();
			let options: OVAudioCaptureOptions | undefined;
			if (storageDevice) {
				options = {
					deviceId: storageDevice.device
				};
			}
			await this._localParticipant()?.setMicrophoneEnabled(enabled, options);
			this._localParticipant()?.bump();
		} else {
			this.openviduService.setAudioTrackEnabled(enabled);
		}
	}

	async setAiNoiseSuppressionEnabled(enabled: boolean): Promise<boolean> {
		return this.openviduService.setAiNoiseSuppressionEnabled(enabled);
	}

	getLocalMediaStats() { return this.openviduService.getLocalMediaStats(); }

	/**
	 * Share or unshare the local participant screen.
	 * @param enabled: true to share the screen, false to unshare it
	 *
	 */
	async setScreenShareEnabled(enabled: boolean): Promise<void> {
		const options = this.getScreenCaptureOptions();
		const track = await this._localParticipant()?.setScreenShareEnabled(enabled, options);
		if (enabled && track) {
			// Set all videos to normal size when a local screen is shared
			this.resetRemoteStreamsToNormalSize();
			this.resetLocalStreamsToNormalSize();
			this._localParticipant()?.toggleVideoPinned(track.trackSid);
			this._localParticipant()?.setScreenTrackPublicationDate(track.trackSid, new Date().getTime());

			track?.addListener('ended', async () => {
				this.log.d('Clicked native stop button. Stopping screen sharing');
				await this.setScreenShareEnabled(false);
			});
		} else if (!enabled && track) {
			// Enlarge the last screen shared when a local screen is stopped
			this._localParticipant()?.setScreenTrackPublicationDate(track.trackSid, -1);
			this.resetRemoteStreamsToNormalSize();
			this.resetLocalStreamsToNormalSize();
			this.setLastScreenPinned();
		}
		this._localParticipant()?.bump();
	}

	/**
	 * @internal
	 * As updating name requires that the participant has the `canUpdateOwnMetadata` to true in server side, which is a little bit insecure,
	 * we decided to not allow this feature for now.
	 */
	// setMyName(name: string) {
	// 	if (!this.localParticipantWritableSignal()) return;
	// 	this.localParticipantWritableSignal().setName(name);
	// 	this.updateLocalParticipant();
	// }

	/**
	 * Sets as speaking to all participants given in the array.
	 * @param speakers
	 * @internal
	 */
	setSpeaking(speakers: OVParticipant[]) {
		// Reset speaking state for all participants (_speaking signal update is a no-op if unchanged).
		this._localParticipant()?.setSpeaking(false);
		this.remoteParticipants().forEach((p) => p.setSpeaking(false));

		// Set speaking state for active speakers.
		speakers.forEach((s) => {
			if (s.isLocal) {
				this._localParticipant()?.setSpeaking(true);
			} else {
				this.remoteParticipants()
					.find((p) => p.sid === s.sid)
					?.setSpeaking(true);
			}
		});
		// Signal propagation is automatic via the _speaking signal in ParticipantModel.
	}

	/**
	 * Sets the encryption error state for a participant.
	 * This is called when a participant cannot decrypt video streams due to an incorrect encryption key.
	 * @param participantSid - The SID of the participant with the encryption error
	 * @param hasError - Whether the participant has an encryption error
	 * @internal
	 */
	setEncryptionError(participantSid: string, hasError: boolean) {
		const local = this._localParticipant();
		if (local?.sid === participantSid) {
			local.setEncryptionError(hasError);
		} else {
			this.remoteParticipants()
				.find((p) => p.sid === participantSid)
				?.setEncryptionError(hasError);
		}
		// Signal propagation is automatic via the _hasEncryptionError signal in ParticipantModel.
	}

	/**
	 * Sets the connection quality for a participant.
	 * @param participantSid - The SID of the participant
	 * @param quality - The new connection quality value
	 * @internal
	 */
	setConnectionQuality(participantSid: string, quality: ConnectionQuality) {
		const local = this._localParticipant();
		if (local?.sid === participantSid) {
			local.setConnectionQuality(quality);
		} else {
			this.remoteParticipants()
				.find((p) => p.sid === participantSid)
				?.setConnectionQuality(quality);
		}
		// Signal propagation is automatic via the _connectionQuality signal in ParticipantModel.
	}

	/**
	 * Returns the current connection quality for a participant (local or remote),
	 * or `undefined` when no participant with the given SID is tracked.
	 * @param participantSid - The SID of the participant
	 * @internal
	 */
	getConnectionQuality(participantSid: string): ConnectionQuality | undefined {
		const local = this._localParticipant();
		if (local?.sid === participantSid) {
			return local.connectionQuality;
		}
		return this.getRemoteParticipantBySid(participantSid)?.connectionQuality;
	}

	/**
	 * Returns the local participant name.
	 */
	getMyName(): string | undefined {
		return this.localParticipantNameSignal() || undefined;
	}

	getMyIdentity(): string | undefined {
		return this.localParticipantIdentitySignal() || undefined;
	}

	/**
	 * @internal
	 */
	toggleMyVideoPinned(sid: string | undefined) {
		const local = this._localParticipant();
		if (sid && local) local.toggleVideoPinned(sid);
		// toggleVideoPinned calls bump() internally — no explicit update needed.
	}

	/**
	 * @internal
	 */
	toggleLocalVideoFloating(sid: string | undefined) {
		const local = this._localParticipant();
		if (sid && local) local.toggleVideoFloating(sid);
		// toggleVideoFloating calls bump() internally — no explicit update needed.
	}

	/**
	 * @internal
	 */
	resetLocalStreamsToNormalSize() {
		this._localParticipant()?.setAllVideoPinned(false);
	}

	/**
	 * Returns if the local participant camera is enabled.
	 */
	isMyCameraEnabled(): boolean {
		const local = this._localParticipant();
		if (this.openviduService.isRoomConnected() && local) {
			return local.isCameraEnabled;
		} else {
			const directiveCameraEnabled = this.directiveService.isVideoEnabled();

			if (!directiveCameraEnabled) {
				return false;
			}
			return this.openviduService.isVideoTrackEnabled() && this.storageSrv.isCameraEnabled();
		}
	}

	/**
	 * Returns if the local participant microphone is enabled.
	 */
	isMyMicrophoneEnabled(): boolean {
		const local = this._localParticipant();
		if (this.openviduService.isRoomConnected() && local) {
			return local.isMicrophoneEnabled;
		} else {
			const directiveMicropgoneEnabled = this.directiveService.isAudioEnabled();

			if (!directiveMicropgoneEnabled) {
				return false;
			}
			return this.openviduService.isAudioTrackEnabled() && this.storageSrv.isMicrophoneEnabled();
		}
	}

	/**
	 * Returns if the local participant screen is enabled.
	 */
	isMyScreenShareEnabled(): boolean {
		return this._localParticipant()?.isScreenShareEnabled || false;
	}

	/**
	 * Forces to update the local participant object and notify signal consumers.
	 * @deprecated No longer needed — ParticipantModel state is now signal-based and propagates
	 * reactively. Kept for external consumers and subclasses that may override it.
	 */
	updateLocalParticipant() {
		this._localParticipant()?.bump();
	}

	/**
	 * Sets the last screen element as pinned
	 * @internal
	 */
	setLastScreenPinned() {
		const local = this._localParticipant();
		if (!local?.isScreenShareEnabled && !this.someRemoteIsSharingScreen()) {
			return;
		}
		let localCreatedAt = -Infinity;
		let localTrackSid = '';
		if (local?.isScreenShareEnabled) {
			localCreatedAt = Math.max(...local.screenTrackPublicationDate.values());
			local.screenTrackPublicationDate.forEach((value, key) => {
				if (value === localCreatedAt) {
					localTrackSid = key;
					return;
				}
			});
		}

		let remoteCreatedAt = -Infinity;
		let remoteTrackSid = '';
		if (this.someRemoteIsSharingScreen()) {
			const lastRemoteParticipant = this.remoteParticipants().reduce((prev, current) => {
				const prevMax = Math.max(...prev.screenTrackPublicationDate.values());
				const currentMax = Math.max(...current.screenTrackPublicationDate.values());
				return prevMax > currentMax ? prev : current;
			});
			remoteCreatedAt = Math.max(...lastRemoteParticipant.screenTrackPublicationDate.values());
			lastRemoteParticipant.screenTrackPublicationDate.forEach((value, key) => {
				if (value === remoteCreatedAt) {
					remoteTrackSid = key;
					return;
				}
			});
		}

		if (remoteCreatedAt > localCreatedAt) {
			this.toggleRemoteVideoPinned(remoteTrackSid);
		} else {
			this.toggleMyVideoPinned(localTrackSid);
		}
	}

	/**
	 * Returns the participant with the given identity.
	 * @param identity
	 * @returns
	 */
	getParticipantByIdentity(identity: string): ParticipantModel | undefined {
		if (this._localParticipant()?.identity === identity) {
			return this._localParticipant();
		}
		return this.remoteParticipants().find((p) => p.identity === identity);
	}

	getParticipantByTrackSid(trackSid: string): ParticipantModel | undefined {
		const local = this._localParticipant();
		if (local?.tracks.some((track) => track.trackSid === trackSid)) return local;
		return this.remoteParticipants().find((participant) => participant.tracks.some((track) => track.trackSid === trackSid));
	}

	/* ------------------------------ Remote Participants ------------------------------ */

	/**
	 * Forces to update the remote participants array and notify signal consumers.
	 * @deprecated No longer needed — each ParticipantModel bumps its own _revision signal.
	 * Kept for external consumers that may call it.
	 */
	private updateRemoteParticipants(): void {
		// No-op: remote participant state propagates via each model's internal signals.
	}
	/**
	 * Returns the remote participant with the given sid.
	 * @param sid
	 */
	getRemoteParticipantBySid(sid: string): ParticipantModel | undefined {
		return this.remoteParticipants().find((p) => p.sid === sid);
	}

	/**
	 * @internal
	 */
	addRemoteParticipant(participant: OVRemoteParticipant) {
		if (shouldHideParticipant(participant)) {
			return;
		}
		const remotes = this._remoteParticipants();
		const existing = remotes.find((p) => p.sid === participant.sid);
		if (existing) {
			// The LiveKit participant object is mutated in-place by the SDK (new track publications).
			// Bumping the model's revision signal causes streams to recompute reactively —
			// no need to clone ParticipantModel or spread the participants array.
			existing.bump();
		} else {
			this._remoteParticipants.set([...remotes, this.newParticipant({ participant })]);
		}
	}

	/**
	 * Removes participant track from the remote participant object.
	 * @param participant
	 * @param trackSid
	 * @internal
	 */
	removeRemoteParticipantTrack(participant: OVRemoteParticipant, trackSid: string) {
		const model = this._remoteParticipants().find((p) => p.sid === participant.sid);
		if (model) {
			const track = model.tracks.find((t) => t.trackSid === trackSid);
			track?.track?.stop();
			track?.track?.detach();
			// LiveKit has already removed the publication from the participant; bump to recompute.
			model.bump();
		}
	}

	/**
	 * @internal
	 */
	removeRemoteParticipant(sid: string) {
		const remotes = [...this.remoteParticipants()];
		const index = remotes.findIndex((p) => p.sid === sid);
		if (index !== -1) {
			remotes.splice(index, 1);
			this._remoteParticipants.set(remotes);
		}
	}

	/**
	 * @internal
	 */
	resetRemoteStreamsToNormalSize() {
		// setAllVideoPinned calls bump() internally — no array update needed.
		this.remoteParticipants().forEach((p) => p.setAllVideoPinned(false));
	}

	/**
	 * Set the screen track publication date of a remote participant with the aim of taking control of the last screen published
	 * @param participantSid
	 * @param trackSid
	 * @param createdAt
	 * @internal
	 */
	setScreenTrackPublicationDate(participantSid: string, trackSid: string, createdAt: number) {
		// setScreenTrackPublicationDate bumps _revision internally.
		this.remoteParticipants()
			.find((p) => p.sid === participantSid)
			?.setScreenTrackPublicationDate(trackSid, createdAt);
	}

	/**
	 * @internal
	 */
	someRemoteIsSharingScreen(): boolean {
		return this.remoteParticipants().some((p) => p.isScreenShareEnabled);
	}

	/**
	 * @internal
	 */
	toggleRemoteVideoPinned(sid: string | undefined) {
		if (sid) {
			const participant = this.remoteParticipants().find((p) => p.tracks.some((track) => track.trackSid === sid));
			// toggleVideoPinned calls bump() internally — no array update needed.
			participant?.toggleVideoPinned(sid);
		}
	}

	/**
	 * Sets the remote participant video track element muted or unmuted.
	 *
	 * When {@link source} is provided, only the matching stream (camera or screen-share) is
	 * affected.
	 *
	 * Omit {@link source} to mute the whole participant.
	 *
	 * @internal
	 */
	setRemoteMutedForcibly(sid: string, value: boolean, source?: Track.Source) {
		// setMutedForcibly calls bump() internally — no array update needed.
		this.remoteParticipants()
			.find((p) => p.sid === sid)
			?.setMutedForcibly(value, source);
	}

	private newParticipant(props: ParticipantProperties): ParticipantModel {
		let participant: ParticipantModel;
		if (this.globalService.hasParticipantFactory()) {
			participant = this.globalService.getParticipantFactory().apply(this, [props]);
		} else {
			participant = new ParticipantModel(props);
		}

		// Decrypt participant name asynchronously if E2EE is enabled
		this.decryptParticipantName(participant);

		return participant;
	}

	/**
	 * Decrypts the participant name if E2EE is enabled.
	 * Updates the participant model asynchronously.
	 * @param participant - The participant model to decrypt the name for
	 * @private
	 */
	private async decryptParticipantName(participant: ParticipantModel): Promise<void> {
		const originalName = participant.name;
		if (!originalName) {
			return;
		}

		try {
			const decryptedName = await this.e2eeService.decryptOrMask(originalName, participant.identity);
			// setDecryptedName updates a signal — propagates reactively, no explicit update needed.
			participant.setDecryptedName(decryptedName);
		} catch (error) {
			this.log.w('Failed to decrypt participant name:', error);
		}
	}

	private getScreenCaptureOptions(): OVScreenShareCaptureOptions {
		return {
			audio: true,
			video: {
				displaySurface: 'browser' // Set browser tab as default options
			},
			systemAudio: 'include', // Include system audio as an option
			resolution: VideoPresets.h1080.resolution,
			contentHint: 'text', // Optimized for detailed content, adjust based on use case
			suppressLocalAudioPlayback: true, // Prevent echo by not playing local audio
			selfBrowserSurface: 'exclude', // Avoid self capture to prevent mirror effect
			surfaceSwitching: 'include', // Allow users to switch shared tab dynamically
			preferCurrentTab: false // Do not force current tab to be selected
		};
	}
}

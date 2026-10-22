import { inject, Injectable, Signal } from '@angular/core';
import { ILogger } from '../../models/logger.model';
import { OpenViduComponentsConfigService } from '../config/directive-config.service';
import { DeviceService } from '../device/device.service';
import {
	AudioCaptureOptions,
	ConnectionState,
	ExternalE2EEKeyProvider,
	OVCreateLocalTracksOptions,
	OVE2EEOptions,
	OVLocalAudioTrack,
	OVLocalTrack,
	OVLocalVideoTrack,
	OVRoom,
	OVRoomOptions,
	Track,
	VideoCaptureOptions,
	VideoPresets
} from '../livekit-adapter';
import { LivekitAdapterInterface } from '../livekit-adapter/interfaces/livekit.adapter.interface';
import { LivekitAdapterFactory } from '../livekit-adapter/livekit-adapter.factory';
import { LoggerService } from '../logger/logger.service';
import { StorageService } from '../storage/storage.service';
import { VideoTrackProcessorService } from '../track-processor/video-track-processor.service';
import { AssetsService } from '../../../../../shared/services/assets.service';
import { AudioNoiseSuppressionService } from '../track-processor/audio-noise-suppression.service';

@Injectable({
	providedIn: 'root'
})
export class OpenViduService {
	private readonly deviceService = inject(DeviceService);
	private readonly storageService = inject(StorageService);
	private readonly configService = inject(OpenViduComponentsConfigService);
	private readonly livekitAdapterFactory = inject(LivekitAdapterFactory);
	private readonly livekitAdapter: LivekitAdapterInterface = this.livekitAdapterFactory.createLiveKitAdapter();
	private readonly videoTrackProcessorService = inject(VideoTrackProcessorService);
	private readonly assets = inject(AssetsService);
	private readonly audioNoiseSuppression = inject(AudioNoiseSuppressionService);

	private room: OVRoom | undefined = undefined;
	private keyProvider: ExternalE2EEKeyProvider | undefined;

	/**
	 * @internal
	 * Indicates whether the client initiated disconnect event should be handled.
	 * This is used to determine if the disconnect event should be emitted when the 'Disconnect' event is triggered
	 */
	shouldHandleClientInitiatedDisconnectEvent = true;

	/*
	 * Tracks used in the prejoin component. They are created when the room is not yet created.
	 */
	private localTracks: OVLocalTrack[] = [];
	private livekitToken = '';
	private livekitUrl = '';
	private readonly statsBaselines = new Map<string,{bytes:number;at:number}>();
	private log: ILogger = inject(LoggerService).get('OpenViduService');

	/**
	 * Readonly signal indicating whether the background processor is available.
	 * Delegates to VideoTrackProcessorService.
	 */
	readonly isBackgroundProcessorSupported: Signal<boolean> =
		this.videoTrackProcessorService.isBackgroundProcessorSupported;

	/**
	 * Creates a new Room with audio and video devices selected or default ones.
	 * @internal
	 */
	initRoom(): void {
		// Check if E2EE configuration needs to be applied
		const e2eeKey = this.configService.getE2EEKey();
		const needsE2EEConfig = e2eeKey && e2eeKey.trim() !== '' && !this.keyProvider;

		// If room already exists and doesn't need E2EE reconfiguration, don't recreate it
		if (this.room && !needsE2EEConfig) {
			this.log.d('Room already initialized, skipping re-initialization');
			return;
		}

		// If room exists but needs E2EE configuration, we need to recreate it
		if (this.room && needsE2EEConfig) {
			this.log.d('Room needs E2EE configuration, recreating room');
			this.room = undefined;
		}

		const videoDeviceId = this.deviceService.getCameraSelected()?.device ?? undefined;
		const audioDeviceId = this.deviceService.getMicrophoneSelected()?.device ?? undefined;

		const roomOptions: OVRoomOptions = {
			adaptiveStream: true,
			dynacast: true,
			audioCaptureDefaults: {
				deviceId: audioDeviceId,
				echoCancellation: true,
				noiseSuppression: true,
				autoGainControl: true
			},
			videoCaptureDefaults: {
				deviceId: videoDeviceId,
				resolution: VideoPresets.h720.resolution
			},
			publishDefaults: {
				dtx: true,
				simulcast: true,
				stopMicTrackOnMute: true
			},
			stopLocalTrackOnUnpublish: true,
			disconnectOnPageLeave: true
		};

		// Configure E2EE if key is provided and keyProvider exists
		if (needsE2EEConfig) {
			roomOptions.encryption = this.buildE2EEOptions();
		}

		this.room = this.livekitAdapter.createRoom(roomOptions);
		this.log.d('Room initialized successfully');
	}

	private buildE2EEOptions(): OVE2EEOptions {
		this.log.d('Configuring E2EE with provided key');
		this.keyProvider = new ExternalE2EEKeyProvider();
		return {
			keyProvider: this.keyProvider,
			worker: this.createE2EEWorker()
		};
	}

	/**
	 * Loads the livekit-client E2EE worker, which is served from the Meet server's
	 * assets. `resolveUrl` points it at that server — in webcomponent mode that may
	 * be a remote, cross-origin origin. A module Worker cannot be constructed
	 * directly from a cross-origin script URL, so in that case it is wrapped in a
	 * same-origin blob that imports the real worker (the backend serves assets with
	 * CORS). Same-origin (SPA / same-origin embed) loads the URL directly.
	 */
	private createE2EEWorker(): Worker {
		const url = new URL(this.assets.e2eeWorker, window.location.href);

		if (url.origin === window.location.origin) {
			return new Worker(url.href, { type: 'module' });
		}

		const bootstrap = `import ${JSON.stringify(url.href)};`;
		const blobUrl = URL.createObjectURL(new Blob([bootstrap], { type: 'text/javascript' }));
		return new Worker(blobUrl, { type: 'module' });
	}

	/**
	 * Connects local participant to the room
	 */
	async connectRoom(): Promise<void> {
		try {
			const room = this.getRoom();

			// Configure E2EE if key provider was initialized
			if (this.keyProvider) {
				const e2eeKey = this.configService.getE2EEKey();
				if (e2eeKey) {
					this.log.d('Setting E2EE key and enabling encryption');
					await this.keyProvider.setKey(e2eeKey);
					await room.setE2EEEnabled(true);
					this.log.d('E2EE successfully enabled');
				}
			}
			await this.livekitAdapter.connectRoom(room, this.livekitUrl, this.livekitToken);
			this.log.d(`Successfully connected to room ${room.name}`);

			const participantName = this.storageService.getParticipantName();
			if (participantName) {
				room.localParticipant.setName(participantName);
			}
		} catch (error) {
			this.log.e('Error connecting to room:', error);
			throw {
				code: 'CONNECTION_ERROR',
				message: `Error connecting to the server at the following URL: ${this.livekitUrl}`
			};
		}
	}

	/**
	 * Disconnects from the current room.
	 *
	 * This method will check if there's an active connection to a room before attempting to disconnect.
	 * If the room is connected, it will perform the disconnection and call the optional callback function.
	 *
	 * @param callback - Optional function to be executed after a successful disconnection
	 * @returns A Promise that resolves once the disconnection is complete
	 */
	async disconnectRoom(
		callback?: () => void,
		shouldHandleClientInitiatedDisconnectEvent: boolean = true
	): Promise<void> {
		this.shouldHandleClientInitiatedDisconnectEvent = shouldHandleClientInitiatedDisconnectEvent;
		const room = this.room;
		if (room && this.isRoomConnected()) {
			this.log.d('Disconnecting from room');
			await this.livekitAdapter.disconnectRoom(room);
			if (callback) callback();
		}
	}

	/**
	 * @returns Room instance
	 */
	getRoom(): OVRoom {
		if (!this.room) {
			this.log.e('Room is not initialized. Make sure token is set before accessing the room.');
			throw new Error('Room is not initialized. Make sure token is set before accessing the room.');
		}
		return this.room;
	}

	/**
	 * Checks if room is initialized without throwing an error
	 * @returns true if room is initialized, false otherwise
	 */
	isRoomInitialized(): boolean {
		return !!this.room;
	}

	/**
	 * Returns the room name
	 */
	getRoomName(): string {
		return this.room?.name ?? '';
	}

	/**
	 * Returns if local participant is connected to the room
	 * @returns
	 */
	isRoomConnected(): boolean {
		return this.room?.state === ConnectionState.Connected;
	}

	hasRoomTracksPublished(): boolean {
		const { localParticipant, remoteParticipants } = this.getRoom();
		const localTracks = localParticipant.getTrackPublications();
		const remoteTracks = Array.from(remoteParticipants.values()).flatMap((p: any) => p.getTrackPublications());

		return localTracks.length > 0 || remoteTracks.length > 0;
	}

	/**
	 * @internal
	 */
	initializeAndSetToken(token: string, livekitUrl?: string): void {
		const { livekitUrl: urlFromToken } = this.extractLivekitData(token);

		this.livekitToken = token;
		const url = livekitUrl || urlFromToken;

		if (!url) {
			this.log.e(
				'LiveKit URL is not defined. Please, check the livekitUrl parameter of the VideoConferenceComponent'
			);
			throw new Error('Livekit URL is not defined');
		}

		this.livekitUrl = url;
		// this.livekitRoomAdmin = !!livekitRoomAdmin;

		// Initialize room if it doesn't exist yet
		// This ensures that getRoom() won't fail if token is set before onTokenRequested
		if (!this.room) {
			this.log.d('Room not initialized yet, initializing room due to token assignment');
			this.initRoom();
		}
		// return this.room.prepareConnection(this.livekitUrl, this.livekitToken);
	}

	/**
	 * Sets the local tracks for the OpenVidu service.
	 *
	 * @param tracks - An array of LocalTrack objects representing the local tracks to be set.
	 * @returns void
	 * @internal
	 */
	setLocalTracks(tracks: OVLocalTrack[]): void {
		this.localTracks = tracks.filter((track) => track !== undefined) as OVLocalTrack[];
	}

	/**
	 * @internal
	 * @returns
	 */
	getLocalTracks(): OVLocalTrack[] {
		return this.localTracks;
	}

	/**
	 * @internal
	 **/
	removeLocalTracks(): void {
		this.localTracks.forEach((track) => {
			track.stop();
			track.detach();
		});
		this.localTracks = [];
	}

	/**
	 * Creates local tracks for video and audio devices.
	 *
	 * @param videoDeviceId - The ID of the video device to use. If not provided, the default video device will be used.
	 * @param audioDeviceId - The ID of the audio device to use. If not provided, the default audio device will be used.
	 * @param allowPartialCreation - If true, allows creating tracks even if some devices fail
	 * @returns A promise that resolves to an array of LocalTrack objects representing the created tracks.
	 * @internal
	 */
	async createLocalTracks(
		videoDeviceId: string | boolean | undefined = undefined,
		audioDeviceId: string | boolean | undefined = undefined,
		allowPartialCreation: boolean = true
	): Promise<OVLocalTrack[]> {
		// Default to the user's stored preference (availability-independent). Whether a device is
		// actually opened — and which one — is resolved by the per-kind logic below; on first visit
		// the device list is still empty, so a default-device request is issued to obtain permission.
		videoDeviceId ??= this.storageService.isCameraEnabled();
		audioDeviceId ??= this.storageService.isMicrophoneEnabled();

		const options: OVCreateLocalTracksOptions = {
			audio: { echoCancellation: true, noiseSuppression: true },
			video: {}
		};

		// Video device
		if (videoDeviceId === true) {
			if (this.deviceService.hasVideoDeviceAvailable()) {
				const selectedCamera = this.deviceService.getCameraSelected();
				options.video = { deviceId: this.toDeviceConstraint(selectedCamera?.device) } as VideoCaptureOptions;
			} else if (!this.deviceService.hasVideoPermissionGranted()) {
				// Permission not granted yet (e.g. first visit): request the default camera so this
				// call obtains permission. The caller enumerates devices afterwards.
				options.video = {} as VideoCaptureOptions;
			} else {
				// Permission granted but no camera present.
				options.video = false;
			}
		} else if (videoDeviceId === false) {
			options.video = false;
		} else {
			(options.video as VideoCaptureOptions).deviceId = this.toDeviceConstraint(videoDeviceId);
		}

		// Audio device
		if (audioDeviceId === true) {
			if (this.deviceService.hasAudioDeviceAvailable()) {
				const selectedMic = this.deviceService.getMicrophoneSelected();
				(options.audio as AudioCaptureOptions).deviceId = this.toDeviceConstraint(selectedMic?.device);
			} else if (!this.deviceService.hasAudioPermissionGranted()) {
				// Permission not granted yet: keep the default-device audio request (set above) so
				// this call can obtain permission. The caller enumerates devices afterwards.
			} else {
				// Permission granted but no microphone present.
				options.audio = false;
			}
		} else if (audioDeviceId === false) {
			options.audio = false;
		} else {
			(options.audio as AudioCaptureOptions).deviceId = this.toDeviceConstraint(audioDeviceId);
		}

		let newLocalTracks: OVLocalTrack[] = [];

		if (options.audio || options.video) {
			this.log.d('Creating local tracks with options', options);

			if (allowPartialCreation) {
				// Try to create tracks separately to handle device conflicts gracefully
				newLocalTracks = await this.createTracksWithFallback(options);
			} else {
				// Original behavior - all or nothing
				newLocalTracks = await this.livekitAdapter.createLocalTracks(options);
			}

			const videoTrack = newLocalTracks.find((t) => t.kind === Track.Kind.Video) as OVLocalVideoTrack | undefined;
			if (videoTrack) {
				await this.videoTrackProcessorService.applyToVideoTrack(videoTrack);
			}

			// Mute tracks when the user's stored preference is "off". This is availability-independent
			// so a freshly created track isn't muted before devices have been enumerated.
			if (!this.storageService.isCameraEnabled()) {
				newLocalTracks.find((t) => t.kind === Track.Kind.Video)?.mute();
			}
			if (!this.storageService.isMicrophoneEnabled()) {
				newLocalTracks.find((t) => t.kind === Track.Kind.Audio)?.mute();
			}
		}
		return newLocalTracks;
	}

	/**
	 * Creates tracks with fallback strategy to handle device conflicts
	 * @param options - The track creation options
	 * @returns Array of successfully created tracks
	 * @internal
	 */
	private async createTracksWithFallback(options: OVCreateLocalTracksOptions): Promise<OVLocalTrack[]> {
		const tracks: OVLocalTrack[] = [];

		// Try to create video track separately
		if (options.video) {
			try {
				const videoTracks = await this.livekitAdapter.createLocalTracks({ video: options.video });
				tracks.push(...videoTracks);
				this.log.d('Video track created successfully');
			} catch (error) {
				this.log.w('Failed to create video track, device may be busy:', error);
				// Still continue to try audio track
			}
		}

		// Try to create audio track separately
		if (options.audio) {
			try {
				const audioTracks = await this.livekitAdapter.createLocalTracks({ audio: options.audio });
				tracks.push(...audioTracks);
				this.log.d('Audio track created successfully');
			} catch (error) {
				this.log.w('Failed to create audio track, device may be busy:', error);
			}
		}

		return tracks;
	}

	private toDeviceConstraint(deviceId?: string): ConstrainDOMString {
		if (!deviceId || deviceId === 'default') {
			return { ideal: 'default' };
		}
		return { exact: deviceId };
	}

	/**
	 * @internal
	 * As the Room is not created yet, we need to handle the media tracks with a temporary array of tracks.
	 * This method must be only called from the prejoin component.
	 **/
	async setVideoTrackEnabled(enabled: boolean) {
		let videoTrack = this.localTracks?.find((track) => track.kind === Track.Kind.Video);
		// Room is not connected, so we can't enable/disable the camera
		if (enabled) {
			await videoTrack?.unmute();
		} else {
			await videoTrack?.mute();
		}
	}

	/**
	 * @internal
	 * As the Room is not created yet, we need to handle the media tracks with a temporary array of tracks.
	 * This method must be only called from the prejoin component.
	 **/
	async setAudioTrackEnabled(enabled: boolean) {
		const audioTrack = this.localTracks?.find((track) => track.kind === Track.Kind.Audio);
		// Session is not connected, so we can't enable/disable the camera
		if (enabled) {
			await audioTrack?.unmute();
		} else {
			await audioTrack?.mute();
		}
	}

	/**
	 * @internal
	 * As the Room is not created yet, we need to handle the media tracks with a temporary array of tracks.
	 * This method must be only called before connect to room.
	 **/
	isVideoTrackEnabled(): boolean {
		if (this.localTracks.length === 0) {
			return this.deviceService.isCameraEnabled();
		}
		const videoTrack = this.localTracks.find((track) => track.kind === Track.Kind.Video);
		return !!videoTrack && !videoTrack.isMuted && videoTrack?.mediaStreamTrack?.enabled;
	}

	/**
	 * @internal
	 * As the Room is not created yet, we need to handle the media tracks with a temporary array of tracks.
	 * This method must be only called before connect to room.
	 **/
	isAudioTrackEnabled(): boolean {
		if (this.localTracks.length === 0) {
			return this.deviceService.isMicrophoneEnabled();
		}
		const audioTrack = this.localTracks.find((track) => track.kind === Track.Kind.Audio);
		return !!audioTrack && !audioTrack.isMuted && audioTrack?.mediaStreamTrack?.enabled;
	}

	/**
	 * Switches the camera device in prejoin (room not yet connected).
	 *
	 * Uses `LocalVideoTrack.restartTrack({ deviceId })` on the existing track when available.
	 * This is the correct LiveKit pattern: `restartTrack` internally calls `setMediaStreamTrack`,
	 * which automatically calls `processor.restart(newTrack)` if a background processor is
	 * attached — preserving any active virtual-background effect without extra work.
	 *
	 * Falls back to creating a new track (with processor reattachment) when no track exists.
	 * @param deviceId - The new video device ID
	 * @internal
	 */
	async switchCamera(deviceId: string): Promise<void> {
		const existingTrack = this.localTracks.find((t) => t.kind === Track.Kind.Video) as
			| OVLocalVideoTrack
			| undefined;
		const options: VideoCaptureOptions = { deviceId: this.toDeviceConstraint(deviceId) };
		if (existingTrack) {
			try {
				// restartTrack replaces the underlying MediaStreamTrack in-place.
				// LiveKit's setMediaStreamTrack will call processor.restart(newTrack) automatically
				// if a background processor is attached, preserving the active effect.
				await existingTrack.restartTrack(options);
				if (!this.deviceService.isCameraEnabled()) {
					await existingTrack.mute();
				}
				this.log.d('Camera switched via restartTrack:', deviceId);
			} catch (error) {
				this.log.e('Failed to switch camera via restartTrack:', error);
				throw error;
			}
			return;
		}

		// No existing track (edge case: camera was unavailable/unpublished) → create a fresh one
		try {
			const newVideoTracks = await this.livekitAdapter.createLocalTracks({ video: options });
			const videoTrack = newVideoTracks.find((t) => t.kind === Track.Kind.Video) as OVLocalVideoTrack | undefined;
			if (videoTrack) {
				if (!this.deviceService.isCameraEnabled()) {
					await videoTrack.mute();
				}
				// Attach processor (and restore active background if any) to the fresh track
				await this.videoTrackProcessorService.applyToVideoTrack(videoTrack);
				this.localTracks.push(videoTrack);
				this.log.d('New camera track created and added:', deviceId);
			}
		} catch (error) {
			this.log.e('Failed to create new video track:', error);
			const message = error instanceof Error ? error.message : 'Unknown error';
			throw new Error(`Failed to switch camera: ${message}`);
		}
	}

	/**
	 * Switches the microphone device in prejoin (room not yet connected).
	 *
	 * Uses `LocalAudioTrack.restartTrack({ deviceId })` on the existing track when available,
	 * preserving echo-cancellation, noise-suppression and auto-gain-control constraints.
	 * Falls back to creating a new audio track when none exists.
	 * @param deviceId - The new audio device ID
	 * @internal
	 */
	async switchMicrophone(deviceId: string): Promise<void> {
		const existingTrack = this.localTracks.find((t) => t.kind === Track.Kind.Audio) as
			| OVLocalAudioTrack
			| undefined;
		const options: AudioCaptureOptions = {
			deviceId: this.toDeviceConstraint(deviceId),
			echoCancellation: true,
			noiseSuppression: true,
			autoGainControl: true
		};

		if (existingTrack) {
			try {
				await existingTrack.restartTrack(options);
				if (!this.deviceService.isMicrophoneEnabled()) {
					await existingTrack.mute();
				}
				this.log.d('Microphone switched via restartTrack:', deviceId);
			} catch (error) {
				this.log.e('Failed to switch microphone via restartTrack:', error);
				throw error;
			}
			return;
		}

		// No existing track (edge case) → create a fresh one
		try {
			const newAudioTracks = await this.livekitAdapter.createLocalTracks(options as OVCreateLocalTracksOptions);
			const audioTrack = newAudioTracks.find((t) => t.kind === Track.Kind.Audio);
			if (audioTrack) {
				if (!this.deviceService.isMicrophoneEnabled()) {
					await audioTrack.mute();
				}
				this.localTracks.push(audioTrack);
				this.log.d('New microphone track created and added:', deviceId);
			}
		} catch (error) {
			this.log.e('Failed to create new audio track:', error);
			const message = error instanceof Error ? error.message : 'Unknown error';
			throw new Error(`Failed to switch microphone: ${message}`);
		}
	}

	/**
	 * Gets the current video track from local tracks or room.
	 * @returns LocalVideoTrack or undefined
	 * @internal
	 */
	async getCurrentVideoTrack(): Promise<OVLocalVideoTrack | undefined> {
		// First try to get from local tracks (prejoin state)
		let videoTrack = this.localTracks.find((t) => t.kind === Track.Kind.Video) as OVLocalVideoTrack | undefined;

		// If not found and room is connected, get from published tracks
		if (!videoTrack && this.isRoomConnected() && this.room) {
			const localParticipant = this.room.localParticipant;
			const videoPublication = localParticipant
				.getTrackPublications()
				.find((pub) => pub.kind === Track.Kind.Video);
			videoTrack = videoPublication?.track as OVLocalVideoTrack | undefined;
		}

		return videoTrack;
	}

	async getCurrentAudioTrack(): Promise<OVLocalAudioTrack | undefined> {
		let audioTrack = this.localTracks.find((track) => track.kind === Track.Kind.Audio) as OVLocalAudioTrack | undefined;
		if (!audioTrack && this.isRoomConnected() && this.room) {
			audioTrack = this.room.localParticipant.getTrackPublications()
				.find((publication) => publication.source === Track.Source.Microphone)?.track as OVLocalAudioTrack | undefined;
		}
		return audioTrack;
	}

	async setAiNoiseSuppressionEnabled(enabled: boolean): Promise<boolean> {
		return this.audioNoiseSuppression.setEnabled(await this.getCurrentAudioTrack(), enabled);
	}

	async getLocalMediaStats(): Promise<{rttMs?:number;jitterMs?:number;packetLossPercent?:number;bitrateKbps?:number;framesPerSecond?:number;width?:number;height?:number;candidateType?:string;protocol?:string}> {
		const tracks: OVLocalTrack[] = this.localTracks.length ? this.localTracks : this.room?.localParticipant.getTrackPublications().map((p)=>p.track).filter((t):t is OVLocalTrack=>!!t)??[];
		const reports=(await Promise.all(tracks.map((track)=>track.getRTCStatsReport().catch(()=>undefined)))).filter((r):r is RTCStatsReport=>!!r);let sent=0,lost=0,rtt=0,jitter=0,bitrate=0,fps=0,width=0,height=0,candidateType:string|undefined,protocol:string|undefined;const now=Date.now();
		for(const report of reports)for(const stat of report.values()){if(stat.type==='remote-inbound-rtp'){sent+=Number(stat.packetsSent??0);lost+=Math.max(0,Number(stat.packetsLost??0));rtt=Math.max(rtt,Number(stat.roundTripTime??0)*1000);jitter=Math.max(jitter,Number(stat.jitter??0)*1000);}if(stat.type==='outbound-rtp'){const bytes=Number(stat.bytesSent??0),previous=this.statsBaselines.get(stat.id);if(previous&&bytes>=previous.bytes&&now>previous.at)bitrate+=(bytes-previous.bytes)*8/(now-previous.at);this.statsBaselines.set(stat.id,{bytes,at:now});fps=Math.max(fps,Number(stat.framesPerSecond??0));width=Math.max(width,Number(stat.frameWidth??0));height=Math.max(height,Number(stat.frameHeight??0));}if(stat.type==='candidate-pair'&&stat.nominated){const local=report.get(stat.localCandidateId);protocol=local?.protocol??stat.protocol;candidateType=local?.candidateType;}}
		return{rttMs:rtt||undefined,jitterMs:jitter||undefined,packetLossPercent:sent+lost?lost/(sent+lost)*100:undefined,bitrateKbps:bitrate||undefined,framesPerSecond:fps||undefined,width:width||undefined,height:height||undefined,candidateType,protocol};
	}

	/**
	 * Extracts Livekit data from the provided token and returns an object containing the Livekit URL and room admin status.
	 * @param token - The token to extract Livekit data from.
	 * @param livekitUrl - The default Livekit URL to use if no Livekit URL is found in the token metadata.
	 * @returns An object containing the Livekit URL and room admin status.
	 * @throws Error if there is an error decoding and parsing the token.
	 * @internal
	 */
	private extractLivekitData(token: string): { livekitUrl?: string; livekitRoomAdmin: boolean } {
		try {
			const base64Url = token.split('.')[1];
			const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
			const jsonPayload = decodeURIComponent(
				window
					.atob(base64)
					.split('')
					.map((c) => {
						return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
					})
					.join('')
			);

			const payload = JSON.parse(jsonPayload);
			if (payload?.metadata) {
				const tokenMetadata = JSON.parse(payload.metadata);
				return {
					livekitUrl: tokenMetadata.livekitUrl,
					livekitRoomAdmin: !!tokenMetadata.roomAdmin
				};
			}

			return { livekitRoomAdmin: false };
		} catch (error) {
			throw new Error('Error decoding and parsing token: ' + error);
		}
	}
}

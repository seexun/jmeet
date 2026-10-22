import { computed, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { CameraType, CustomDevice, DeviceType } from '../../models/device.model';
import { ILogger } from '../../models/logger.model';
import type { OVLocalTrack } from '../livekit-adapter';
import { LivekitAdapterFactory, LivekitAdapterInterface, Track } from '../livekit-adapter';
import { LoggerService } from '../logger/logger.service';
import { MeetingTranslateService } from '../translate/meeting-translate.service';
import { PlatformService } from '../platform/platform.service';
import { StorageService } from '../storage/storage.service';

/**
 * Device service with reactive state and independent audio/video handling.
 *
 * Design:
 * - Enumeration-only: this service never calls getUserMedia itself. Media permission is obtained
 *   when the real local tracks are created (prejoin / connect), so there is no throwaway probe
 *   that would acquire and immediately release the camera/microphone. Device labels — and hence a
 *   populated device list — only become available once that permission has been granted.
 * - Angular Signals for reactive state management (cameras, microphones as signals)
 * - Live device detection - automatically refreshes the list when devices are connected/disconnected
 * - LiveKit client integration for modern device enumeration
 *
 * @internal
 */
@Injectable({
	providedIn: 'root'
})
export class DeviceService implements OnDestroy {
	private readonly loggerSrv = inject(LoggerService);
	private readonly platformSrv = inject(PlatformService);
	private readonly storageSrv = inject(StorageService);
	private readonly translateSrv = inject(MeetingTranslateService);
	private readonly livekitAdapterFactory = inject(LivekitAdapterFactory);
	private readonly livekitAdapter: LivekitAdapterInterface = this.livekitAdapterFactory.createLiveKitAdapter();

	// 浏览器/系统默认设备的保留 deviceId：以 { ideal: 'default' } 约束打开即可跟随操作系统的
	// 默认麦克风/摄像头（见 OpenViduService.toDeviceConstraint）
	private static readonly DEFAULT_DEVICE_ID = 'default';
	// 摄像头没有浏览器 default 指针条目；这里记忆轨道实际打开的默认摄像头 id，
	// 供 devicechange 重建列表后继续组合"系统默认 · <设备名>"标签
	private systemDefaultCameraId: string | null = null;

	// Reactive device lists with Signals
	readonly cameras = signal<CustomDevice[]>([]);
	readonly microphones = signal<CustomDevice[]>([]);
	readonly cameraSelected = signal<CustomDevice | undefined>(undefined);
	readonly microphoneSelected = signal<CustomDevice | undefined>(undefined);

	// Computed availability/permission, derived directly from the device lists. A device only
	// appears in these lists once it carries a label, which the browser exposes only after media
	// permission has been granted — so "has devices" and "permission granted" collapse to the same
	// check, and there is no separate state to keep in sync.
	readonly hasVideoDevices = computed(() => this.cameras().length > 0);
	readonly hasAudioDevices = computed(() => this.microphones().length > 0);
	// Permission is inferred from device presence, so these are plain aliases of the availability
	// signals — no extra computed node needed.
	readonly hasVideoPermission = this.hasVideoDevices;
	readonly hasAudioPermission = this.hasAudioDevices;
	readonly allPermissionsGranted = computed(() => this.hasVideoPermission() && this.hasAudioPermission());

	// Internal state
	private log: ILogger;
	private initializationPromise: Promise<void> | null = null;
	private deviceChangeHandler: (() => void) | null = null;
	private deviceChangeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
	// Browsers commonly fire several `devicechange` events for a single hotplug; coalesce them.
	private readonly DEVICE_CHANGE_DEBOUNCE_MS = 300;

	constructor() {
		this.log = this.loggerSrv.get('DeviceService');
	}

	/**
	 * Cleanup when service is destroyed
	 */
	ngOnDestroy(): void {
		// Cancel any pending debounced refresh
		if (this.deviceChangeDebounceTimer) {
			clearTimeout(this.deviceChangeDebounceTimer);
			this.deviceChangeDebounceTimer = null;
		}

		// Remove device change listener
		if (this.deviceChangeHandler && navigator.mediaDevices?.removeEventListener) {
			navigator.mediaDevices.removeEventListener('devicechange', this.deviceChangeHandler);
			this.deviceChangeHandler = null;
			this.log.d('Device change detection disabled');
		}
	}

	/**
	 * Enumerate media devices and populate the reactive lists.
	 * Returns a promise that resolves when enumeration is complete.
	 *
	 * This does NOT request media permission. On first visit (before any track has been created)
	 * the lists will be empty; callers create the local tracks — which grants permission — and then
	 * call this again to populate the now-labelled device list.
	 */
	async initializeDevices(): Promise<void> {
		// Prevent multiple simultaneous initializations
		if (this.initializationPromise) {
			return this.initializationPromise;
		}

		this.initializationPromise = this.performInitialization();

		try {
			await this.initializationPromise;
		} finally {
			this.initializationPromise = null;
		}
	}

	private async performInitialization(): Promise<void> {
		this.clear();

		try {
			const devices = await this.enumerateDevices();

			this.processDevices(devices);
			this.updateSelectedDevices();

			// Setup live device detection
			this.setupDeviceChangeDetection();

			if (devices.length === 0) {
				this.log.w('No media devices found yet (permission may not have been granted)');
			} else {
				this.log.d('Media devices initialized', {
					cameras: this.cameras().length,
					microphones: this.microphones().length
				});
			}
		} catch (error) {
			this.log.e('Error initializing devices', error);
			throw error;
		}
	}

	/**
	 * Enumerate devices using LiveKit's Room API or the browser API.
	 *
	 * Only devices that already expose a label are kept (see {@link filterValidDevices}); labels are
	 * exposed by the browser once media permission has been granted. The browser's own pointer
	 * entries ('default' / 'communications') are preserved — they carry which concrete device the
	 * OS default currently maps to.
	 */
	private async enumerateDevices(): Promise<MediaDeviceInfo[]> {
		try {
			// Prefer LiveKit's enumeration (handles some cross-browser quirks).
			const devices = await this.livekitAdapter.getLocalDevices();
			return this.filterValidDevices(devices);
		} catch (error) {
			this.log.w('LiveKit device enumeration failed, falling back to browser API', error);
			const devices = await navigator.mediaDevices.enumerateDevices();
			return this.filterValidDevices(devices);
		}
	}

	/**
	 * Filter out invalid devices. Pointer entries ('default' / 'communications') are kept —
	 * {@link processDevices} consumes them to resolve the system default's concrete name.
	 */
	private filterValidDevices(devices: MediaDeviceInfo[]): MediaDeviceInfo[] {
		return devices.filter((d) => d.label && d.deviceId);
	}

	/**
	 * Process raw devices into typed camera and microphone lists
	 *
	 * A "系统默认" entry (deviceId 'default') is always placed first so the selection can follow
	 * the OS default microphone/camera — the enumerated concrete entries follow after it. The
	 * default entry's label carries the concrete device name behind the OS default, e.g.
	 * "系统默认 · 麦克风阵列 (Realtek Audio)".
	 */
	private processDevices(devices: MediaDeviceInfo[]): void {
		const defaultLabel = this.translateSrv.translate('DEVICE.DEFAULT');
		const browserDefault = devices.find((d) => d.deviceId === DeviceService.DEFAULT_DEVICE_ID);
		// 具体设备 = 去掉浏览器的指针条目（default/communications 只是指向，不是独立硬件）
		const concreteDevices = devices.filter(
			(d) => d.deviceId !== 'default' && d.deviceId !== 'communications'
		);

		// Process video devices
		const camerasArray = concreteDevices
			.filter((d) => d.kind === DeviceType.VIDEO_INPUT)
			.map((d) => this.createCustomDevice(d, CameraType.BACK));

		// Detect camera types (front/back) on the concrete devices
		this.detectCameraTypes(camerasArray);
		const defaultCamera = this.systemDefaultCameraId
			? camerasArray.find((c) => c.device === this.systemDefaultCameraId)
			: undefined;
		camerasArray.unshift({
			label: defaultCamera
				? `${defaultLabel} · ${defaultCamera.label}`
				: this.composeDefaultDeviceLabel(defaultLabel, browserDefault, camerasArray),
			device: DeviceService.DEFAULT_DEVICE_ID,
			type: CameraType.FRONT
		});

		// Process audio devices
		const microphonesArray = concreteDevices
			.filter((d) => d.kind === DeviceType.AUDIO_INPUT)
			.map((d) => ({ label: d.label, device: d.deviceId }));
		microphonesArray.unshift({
			label: this.composeDefaultDeviceLabel(defaultLabel, browserDefault, microphonesArray),
			device: DeviceService.DEFAULT_DEVICE_ID
		});

		// Update signals (availability/permission computeds derive from these)
		this.cameras.set(camerasArray);
		this.microphones.set(microphonesArray);
	}

	/**
	 * Detect camera types (front/back) based on platform and labels
	 */
	private detectCameraTypes(cameras: CustomDevice[]): void {
		if (cameras.length === 0) return;

		if (this.platformSrv.isMobile()) {
			// On mobile, detect by label
			cameras.forEach((camera) => {
				if (camera.label.toLowerCase().includes(CameraType.FRONT.toLowerCase())) {
					camera.type = CameraType.FRONT;
				}
			});
		} else {
			// On desktop, first camera is typically front-facing
			cameras[0].type = CameraType.FRONT;
		}
	}

	/**
	 * Create custom device object
	 */
	private createCustomDevice(device: MediaDeviceInfo, defaultType: CameraType): CustomDevice {
		return {
			label: device.label,
			device: device.deviceId,
			type: defaultType
		};
	}

	/**
	 * Update selected devices from storage or use defaults
	 */
	private updateSelectedDevices(): void {
		const storedCamera = this.storageSrv.getVideoDevice();
		const selectedCam = this.findDeviceOrDefault(
			this.cameras(),
			storedCamera?.device
		);
		if (selectedCam) {
			this.cameraSelected.set(selectedCam);
		}

		const storedMic = this.storageSrv.getAudioDevice();
		const selectedMic = this.findDeviceOrDefault(
			this.microphones(),
			storedMic?.device
		);
		if (selectedMic) {
			this.microphoneSelected.set(selectedMic);
		}
	}

	/**
	 * Find device by ID or fall back to the system default entry
	 */
	private findDeviceOrDefault(devices: CustomDevice[], deviceId?: string): CustomDevice | undefined {
		if (devices.length === 0) return undefined;
		return deviceId
			? devices.find((d) => d.device === deviceId) || this.findSystemDefaultEntry(devices)
			: this.findSystemDefaultEntry(devices);
	}

	/** The "系统默认" entry keeps the selection following the OS default microphone/camera. */
	private findSystemDefaultEntry(devices: CustomDevice[]): CustomDevice | undefined {
		return devices.find((d) => d.device === DeviceService.DEFAULT_DEVICE_ID) ?? devices[0];
	}

	/**
	 * "系统默认"的显示名：附上系统默认背后的实际设备名。
	 *
	 * 浏览器的 default 指针条目 label 形如 "默认 - <设备名>" / "Default - <设备名>"，
	 * 取 " - " 之后的后缀与具体设备 label 匹配得到设备名；匹配不到（如个别浏览器
	 * 不提供 default 条目）则只显示"系统默认"。
	 */
	private composeDefaultDeviceLabel(
		prefix: string,
		browserDefault: MediaDeviceInfo | undefined,
		concrete: CustomDevice[]
	): string {
		if (!browserDefault) return prefix;
		const suffix = browserDefault.label.includes(' - ')
			? browserDefault.label.split(' - ').slice(1).join(' - ').trim()
			: browserDefault.label.trim();
		if (!suffix) return prefix;
		const match =
			concrete.find((d) => d.label === suffix) ??
			concrete.find((d) => suffix.endsWith(d.label) || d.label.endsWith(suffix));
		return match ? `${prefix} · ${match.label}` : prefix;
	}

	/**
	 * Align the selected camera/microphone with the devices actually backing the given local tracks.
	 *
	 * Called right after the initial track creation so the device selectors reflect the hardware the
	 * browser really opened (e.g. the default device picked on first visit) rather than a guess made
	 * before enumeration. A stored preference, when the matching device exists, has already been
	 * honoured by the track creation, so this is a no-op in that common case.
	 */
	private async syncSelectedFromTracks(tracks: OVLocalTrack[]): Promise<void> {
		// 轨道刚创建时 getSettings() 可能还没有 deviceId（硬件启动中），有界等待其就绪
		for (let attempt = 0; attempt < 6; attempt++) {
			const pending = tracks.some((t) => !t?.mediaStreamTrack?.getSettings?.().deviceId);
			if (!pending) break;
			await new Promise((resolve) => setTimeout(resolve, 400));
		}
		for (const track of tracks) {
			const deviceId = track?.mediaStreamTrack?.getSettings?.().deviceId;
			if (!deviceId) continue;

			const isVideo = track.kind === Track.Kind.Video;
			const list = isVideo ? this.cameras() : this.microphones();
			const selected = isVideo ? this.cameraSelected() : this.microphoneSelected();

			// 轨道实际打开的设备 = 创建时的系统默认 → 用它充实"系统默认"标签
			// （摄像头没有浏览器级 default 指针条目，只能靠轨道 settings 反推）
			if (isVideo) this.systemDefaultCameraId = deviceId;
			this.enrichDefaultEntryLabel(list, deviceId);

			// 已有选中（含"系统默认"）时不顶替；首访无选中时对齐到实际打开的设备
			if (selected) continue;
			const match = list.find((d) => d.device === deviceId);
			if (match) {
				if (isVideo) this.cameraSelected.set(match);
				else this.microphoneSelected.set(match);
			}
		}
	}

	/**
	 * "系统默认"条目的标签还没有实际设备名时（如浏览器不为该类设备提供 default 指针条目），
	 * 用轨道实际打开的设备名充实。仅在首次充实，之后不覆盖。
	 */
	private enrichDefaultEntryLabel(devices: CustomDevice[], concreteDeviceId: string): void {
		const defaultEntry = devices.find((d) => d.device === DeviceService.DEFAULT_DEVICE_ID);
		const match = devices.find((d) => d.device === concreteDeviceId);
		if (!defaultEntry || !match || defaultEntry.label.includes(' · ')) return;
		defaultEntry.label = `${this.translateSrv.translate('DEVICE.DEFAULT')} · ${match.label}`;
	}

	/**
	 * Populate the device list right after the initial local tracks were created — the call that
	 * grants media permission on first visit — then align the current selection with the devices the
	 * browser actually opened.
	 *
	 * Re-enumeration is skipped when the list is already populated (returning users enumerate up
	 * front), and the whole operation is best-effort: an enumeration failure is logged, never thrown,
	 * so it can neither block joining nor cause the caller to re-acquire the tracks.
	 */
	async syncDevicesAfterTrackCreation(tracks: OVLocalTrack[]): Promise<void> {
		try {
			if (this.cameras().length === 0 && this.microphones().length === 0) {
				await this.initializeDevices();
			}
			await this.syncSelectedFromTracks(tracks);
		} catch (error) {
			this.log.w('Failed to enumerate devices after track creation', error);
		}
	}

	/**
	 * Refresh devices (e.g., when a device is plugged/unplugged).
	 *
	 * Re-enumerates only — it does not request permission, so it is cheap to call from the
	 * `devicechange` handler.
	 */
	async refreshDevices(): Promise<void> {
		const devices = await this.enumerateDevices();
		this.processDevices(devices);
		this.updateSelectedDevices();

		this.log.d('Devices refreshed', {
			cameras: this.cameras().length,
			microphones: this.microphones().length
		});
	}

	/**
	 * Setup live device change detection
	 * Automatically refreshes device list when devices are connected/disconnected
	 */
	private setupDeviceChangeDetection(): void {
		if (!navigator.mediaDevices?.addEventListener) {
			this.log.w('Device change detection not supported');
			return;
		}

		// Remove existing listener if any
		if (this.deviceChangeHandler) {
			navigator.mediaDevices.removeEventListener('devicechange', this.deviceChangeHandler);
		}

		// Create new handler: debounce so a burst of `devicechange` events triggers a single refresh
		this.deviceChangeHandler = () => {
			if (this.deviceChangeDebounceTimer) {
				clearTimeout(this.deviceChangeDebounceTimer);
			}
			this.deviceChangeDebounceTimer = setTimeout(() => {
				this.deviceChangeDebounceTimer = null;
				this.log.d('Device change detected, refreshing device list');
				void this.refreshDevices();
			}, this.DEVICE_CHANGE_DEBOUNCE_MS);
		};

		// Register listener
		navigator.mediaDevices.addEventListener('devicechange', this.deviceChangeHandler);
		this.log.d('Device change detection enabled');
	}

	// Public API methods (compatible with original DeviceService)

	/**
	 * Check if camera is enabled based on storage and device availability
	 */
	isCameraEnabled(): boolean {
		return this.hasVideoDeviceAvailable() && this.storageSrv.isCameraEnabled();
	}

	/**
	 * Check if microphone is enabled based on storage and device availability
	 */
	isMicrophoneEnabled(): boolean {
		return this.hasAudioDeviceAvailable() && this.storageSrv.isMicrophoneEnabled();
	}

	/**
	 * Get currently selected camera
	 */
	getCameraSelected(): CustomDevice | undefined {
		return this.cameraSelected();
	}

	/**
	 * Get currently selected microphone
	 */
	getMicrophoneSelected(): CustomDevice | undefined {
		return this.microphoneSelected();
	}

	/**
	 * Set selected camera and persist to storage
	 */
	setCameraSelected(deviceId: string): void {
		const device = this.cameras().find((c) => c.device === deviceId);
		if (!device) {
			this.log.w('Camera not found:', deviceId);
			return;
		}

		this.cameraSelected.set(device);
		this.storageSrv.setVideoDevice(device);
		this.log.d('Camera selected:', device.label);
	}

	/**
	 * Set selected microphone and persist to storage
	 */
	setMicSelected(deviceId: string): void {
		const device = this.microphones().find((m) => m.device === deviceId);
		if (!device) {
			this.log.w('Microphone not found:', deviceId);
			return;
		}

		this.microphoneSelected.set(device);
		this.storageSrv.setAudioDevice(device);
		this.log.d('Microphone selected:', device.label);
	}

	/**
	 * Check if video track needs to be updated
	 */
	needUpdateVideoTrack(newDevice: CustomDevice): boolean {
		const current = this.cameraSelected();
		return (
			current?.device !== newDevice.device ||
			current?.label !== newDevice.label
		);
	}

	/**
	 * Check if audio track needs to be updated
	 */
	needUpdateAudioTrack(newDevice: CustomDevice): boolean {
		const current = this.microphoneSelected();
		return (
			current?.device !== newDevice.device ||
			current?.label !== newDevice.label
		);
	}

	// ==========================================
	// Public API - Device Access
	// ==========================================

	/**
	 * Get list of available cameras
	 */
	getCameras(): CustomDevice[] {
		return this.cameras();
	}

	/**
	 * Get list of available microphones
	 */
	getMicrophones(): CustomDevice[] {
		return this.microphones();
	}

	// ==========================================
	// Public API - Device State
	// ==========================================

	/**
	 * Check if video devices are available
	 */
	hasVideoDeviceAvailable(): boolean {
		return this.hasVideoDevices();
	}

	/**
	 * Check if audio devices are available
	 */
	hasAudioDeviceAvailable(): boolean {
		return this.hasAudioDevices();
	}

	// ==========================================
	// Public API - Permission State
	// ==========================================

	/**
	 * Check if video permission was granted
	 */
	hasVideoPermissionGranted(): boolean {
		return this.hasVideoPermission();
	}

	/**
	 * Check if audio permission was granted
	 */
	hasAudioPermissionGranted(): boolean {
		return this.hasAudioPermission();
	}

	// ==========================================
	// Public API - Reactive State Access
	// For components that need direct signal access, use:
	// - this.cameras, this.microphones (device lists)
	// - this.cameraSelected, this.microphoneSelected (selections)
	// - this.hasVideoDevices, this.hasAudioDevices (availability)
	// - this.hasVideoPermission, this.hasAudioPermission (permissions)
	// - this.allPermissionsGranted (combined permissions)
	// ==========================================

	/**
	 * Clear all device data
	 */
	clear(): void {
		this.cameras.set([]);
		this.microphones.set([]);
		this.cameraSelected.set(undefined);
		this.microphoneSelected.set(undefined);
	}
}

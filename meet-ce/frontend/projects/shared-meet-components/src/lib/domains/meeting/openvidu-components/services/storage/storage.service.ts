import { inject, Injectable } from '@angular/core';
import { CustomDevice } from '../../models/device.model';
import { ILogger } from '../../models/logger.model';
import { STORAGE_PREFIX, StorageKeys, TAB_SPECIFIC_KEYS } from '../../models/storage.model';
import { OpenViduThemeMode } from '../../models/theme.model';
import { LoggerService } from '../logger/logger.service';

/** localStorage 内的自定义虚拟背景条目（见 VirtualBackgroundService） */
export interface CustomBackgroundRecord {
	id: string;
	dataUrl: string;
	createdAt?: number;
}

/**
 * @internal
 *
 * Stores the user's meeting preferences in the browser, namespaced under {@link STORAGE_PREFIX}.
 *
 * Each key is routed to a backend according to its lifecycle:
 * - {@link TAB_SPECIFIC_KEYS} (participant name, camera/microphone state) live in `sessionStorage`.
 *   It is isolated per tab and wiped by the browser when the tab closes, so the same room can be
 *   opened in several tabs with independent settings and no stale data is left behind — which is
 *   why this service carries no manual tab-cleanup logic.
 * - Every other key lives in `localStorage`, shared across all tabs of the same origin and kept
 *   until explicitly removed (devices, language, captions, theme, virtual background).
 *
 * `MeetStorageService` extends this class to persist its own keys through {@link get}/{@link set}.
 */
@Injectable({
	providedIn: 'root'
})
export class StorageService {
	protected readonly log: ILogger = inject(LoggerService).get('StorageService');
	protected PREFIX_KEY = STORAGE_PREFIX;
	private readonly isStorageAvailable = this.checkStorageAvailability();

	constructor() {
		if (!this.isStorageAvailable) {
			this.log.w('Browser storage is not available - StorageService will operate in no-op mode');
		}
	}

	getParticipantName(): string | null {
		return this.get<string>(StorageKeys.PARTICIPANT_NAME);
	}

	setParticipantName(name: string): void {
		this.set(StorageKeys.PARTICIPANT_NAME, name);
	}

	getVideoDevice(): CustomDevice | null {
		return this.get<CustomDevice>(StorageKeys.VIDEO_DEVICE);
	}

	setVideoDevice(device: CustomDevice): void {
		this.set(StorageKeys.VIDEO_DEVICE, device);
	}

	getAudioDevice(): CustomDevice | null {
		return this.get<CustomDevice>(StorageKeys.AUDIO_DEVICE);
	}

	setAudioDevice(device: CustomDevice): void {
		this.set(StorageKeys.AUDIO_DEVICE, device);
	}

	/** Defaults to enabled: a missing key means the participant never turned the camera off. */
	isCameraEnabled(): boolean {
		return this.get<boolean>(StorageKeys.CAMERA_ENABLED) ?? true;
	}

	setCameraEnabled(enabled: boolean): void {
		this.set(StorageKeys.CAMERA_ENABLED, enabled);
	}

	/** Defaults to enabled: a missing key means the participant never turned the microphone off. */
	isMicrophoneEnabled(): boolean {
		return this.get<boolean>(StorageKeys.MICROPHONE_ENABLED) ?? true;
	}

	setMicrophoneEnabled(enabled: boolean): void {
		this.set(StorageKeys.MICROPHONE_ENABLED, enabled);
	}

	isAiNoiseSuppressionEnabled(): boolean {
		return this.get<boolean>(StorageKeys.AI_NOISE_SUPPRESSION) ?? false;
	}

	setAiNoiseSuppressionEnabled(enabled: boolean): void {
		this.set(StorageKeys.AI_NOISE_SUPPRESSION, enabled);
	}

	getLang(): string | null {
		return this.get<string>(StorageKeys.LANG);
	}

	setLang(lang: string): void {
		this.set(StorageKeys.LANG, lang);
	}

	getCaptionsLang(): string | null {
		return this.get<string>(StorageKeys.CAPTION_LANG);
	}

	setCaptionLang(lang: string): void {
		this.set(StorageKeys.CAPTION_LANG, lang);
	}

	getBackground(): string | null {
		return this.get<string>(StorageKeys.BACKGROUND);
	}

	setBackground(id: string): void {
		this.set(StorageKeys.BACKGROUND, id);
	}

	removeBackground(): void {
		this.remove(StorageKeys.BACKGROUND);
	}

	getTheme(): OpenViduThemeMode | null {
		return this.get<OpenViduThemeMode>(StorageKeys.THEME);
	}

	setTheme(theme: OpenViduThemeMode): void {
		this.set(StorageKeys.THEME, theme);
	}

	removeTheme(): void {
		this.remove(StorageKeys.THEME);
	}

	isMusicModeEnabled(): boolean {
		return this.get<boolean>(StorageKeys.MUSIC_MODE) ?? false;
	}

	setMusicModeEnabled(enabled: boolean): void {
		this.set(StorageKeys.MUSIC_MODE, enabled);
	}

	getVideoQuality(): string | null {
		return this.get<string>(StorageKeys.VIDEO_QUALITY);
	}

	setVideoQuality(tier: string): void {
		this.set(StorageKeys.VIDEO_QUALITY, tier);
	}

	/** 自定义虚拟背景列表（dataURL） */
	getCustomBackgrounds(): CustomBackgroundRecord[] {
		return this.get<CustomBackgroundRecord[]>(StorageKeys.CUSTOM_BACKGROUNDS) ?? [];
	}

	setCustomBackgrounds(backgrounds: CustomBackgroundRecord[]): void {
		this.set(StorageKeys.CUSTOM_BACKGROUNDS, backgrounds);
	}

	/**
	 * Persists a value, wrapped as `{ item: value }` so that falsy values (`false`, `0`, `''`) and
	 * `null` round-trip intact and stay distinguishable from an absent key.
	 */
	protected set(key: string, item: unknown): void {
		const storage = this.storageFor(key);
		if (!storage) return;

		try {
			storage.setItem(this.PREFIX_KEY + key, JSON.stringify({ item }));
		} catch (e) {
			this.log.e(`Failed to set storage key: ${key}`, e);
		}
	}

	/**
	 * Reads a value written by {@link set}, or `null` if it is absent or corrupted.
	 *
	 * `T` defaults to `any` (rather than `unknown`) so subclasses can assign the result without
	 * casting; the public accessors above pass an explicit `T` to recover real type safety.
	 */
	protected get<T = any>(key: string): T | null {
		const storage = this.storageFor(key);
		if (!storage) return null;

		const storageKey = this.PREFIX_KEY + key;
		const raw = storage.getItem(storageKey);
		if (!raw) return null;

		try {
			return (JSON.parse(raw) as { item: T }).item;
		} catch (e) {
			this.log.e(`Failed to parse storage key: ${key}`, e);
			storage.removeItem(storageKey); // discard the corrupted entry so it stops failing
			return null;
		}
	}

	protected remove(key: string): void {
		const storage = this.storageFor(key);
		if (!storage) return;

		try {
			storage.removeItem(this.PREFIX_KEY + key);
		} catch (e) {
			this.log.e(`Failed to remove storage key: ${key}`, e);
		}
	}

	/**
	 * Selects the backend for a key — `sessionStorage` for {@link TAB_SPECIFIC_KEYS}, `localStorage`
	 * otherwise — or `null` when storage is unavailable, which turns every operation into a safe no-op.
	 */
	private storageFor(key: string): Storage | null {
		if (!this.isStorageAvailable) return null;
		return TAB_SPECIFIC_KEYS.includes(key as StorageKeys) ? window.sessionStorage : window.localStorage;
	}

	/**
	 * Probes storage once at construction. Access can *throw* (not just return null) when blocked by
	 * browser policy or Safari's private mode, so the result is cached to keep later calls cheap.
	 */
	private checkStorageAvailability(): boolean {
		const probe = '__ovStorageProbe__';
		try {
			for (const storage of [window.localStorage, window.sessionStorage]) {
				storage.setItem(probe, probe);
				storage.removeItem(probe);
			}
			return true;
		} catch {
			return false;
		}
	}
}

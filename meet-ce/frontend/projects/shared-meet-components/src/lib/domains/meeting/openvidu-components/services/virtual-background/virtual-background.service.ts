import { computed, inject, Injectable, Signal, signal } from '@angular/core';
import { SwitchBackgroundProcessorOptions } from '@livekit/track-processors';
import { AssetsService } from '../../../../../shared/services/assets.service';
import { BackgroundCategory, BackgroundEffect, EffectType } from '../../models/background-effect.model';
import { LoggerService } from '../logger/logger.service';
import { OpenViduService } from '../openvidu/openvidu.service';
import { StorageService } from '../storage/storage.service';
import { VideoTrackProcessorService } from '../track-processor/video-track-processor.service';

function categoryPrefix(category: BackgroundCategory): string {
	return category.toLowerCase().replace('_', '-');
}

/** 自定义背景上限：dataURL 存于 localStorage，超限按最旧淘汰 */
const MAX_CUSTOM_BACKGROUNDS = 3;
/** 自定义背景文件大小上限 */
const MAX_CUSTOM_BACKGROUND_FILE_SIZE = 5 * 1024 * 1024;
/** 自定义背景缩放上限（长边），控制 dataURL 体积 */
const CUSTOM_BACKGROUND_MAX_DIMENSION = 1280;
/**
 * @internal
 */
@Injectable({
	providedIn: 'root'
})
export class VirtualBackgroundService {
	private readonly openviduService = inject(OpenViduService);
	private readonly videoTrackProcessorService = inject(VideoTrackProcessorService);
	private readonly storageService = inject(StorageService);
	private readonly log = inject(LoggerService).get('VirtualBackgroundService');
	private readonly assets = inject(AssetsService);
	private readonly backgroundIdSelectedWritable = signal<string>('');
	readonly backgroundIdSelected = this.backgroundIdSelectedWritable.asReadonly();

	private buildBackgroundPath(path: string): string {
		return this.assets.background(path);
	}

	/**
	 * Background images available per category. Each id maps directly to the asset files:
	 *   src/assets/backgrounds/<category>/<id>.webp            (full image)
	 *   src/assets/backgrounds/<category>/thumbnails/<id>.webp (thumbnail)
	 * The order here is the order shown within each category.
	 *
	 * To add an image: drop the two files and add its id here.
	 * To remove one: delete the two files and remove its id here.
	 */
	private readonly imageBackgrounds: Record<BackgroundCategory, string[]> = {
		[BackgroundCategory.PROFESSIONAL]: ['professional-1', 'professional-2', 'professional-3', 'professional-4'],
		[BackgroundCategory.HOME_OFFICE]: ['home-office-1', 'home-office-2', 'home-office-3', 'home-office-4'],
		[BackgroundCategory.CREATIVE]: [
			'creative-1',
			'creative-2',
			'creative-3',
			'creative-4',
			'creative-5',
			'creative-6',
			'creative-7'
		],
		// 自定义背景来自本地上传,不在此登记
		[BackgroundCategory.CUSTOM]: []
	};

	private createImageBackground(id: string, category: BackgroundCategory): BackgroundEffect {
		const prefix = categoryPrefix(category);
		const fileName = `${id}.webp`;

		return {
			id,
			type: EffectType.IMAGE,
			thumbnail: this.buildBackgroundPath(`${prefix}/thumbnails/${fileName}`),
			src: this.buildBackgroundPath(`${prefix}/${fileName}`),
			category
		};
	}

	private createImageBackgrounds(): BackgroundEffect[] {
		return Object.entries(this.imageBackgrounds).flatMap(([category, ids]) =>
			ids.map((id) => this.createImageBackground(id, category as BackgroundCategory))
		);
	}

	backgrounds: BackgroundEffect[] = [
		{ id: 'no_effect', type: EffectType.NONE, thumbnail: 'block' },
		{ id: 'soft_blur', type: EffectType.BLUR, thumbnail: 'blur_on' },
		{ id: 'hard_blur', type: EffectType.BLUR, thumbnail: 'blur_on' },
		...this.createImageBackgrounds()
	];

	private readonly _customBackgrounds = signal<BackgroundEffect[]>(this.loadCustomBackgrounds());
	/** 用户上传的自定义背景（最新在前），随上传/删除实时更新 */
	readonly customBackgrounds = this._customBackgrounds.asReadonly();

	private SOFT_BLUR_INTENSITY = 20;
	private HARD_BLUR_INTENSITY = 60;

	getBackgrounds(): BackgroundEffect[] {
		return [...this.backgrounds, ...this._customBackgrounds()];
	}

	/** 从本地存储恢复自定义背景（dataURL 同时用作缩略图与处理器输入源） */
	private loadCustomBackgrounds(): BackgroundEffect[] {
		try {
			const stored = this.storageService.getCustomBackgrounds();
			return stored.map((entry) => ({
				id: entry.id,
				type: EffectType.IMAGE,
				thumbnail: entry.dataUrl,
				src: entry.dataUrl,
				category: BackgroundCategory.CUSTOM
			}));
		} catch (error) {
			this.log.w('Failed to load custom backgrounds', error);
			return [];
		}
	}

	private persistCustomBackgrounds(): void {
		const stored = this._customBackgrounds().map((effect) => ({
			id: effect.id,
			dataUrl: effect.src!,
			createdAt: Date.now()
		}));
		this.storageService.setCustomBackgrounds(stored);
	}

	/**
	 * 上传自定义虚拟背景：校验类型与大小后等比缩放为 JPEG dataURL。
	 * 超过 {@link MAX_CUSTOM_BACKGROUNDS} 时按最旧淘汰。
	 */
	async addCustomBackground(file: File): Promise<BackgroundEffect> {
		if (!file.type.startsWith('image/')) {
			throw new Error('仅支持图片文件');
		}
		if (file.size > MAX_CUSTOM_BACKGROUND_FILE_SIZE) {
			throw new Error('图片不能超过 5MB');
		}
		const dataUrl = await this.downscaleToDataUrl(file);
		const effect: BackgroundEffect = {
			id: `custom-${Date.now()}`,
			type: EffectType.IMAGE,
			thumbnail: dataUrl,
			src: dataUrl,
			category: BackgroundCategory.CUSTOM
		};
		this._customBackgrounds.update((list) => [effect, ...list].slice(0, MAX_CUSTOM_BACKGROUNDS));
		this.persistCustomBackgrounds();
		return effect;
	}

	/** 删除自定义背景；若其正处于选中状态则同步还原为无效果 */
	async removeCustomBackground(id: string): Promise<void> {
		this._customBackgrounds.update((list) => list.filter((effect) => effect.id !== id));
		this.persistCustomBackgrounds();
		if (this.backgroundIdSelected() === id) {
			await this.removeBackground();
		}
	}

	/** 等比缩放到长边 ≤1280 并压缩为 JPEG，控制 localStorage 占用 */
	private downscaleToDataUrl(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			const objectUrl = URL.createObjectURL(file);
			img.onload = () => {
				try {
					const scale = Math.min(1, CUSTOM_BACKGROUND_MAX_DIMENSION / Math.max(img.width, img.height));
					const canvas = document.createElement('canvas');
					canvas.width = Math.round(img.width * scale);
					canvas.height = Math.round(img.height * scale);
					const ctx = canvas.getContext('2d');
					if (!ctx) throw new Error('Canvas 不可用');
					ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
					resolve(canvas.toDataURL('image/jpeg', 0.85));
				} catch (error) {
					reject(error);
				} finally {
					URL.revokeObjectURL(objectUrl);
				}
			};
			img.onerror = () => {
				URL.revokeObjectURL(objectUrl);
				reject(new Error('图片解析失败'));
			};
			img.src = objectUrl;
		});
	}

	/**
	 * Computed signal that checks if virtual background is supported (requires GPU).
	 * Reactively tracks the support status from OpenViduService.
	 */
	readonly isVirtualBackgroundSupported: Signal<boolean> = computed(() =>
		this.videoTrackProcessorService.isBackgroundProcessorSupported()
	);

	isBackgroundApplied(): boolean {
		const bgSelected = this.backgroundIdSelected();
		return !!bgSelected && bgSelected !== 'no_effect';
	}

	async applyBackgroundFromStorage() {
		const bgId = this.storageService.getBackground();
		if (!!bgId) {
			const background = this.getBackgrounds().find((bg) => bg.id === bgId);
			if (background) {
				await this.applyBackground(background);
			}
		}
	}

	/**
	 * Applies a background effect to the local video track.
	 * Works both in prejoin (using OpenViduService's processor) and in-room states.
	 * The background processor is centralized in OpenViduService for consistency.
	 */
	async applyBackground(bg: BackgroundEffect) {
		// Check if virtual background is supported before proceeding
		if (!this.isVirtualBackgroundSupported()) {
			this.log.w('Virtual background not supported (GPU disabled). Skipping background application.');
			return;
		}

		// If the background is already applied, do nothing
		if (this.backgroundIsAlreadyApplied(bg.id)) return;

		try {
			const options = this.getBackgroundOptions(bg);
			const videoTrack = await this.openviduService.getCurrentVideoTrack();
			await this.videoTrackProcessorService.switchBackgroundMode(options, videoTrack);

			this.storageService.setBackground(bg.id);
			this.backgroundIdSelectedWritable.set(bg.id);
			this.log.d('Background applied:', options);
		} catch (error) {
			this.log.e('Error applying background effect:', error);
		}
	}

	async removeBackground() {
		if (this.isBackgroundApplied()) {
			this.backgroundIdSelectedWritable.set('no_effect');
			try {
				const videoTrack = await this.openviduService.getCurrentVideoTrack();
				await this.videoTrackProcessorService.switchBackgroundMode({ mode: 'disabled' }, videoTrack);
			} catch (e) {
				this.log.w('Error disabling processor:', e);
			}
			this.storageService.removeBackground();
		}
	}

	private getBackgroundOptions(bg: BackgroundEffect): SwitchBackgroundProcessorOptions {
		if (bg.type === EffectType.NONE) {
			return { mode: 'disabled' };
		} else if (bg.type === EffectType.IMAGE && bg.src) {
			return { mode: 'virtual-background', imagePath: bg.src };
		} else if (bg.type === EffectType.BLUR) {
			return {
				mode: 'background-blur',
				blurRadius: bg.id === 'soft_blur' ? this.SOFT_BLUR_INTENSITY : this.HARD_BLUR_INTENSITY
			};
		}
		return { mode: 'disabled' };
	}

	private backgroundIsAlreadyApplied(backgroundId: string): boolean {
		return backgroundId === this.backgroundIdSelected();
	}
}

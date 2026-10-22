import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { LoggerService, ParticipantService } from '../openvidu-components';
import { MeetingContextService } from './meeting-context.service';
import { NotificationService } from '../../../shared/services/notification.service';

/** 画中画窗口尺寸（Document Picture-in-Picture） */
const PIP_WIDTH = 480;
const PIP_HEIGHT = 300;

/**
 * 会中画中画（Document Picture-in-Picture，Chrome/Edge 116+）：
 * 在独立小窗中跟随"当前焦点画面"——优先级：全局焦点 > 正在说话的人 > 本人。
 * 焦点切换时自动切换视频源；关闭小窗或离开会议时自动清理。
 */
@Injectable({ providedIn: 'root' })
export class MeetingPipService {
	private readonly meetingContext = inject(MeetingContextService);
	private readonly participantService = inject(ParticipantService);
	private readonly notificationService = inject(NotificationService);
	private readonly loggerService = inject(LoggerService);
	private log = this.loggerService.get('JMeet - MeetingPip');

	private pipWindow: Window | null = null;
	private videoElement: HTMLVideoElement | null = null;
	private currentStream: MediaStream | null = null;

	readonly isOpen = signal(false);

	/** 当前应跟随的参会人（全局焦点 > 发言者 > 本人） */
	readonly featuredParticipant = computed(() => {
		const spotlight = this.meetingContext.spotlightIdentity();
		if (spotlight) {
			const target = this.participantService.getParticipantByIdentity(spotlight);
			if (target) return target;
		}
		const speaker = this.participantService
			.remoteParticipants()
			.find((p) => p.isSpeaking && p.isCameraEnabled);
		if (speaker) return speaker;
		const local = this.meetingContext.localParticipant();
		if (local?.isCameraEnabled) return local;
		return this.participantService.remoteParticipants().find((p) => p.isCameraEnabled);
	});

	/** 焦点画面变化 → 更新小窗视频源 */
	private readonly streamEffect = effect(() => {
		if (!this.isOpen()) return;
		const participant = this.featuredParticipant();
		untracked(() => this.attachStream(participant?.identity));
	});

	get isSupported(): boolean {
		return typeof (window as any).documentPictureInPicture !== 'undefined';
	}

	/** 打开/关闭画中画小窗 */
	async toggle(): Promise<void> {
		if (this.isOpen()) {
			this.close();
			return;
		}
		if (!this.isSupported) {
			this.notificationService.showSnackbar('当前浏览器不支持画中画，请使用 Chrome/Edge 116 及以上版本');
			return;
		}
		try {
			// Document Picture-in-Picture 的入参 API 是 requestWindow(同步调用以保住用户手势)
			const pipWindow: Window = await (window as any).documentPictureInPicture.requestWindow({
				width: PIP_WIDTH,
				height: PIP_HEIGHT
			});
			this.pipWindow = pipWindow;
			this.setupDocument(pipWindow);
			this.isOpen.set(true);
			// effect 依赖 isOpen,置位后手动触发一次源挂载
			untracked(() => this.attachStream(this.featuredParticipant()?.identity));
			pipWindow.addEventListener('pagehide', () => this.close());
		} catch (error) {
			this.log.e('Error opening picture-in-picture window:', error);
			this.notificationService.showSnackbar('画中画打开失败，请稍后重试');
		}
	}

	private setupDocument(pipWindow: Window): void {
		const doc = pipWindow.document;
		doc.title = '会议画中画';
		doc.body.style.cssText = 'margin:0;background:#141414;display:flex;align-items:center;justify-content:center;height:100vh;overflow:hidden;';
		const video = doc.createElement('video');
		video.autoplay = true;
		video.muted = true; // 音频仍由主窗口播放,避免双声道/回声
		video.playsInline = true;
		video.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#141414;';
		doc.body.appendChild(video);
		this.videoElement = video;
	}

	/** 把参会人的摄像头轨挂到小窗视频元素 */
	private attachStream(identity?: string): void {
		if (!this.videoElement || !identity) return;
		const participant = this.participantService.getParticipantByIdentity(identity);
		if (!participant) return;
		const cameraStream = participant.streams().find((s) => s.isCameraStream);
		const mediaStreamTrack = cameraStream?.videoTrack?.videoTrack?.mediaStreamTrack;
		if (!mediaStreamTrack) return;
		const nextStream = new MediaStream([mediaStreamTrack]);
		if (nextStream.id === this.currentStream?.id) return;
		this.currentStream = nextStream;
		this.videoElement.srcObject = nextStream;
		void this.videoElement.play().catch(() => {});
	}

	close(): void {
		this.videoElement = null;
		this.currentStream = null;
		if (this.pipWindow && !this.pipWindow.closed) {
			this.pipWindow.close();
		}
		this.pipWindow = null;
		this.isOpen.set(false);
	}
}

import { DestroyRef, inject, Injectable, signal } from '@angular/core';

export type MeetingTheme = 'light';

const MEETING_UI_CLASS = 'meeting-ui';

/**
 * 会议域作用域开关：首次注入时在 body 挂 meeting-ui，应用级常驻。
 * 本服务是 root 单例，DestroyRef 挂在根注入器上——仅应用销毁时触发，
 * 路由离开会议页不摘除（令牌经 --jmeet-meeting-* 独立命名空间隔离，
 * 残留类不外溢影响控制台域）。
 * 会议域全部令牌（--jmeet-meeting-*）与骨架样式都在 body.meeting-ui 之下，
 * 覆盖 teleport 到 body 的 nz-modal / nz-dropdown / nz-message 浮层。
 * 暗色模式已按规格移除（Light-only），历史暗色主题挂类全链路删除。
 */
@Injectable({ providedIn: 'root' })
export class MeetingThemeService {
	readonly theme = signal<MeetingTheme>('light');

	constructor() {
		const destroyRef = inject(DestroyRef);
		document.body.classList.add(MEETING_UI_CLASS);
		destroyRef.onDestroy(() => document.body.classList.remove(MEETING_UI_CLASS));
	}
}

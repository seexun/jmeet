import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * 应用骨架（标准 §8-11）：全宽 Topbar + 下方「Sidebar | Content」双栏。
 *
 * 布局本身由 styles/layout/_shell.scss 的 .jmeet-app-shell Grid 承担；
 * 本组件只负责三块插槽的分发与抽屉态：
 *  - [sidebar]  左侧导航（220px，≤1024px 折叠为 64px 图标栏）
 *  - [topbar]   顶部栏（64px，横贯整页）
 *  - [content]  主内容区（溢出滚动）
 *
 * 用法：<jmeet-app-shell [sidebarOpen]="open" (backdropClick)="close()">
 */


@Component({
	selector: 'jmeet-app-shell',
	templateUrl: './app-shell.component.html',
	styleUrl: './app-shell.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class JmeetAppShellComponent {
	/** 窄屏下抽屉开关（标准 §29：≤767px 侧栏变 Overlay）。桌面端该值无效果。 */
	sidebarOpen = input(false);
	/** 点击遮罩时发出，宿主应在此关闭抽屉（Escape 键由宿主自行监听）。 */
	backdropClick = output<void>();
}

import { Directive, OnInit, input, signal } from '@angular/core';

/**
 * 设置蓝图锚点导航（批次 3 任务 4 统一）：activeSection 高亮置位 + 平滑滚动到目标节。
 *
 * 任务 2 在 config-account / meeting-defaults 各落了约 8 行同构实现（signal 置位 +
 * scrollIntoView），挂账统一——此处收口为 console 域共享指令，页面以模板属性指令 +
 * exportAs 模板引用变量消费（`jmeetSettingsAnchor #anchors="jmeetSettingsAnchor"`），
 * 组件类不再各自持有重复状态与方法。静态字符串赋值可指定初始高亮节
 * （`jmeetSettingsAnchor="section-id"`，保持任务 2 首节预高亮的渲染行为）。
 *
 * config-intelligence 保留页私有实现（IntersectionObserver 滚动 spy + rAF 缓动，
 * 为本指令的超集）：统一它会改变已验证的滚动行为，超出"最小合并"范围。
 */
@Directive({
	selector: '[jmeetSettingsAnchor]',
	exportAs: 'jmeetSettingsAnchor'
})
export class SettingsAnchorNavDirective implements OnInit {
	/** 初始高亮分区 id（可选；默认空 = 首帧无高亮）。 */
	readonly jmeetSettingsAnchor = input<string>('');

	/** 当前高亮分区 id（点击置位，展示性交互，不涉业务语义）。 */
	readonly activeSection = signal('');

	ngOnInit(): void {
		const initial = this.jmeetSettingsAnchor();
		if (initial) {
			this.activeSection.set(initial);
		}
	}

	scrollToSection(id: string): void {
		this.activeSection.set(id);
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
}

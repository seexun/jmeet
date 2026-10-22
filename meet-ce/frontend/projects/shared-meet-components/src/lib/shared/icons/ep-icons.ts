/**
 * Element Plus 图标覆盖层（EP 风格统一）。
 *
 * - `EP_ICON_MAP` 把应用现有的 nzType 名映射到 EP（Element Plus）图标名；
 *   渲染仍走 nz-icon 注册表，nzType 字符串与全部调用点保持不变。
 * - `epIconDefinition()` 用 EP 的 SVG path（viewBox 1024，fill currentColor）
 *   构造 antd `IconDefinition`，`nz-icons.ts` 中以「EP 优先、antd 兜底」的方式
 *   组装 `provideNzIcons()` 注册表。provideNzIcons 提供的 NZ_ICONS 在
 *   NzIconService 构造时晚于 zorro 内部图标注册，同名键后者覆盖前者，
 *   因此 select 箭头、弹窗关闭、消息状态等库内部图标同步切换为 EP 风格。
 * - EP 图标集没有对应语义的少数图标（团队多人、翻译、笑脸、代码、地球等）
 *   不在本表内，继续使用 antd 原图，见 `nz-icons.ts` 的 ANT_ICON_BY_TYPE。
 */
import type { IconDefinition } from '@ant-design/icons-angular';
import { EP_ICON_BODIES } from './ep-icon-bodies';

export const EP_ICON_MAP: Record<string, string> = {
	aim: 'aim',
	apartment: 'office-building',
	api: 'link',
	appstore: 'grid',
	'arrow-left': 'arrow-left',
	'arrow-right': 'arrow-right',
	'arrow-down': 'arrow-down',
	'arrow-up': 'arrow-up',
	audio: 'microphone',
	'audio-muted': 'mute',
	bank: 'briefcase',
	'bar-chart': 'histogram',
	bars: 'list',
	bell: 'bell',
	'bg-colors': 'brush',
	block: 'circle-close',
	'border-outer': 'crop',
	bulb: 'magic-stick',
	calendar: 'calendar',
	camera: 'camera',
	'caret-down': 'caret-bottom',
	'caret-right': 'caret-right',
	check: 'check',
	'check-circle': 'circle-check',
	clear: 'circle-close',
	'clock-circle': 'clock',
	close: 'close',
	'close-circle': 'circle-close',
	cluster: 'cpu',
	cloud: 'cloudy',
	comment: 'comment',
	compress: 'scale-to-original',
	copy: 'copy-document',
	'customer-service': 'service',
	crown: 'medal',
	dashboard: 'odometer',
	database: 'box',
	delete: 'delete',
	desktop: 'monitor',
	disconnect: 'circle-close',
	'double-left': 'd-arrow-left',
	'double-right': 'd-arrow-right',
	down: 'arrow-down',
	download: 'download',
	edit: 'edit',
	expand: 'full-screen',
	export: 'share',
	eye: 'view',
	'eye-invisible': 'hide',
	'field-time': 'timer',
	'file-done': 'document-checked',
	'file-text': 'document',
	filter: 'filter',
	flag: 'flag',
	folder: 'folder',
	'folder-open': 'folder-opened',
	fullscreen: 'full-screen',
	global: 'compass',
	heart: 'odometer',
	highlight: 'edit-pen',
	home: 'house',
	hourglass: 'stopwatch',
	idcard: 'postcard',
	inbox: 'message-box',
	'info-circle': 'info-filled',
	key: 'key',
	left: 'arrow-left',
	'line-chart': 'trend-charts',
	like: 'pointer',
	link: 'link',
	lock: 'lock',
	login: 'avatar',
	logout: 'switch-button',
	menu: 'fold',
	message: 'chat-dot-round',
	minus: 'minus',
	'minus-circle': 'remove',
	moon: 'moon',
	more: 'more',
	picture: 'picture',
	'play-circle': 'video-play',
	'play-square': 'film',
	plus: 'plus',
	'plus-circle': 'circle-plus',
	phone: 'phone',
	poweroff: 'turn-off',
	pushpin: 'top',
	'question-circle': 'question-filled',
	redo: 'refresh-right',
	reload: 'refresh',
	rollback: 'refresh-left',
	right: 'arrow-right',
	'safety-certificate': 'stamp',
	schedule: 'alarm-clock',
	search: 'search',
	send: 'promotion',
	setting: 'setting',
	'share-alt': 'share',
	skin: 'brush',
	snippets: 'memo',
	solution: 'tickets',
	sound: 'headset',
	star: 'star',
	stop: 'video-pause',
	sun: 'sunny',
	swap: 'switch',
	sync: 'refresh',
	team: 'management',
	thunderbolt: 'lightning',
	undo: 'back',
	unlock: 'unlock',
	up: 'arrow-up',
	upload: 'upload',
	user: 'user',
	'user-add': 'plus',
	'user-delete': 'minus',
	'video-camera': 'video-camera',
	'video-camera-add': 'video-camera',
	warning: 'warning',
	wifi: 'connection',
	'zoom-in': 'zoom-in'
};

/**
 * 用 EP path 构造与 nzType 同名的 outline 定义；未映射或数据缺失时返回
 * null，由调用方回退 antd 原图。
 */
export function epIconDefinition(nzType: string): IconDefinition | null {
	const epName = EP_ICON_MAP[nzType];
	const body = epName ? EP_ICON_BODIES[epName] : undefined;
	if (!body) {
		return null;
	}
	return {
		name: nzType,
		theme: 'outline',
		icon: `<svg viewBox="0 0 1024 1024" fill="currentColor" focusable="false">${body}</svg>`
	};
}

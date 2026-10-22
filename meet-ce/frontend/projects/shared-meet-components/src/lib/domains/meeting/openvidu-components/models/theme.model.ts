/**
 * Represents the possible theme modes for OpenVidu components
 * @internal
 */
export enum OpenViduThemeMode {
	Light = 'light',
	Classic = 'classic'
}

/**
 * Interface representing the complete set of theme variables for OpenVidu components
 * @internal
 */
export interface OpenViduThemeVariables {
	// === Core Background Colors ===
	'--ov-background-color'?: string;
	'--ov-surface-color'?: string;
	'--ov-surface-container-color'?: string;

	// === Action Colors ===
	'--ov-primary-action-color'?: string;
	'--ov-secondary-action-color'?: string;
	'--ov-accent-action-color'?: string;

	// === State Colors ===
	'--ov-error-color'?: string;
	'--ov-warn-color'?: string;
	'--ov-success-color'?: string;

	// === Text Colors ===
	'--ov-text-primary-color'?: string;
	'--ov-text-surface-color'?: string;
	'--ov-text-secondary-color'?: string;
	'--ov-text-disabled-color'?: string;

	// === Interactive States ===
	'--ov-hover-color'?: string;
	'--ov-disabled-background'?: string;
	'--ov-disabled-border-color'?: string;

	// === Input & Form Colors ===
	'--ov-border-color'?: string;

	// === Layout & Spacing ===
	'--ov-toolbar-buttons-radius'?: string;
	'--ov-leave-button-radius'?: string;
	'--ov-video-radius'?: string;
	'--ov-surface-radius'?: string;
	'--ov-input-radius'?: string;

	// === Special Colors ===
	'--ov-recording-color'?: string;
	'--ov-broadcasting-color'?: string;
	'--ov-selection-color'?: string;
	'--ov-selection-color-btn'?: string;
	'--ov-activity-status-color'?: string;

	// === Video/Media Specific ===
	'--ov-video-background'?: string;
	'--ov-captions-height'?: string;

	// Allow for custom variables
	[key: string]: string | undefined;
}

/**
 * Predefined theme configuration.
 *
 * JMeet is Light-only: every `--ov-*` component variable resolves to a `--jmeet-*`
 * semantic token so there is a single source of truth and no hardcoded brand color.
 * @internal
 */
export const OPENVIDU_COMPONENTS_LIGHT_THEME: OpenViduThemeVariables = {
	'--ov-background-color': 'var(--jmeet-color-surface-page)',
	'--ov-surface-color': 'var(--jmeet-color-surface-card)',
	'--ov-surface-container-color': 'var(--jmeet-color-surface-variant)',
	'--ov-primary-action-color': 'var(--jmeet-color-action-primary)',
	'--ov-secondary-action-color': 'var(--jmeet-color-action-primary-light)',
	'--ov-accent-action-color': 'var(--jmeet-color-action-primary)',
	'--ov-error-color': 'var(--jmeet-color-action-danger)',
	'--ov-warn-color': 'var(--jmeet-color-action-warning)',
	'--ov-success-color': 'var(--jmeet-color-action-success)',
	'--ov-text-primary-color': 'var(--jmeet-color-text-primary)',
	'--ov-text-surface-color': 'var(--jmeet-color-text-primary)',
	'--ov-text-secondary-color': 'var(--jmeet-color-text-secondary)',
	'--ov-text-disabled-color': 'var(--jmeet-color-text-disabled)',
	'--ov-hover-color': 'var(--jmeet-color-surface-hover)',
	'--ov-disabled-background': 'var(--jmeet-color-surface-hover)',
	'--ov-disabled-border-color': 'var(--jmeet-color-border)',
	'--ov-border-color': 'var(--jmeet-color-border)',
	'--ov-activity-status-color': 'var(--jmeet-color-action-primary)',
	'--ov-broadcasting-color': 'var(--jmeet-color-action-primary)',
	'--ov-selection-color': 'var(--jmeet-color-action-primary)',
	'--ov-selection-color-btn': 'var(--jmeet-color-action-accent-light)',
	'--ov-recording-color': 'var(--jmeet-color-action-danger)',
	'--ov-video-background': 'var(--jmeet-color-border)',

	// 工具栏按钮统一 10px 圆角方按钮（与左侧媒体按钮一致），不再用 50% 圆形
	// ── 补全桥接（A3 审计发现的缺失项）：旧组件散落的 ov 变量统一指向 EP 语义 ──
	'--ov-footer-height': '120px',
	'--ov-text-primary': 'var(--jmeet-color-text-primary)',
	'--ov-disabled-text-color': 'var(--jmeet-color-text-disabled)',
	'--ov-surface-hover': 'var(--jmeet-color-surface-hover)',
	'--ov-text-secondary': 'var(--jmeet-color-text-secondary)',
	'--ov-error-light': 'var(--jmeet-color-action-danger-light)',
	'--ov-warning-color': 'var(--jmeet-color-action-warning)',
	'--ov-surface-border': 'var(--jmeet-color-border)',
	'--ov-surface-alt': 'var(--jmeet-color-surface-variant)',
	'--ov-surface-background': 'var(--jmeet-color-surface-page)',
	'--ov-toolbar-buttons-radius': '10px',
	'--ov-leave-button-radius': '10px',
	'--ov-video-radius': '8px',
	'--ov-surface-radius': '8px',
	'--ov-input-radius': '6px'
};

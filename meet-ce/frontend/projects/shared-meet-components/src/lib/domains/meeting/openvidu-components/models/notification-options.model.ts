/**
 * @internal
 * Toast config fields kept from the former notification options so existing callers compile
 * unchanged after the migration to NzMessageService.
 */
export interface INotificationConfig {
	duration?: number;
	panelClass?: string | string[];
}

export interface INotificationOptions {
	message: string;
	/** Kept for API compatibility; the action is rendered as a clickable toast. */
	buttonActionText?: string;
	config?: INotificationConfig;
}

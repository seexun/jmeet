import type { StringValue } from 'ms';

export type TaskType = 'cron' | 'timeout';

export interface IScheduledTask {
	name: string;
	type: TaskType;
	scheduleOrDelay: StringValue;
	callback: () => Promise<void>;
}

import { CronJob } from 'cron';
import { inject, injectable } from 'inversify';
import ms from 'ms';
import { INTERNAL_CONFIG } from '../config/internal-config.js';
import { MeetLock } from '../helpers/redis.helper.js';
import type { IScheduledTask } from '../models/task-scheduler.model.js';
import { DistributedEventService } from './distributed-event.service.js';
import { LoggerService } from './logger.service.js';
import { MutexService } from './mutex.service.js';

@injectable()
export class TaskSchedulerService {
	private taskRegistry: IScheduledTask[] = [];
	private scheduledTasks = new Map<string, CronJob | NodeJS.Timeout>();
	private started = false;

	constructor(
		@inject(LoggerService) protected logger: LoggerService,
		@inject(DistributedEventService) protected systemEventService: DistributedEventService,
		@inject(MutexService) protected mutexService: MutexService
	) {
		this.systemEventService.onRedisReady(() => {
			this.logger.debug('Starting all registered tasks...');
			this.taskRegistry.forEach((task) => {
				this.scheduleTask(task);
			});
			this.started = true;

			this.systemEventService.onceRedisError(() => {
				this.logger.debug('Redis shutdown detected. Cancelling all scheduled tasks...');
				this.scheduledTasks.forEach((task, name) => {
					this.cancelTask(name);
				});
				this.started = false;
			});
		});
	}

	/**
	 * Registers a new task to be scheduled.
	 * If the task is already registered, it will not be added again.
	 */
	public registerTask(task: IScheduledTask): void {
		if (this.taskRegistry.find((t) => t.name === task.name)) {
			this.logger.error(`Task with name "${task.name}" already exists.`);
			return;
		}

		this.logger.debug(`Registering task "${task.name}".`);
		this.taskRegistry.push(task);

		if (this.started) {
			this.scheduleTask(task);
		}
	}

	protected async runCronTask(name: string, lockDuration: number, callback: () => Promise<void>): Promise<void> {
		const lockKey = MeetLock.getScheduledTaskLock(name);

		try {
			this.logger.debug(`Attempting to acquire lock for cron task "${name}"`);
			const executionResult = await this.mutexService.withLock(lockKey, lockDuration, async () => {
				this.logger.debug(`Running cron task "${name}"...`);
				await callback();
				return true;
			});

			if (executionResult === null) {
				this.logger.debug(`Task "${name}" skipped: another instance holds the lock.`);
				return;
			}
		} catch (error) {
			this.logger.error(`Error running cron task "${name}":`, error);
		}
	}

	protected async scheduleTask(task: IScheduledTask): Promise<void> {
		const { name, type, scheduleOrDelay, callback } = task;

		if (this.scheduledTasks.has(name)) {
			this.logger.debug(`Task "${name}" already scheduled.`);
			return;
		}

		if (type === 'cron') {
			this.logger.debug(`Scheduling cron task "${name}" with schedule "${scheduleOrDelay}"`);
			const cronExpression = this.msStringToCronExpression(scheduleOrDelay);
			const lockDuration = Math.max(ms(scheduleOrDelay) - ms('1m'), ms(INTERNAL_CONFIG.CRON_JOB_LOCK_TTL));

			const job = new CronJob(cronExpression, async () => {
				await this.runCronTask(name, lockDuration, callback);
			});
			// Start the job immediately only in one instance to avoid multiple instances running the same task at the same time on startup.
			await this.runCronTask(name, lockDuration, callback);
			job.start();
			this.scheduledTasks.set(name, job);
		} else if (type === 'timeout') {
			this.logger.debug(`Scheduling timeout task "${name}" with delay ${scheduleOrDelay}`);
			const timeoutId = setTimeout(
				async () => {
					try {
						this.scheduledTasks.delete(name);
						await callback();
					} catch (error) {
						this.logger.error(`Error running timeout task "${name}":`, error);
					}
				},
				ms(scheduleOrDelay as ms.StringValue)
			);
			this.scheduledTasks.set(name, timeoutId);
		}
	}

	/**
	 * Cancel the scheduled task with the given name.
	 */
	public cancelTask(name: string): void {
		const scheduled = this.scheduledTasks.get(name);

		if (scheduled) {
			if (scheduled instanceof CronJob) {
				scheduled.stop();
			} else {
				clearTimeout(scheduled as NodeJS.Timeout);
			}

			this.scheduledTasks.delete(name);
			this.taskRegistry = this.taskRegistry.filter((task) => task.name !== name);
			this.logger.debug(`Task "${name}" cancelled.`);
		}
	}

	/**
	 * Converts a human-readable time string to a cron expression.
	 *
	 * This method takes a string representation of a time duration (e.g., '1h', '30m', '1d')
	 * and converts it to an equivalent cron expression that would trigger at that interval.
	 * The conversion uses different cron patterns based on the duration magnitude:
	 * - For days: Runs at midnight every X days
	 * - For hours: Runs at the start of every X hours
	 * - For minutes: Runs every X minutes
	 * - For seconds ≥ 30: Runs every minute
	 * - For seconds < 30: Runs every X seconds
	 *
	 * @param msString - A string representing time duration (parsed by the 'ms' library)
	 * @returns A cron expression string that represents the equivalent scheduling interval
	 *
	 */
	protected msStringToCronExpression(msString: ms.StringValue): string {
		const milliseconds = ms(msString);
		const totalSeconds = Math.floor(milliseconds / 1000);
		const seconds = totalSeconds % 60;
		const minutes = Math.floor(totalSeconds / 60) % 60;
		const hours = Math.floor(totalSeconds / 3600) % 24;
		const days = Math.floor(totalSeconds / 86400);

		if (days > 0) {
			return `0 0 */${days} * *`;
		} else if (hours > 0) {
			return `0 0 */${hours} * * *`;
		} else if (minutes > 0) {
			return `0 */${minutes} * * * *`;
		} else if (seconds >= 30) {
			return `0 * * * * *`;
		} else {
			return `*/${Math.max(seconds, 1)} * * * * *`;
		}
	}
}

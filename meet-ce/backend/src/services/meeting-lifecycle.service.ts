import { inject, injectable } from 'inversify';
import { LiveKitService } from './livekit.service.js';
import { LoggerService } from './logger.service.js';
import { RedisService } from './redis.service.js';

@injectable()
export class MeetingLifecycleService {
	constructor(
		@inject(RedisService) private redis: RedisService,
		@inject(LiveKitService) private livekit: LiveKitService,
		@inject(LoggerService) private logger: LoggerService
	) {}

	/**
	 * 幂等地结束一场会议：同一房间 5 分钟内只允许编排一次，随后删除 LiveKit 房间。
	 */
	async end(roomId: string, reason: string): Promise<boolean> {
		if (!(await this.redis.setIfNotExists(`meeting-end:${roomId}`, reason, 300))) return false;
		try {
			if (await this.livekit.roomExists(roomId)) await this.livekit.deleteRoom(roomId);
			return true;
		} catch (error) {
			await this.redis.delete(`meeting-end:${roomId}`);
			this.logger.error(`Meeting end orchestration failed for '${roomId}'`, error);
			throw error;
		}
	}
}

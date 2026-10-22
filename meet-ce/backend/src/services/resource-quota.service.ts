import { inject, injectable } from 'inversify';
import { OpenViduMeetError } from '../models/error.model.js';
import { LiveKitService } from './livekit.service.js';

/**
 * 开源版固定配额：单会议 50 人、并发会议 3 场。
 * 该上限为开源版边界（企业版提供可配置配额与集群扩展），
 * 触顶时返回 429 并引导用户了解企业版。
 */
export const CE_QUOTA = {
	maxConcurrentMeetings: 3,
	maxParticipantsPerMeeting: 50
} as const;

@injectable()
export class ResourceQuotaService {
	constructor(@inject(LiveKitService) private livekit: LiveKitService) {}

	async assertMeetingAdmission(roomId: string) {
		const rooms = await this.livekit.listRooms();
		const room = rooms.find((r) => r.name === roomId);
		if (!room && rooms.length >= CE_QUOTA.maxConcurrentMeetings)
			throw new OpenViduMeetError(
				'Meeting quota exceeded',
				'已达到开源版并发会议上限（3 场），升级企业版可支持更大规模',
				429
			);
		if (room && Number(room.numParticipants ?? 0) >= CE_QUOTA.maxParticipantsPerMeeting)
			throw new OpenViduMeetError(
				'Participant quota exceeded',
				'已达到开源版单会议人数上限（50 人），升级企业版可支持更多参会人',
				429
			);
	}
}

import { MeetParticipantModerationAction, type MeetMeetingSecurityConfig } from '@openvidu-meet/typings';
import type { Request, Response } from 'express';
import { container } from '../config/dependency-injector.config.js';
import { handleError, OpenViduMeetError } from '../models/error.model.js';
import { MeetingSessionModel } from '../models/mongoose-schemas/meeting-session.schema.js';
import { LiveKitService } from '../services/livekit.service.js';
import { LoggerService } from '../services/logger.service.js';
import { MeetingHostService } from '../services/meeting-host.service.js';
import { RequestSessionService } from '../services/request-session.service.js';
import { RoomMemberService } from '../services/room-member.service.js';
import { RoomService } from '../services/room.service.js';
import { FrontendEventService } from '../services/frontend-event.service.js';
import { MeetingLifecycleService } from '../services/meeting-lifecycle.service.js';

// 会议摘要（名称 + 数字会议号）：邀请对话框用。显式投影字段——房间实体含
// secret/access 配置，不得整体下发给普通参会人。
export const getMeetingSummary = async (req: Request, res: Response) => {
	const { roomId } = req.params as Record<string, string>;
	try {
		const roomService = container.get(RoomService);
		const room = await roomService.getMeetRoom(roomId, ['roomId', 'roomName', 'meetingCode']);
		return res.json({ roomId: room.roomId, roomName: room.roomName, meetingCode: room.meetingCode });
	} catch (error) {
		handleError(res, error, `getting meeting summary for room '${roomId}'`);
	}
};

export const listSessions = async (req: Request, res: Response) => {
	const sessions = await MeetingSessionModel.find(
		{ roomId: String(req.params.roomId) },
		{ _id: 0, meetingSessionId: 1, status: 1, startedAt: 1, endedAt: 1 }
	)
		.sort({ startedAt: -1 })
		.limit(100)
		.lean()
		.exec();
	res.json({ items: sessions });
};

export const endMeeting = async (req: Request, res: Response) => {
	const logger = container.get(LoggerService);
	const roomService = container.get(RoomService);
	const hostService = container.get(MeetingHostService);
	const requestSessionService = container.get(RequestSessionService);

	const { roomId } = req.params as Record<string, string>;

	// Check if the room exists
	try {
		await roomService.getMeetRoom(roomId, ['roomId']);
	} catch (error) {
		return handleError(res, error, `getting room '${roomId}'`);
	}

	try {
		const actorIdentity = requestSessionService.getParticipantIdentity();
		if (!actorIdentity)
			throw new OpenViduMeetError('Host Governance Error', 'Participant identity is missing', 401);
		await hostService.assertPrimaryHost(roomId, actorIdentity);
		logger.info(`Ending meeting from room '${roomId}'`);
		// To end a meeting, we need to delete the room from LiveKit
		await container.get(MeetingLifecycleService).end(roomId, 'host-ended');
		res.status(200).json({ message: `Meeting in room '${roomId}' ended successfully` });
	} catch (error) {
		handleError(res, error, `ending meeting from room '${roomId}'`);
	}
};

export const leaveAsHost = async (req: Request, res: Response) => {
	try {
		const roomId = String(req.params.roomId),
			identity = container.get(RequestSessionService).getParticipantIdentity();
		if (!identity) throw new OpenViduMeetError('Host Governance Error', 'Participant identity is missing', 401);
		await container.get(MeetingHostService).assertPrimaryHost(roomId, identity);
		const target = typeof req.body?.targetIdentity === 'string' ? req.body.targetIdentity : undefined;
		if (target) await container.get(MeetingHostService).transferHost(roomId, identity, target);
		else await container.get(MeetingHostService).prepareHostDeparture(roomId, identity);
		return res.json({ ok: true, targetIdentity: target });
	} catch (error) {
		handleError(res, error, 'preparing host departure');
	}
};

export const claimHost = async (req: Request, res: Response) => {
	try {
		const roomId = String(req.params.roomId);
		const identity = container.get(RequestSessionService).getParticipantIdentity();
		if (!identity) throw new OpenViduMeetError('Host Governance Error', 'Participant identity is missing', 401);
		const hostIdentity = await container.get(MeetingHostService).claimHost(roomId, identity);
		return res.json({ roomId, hostIdentity, timestamp: Date.now() });
	} catch (error) {
		handleError(res, error, 'claiming meeting host');
	}
};

export const updateParticipantRole = async (req: Request, res: Response) => {
	const logger = container.get(LoggerService);
	const roomMemberService = container.get(RoomMemberService);
	const hostService = container.get(MeetingHostService);
	const { roomId, participantIdentity } = req.params as Record<string, string>;
	const { action } = req.body as { action: MeetParticipantModerationAction };

	try {
		if (action === MeetParticipantModerationAction.DOWNGRADE) {
			await hostService.assertNotPrimaryHost(roomId, participantIdentity);
		}
		logger.verbose(
			`Applying moderation action '${action}' for participant '${participantIdentity}' in room '${roomId}'`
		);
		await roomMemberService.updateParticipantRole(roomId, participantIdentity, action);
		res.status(200).json({
			message: `Moderation action '${action}' applied to participant '${participantIdentity}' in room '${roomId}'`
		});
	} catch (error) {
		handleError(
			res,
			error,
			`applying moderation action for participant '${participantIdentity}' in room '${roomId}'`
		);
	}
};

export const getMeetingHost = async (req: Request, res: Response) => {
	const hostService = container.get(MeetingHostService);
	const { roomId } = req.params as Record<string, string>;
	try {
		const hostIdentity = await hostService.getOrElectHost(roomId);
		res.status(200).json({ roomId, hostIdentity, timestamp: Date.now() });
	} catch (error) {
		handleError(res, error, `getting primary host for room '${roomId}'`);
	}
};

export const transferMeetingHost = async (req: Request, res: Response) => {
	const hostService = container.get(MeetingHostService);
	const requestSessionService = container.get(RequestSessionService);
	const { roomId } = req.params as Record<string, string>;
	const actorIdentity = requestSessionService.getParticipantIdentity();
	const { targetParticipantIdentity } = req.body as { targetParticipantIdentity: string };
	if (!actorIdentity) {
		return handleError(
			res,
			new OpenViduMeetError('Host Governance Error', 'Participant identity is missing', 401),
			`transferring primary host in room '${roomId}'`
		);
	}
	try {
		const hostIdentity = await hostService.transferHost(roomId, actorIdentity, targetParticipantIdentity);
		res.status(200).json({ roomId, hostIdentity, timestamp: Date.now() });
	} catch (error) {
		handleError(res, error, `transferring primary host in room '${roomId}'`);
	}
};

export const updateHandState = async (req: Request, res: Response) => {
	const requestSessionService = container.get(RequestSessionService);
	const frontendEventService = container.get(FrontendEventService);
	const { roomId } = req.params as Record<string, string>;
	const participantIdentity = requestSessionService.getParticipantIdentity();
	const { raised } = req.body as { raised: boolean };
	try {
		if (!participantIdentity)
			throw new OpenViduMeetError('Meeting Governance Error', 'Participant identity is missing', 401);
		await frontendEventService.sendHandStateChangedSignal(roomId, participantIdentity, raised);
		res.status(200).json({ roomId, participantIdentity, raised, timestamp: Date.now() });
	} catch (error) {
		handleError(res, error, `updating hand state in room '${roomId}'`);
	}
};

export const kickParticipantFromMeeting = async (req: Request, res: Response) => {
	const logger = container.get(LoggerService);
	const roomService = container.get(RoomService);
	const roomMemberService = container.get(RoomMemberService);
	const hostService = container.get(MeetingHostService);
	const { roomId, participantIdentity } = req.params as Record<string, string>;

	// Check if the room exists
	try {
		await roomService.getMeetRoom(roomId, ['roomId']);
	} catch (error) {
		return handleError(res, error, `getting room '${roomId}'`);
	}

	try {
		await hostService.assertNotPrimaryHost(roomId, participantIdentity);
		logger.verbose(`Kicking participant '${participantIdentity}' from room '${roomId}'`);
		await roomMemberService.kickParticipantFromMeeting(
			roomId,
			participantIdentity,
			req.query.blockRejoin === 'true'
		);
		res.status(200).json({
			message: `Participant '${participantIdentity}' kicked successfully from meeting in room '${roomId}'`
		});
	} catch (error) {
		handleError(res, error, `kicking participant '${participantIdentity}' from meeting in room '${roomId}'`);
	}
};

export const stopParticipantCamera = async (req: Request, res: Response) => {
	const livekitService = container.get(LiveKitService);
	const { roomId, participantIdentity } = req.params as Record<string, string>;
	try {
		const stoppedTracks = await livekitService.stopParticipantCamera(roomId, participantIdentity);
		res.status(200).json({ stoppedTracks });
	} catch (error) {
		handleError(res, error, `stopping camera for participant '${participantIdentity}' in room '${roomId}'`);
	}
};

export const stopParticipantScreenShare = async (req: Request, res: Response) => {
	const livekitService = container.get(LiveKitService);
	const { roomId, participantIdentity } = req.params as Record<string, string>;
	try {
		const stoppedTracks = await livekitService.stopParticipantScreenShare(roomId, participantIdentity);
		res.status(200).json({ stoppedTracks });
	} catch (error) {
		handleError(res, error, `stopping screen share for participant '${participantIdentity}' in room '${roomId}'`);
	}
};

export const muteAllParticipants = async (req: Request, res: Response) => {
	const logger = container.get(LoggerService);
	const roomService = container.get(RoomService);
	const livekitService = container.get(LiveKitService);
	const { roomId } = req.params as Record<string, string>;

	try {
		await roomService.getMeetRoom(roomId, ['roomId']);
		logger.info(`Muting all microphones in room '${roomId}'`);
		const mutedTracks = await livekitService.muteAllMicrophones(roomId);
		res.status(200).json({ mutedTracks, message: `Muted ${mutedTracks} microphone track(s)` });
	} catch (error) {
		handleError(res, error, `muting all microphones in room '${roomId}'`);
	}
};

export const muteParticipant = async (req: Request, res: Response) => {
	const logger = container.get(LoggerService);
	const roomService = container.get(RoomService);
	const livekitService = container.get(LiveKitService);
	const { roomId, participantIdentity } = req.params as Record<string, string>;

	try {
		await roomService.getMeetRoom(roomId, ['roomId']);
		logger.info(`Muting participant '${participantIdentity}' in room '${roomId}'`);
		const mutedTracks = await livekitService.muteParticipantMicrophone(roomId, participantIdentity);
		res.status(200).json({ mutedTracks, message: `Muted ${mutedTracks} microphone track(s)` });
	} catch (error) {
		handleError(res, error, `muting participant '${participantIdentity}' in room '${roomId}'`);
	}
};

export const requestParticipantUnmute = async (req: Request, res: Response) => {
	const livekitService = container.get(LiveKitService);
	const frontendEventService = container.get(FrontendEventService);
	const requestSessionService = container.get(RequestSessionService);
	const { roomId, participantIdentity } = req.params as Record<string, string>;
	const actorIdentity = requestSessionService.getParticipantIdentity();
	try {
		if (!actorIdentity)
			throw new OpenViduMeetError('Host Governance Error', 'Participant identity is missing', 401);
		await livekitService.allowParticipantMicrophone(roomId, participantIdentity);
		await frontendEventService.sendUnmuteRequestedSignal(roomId, participantIdentity, actorIdentity);
		res.status(200).json({ message: 'Unmute request sent' });
	} catch (error) {
		handleError(res, error, `requesting participant '${participantIdentity}' to unmute in room '${roomId}'`);
	}
};

export const requestScreenShare = async (req: Request, res: Response) => {
	const livekitService = container.get(LiveKitService);
	const hostService = container.get(MeetingHostService);
	const frontendEventService = container.get(FrontendEventService);
	const session = container.get(RequestSessionService);
	const { roomId } = req.params as Record<string, string>;
	const participantIdentity = session.getParticipantIdentity();
	try {
		if (!participantIdentity)
			throw new OpenViduMeetError('Screen Share Error', 'Participant identity is missing', 401);
		const [hostIdentity, participant] = await Promise.all([
			hostService.getOrElectHost(roomId),
			livekitService.getParticipant(roomId, participantIdentity)
		]);
		if (hostIdentity === participantIdentity) {
			throw new OpenViduMeetError('Screen Share Error', 'The primary host can already share the screen', 409);
		}
		await frontendEventService.sendScreenShareRequestedSignal(
			roomId,
			hostIdentity,
			participantIdentity,
			participant.name
		);
		res.status(202).json({ message: 'Screen-share request sent to the host' });
	} catch (error) {
		handleError(res, error, `requesting screen share in room '${roomId}'`);
	}
};

export const grantScreenShare = async (req: Request, res: Response) => {
	const livekitService = container.get(LiveKitService);
	const frontendEventService = container.get(FrontendEventService);
	const session = container.get(RequestSessionService);
	const { roomId, participantIdentity } = req.params as Record<string, string>;
	const actorIdentity = session.getParticipantIdentity();
	try {
		if (!actorIdentity) throw new OpenViduMeetError('Screen Share Error', 'Participant identity is missing', 401);
		await livekitService.allowParticipantScreenShare(roomId, participantIdentity);
		await frontendEventService.sendScreenShareGrantedSignal(roomId, participantIdentity, actorIdentity);
		res.status(200).json({ message: 'Screen sharing approved' });
	} catch (error) {
		handleError(res, error, `granting screen share to '${participantIdentity}' in room '${roomId}'`);
	}
};

export const updateMeetingSecurity = async (req: Request, res: Response) => {
	const logger = container.get(LoggerService);
	const roomService = container.get(RoomService);
	const { roomId } = req.params as Record<string, string>;
	const security = req.body as MeetMeetingSecurityConfig;
	try {
		logger.info(`Updating active meeting security policy in room '${roomId}'`);
		const room = await roomService.updateActiveMeetingSecurity(roomId, security);
		res.status(200).json({ security: room.config.security });
	} catch (error) {
		handleError(res, error, `updating meeting security policy in room '${roomId}'`);
	}
};

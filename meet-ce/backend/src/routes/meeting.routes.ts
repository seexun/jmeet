import bodyParser from 'body-parser';
import { Router } from 'express';
import * as meetingCtrl from '../controllers/meeting.controller.js';
import { roomMemberTokenValidator, withAuth } from '../middlewares/auth.middleware.js';
import { apiLimiter } from '../middlewares/rate-limit.middleware.js';
import {
	validateTransferMeetingHostReq,
	validateUpdateHandStateReq,
	validateUpdateMeetingSecurityReq,
	validateUpdateParticipantRoleReq
} from '../middlewares/request-validators/meeting-validator.middleware.js';
import { withValidRoomId } from '../middlewares/request-validators/room-validator.middleware.js';
import { withRoomMemberPermission } from '../middlewares/room-member.middleware.js';

export const internalMeetingRouter: Router = Router();
internalMeetingRouter.use(bodyParser.urlencoded({ extended: true }));
internalMeetingRouter.use(bodyParser.json());
internalMeetingRouter.use(apiLimiter);

// Internal Meetings Routes
internalMeetingRouter.delete(
	'/:roomId',
	withAuth(roomMemberTokenValidator),
	withValidRoomId,
	withRoomMemberPermission('canEndMeeting'),
	meetingCtrl.endMeeting
);
internalMeetingRouter.post(
	'/:roomId/host/leave',
	withAuth(roomMemberTokenValidator),
	withValidRoomId,
	meetingCtrl.leaveAsHost
);
internalMeetingRouter.post(
	'/:roomId/host/claim',
	withAuth(roomMemberTokenValidator),
	withValidRoomId,
	meetingCtrl.claimHost
);
// 邀请对话框的会议摘要：任意参会人可读（名称/数字会议号无敏感面，投影在控制器收敛）
internalMeetingRouter.get(
	'/:roomId/summary',
	withAuth(roomMemberTokenValidator),
	withValidRoomId,
	meetingCtrl.getMeetingSummary
);
internalMeetingRouter.get(
	'/:roomId/sessions',
	withAuth(roomMemberTokenValidator),
	withValidRoomId,
	meetingCtrl.listSessions
);
internalMeetingRouter.delete(
	'/:roomId/participants/:participantIdentity',
	withAuth(roomMemberTokenValidator),
	withValidRoomId,
	withRoomMemberPermission('canKickParticipants'),
	meetingCtrl.kickParticipantFromMeeting
);
internalMeetingRouter.put(
	'/:roomId/participants/:participantIdentity/role',
	withAuth(roomMemberTokenValidator),
	withValidRoomId,
	validateUpdateParticipantRoleReq,
	withRoomMemberPermission('canMakeModerator'),
	meetingCtrl.updateParticipantRole
);
internalMeetingRouter.get(
	'/:roomId/host',
	withAuth(roomMemberTokenValidator),
	withValidRoomId,
	meetingCtrl.getMeetingHost
);
internalMeetingRouter.put(
	'/:roomId/hand',
	withAuth(roomMemberTokenValidator),
	withValidRoomId,
	validateUpdateHandStateReq,
	meetingCtrl.updateHandState
);
internalMeetingRouter.post(
	'/:roomId/screen-share/request',
	withAuth(roomMemberTokenValidator),
	withValidRoomId,
	meetingCtrl.requestScreenShare
);
internalMeetingRouter.post(
	'/:roomId/participants/:participantIdentity/screen-share/grant',
	withAuth(roomMemberTokenValidator),
	withValidRoomId,
	withRoomMemberPermission('canKickParticipants'),
	meetingCtrl.grantScreenShare
);
internalMeetingRouter.put(
	'/:roomId/host',
	withAuth(roomMemberTokenValidator),
	withValidRoomId,
	validateTransferMeetingHostReq,
	withRoomMemberPermission('canMakeModerator'),
	meetingCtrl.transferMeetingHost
);
internalMeetingRouter.post(
	'/:roomId/participants/mute-all',
	withAuth(roomMemberTokenValidator),
	withValidRoomId,
	withRoomMemberPermission('canKickParticipants'),
	meetingCtrl.muteAllParticipants
);
internalMeetingRouter.post(
	'/:roomId/participants/:participantIdentity/mute',
	withAuth(roomMemberTokenValidator),
	withValidRoomId,
	withRoomMemberPermission('canKickParticipants'),
	meetingCtrl.muteParticipant
);
internalMeetingRouter.post(
	'/:roomId/participants/:participantIdentity/request-unmute',
	withAuth(roomMemberTokenValidator),
	withValidRoomId,
	withRoomMemberPermission('canKickParticipants'),
	meetingCtrl.requestParticipantUnmute
);
internalMeetingRouter.post(
	'/:roomId/participants/:participantIdentity/stop-camera',
	withAuth(roomMemberTokenValidator),
	withValidRoomId,
	withRoomMemberPermission('canKickParticipants'),
	meetingCtrl.stopParticipantCamera
);
internalMeetingRouter.post(
	'/:roomId/participants/:participantIdentity/stop-screen-share',
	withAuth(roomMemberTokenValidator),
	withValidRoomId,
	withRoomMemberPermission('canKickParticipants'),
	meetingCtrl.stopParticipantScreenShare
);
internalMeetingRouter.put(
	'/:roomId/security',
	withAuth(roomMemberTokenValidator),
	withValidRoomId,
	validateUpdateMeetingSecurityReq,
	withRoomMemberPermission('canEndMeeting'),
	meetingCtrl.updateMeetingSecurity
);

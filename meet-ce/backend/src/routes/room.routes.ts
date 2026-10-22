import { MeetUserRole } from '@openvidu-meet/typings';
import bodyParser from 'body-parser';
import { Router } from 'express';
import * as roomMemberCtrl from '../controllers/room-member.controller.js';
import * as roomCtrl from '../controllers/room.controller.js';
import {
	accessTokenValidator,
	roomMemberTokenValidator,
	withAuth
} from '../middlewares/auth.middleware.js';
import {
	validateBulkDeleteRoomMembersReq,
	validateCreateRoomMemberReq,
	validateCreateRoomMemberTokenReq,
	validateGetRoomMemberReq,
	validateGetRoomMembersReq,
	validateUpdateRoomMemberReq
} from '../middlewares/request-validators/room-member-validator.middleware.js';
import {
	validateMeetingCodeParam,
	validateBulkDeleteRoomsReq,
	validateCreateRoomReq,
	validateDeleteRoomReq,
	validateGetRoomReq,
	validateGetRoomsReq,
	validateUpdateRoomAccessReq,
	validateUpdateRoomConfigReq,
	validateUpdateRoomRolesReq,
	validateUpdateRoomStatusReq,
	withValidRoomId
} from '../middlewares/request-validators/room-validator.middleware.js';
import { apiLimiter, tokenIssuanceLimiter } from '../middlewares/rate-limit.middleware.js';
import {
	authorizeRoomMemberAccess,
	authorizeRoomMemberTokenGeneration,
	setupRoomMemberTokenAuthentication
} from '../middlewares/room-member.middleware.js';
import {
	applyRoomListAccessFilters,
	authorizeRoomAccess,
	authorizeRoomManagement,
	validateBulkDeleteRoomManagement
} from '../middlewares/room.middleware.js';

export const roomRouter: Router = Router();
roomRouter.use(bodyParser.urlencoded({ extended: true }));
roomRouter.use(bodyParser.json());
roomRouter.use(apiLimiter);

// Room Routes
roomRouter.post(
	'/',
	withAuth(accessTokenValidator(MeetUserRole.ADMIN, MeetUserRole.ROOM_MANAGER)),
	validateCreateRoomReq,
	roomCtrl.createRoom
);
roomRouter.get(
	'/',
	withAuth(accessTokenValidator(MeetUserRole.ADMIN, MeetUserRole.ROOM_MANAGER, MeetUserRole.ROOM_MEMBER)),
	validateGetRoomsReq,
	applyRoomListAccessFilters,
	roomCtrl.getRooms
);
roomRouter.delete(
	'/',
	withAuth(accessTokenValidator(MeetUserRole.ADMIN, MeetUserRole.ROOM_MANAGER)),
	validateBulkDeleteRoomsReq,
	validateBulkDeleteRoomManagement,
	roomCtrl.bulkDeleteRooms
);

// Join-by-code lookup: public (the numeric code is the entry token). Registered BEFORE
// /:roomId so 'code' is never captured as a roomId. apiLimiter (router-level) throttles scanning.
roomRouter.get(
	'/code/:meetingCode',
	validateMeetingCodeParam,
	roomCtrl.getRoomByMeetingCode
);

roomRouter.get(
	'/:roomId',
	withAuth(
		roomMemberTokenValidator,
		accessTokenValidator(MeetUserRole.ADMIN, MeetUserRole.ROOM_MANAGER, MeetUserRole.ROOM_MEMBER)
	),
	withValidRoomId,
	validateGetRoomReq,
	authorizeRoomAccess,
	roomCtrl.getRoom
);
roomRouter.delete(
	'/:roomId',
	withAuth(accessTokenValidator(MeetUserRole.ADMIN, MeetUserRole.ROOM_MANAGER)),
	validateDeleteRoomReq,
	authorizeRoomManagement,
	roomCtrl.deleteRoom
);

roomRouter.get(
	'/:roomId/config',
	withAuth(
		roomMemberTokenValidator,
		accessTokenValidator(MeetUserRole.ADMIN, MeetUserRole.ROOM_MANAGER, MeetUserRole.ROOM_MEMBER)
	),
	withValidRoomId,
	authorizeRoomAccess,
	roomCtrl.getRoomConfig
);
roomRouter.put(
	'/:roomId/config',
	withAuth(accessTokenValidator(MeetUserRole.ADMIN, MeetUserRole.ROOM_MANAGER)),
	withValidRoomId,
	validateUpdateRoomConfigReq,
	authorizeRoomManagement,
	roomCtrl.updateRoomConfig
);

roomRouter.put(
	'/:roomId/status',
	withAuth(accessTokenValidator(MeetUserRole.ADMIN, MeetUserRole.ROOM_MANAGER)),
	withValidRoomId,
	validateUpdateRoomStatusReq,
	authorizeRoomManagement,
	roomCtrl.updateRoomStatus
);
roomRouter.put(
	'/:roomId/roles',
	withAuth(accessTokenValidator(MeetUserRole.ADMIN, MeetUserRole.ROOM_MANAGER)),
	withValidRoomId,
	validateUpdateRoomRolesReq,
	authorizeRoomManagement,
	roomCtrl.updateRoomRoles
);
roomRouter.put(
	'/:roomId/access',
	withAuth(accessTokenValidator(MeetUserRole.ADMIN, MeetUserRole.ROOM_MANAGER)),
	withValidRoomId,
	validateUpdateRoomAccessReq,
	authorizeRoomManagement,
	roomCtrl.updateRoomAccess
);

// Room Member Routes
roomRouter.post(
	'/:roomId/members',
	withAuth(accessTokenValidator(MeetUserRole.ADMIN, MeetUserRole.ROOM_MANAGER)),
	withValidRoomId,
	validateCreateRoomMemberReq,
	authorizeRoomManagement,
	roomMemberCtrl.createRoomMember
);
roomRouter.get(
	'/:roomId/members',
	withAuth(accessTokenValidator(MeetUserRole.ADMIN, MeetUserRole.ROOM_MANAGER)),
	withValidRoomId,
	validateGetRoomMembersReq,
	authorizeRoomManagement,
	roomMemberCtrl.getRoomMembers
);
roomRouter.delete(
	'/:roomId/members',
	withAuth(accessTokenValidator(MeetUserRole.ADMIN, MeetUserRole.ROOM_MANAGER)),
	withValidRoomId,
	validateBulkDeleteRoomMembersReq,
	authorizeRoomManagement,
	roomMemberCtrl.bulkDeleteRoomMembers
);

roomRouter.get(
	'/:roomId/members/:memberId',
	withAuth(roomMemberTokenValidator, accessTokenValidator(MeetUserRole.ADMIN, MeetUserRole.ROOM_MANAGER)),
	withValidRoomId,
	validateGetRoomMemberReq,
	authorizeRoomMemberAccess,
	roomMemberCtrl.getRoomMember
);
roomRouter.put(
	'/:roomId/members/:memberId',
	withAuth(accessTokenValidator(MeetUserRole.ADMIN, MeetUserRole.ROOM_MANAGER)),
	withValidRoomId,
	validateUpdateRoomMemberReq,
	authorizeRoomManagement,
	roomMemberCtrl.updateRoomMember
);
roomRouter.delete(
	'/:roomId/members/:memberId',
	withAuth(accessTokenValidator(MeetUserRole.ADMIN, MeetUserRole.ROOM_MANAGER)),
	withValidRoomId,
	authorizeRoomManagement,
	roomMemberCtrl.deleteRoomMember
);

// Internal room routes
export const internalRoomRouter: Router = Router();
internalRoomRouter.use(bodyParser.urlencoded({ extended: true }));
internalRoomRouter.use(bodyParser.json());

internalRoomRouter.post(
	'/:roomId/members/token',
	tokenIssuanceLimiter,
	withValidRoomId,
	validateCreateRoomMemberTokenReq,
	setupRoomMemberTokenAuthentication,
	authorizeRoomMemberTokenGeneration,
	roomMemberCtrl.generateRoomMemberToken
);
internalRoomRouter.post(
	'/:roomId/members/token/refresh',
	tokenIssuanceLimiter,
	withValidRoomId,
	roomMemberCtrl.refreshRoomMemberToken
);

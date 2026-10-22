import { MeetUserRole } from '@openvidu-meet/typings';
import bodyParser from 'body-parser';
import { Router } from 'express';
import * as userCtrl from '../controllers/user.controller.js';
import { accessTokenValidator, withAuth } from '../middlewares/auth.middleware.js';
import { apiLimiter, sensitiveActionLimiter } from '../middlewares/rate-limit.middleware.js';
import {
	validateBulkDeleteUsersReq,
	validateChangePasswordReq,
	validateCreateUserReq,
	validateGetUsersReq,
	validateResetUserPasswordReq,
	validateUpdateUserRoleReq
} from '../middlewares/request-validators/user-validator.middleware.js';

// Public user routes
export const userRouter: Router = Router();
userRouter.use(bodyParser.urlencoded({ extended: true }));
userRouter.use(bodyParser.json());
userRouter.use(apiLimiter);

// Users Routes
userRouter.post(
	'/',
	withAuth(accessTokenValidator(MeetUserRole.ADMIN)),
	validateCreateUserReq,
	userCtrl.createUser
);
userRouter.get(
	'/',
	withAuth(accessTokenValidator(MeetUserRole.ADMIN, MeetUserRole.ROOM_MANAGER)),
	validateGetUsersReq,
	userCtrl.getUsers
);
userRouter.delete(
	'/',
	withAuth(accessTokenValidator(MeetUserRole.ADMIN)),
	validateBulkDeleteUsersReq,
	userCtrl.bulkDeleteUsers
);

userRouter.get(
	'/:userId',
	withAuth(accessTokenValidator(MeetUserRole.ADMIN, MeetUserRole.ROOM_MANAGER)),
	userCtrl.getUser
);
userRouter.put(
	'/:userId/password',
	sensitiveActionLimiter,
	withAuth(accessTokenValidator(MeetUserRole.ADMIN)),
	validateResetUserPasswordReq,
	userCtrl.resetUserPassword
);
userRouter.put(
	'/:userId/role',
	withAuth(accessTokenValidator(MeetUserRole.ADMIN)),
	validateUpdateUserRoleReq,
	userCtrl.updateUserRole
);
userRouter.put('/:userId/status', sensitiveActionLimiter, withAuth(accessTokenValidator(MeetUserRole.ADMIN)), userCtrl.updateAccountStatus);
userRouter.post('/:userId/sessions/revoke', sensitiveActionLimiter, withAuth(accessTokenValidator(MeetUserRole.ADMIN)), userCtrl.revokeUserSessions);
userRouter.delete('/:userId', withAuth(accessTokenValidator(MeetUserRole.ADMIN)), userCtrl.deleteUser);

// Internal user routes
export const internalUserRouter: Router = Router();
internalUserRouter.use(bodyParser.urlencoded({ extended: true }));
internalUserRouter.use(bodyParser.json());
internalUserRouter.use(apiLimiter);

// /me 与 /change-password 面向全体角色；其余路径仅管理员。路由级统一鉴权，
// 使未注册的管理路径对成员返回 403（与其他管理接口一致），而非落到 404。
internalUserRouter.use((req, res, next) => {
	if (req.path === '/me' || req.path === '/change-password') return next();
	return withAuth(accessTokenValidator(MeetUserRole.ADMIN))(req, res, next);
});

internalUserRouter.patch(
	'/me',
	withAuth(accessTokenValidator(MeetUserRole.ADMIN, MeetUserRole.ROOM_MANAGER, MeetUserRole.ROOM_MEMBER)),
	userCtrl.updateMe
);
internalUserRouter.get(
	'/me',
	withAuth(accessTokenValidator(MeetUserRole.ADMIN, MeetUserRole.ROOM_MANAGER, MeetUserRole.ROOM_MEMBER)),
	userCtrl.getMe
);
internalUserRouter.post(
	'/change-password',
	sensitiveActionLimiter,
	withAuth(accessTokenValidator(MeetUserRole.ADMIN, MeetUserRole.ROOM_MANAGER, MeetUserRole.ROOM_MEMBER)),
	validateChangePasswordReq,
	userCtrl.changePassword
);

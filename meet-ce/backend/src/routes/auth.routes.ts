import bodyParser from 'body-parser';
import { Router } from 'express';
import * as authCtrl from '../controllers/auth.controller.js';
import { authLimiter, loginLimiter } from '../middlewares/rate-limit.middleware.js';
import { validateLoginReq } from '../middlewares/request-validators/auth-validator.middleware.js';
import { withAuth, accessTokenValidator } from '../middlewares/auth.middleware.js';
import { MeetUserRole } from '@openvidu-meet/typings';

export const authRouter: Router = Router();
authRouter.use(bodyParser.urlencoded({ extended: true }));
authRouter.use(bodyParser.json());

// Auth Routes
authRouter.get('/options', authCtrl.getAuthenticationOptions);
authRouter.get('/sessions', withAuth(accessTokenValidator(MeetUserRole.ADMIN, MeetUserRole.ROOM_MANAGER, MeetUserRole.ROOM_MEMBER)), authCtrl.listSessions);
authRouter.delete('/sessions/:sessionId', withAuth(accessTokenValidator(MeetUserRole.ADMIN, MeetUserRole.ROOM_MANAGER, MeetUserRole.ROOM_MEMBER)), authCtrl.revokeSession);
authRouter.post('/login', loginLimiter, validateLoginReq, authCtrl.login);
authRouter.post('/logout', authLimiter, authCtrl.logout);
authRouter.post('/refresh', authLimiter, authCtrl.refreshToken);

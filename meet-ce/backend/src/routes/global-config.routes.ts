import { MeetUserRole } from '@openvidu-meet/typings';
import bodyParser from 'body-parser';
import { Router } from 'express';
import * as globalConfigCtrl from '../controllers/global-config.controller.js';
import { accessTokenValidator, allowAnonymous, withAuth } from '../middlewares/auth.middleware.js';
import { apiLimiter } from '../middlewares/rate-limit.middleware.js';
import { validateUpdateRoomsAppearanceConfigReq } from '../middlewares/request-validators/config-validator.middleware.js';

export const configRouter: Router = Router();
configRouter.use(bodyParser.urlencoded({ extended: true }));
configRouter.use(bodyParser.json());
configRouter.use(apiLimiter);

// Appearance config
configRouter.put(
	'/rooms/appearance',
	withAuth(accessTokenValidator(MeetUserRole.ADMIN)),
	validateUpdateRoomsAppearanceConfigReq,
	globalConfigCtrl.updateRoomsAppearanceConfig
);
configRouter.get('/rooms/appearance', withAuth(allowAnonymous), globalConfigCtrl.getRoomsAppearanceConfig);

// Platform branding（开源版固定 JMeet 品牌，只读）
configRouter.get('/platform-branding', withAuth(allowAnonymous), globalConfigCtrl.getPlatformBranding);

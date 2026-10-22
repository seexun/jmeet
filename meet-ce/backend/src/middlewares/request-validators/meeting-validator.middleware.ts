import type { NextFunction, Request, Response } from 'express';
import { rejectUnprocessableRequest } from '../../models/error.model.js';
import {
	CreateWaitingRoomRequestSchema,
	TransferMeetingHostReqSchema,
	UpdateHandStateReqSchema,
	UpdateMeetingSecurityReqSchema,
	UpdateParticipantRoleReqSchema,
	WaitingRoomDecisionSchema
} from '../../models/zod-schemas/meeting.schema.js';

const validateBody = (schema: { safeParse: (body: unknown) => any }) =>
	(req: Request, res: Response, next: NextFunction) => {
		const { success, error, data } = schema.safeParse(req.body);
		if (!success) return rejectUnprocessableRequest(res, error);
		req.body = data;
		next();
	};

export const validateCreateWaitingRoomRequest = validateBody(CreateWaitingRoomRequestSchema);
export const validateWaitingRoomDecision = validateBody(WaitingRoomDecisionSchema);
export const validateTransferMeetingHostReq = validateBody(TransferMeetingHostReqSchema);
export const validateUpdateHandStateReq = validateBody(UpdateHandStateReqSchema);

export const validateUpdateParticipantRoleReq = (req: Request, res: Response, next: NextFunction) => {
	const { success, error, data } = UpdateParticipantRoleReqSchema.safeParse(req.body);

	if (!success) {
		return rejectUnprocessableRequest(res, error);
	}

	req.body = data;
	next();
};

export const validateUpdateMeetingSecurityReq = (req: Request, res: Response, next: NextFunction) => {
	const { success, error, data } = UpdateMeetingSecurityReqSchema.safeParse(req.body);
	if (!success) return rejectUnprocessableRequest(res, error);
	req.body = data;
	next();
};

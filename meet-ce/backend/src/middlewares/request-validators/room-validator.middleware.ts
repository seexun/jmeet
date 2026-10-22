import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { rejectUnprocessableRequest } from '../../models/error.model.js';
import {
	BulkDeleteRoomsReqSchema,
	DeleteRoomReqSchema,
	mergeHeaderFieldsIntoQuery,
	nonEmptySanitizedRoomId,
	RoomFiltersSchema,
	RoomOptionsSchema,
	RoomQueryFieldsSchema,
	UpdateRoomAccessReqSchema,
	UpdateRoomConfigReqSchema,
	UpdateRoomRolesReqSchema,
	UpdateRoomStatusReqSchema
} from '../../models/zod-schemas/room.schema.js';

export const validateCreateRoomReq = (req: Request, res: Response, next: NextFunction) => {
	const query = req.query;
	mergeHeaderFieldsIntoQuery(req.headers, query);

	const bodyResult = RoomOptionsSchema.safeParse(req.body);

	if (!bodyResult.success) {
		return rejectUnprocessableRequest(res, bodyResult.error);
	}

	req.body = bodyResult.data;

	const { success, error, data } = RoomQueryFieldsSchema.safeParse(query);

	if (!success) {
		return rejectUnprocessableRequest(res, error);
	}

	res.locals.validatedQuery = data;
	next();
};

export const validateGetRoomsReq = (req: Request, res: Response, next: NextFunction) => {
	// Merge X-Fields and X-ExtraFields headers into query params before validation
	const query = req.query;
	mergeHeaderFieldsIntoQuery(req.headers, query);

	const { success, error, data } = RoomFiltersSchema.safeParse(query);

	if (!success) {
		return rejectUnprocessableRequest(res, error);
	}

	res.locals.validatedQuery = {
		...data,
		maxItems: data.maxItems?.toString()
	};
	next();
};

export const validateBulkDeleteRoomsReq = (req: Request, res: Response, next: NextFunction) => {
	// Merge X-Fields and X-ExtraFields headers into query params before validation
	const query = req.query;
	mergeHeaderFieldsIntoQuery(req.headers, query);

	const { success, error, data } = BulkDeleteRoomsReqSchema.safeParse(query);

	if (!success) {
		return rejectUnprocessableRequest(res, error);
	}

	res.locals.validatedQuery = data;
	next();
};

export const validateMeetingCodeParam = (req: Request, res: Response, next: NextFunction) => {
	const raw = String(req.params.meetingCode ?? '');
	const digits = raw.replace(/[^0-9]/g, '');

	// 9-12 digits: accepts space/hyphen formatted input (e.g. '123 4567 890'), rejects junk
	const result = z
		.string()
		.regex(/^[0-9]{9,12}$/, 'Meeting code must be 9-12 digits')
		.safeParse(digits);

	if (!result.success) {
		result.error.errors[0].path = ['meetingCode'];
		return rejectUnprocessableRequest(res, result.error);
	}

	req.params.meetingCode = result.data;
	next();
};

export const withValidRoomId = (req: Request, res: Response, next: NextFunction) => {
	const { success, error, data } = nonEmptySanitizedRoomId('roomId').safeParse(req.params.roomId);

	if (!success) {
		error.errors[0].path = ['roomId'];
		return rejectUnprocessableRequest(res, error);
	}

	req.params.roomId = data;
	next();
};

export const validateGetRoomReq = (req: Request, res: Response, next: NextFunction) => {
	// Merge X-Fields and X-ExtraFields headers into query params before validation
	const query = req.query;
	mergeHeaderFieldsIntoQuery(req.headers, query);

	const { success, error, data } = RoomQueryFieldsSchema.safeParse(query);

	if (!success) {
		return rejectUnprocessableRequest(res, error);
	}

	res.locals.validatedQuery = data;
	next();
};

export const validateDeleteRoomReq = (req: Request, res: Response, next: NextFunction) => {
	const roomIdResult = nonEmptySanitizedRoomId('roomId').safeParse(req.params.roomId);

	if (!roomIdResult.success) {
		return rejectUnprocessableRequest(res, roomIdResult.error);
	}

	req.params.roomId = roomIdResult.data;

	// Merge X-Fields and X-ExtraFields headers into query params before validation
	const query = req.query;
	mergeHeaderFieldsIntoQuery(req.headers, query);

	const queryParamsResult = DeleteRoomReqSchema.safeParse(query);

	if (!queryParamsResult.success) {
		return rejectUnprocessableRequest(res, queryParamsResult.error);
	}

	res.locals.validatedQuery = queryParamsResult.data;
	next();
};

export const validateUpdateRoomConfigReq = (req: Request, res: Response, next: NextFunction) => {
	const { success, error, data } = UpdateRoomConfigReqSchema.safeParse(req.body);

	if (!success) {
		return rejectUnprocessableRequest(res, error);
	}

	req.body = data;
	next();
};

export const validateUpdateRoomStatusReq = (req: Request, res: Response, next: NextFunction) => {
	const { success, error, data } = UpdateRoomStatusReqSchema.safeParse(req.body);

	if (!success) {
		return rejectUnprocessableRequest(res, error);
	}

	req.body = data;

	// Merge X-Fields and X-ExtraFields headers into query params before validation.
	const query = req.query;
	mergeHeaderFieldsIntoQuery(req.headers, query);
	const fieldsResult = RoomQueryFieldsSchema.safeParse(query);

	if (!fieldsResult.success) {
		return rejectUnprocessableRequest(res, fieldsResult.error);
	}

	res.locals.validatedQuery = fieldsResult.data;
	next();
};

export const validateUpdateRoomRolesReq = (req: Request, res: Response, next: NextFunction) => {
	const { success, error, data } = UpdateRoomRolesReqSchema.safeParse(req.body);

	if (!success) {
		return rejectUnprocessableRequest(res, error);
	}

	req.body = data;
	next();
};

export const validateUpdateRoomAccessReq = (req: Request, res: Response, next: NextFunction) => {
	const { success, error, data } = UpdateRoomAccessReqSchema.safeParse(req.body);

	if (!success) {
		return rejectUnprocessableRequest(res, error);
	}

	req.body = data;
	next();
};

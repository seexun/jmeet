import type { MeetRoomMemberTokenMetadata } from '@openvidu-meet/typings';
import type { NextFunction, Request, Response } from 'express';
import { rejectUnprocessableRequest } from '../../models/error.model.js';
import {
	BulkDeleteRoomMembersReqSchema,
	mergeMemberHeaderFieldsIntoQuery,
	RoomMemberFiltersSchema,
	RoomMemberOptionsSchema,
	RoomMemberQueryFieldsSchema,
	RoomMemberTokenMetadataSchema,
	RoomMemberTokenOptionsSchema,
	UpdateRoomMemberReqSchema
} from '../../models/zod-schemas/room-member.schema.js';

export const validateCreateRoomMemberReq = (req: Request, res: Response, next: NextFunction) => {
	const { success, error, data } = RoomMemberOptionsSchema.safeParse(req.body);

	if (!success) {
		return rejectUnprocessableRequest(res, error);
	}

	req.body = data;

	// Merge X-Fields and X-ExtraFields headers into query params before validating field selection
	const query = req.query;
	mergeMemberHeaderFieldsIntoQuery(req.headers, query);
	const fieldsResult = RoomMemberQueryFieldsSchema.safeParse(query);

	if (!fieldsResult.success) {
		return rejectUnprocessableRequest(res, fieldsResult.error);
	}

	res.locals.validatedQuery = fieldsResult.data;
	next();
};

export const validateGetRoomMembersReq = (req: Request, res: Response, next: NextFunction) => {
	// Merge X-Fields and X-ExtraFields headers into query params before validation
	const query = req.query;
	mergeMemberHeaderFieldsIntoQuery(req.headers, query);

	const { success, error, data } = RoomMemberFiltersSchema.safeParse(query);

	if (!success) {
		return rejectUnprocessableRequest(res, error);
	}

	res.locals.validatedQuery = {
		...data,
		maxItems: data.maxItems?.toString()
	};
	next();
};

export const validateGetRoomMemberReq = (req: Request, res: Response, next: NextFunction) => {
	// Merge X-Fields and X-ExtraFields headers into query params before validation
	const query = req.query;
	mergeMemberHeaderFieldsIntoQuery(req.headers, query);

	const { success, error, data } = RoomMemberQueryFieldsSchema.safeParse(query);

	if (!success) {
		return rejectUnprocessableRequest(res, error);
	}

	res.locals.validatedQuery = data;
	next();
};

export const validateBulkDeleteRoomMembersReq = (req: Request, res: Response, next: NextFunction) => {
	const { success, error, data } = BulkDeleteRoomMembersReqSchema.safeParse(req.query);

	if (!success) {
		return rejectUnprocessableRequest(res, error);
	}

	res.locals.validatedQuery = data;
	next();
};

export const validateUpdateRoomMemberReq = (req: Request, res: Response, next: NextFunction) => {
	const { success, error, data } = UpdateRoomMemberReqSchema.safeParse(req.body);

	if (!success) {
		return rejectUnprocessableRequest(res, error);
	}

	req.body = data;

	// Merge X-Fields and X-ExtraFields headers into query params before validating field selection
	const query = req.query;
	mergeMemberHeaderFieldsIntoQuery(req.headers, query);
	const fieldsResult = RoomMemberQueryFieldsSchema.safeParse(query);

	if (!fieldsResult.success) {
		return rejectUnprocessableRequest(res, fieldsResult.error);
	}

	res.locals.validatedQuery = fieldsResult.data;
	next();
};

export const validateCreateRoomMemberTokenReq = (req: Request, res: Response, next: NextFunction) => {
	const { success, error, data } = RoomMemberTokenOptionsSchema.safeParse(req.body);

	if (!success) {
		return rejectUnprocessableRequest(res, error);
	}

	req.body = data;
	next();
};

export const validateRoomMemberTokenMetadata = (metadata: unknown): MeetRoomMemberTokenMetadata => {
	const { success, error, data } = RoomMemberTokenMetadataSchema.safeParse(metadata);

	if (!success) {
		throw new Error(`Invalid metadata: ${error.message}`);
	}

	return data;
};

import type {
	MeetRoomMemberExtraField,
	MeetRoomMemberField,
	MeetRoomMemberFilters,
	MeetRoomMemberTokenOptions
} from '@openvidu-meet/typings';
import type { Request, Response } from 'express';
import { container } from '../config/dependency-injector.config.js';
import { INTERNAL_CONFIG } from '../config/internal-config.js';
import { MeetRoomMemberHelper } from '../helpers/room-member.helper.js';
import { errorRoomMemberNotFound, errorUnauthorized, handleError } from '../models/error.model.js';
import { LoggerService } from '../services/logger.service.js';
import { RoomMemberService } from '../services/room-member.service.js';
import { getRoomMemberToken } from '../utils/token.utils.js';
import { getBaseUrl } from '../utils/url.utils.js';

export const createRoomMember = async (req: Request, res: Response) => {
	const logger = container.get(LoggerService);
	const roomMemberService = container.get(RoomMemberService);

	const { roomId } = req.params as Record<string, string>;
	const memberOptions = req.body;
	const { fields, extraFields } = res.locals.validatedQuery as {
		fields?: MeetRoomMemberField[];
		extraFields?: MeetRoomMemberExtraField[];
	};

	try {
		logger.verbose(`Adding member in room '${roomId}'`);

		let member = await roomMemberService.createRoomMember(roomId, memberOptions);
		member = MeetRoomMemberHelper.applyFieldFilters(member, fields, extraFields);
		member = MeetRoomMemberHelper.addResponseMetadata(member);

		res.set(
			'Location',
			`${getBaseUrl()}${INTERNAL_CONFIG.API_BASE_PATH_V1}/rooms/${roomId}/members/${member.memberId}`
		);
		return res.status(201).json(member);
	} catch (error) {
		handleError(res, error, `adding member in room '${roomId}'`);
	}
};

export const getRoomMembers = async (req: Request, res: Response) => {
	const logger = container.get(LoggerService);
	const roomMemberService = container.get(RoomMemberService);

	const { roomId } = req.params as Record<string, string>;
	const filters = res.locals.validatedQuery as MeetRoomMemberFilters;

	try {
		logger.verbose(`Getting members for room '${roomId}'`);

		// Compute the optimal set of fields to retrieve from the database (fields ∪ extraFields)
		const fieldsForQuery = MeetRoomMemberHelper.computeFieldsForMemberQuery(filters.fields, filters.extraFields);
		const { members, isTruncated, nextPageToken } = await roomMemberService.getAllRoomMembers(roomId, {
			...filters,
			fields: fieldsForQuery
		});
		const maxItems = Number(filters.maxItems);

		let response = { members, pagination: { isTruncated, nextPageToken, maxItems } };
		response = MeetRoomMemberHelper.addResponseMetadata(response);
		return res.status(200).json(response);
	} catch (error) {
		handleError(res, error, `getting members for room '${roomId}'`);
	}
};

export const getRoomMember = async (req: Request, res: Response) => {
	const logger = container.get(LoggerService);
	const roomMemberService = container.get(RoomMemberService);

	const { roomId, memberId } = req.params as Record<string, string>;
	const { fields, extraFields } = res.locals.validatedQuery as {
		fields?: MeetRoomMemberField[];
		extraFields?: MeetRoomMemberExtraField[];
	};

	try {
		logger.verbose(`Getting member '${memberId}' from room '${roomId}'`);

		// Retrieve only the requested fields (fields ∪ extraFields) from the database
		const fieldsForQuery = MeetRoomMemberHelper.computeFieldsForMemberQuery(fields, extraFields);
		let member = await roomMemberService.getRoomMember(roomId, memberId, fieldsForQuery);

		if (!member) {
			throw errorRoomMemberNotFound(roomId, memberId);
		}

		member = MeetRoomMemberHelper.addResponseMetadata(member);
		return res.status(200).json(member);
	} catch (error) {
		handleError(res, error, `getting member '${memberId}' from room '${roomId}'`);
	}
};

export const updateRoomMember = async (req: Request, res: Response) => {
	const logger = container.get(LoggerService);
	const roomMemberService = container.get(RoomMemberService);

	const { roomId, memberId } = req.params as Record<string, string>;
	const updates = req.body;
	const { fields, extraFields } = res.locals.validatedQuery as {
		fields?: MeetRoomMemberField[];
		extraFields?: MeetRoomMemberExtraField[];
	};

	try {
		logger.verbose(`Updating member '${memberId}' in room '${roomId}'`);
		let member = await roomMemberService.updateRoomMember(roomId, memberId, updates);

		member = MeetRoomMemberHelper.applyFieldFilters(member, fields, extraFields);
		member = MeetRoomMemberHelper.addResponseMetadata(member);
		return res.status(200).json(member);
	} catch (error) {
		handleError(res, error, `updating member '${memberId}' in room '${roomId}'`);
	}
};

export const deleteRoomMember = async (req: Request, res: Response) => {
	const logger = container.get(LoggerService);
	const roomMemberService = container.get(RoomMemberService);

	const { roomId, memberId } = req.params as Record<string, string>;

	try {
		logger.verbose(`Deleting member '${memberId}' from room '${roomId}'`);
		await roomMemberService.deleteRoomMember(roomId, memberId);
		return res.status(200).json({ message: `Member '${memberId}' deleted successfully from room '${roomId}'` });
	} catch (error) {
		handleError(res, error, `deleting member '${memberId}' from room '${roomId}'`);
	}
};

export const bulkDeleteRoomMembers = async (req: Request, res: Response) => {
	const logger = container.get(LoggerService);
	const roomMemberService = container.get(RoomMemberService);

	const { roomId } = req.params as Record<string, string>;
	const { memberIds } = res.locals.validatedQuery as { memberIds: string[] };

	try {
		logger.verbose(`Deleting members from room '${roomId}' with IDs: ${memberIds}`);
		const { deleted, failed } = await roomMemberService.bulkDeleteRoomMembers(roomId, memberIds);

		// All room members were successfully deleted
		if (failed.length === 0) {
			return res.status(200).json({ message: 'All room members deleted successfully', deleted, failed: [] });
		}

		// Some or all room members could not be deleted
		return res
			.status(400)
			.json({ message: `${failed.length} room member(s) could not be deleted`, deleted, failed });
	} catch (error) {
		handleError(res, error, `bulk deleting members from room '${roomId}'`);
	}
};

export const generateRoomMemberToken = async (req: Request, res: Response) => {
	const logger = container.get(LoggerService);
	const roomMemberTokenService = container.get(RoomMemberService);

	const { roomId } = req.params as Record<string, string>;
	const tokenOptions = req.body as MeetRoomMemberTokenOptions;
	const previousToken = getRoomMemberToken(req);

	try {
		if (!previousToken) await container.get((await import('../services/resource-quota.service.js')).ResourceQuotaService).assertMeetingAdmission(roomId);
		logger.verbose(`Generating room member token for room '${roomId}'`);
		const token = await roomMemberTokenService.generateRoomMemberToken(roomId, tokenOptions, previousToken);
		return res.status(200).json({ token });
	} catch (error) {
		handleError(res, error, `generating room member token for room '${roomId}'`);
	}
};

export const refreshRoomMemberToken = async (req: Request, res: Response) => {
	const logger = container.get(LoggerService);
	const roomMemberTokenService = container.get(RoomMemberService);

	const { roomId } = req.params as Record<string, string>;
	const previousToken = getRoomMemberToken(req);

	try {
		if (!previousToken) {
			throw errorUnauthorized();
		}

		logger.verbose(`Refreshing room member token for room '${roomId}'`);
		const token = await roomMemberTokenService.refreshRoomMemberToken(roomId, previousToken);
		return res.status(200).json({ token });
	} catch (error) {
		handleError(res, error, `refreshing room member token for room '${roomId}'`);
	}
};

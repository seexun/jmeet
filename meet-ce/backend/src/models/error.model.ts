import type { MeetRoomDeletionErrorCode, MeetRoomMemberRole } from '@openvidu-meet/typings';
import type { Response } from 'express';
import type { z } from 'zod';
import { container } from '../config/dependency-injector.config.js';
import { LoggerService } from '../services/logger.service.js';

type StatusError = 400 | 401 | 402 | 403 | 404 | 409 | 415 | 416 | 422 | 429 | 500 | 503;
export class OpenViduMeetError extends Error {
	name: string;
	statusCode: StatusError;

	constructor(error: string, message: string, statusCode: StatusError) {
		super(message);
		this.name = error;
		this.statusCode = statusCode;
	}
}

interface ErrorResponse {
	error: string;
	message: string;
	details?: {
		field: string;
		message: string;
	}[];
}

// General errors

export const errorMalformedBody = (): OpenViduMeetError => {
	return new OpenViduMeetError('Bad Request', 'Malformed body', 400);
};


export const errorUnsupportedMediaType = (supportedTypes: string[]): OpenViduMeetError => {
	return new OpenViduMeetError(
		'Unsupported Media Type',
		`Unsupported media type. Supported types: ${supportedTypes.join(', ')}`,
		415
	);
};

export const internalError = (operationDescription: string): OpenViduMeetError => {
	return new OpenViduMeetError('Internal Server Error', `Unexpected error while ${operationDescription}`, 500);
};

export const errorLivekitNotAvailable = (): OpenViduMeetError => {
	return new OpenViduMeetError('LiveKit Error', 'LiveKit is not available', 503);
};


// Auth errors

export const errorInvalidCredentials = (): OpenViduMeetError => {
	return new OpenViduMeetError('Login Error', 'Invalid user ID or password', 404);
};

export const errorInvalidPassword = (): OpenViduMeetError => {
	return new OpenViduMeetError('Change Password Error', 'Invalid current password', 400);
};

export const errorUnauthorized = (): OpenViduMeetError => {
	return new OpenViduMeetError('Authentication Error', 'Unauthorized', 401);
};

export const errorInvalidToken = (): OpenViduMeetError => {
	return new OpenViduMeetError('Authentication Error', 'Invalid token', 401);
};

export const errorInvalidTokenSubject = (): OpenViduMeetError => {
	return new OpenViduMeetError('Authorization Error', 'Invalid token subject', 403);
};

export const errorRefreshTokenNotPresent = (): OpenViduMeetError => {
	return new OpenViduMeetError('Refresh Token Error', 'No refresh token provided', 400);
};

export const errorInvalidRefreshToken = (): OpenViduMeetError => {
	return new OpenViduMeetError('Refresh Token Error', 'Invalid refresh token', 400);
};

export const errorInsufficientPermissions = (): OpenViduMeetError => {
	return new OpenViduMeetError('Authorization Error', 'Insufficient permissions to access this resource', 403);
};

export const errorPasswordChangeRequired = (): OpenViduMeetError => {
	return new OpenViduMeetError(
		'Authorization Error',
		'Password change required. Please change your password before accessing other resources.',
		403
	);
};

















// User errors

export const errorUserNotFound = (userId: string): OpenViduMeetError => {
	return new OpenViduMeetError('User Error', `User '${userId}' not found`, 404);
};

export const errorUserAlreadyExists = (userId: string): OpenViduMeetError => {
	return new OpenViduMeetError('User Error', `User '${userId}' already exists`, 409);
};

export const errorCannotResetRootAdminPassword = (): OpenViduMeetError => {
	return new OpenViduMeetError(
		'User Error',
		'Cannot reset password for the root admin user. The root admin must change their own password.',
		403
	);
};

export const errorCannotResetOwnPassword = (): OpenViduMeetError => {
	return new OpenViduMeetError(
		'User Error',
		'Cannot reset your own password. Please use the change-password endpoint to change your password.',
		403
	);
};

export const errorCannotDeleteRootAdmin = (): OpenViduMeetError => {
	return new OpenViduMeetError(
		'User Error',
		'Cannot delete the root admin user. This account is required for system administration.',
		403
	);
};

export const errorCannotDeleteOwnAccount = (): OpenViduMeetError => {
	return new OpenViduMeetError(
		'User Error',
		'Cannot delete your own account. Please have another administrator delete your account if needed.',
		403
	);
};

export const errorCannotChangeRootAdminRole = (): OpenViduMeetError => {
	return new OpenViduMeetError(
		'User Error',
		'Cannot change the role of the root admin user. This account must retain administrative privileges.',
		403
	);
};

export const errorCannotChangeOwnRole = (): OpenViduMeetError => {
	return new OpenViduMeetError(
		'User Error',
		'Cannot change your own role. Please have another administrator change your role if needed.',
		403
	);
};

// Room errors

export const errorRoomNotFound = (roomId: string): OpenViduMeetError => {
	return new OpenViduMeetError('Room Error', `Room '${roomId}' does not exist`, 404);
};

export const errorMeetingCodeNotFound = (meetingCode: string): OpenViduMeetError => {
	return new OpenViduMeetError('Room Error', `No room found for meeting code '${meetingCode}'`, 404);
};

export const errorRoomClosed = (roomId: string): OpenViduMeetError => {
	return new OpenViduMeetError('Room Error', `Room '${roomId}' is closed and cannot be joined`, 409);
};

export const errorMeetingLocked = (roomId: string): OpenViduMeetError => {
	return new OpenViduMeetError('Meeting Locked', `Meeting in room '${roomId}' is locked by the host`, 409);
};

export const errorHostNotPresent = (roomId: string): OpenViduMeetError => {
	return new OpenViduMeetError('Host Required', `A host must join room '${roomId}' before participants`, 409);
};

export const errorRoomActiveMeeting = (roomId: string): OpenViduMeetError => {
	return new OpenViduMeetError('Room Error', `Room '${roomId}' has an active meeting`, 409);
};

export const errorInvalidRoomSecret = (roomId: string, secret: string): OpenViduMeetError => {
	return new OpenViduMeetError('Room Error', `Secret '${secret}' is not recognized for room '${roomId}'`, 400);
};

export const errorAnonymousAccessDisabled = (
	roomId: string,
	role: MeetRoomMemberRole | 'recording'
): OpenViduMeetError => {
	return new OpenViduMeetError(
		'Room Error',
		`Anonymous access in room '${roomId}' is disabled for ${role === 'recording' ? 'recordings' : `role '${role}'`}`,
		403
	);
};

export const errorDeletingRoom = (errorCode: MeetRoomDeletionErrorCode, message: string): OpenViduMeetError => {
	return new OpenViduMeetError(errorCode, message, 409);
};

// Room member errors

export const errorRoomMemberNotFound = (roomId: string, memberId: string): OpenViduMeetError => {
	return new OpenViduMeetError('Room Member Error', `Room member '${memberId}' not found in room '${roomId}'`, 404);
};

export const errorRoomMemberAlreadyExists = (roomId: string, userId: string): OpenViduMeetError => {
	return new OpenViduMeetError('Room Member Error', `User '${userId}' is already a member of room '${roomId}'`, 409);
};

export const errorRoomMemberCannotBeOwnerOrAdmin = (roomId: string, userId: string): OpenViduMeetError => {
	return new OpenViduMeetError(
		'Room Member Error',
		`User '${userId}' cannot be added as a member of room '${roomId}' because they are the room owner or an admin`,
		409
	);
};

export const errorParticipantNameRequiredForMeetingJoin = (): OpenViduMeetError => {
	return new OpenViduMeetError(
		'Room Member Error',
		'participantName is required when joining a meeting and it cannot be inferred from member/user context',
		400
	);
};

export const errorParticipantNotFound = (participantIdentity: string, roomId: string): OpenViduMeetError => {
	return new OpenViduMeetError(
		'Participant Error',
		`Participant '${participantIdentity}' not found in room '${roomId}'`,
		404
	);
};

export const errorParticipantCannotBePromotedToModerator = (
	participantIdentity: string,
	roomId: string
): OpenViduMeetError => {
	return new OpenViduMeetError(
		'Participant Error',
		`Participant '${participantIdentity}' in room '${roomId}' cannot be promoted to moderator because they are not eligible for promotion`,
		409
	);
};

export const errorParticipantCannotBeDemotedFromModerator = (
	participantIdentity: string,
	roomId: string
): OpenViduMeetError => {
	return new OpenViduMeetError(
		'Participant Error',
		`Participant '${participantIdentity}' in room '${roomId}' cannot be demoted because they are not a promoted moderator`,
		409
	);
};





// Handlers

export const handleError = (res: Response, error: OpenViduMeetError | unknown, operationDescription: string) => {
	const logger = container.get(LoggerService);
	logger.error(`Error while ${operationDescription}: ${error}`);

	if (!(error instanceof OpenViduMeetError)) {
		error = internalError(operationDescription);
	}

	return rejectRequestFromMeetError(res, error as OpenViduMeetError);
};

export const rejectRequestFromMeetError = (res: Response, error: OpenViduMeetError) => {
	const errorResponse: ErrorResponse = {
		error: error.name,
		message: error.message
	};
	return res.status(error.statusCode).json(errorResponse);
};

export const rejectUnprocessableRequest = (res: Response, error: z.ZodError) => {
	const errorDetails = error.errors.map((error) => ({
		field: error.path.join('.'),
		message: error.message
	}));

	const errorResponse: ErrorResponse = {
		error: 'Unprocessable Entity',
		message: 'Invalid request',
		details: errorDetails
	};
	return res.status(422).json(errorResponse);
};

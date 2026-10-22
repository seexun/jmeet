import { MeetParticipantModerationAction } from '@openvidu-meet/typings';
import { z } from 'zod';

export const UpdateParticipantRoleReqSchema = z.object({
	action: z.nativeEnum(MeetParticipantModerationAction)
});

export const UpdateMeetingSecurityReqSchema = z.object({
	waitingRoomEnabled: z.boolean(),
	locked: z.boolean(),
	accessScope: z.enum(['invited_and_internal', 'internal_only', 'anyone_with_link']),
	allowJoinBeforeHost: z.boolean(),
	muteOnEntry: z.boolean(),
	allowSelfUnmute: z.boolean(),
	screenSharePolicy: z.enum(['moderators_only', 'all_participants']),
	allowParticipantRename: z.boolean(),
	allowMultipleDevices: z.boolean(),
	watermarkEnabled: z.boolean()
});

export const CreateWaitingRoomRequestSchema = z.object({
	participantName: z.string().trim().min(1).max(50)
});

export const WaitingRoomDecisionSchema = z.object({
	status: z.enum(['approved', 'rejected', 'blocked'])
});

export const TransferMeetingHostReqSchema = z.object({
	targetParticipantIdentity: z.string().trim().min(1).max(255)
});

export const UpdateHandStateReqSchema = z.object({ raised: z.boolean() });

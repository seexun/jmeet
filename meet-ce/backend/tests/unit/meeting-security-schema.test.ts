import {
	CreateWaitingRoomRequestSchema,
	UpdateMeetingSecurityReqSchema,
	WaitingRoomDecisionSchema
} from '../../src/models/zod-schemas/meeting.schema.js';

const validSecurity = {
	securityLevel: 'confidential' as const,
	waitingRoomEnabled: true,
	locked: false,
	accessScope: 'invited_and_internal' as const,
	allowJoinBeforeHost: false,
	muteOnEntry: true,
	allowSelfUnmute: false,
	screenSharePolicy: 'moderators_only' as const,
	allowParticipantRename: false,
	allowMultipleDevices: false,
	watermarkEnabled: false
};

describe('commercial meeting security request validation', () => {
	it('accepts a complete enterprise meeting policy', () => {
		expect(UpdateMeetingSecurityReqSchema.safeParse(validSecurity).success).toBe(true);
	});

	it('rejects incomplete or unsupported meeting policies', () => {
		expect(UpdateMeetingSecurityReqSchema.safeParse({ ...validSecurity, accessScope: 'public' }).success).toBe(false);
		expect(UpdateMeetingSecurityReqSchema.safeParse({ locked: true }).success).toBe(false);
	});

	it('validates waiting-room identities and decisions', () => {
		expect(CreateWaitingRoomRequestSchema.safeParse({ participantName: '张三' }).success).toBe(true);
		expect(CreateWaitingRoomRequestSchema.safeParse({ participantName: '   ' }).success).toBe(false);
		expect(WaitingRoomDecisionSchema.safeParse({ status: 'blocked' }).success).toBe(true);
		expect(WaitingRoomDecisionSchema.safeParse({ status: 'unknown' }).success).toBe(false);
	});
});

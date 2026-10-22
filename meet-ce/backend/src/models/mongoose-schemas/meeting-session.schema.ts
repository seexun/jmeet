import { model, Schema } from 'mongoose';

export interface MeetingSessionDocument {
	meetingSessionId: string; roomId: string; livekitRoomSid: string;
	status: 'starting' | 'active' | 'ending' | 'completed' | 'failed' | 'cancelled';
	startedAt: number; endedAt?: number; hostIdentity?: string; participantIdentities: string[];
	createdAt: number; updatedAt: number;
	minutesEnabled: boolean; minutesEnabledAt?: number; minutesEnabledBy?: string; minutesEmptySince?: number;
	legalHold: boolean; legalHoldReason?: string; legalHoldUpdatedBy?: string; legalHoldUpdatedAt?: number;
}
export interface AsrJobDocument {
	asrJobId: string; meetingSessionId: string; roomId: string;
	status: 'queued' | 'starting' | 'running' | 'finalizing' | 'completed' | 'failed' | 'cancelled';
	workerId?: string; heartbeatAt?: number; startedAt?: number; completedAt?: number;
	lastSequence: number; finalSegmentCount: number; retryCount: number; errorCode?: string; errorMessage?: string;
	contiguousSequence: number; missingSequences: number[]; activeTracks: number;
	leaseId?: string;
	createdAt: number; updatedAt: number;
}

const MeetingSessionSchema = new Schema<MeetingSessionDocument>({
	meetingSessionId: { type: String, required: true, unique: true, index: true }, roomId: { type: String, required: true, index: true },
	livekitRoomSid: { type: String, required: true, unique: true, index: true }, status: { type: String, required: true, index: true },
	startedAt: { type: Number, required: true }, endedAt: Number, hostIdentity: String, participantIdentities: { type: [String], default: [] },
	createdAt: { type: Number, required: true }, updatedAt: { type: Number, required: true },
	minutesEnabled: { type: Boolean, default: false }, minutesEnabledAt: Number, minutesEnabledBy: String, minutesEmptySince: Number,
	legalHold: { type: Boolean, default: false, index: true }, legalHoldReason: String, legalHoldUpdatedBy: String, legalHoldUpdatedAt: Number
}, { collection: 'meeting_sessions', versionKey: false });
MeetingSessionSchema.index({ roomId: 1, startedAt: -1 });

const AsrJobSchema = new Schema<AsrJobDocument>({
	asrJobId: { type: String, required: true, unique: true, index: true }, meetingSessionId: { type: String, required: true, unique: true, index: true },
	roomId: { type: String, required: true, index: true }, status: { type: String, required: true, index: true }, workerId: String,
	heartbeatAt: Number, startedAt: Number, completedAt: Number, lastSequence: { type: Number, default: 0 }, finalSegmentCount: { type: Number, default: 0 },
	contiguousSequence: { type: Number, default: 0 }, missingSequences: { type: [Number], default: [] }, activeTracks: { type: Number, default: 0 },
	leaseId: String,
	retryCount: { type: Number, default: 0 }, errorCode: String, errorMessage: String, createdAt: { type: Number, required: true }, updatedAt: { type: Number, required: true }
}, { collection: 'asr_jobs', versionKey: false });
AsrJobSchema.index({ status: 1, heartbeatAt: 1 });

export const MeetingSessionModel = model<MeetingSessionDocument>('MeetingSession', MeetingSessionSchema);
export const AsrJobModel = model<AsrJobDocument>('AsrJob', AsrJobSchema);

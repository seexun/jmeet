export type MeetWhiteboardStatus = 'preparing' | 'active' | 'readonly' | 'archived';
export type MeetWhiteboardObjectType = 'stroke' | 'note' | 'rectangle';
export type MeetWhiteboardOperationType = 'object.upsert' | 'object.delete' | 'board.clear' | 'board.lock';

export interface MeetWhiteboardPoint { x: number; y: number }
export interface MeetWhiteboardObject {
	id: string;
	type: MeetWhiteboardObjectType;
	x: number;
	y: number;
	width?: number;
	height?: number;
	text?: string;
	color: string;
	points?: MeetWhiteboardPoint[];
	author: string;
	version: number;
}

export interface MeetWhiteboard {
	boardId: string;
	roomId: string;
	meetingSessionId: string;
	ownerId: string;
	status: MeetWhiteboardStatus;
	locked: boolean;
	currentSequence: number;
	objects: MeetWhiteboardObject[];
	createdAt: number;
	updatedAt: number;
	legalHold?: boolean;
	legalHoldReason?: string;
	legalHoldUpdatedBy?: string;
	legalHoldUpdatedAt?: number;
}

export interface MeetWhiteboardOperationRequest {
	protocolVersion: 1;
	operationId: string;
	baseSequence: number;
	type: MeetWhiteboardOperationType;
	object?: MeetWhiteboardObject;
	objectId?: string;
	locked?: boolean;
}

export interface MeetWhiteboardOperationResult {
	accepted: boolean;
	duplicate: boolean;
	sequence: number;
	board: MeetWhiteboard;
}

export interface MeetWhiteboardOperation extends MeetWhiteboardOperationRequest {
	boardId: string;
	sequence: number;
	actorId: string;
	createdAt: number;
}

export interface MeetWhiteboardSnapshot {
	snapshotId: string;
	boardId: string;
	sequence: number;
	objects: MeetWhiteboardObject[];
	locked: boolean;
	checksum: string;
	createdAt: number;
}

export interface MeetWhiteboardVersion extends MeetWhiteboardSnapshot {
	versionId: string;
	version: number;
	name: string;
	reason: 'manual' | 'meeting_end' | 'restore';
	createdBy: string;
	/** Resolved display name of the creator; present in version list responses. */
	createdByName?: string;
}

export interface MeetWhiteboardSyncResponse {
	board: MeetWhiteboard;
	snapshot?: MeetWhiteboardSnapshot;
	operations: MeetWhiteboardOperation[];
}

export interface MeetWhiteboardExportAuthorization {
	board: MeetWhiteboard;
	format: 'png';
	fileName: string;
	exportedAt: number;
	checksum: string;
	sequence: number;
}

import { MeetChatAttachmentRef } from './database/index.js';
import { MeetRecordingInfo } from './database/recording.entity.js';
import { MeetRoomConfig } from './database/room-config.js';
import { MeetRoomMemberUIBadge } from './response/room-member-response.js';

/**
 * Interface representing a signal emitted by JMeet to notify clients about real-time updates in the meeting.
 */
export enum MeetSignalType {
	/** Emitted when the recording state of a meeting room is updated */
	MEET_RECORDING_UPDATED = 'meet_recording_updated',
	/** Emitted when the configuration of a meeting room is updated */
	MEET_ROOM_CONFIG_UPDATED = 'meet_room_config_updated',
	/** Emitted when a participant's role in a meeting room is updated */
	MEET_PARTICIPANT_ROLE_UPDATED = 'meet_participant_role_updated',
	/** Emitted when a participant must regenerate their room member token to sync updated permissions */
	MEET_PARTICIPANT_PERMISSIONS_UPDATED = 'meet_participant_permissions_updated',
	/** Emitted when the unique primary host changes */
	MEET_HOST_CHANGED = 'meet_host_changed',
	/** Emitted when a meeting temporarily has no eligible host. */
	MEET_HOST_UNAVAILABLE = 'meet_host_unavailable',
	/** Emitted when a host asks a participant to turn on their microphone */
	MEET_UNMUTE_REQUESTED = 'meet_unmute_requested',
	/** Emitted when a participant raises or lowers their hand */
	MEET_HAND_STATE_CHANGED = 'meet_hand_state_changed',
	/** Emitted to the primary host when a participant requests screen sharing */
	MEET_SCREEN_SHARE_REQUESTED = 'meet_screen_share_requested',
	/** Emitted when the primary host approves a screen-sharing request */
	MEET_SCREEN_SHARE_GRANTED = 'meet_screen_share_granted',
	/** Emitted when the breakout session (分组讨论) state changes: created, started, broadcast, ended */
	MEET_BREAKOUT_UPDATED = 'meet_breakout_updated'
}

/**
 * Payload for MEET_RECORDING_UPDATED signal,
 * containing the latest recording state for a room.
 */
export interface MeetRecordingUpdatedPayload {
	/** ID of the room whose recording state has changed */
	roomId: string;
	/** Latest recording state for the room */
	recording: MeetRecordingInfo;
	/** Timestamp in milliseconds when the update occurred */
	timestamp: number;
}

/**
 * Payload for MEET_ROOM_CONFIG_UPDATED signal,
 * containing the updated room configuration and related information.
 */
export interface MeetRoomConfigUpdatedPayload {
	/** ID of the room whose configuration has been updated */
	roomId: string;
	/** Updated configuration of the meeting room */
	config: MeetRoomConfig;
	/** Timestamp in milliseconds when the update occurred */
	timestamp: number;
}

/**
 * Payload for MEET_PARTICIPANT_ROLE_UPDATED signal,
 * containing information about the participant whose role was updated and the new badge.
 */
export interface MeetParticipantRoleUpdatedPayload {
	/** ID of the room where the participant's role was updated */
	roomId: string;
	/** Identity of the participant whose role was updated */
	participantIdentity: string;
	/** New badge assigned to the participant */
	newBadge: MeetRoomMemberUIBadge;
	/** Timestamp in milliseconds when the role update occurred */
	timestamp: number;
}

/**
 * Payload for MEET_PARTICIPANT_PERMISSIONS_UPDATED signal,
 * containing routing information for the participant that must regenerate their room member token.
 */
export interface MeetParticipantPermissionsUpdatedPayload {
	/** ID of the room where permissions were updated */
	roomId: string;
	/** Identity of the participant that must regenerate the token */
	participantIdentity: string;
	/** Timestamp in milliseconds when the permission update occurred */
	timestamp: number;
}

/** Current primary-host state for an active meeting. */
export interface MeetMeetingHostState {
	roomId: string;
	hostIdentity: string;
	timestamp: number;
}

/** Payload emitted after a successful primary-host transfer. */
export type MeetHostChangedPayload = MeetMeetingHostState;

export interface MeetHostUnavailablePayload {
	roomId: string;
	endsAt: number;
	timestamp: number;
}

export interface MeetUnmuteRequestedPayload {
	roomId: string;
	participantIdentity: string;
	requestedByIdentity: string;
	timestamp: number;
}

export interface MeetHandStateChangedPayload {
	roomId: string;
	participantIdentity: string;
	raised: boolean;
	timestamp: number;
}

export interface MeetScreenShareRequestPayload {
	roomId: string;
	participantIdentity: string;
	participantName?: string;
	timestamp: number;
}

export interface MeetScreenShareGrantedPayload {
	roomId: string;
	participantIdentity: string;
	grantedByIdentity: string;
	timestamp: number;
}

/** 分组讨论状态变化信号：携带最新会话快照（成员按接收端裁剪） */
export interface MeetBreakoutUpdatedPayload {
	roomId: string;
	/** draft=分组配置中 / active=讨论进行中 / ended=已结束（全员应回主会场） */
	status: 'draft' | 'active' | 'ended';
	/** 讨论进行中且接收端被分配了分组时携带 */
	room?: { breakoutId: string; name: string };
	/** 主持人广播消息（仅广播事件携带） */
	broadcast?: { text: string; sentAt: number };
	timestamp: number;
}

export interface MeetingChatSignalPayload {
	message: string;
	attachment?: MeetChatAttachmentRef;
	/** 私聊目标参会者 identity；公共消息为空。私聊仅经数据通道定向投递，不归档 */
	to?: string;
	/** 发送者 identity（接收端判定消息归属用） */
	fromIdentity?: string;
}

/**
 * Union type representing the payload of a MeetSignal.
 * It can be either a {@link MeetRecordingUpdatedPayload}, {@link MeetRoomConfigUpdatedPayload},
 * {@link MeetParticipantRoleUpdatedPayload} or {@link MeetParticipantPermissionsUpdatedPayload},
 * depending on the signal type.
 */
export type MeetSignalPayload =
	| MeetRecordingUpdatedPayload
	| MeetRoomConfigUpdatedPayload
	| MeetParticipantRoleUpdatedPayload
	| MeetParticipantPermissionsUpdatedPayload
	| MeetHostChangedPayload
	| MeetHostUnavailablePayload
	| MeetUnmuteRequestedPayload
	| MeetHandStateChangedPayload
	| MeetScreenShareRequestPayload
	| MeetScreenShareGrantedPayload
	| MeetBreakoutUpdatedPayload;

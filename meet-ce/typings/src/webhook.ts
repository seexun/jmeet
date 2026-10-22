import { MeetRecordingInfo } from './database/recording.entity.js';
import { MeetRoom } from './database/room.entity.js';

/**
 * Interface representing a webhook event emitted by JMeet.
 */
export interface MeetWebhookEvent {
	/** Timestamp in milliseconds since epoch when the event was created */
	creationDate: number;
	/** Type of the webhook event. See {@link MeetWebhookEventType} for details. */
	event: MeetWebhookEventType;
	/** Payload of the webhook event, containing relevant data about the event. See {@link MeetWebhookPayload} for details. */
	data: MeetWebhookPayload;
}

/**
 * Webhook event types that can be emitted by JMeet.
 */
export enum MeetWebhookEventType {
	/** Emitted when a meeting starts in a room */
	MEETING_STARTED = 'meetingStarted',
	/** Emitted when a meeting ends in a room */
	MEETING_ENDED = 'meetingEnded',
	/** Emitted when a recording starts in a room */
	RECORDING_STARTED = 'recordingStarted',
	/** Emitted when a recording is updated */
	RECORDING_UPDATED = 'recordingUpdated',
	/** Emitted when a recording ends */
	RECORDING_ENDED = 'recordingEnded'
}

/**
 * Payload for JMeet webhook events.
 * Depending on the event type, the payload can be either {@link MeetRecordingInfo} or {@link MeetRoom}.
 */
export type MeetWebhookPayload = MeetRecordingInfo | MeetRoom;

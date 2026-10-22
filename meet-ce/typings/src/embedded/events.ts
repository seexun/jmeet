/**
 * All available events that can be emitted by the embedded JMeet application.
 * @category Communication
 */
export enum EmbeddedEventName {
	/**
	 * Event emitted when the local participant joins the meeting.
	 */
	JOINED = 'joined',
	/**
	 * Event emitted when the local participant leaves the meeting.
	 */
	LEFT = 'left',
	/**
	 * Event emitted when the application is closed.
	 */
	CLOSED = 'closed'
}

/**
 * Reason for emitting the LEFT event in JMeet.
 */
export enum LeftEventReason {
	/** The participant left the meeting voluntarily */
	VOLUNTARY_LEAVE = 'voluntary_leave',
	/** The participant was disconnected due to network issues */
	NETWORK_DISCONNECT = 'network_disconnect',
	/** The server was shut down unexpectedly */
	SERVER_SHUTDOWN = 'server_shutdown',
	/** The participant was kicked from the meeting by a moderator */
	PARTICIPANT_KICKED = 'participant_kicked',
	/** A moderator ended the meeting for all participants */
	MEETING_ENDED = 'meeting_ended',
	/** The local participant ended the meeting for all participants */
	MEETING_ENDED_BY_SELF = 'meeting_ended_by_self',
	/** The participant was disconnected because the same identity joined again */
	DUPLICATE_IDENTITY = 'duplicate_identity',
	/** Unknown reason for leaving the meeting */
	UNKNOWN = 'unknown'
}

/**
 * Type definitions for event payloads.
 * Each property corresponds to an event in {@link EmbeddedEventName}.
 * @category Communication
 */
export interface EmbeddedEventPayloads {
	/**
	 * Payload for the {@link EmbeddedEventName.JOINED} event.
	 */
	[EmbeddedEventName.JOINED]: {
		roomId: string;
		participantIdentity: string;
	};
	/**
	 * Payload for the {@link EmbeddedEventName.LEFT} event.
	 */
	[EmbeddedEventName.LEFT]: {
		roomId: string;
		participantIdentity: string;
		reason: LeftEventReason;
	};
}

/**
 * Gets the type-safe payload for a specific event.
 * This type allows TypeScript to infer the correct payload type based on the event.
 * @category Type Helpers
 * @private
 */
export type EmbeddedEventPayloadFor<T extends EmbeddedEventName> = T extends keyof EmbeddedEventPayloads
	? EmbeddedEventPayloads[T]
	: never;

/**
 * Event message emitted when the local participant joins the meeting: the event name plus its payload,
 * derived from {@link EmbeddedEventPayloadFor}.
 * @category Communication
 */
export interface EmbeddedJoinedEvent {
	event: EmbeddedEventName.JOINED;
	payload: EmbeddedEventPayloadFor<EmbeddedEventName.JOINED>;
}

/**
 * Event message emitted when the local participant leaves the meeting: the event name plus its payload,
 * derived from {@link EmbeddedEventPayloadFor}.
 * @category Communication
 */
export interface EmbeddedLeftEvent {
	event: EmbeddedEventName.LEFT;
	payload: EmbeddedEventPayloadFor<EmbeddedEventName.LEFT>;
}

/**
 * Event message emitted when the application closes (no payload).
 * @category Communication
 */
export interface EmbeddedClosedEvent {
	event: EmbeddedEventName.CLOSED;
}

/**
 * Discriminated union of every event message the embedded app emits; narrow on `event`. It is drained
 * from the app's event queue and either re-emitted as a DOM `CustomEvent` (webcomponent) or posted
 * verbatim over `postMessage` (iframe integration).
 * @category Communication
 */
export type EmbeddedEvent = EmbeddedJoinedEvent | EmbeddedLeftEvent | EmbeddedClosedEvent;

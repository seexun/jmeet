/**
 * All available commands that can be sent to the embedded JMeet application.
 */
export enum EmbeddedCommandName {
	/**
	 * Ends the current meeting for all participants.
	 * @moderator
	 */
	END_MEETING = 'endMeeting',
	/**
	 * Disconnects the local participant from the current meeting.
	 */
	LEAVE_ROOM = 'leaveRoom',
	/**
	 * Kicks a participant from the meeting.
	 * @moderator
	 */
	KICK_PARTICIPANT = 'kickParticipant'
}

/**
 * Type definitions for command payloads.
 * Each property corresponds to a command in {@link EmbeddedCommandName}.
 * @category Communication
 */
export interface EmbeddedCommandPayloads {
	/**
	 * Payload for the {@link EmbeddedCommandName.END_MEETING} command.
	 */
	[EmbeddedCommandName.END_MEETING]: void;
	/**
	 * Payload for the {@link EmbeddedCommandName.LEAVE_ROOM} command.
	 */
	[EmbeddedCommandName.LEAVE_ROOM]: void;
	/**
	 * Payload for the {@link EmbeddedCommandName.KICK_PARTICIPANT} command.
	 */
	[EmbeddedCommandName.KICK_PARTICIPANT]: {
		participantIdentity: string;
	};
}

/**
 * Gets the type-safe payload for a specific command.
 * This type allows TypeScript to infer the correct payload type based on the command.
 * @category Type Helpers
 * @private
 */
export type EmbeddedCommandPayloadFor<T extends EmbeddedCommandName> = T extends keyof EmbeddedCommandPayloads
	? EmbeddedCommandPayloads[T]
	: never;

/**
 * Command message for {@link EmbeddedCommandName.END_MEETING} (no payload).
 * @category Communication
 */
export interface EmbeddedEndMeetingCommand {
	command: EmbeddedCommandName.END_MEETING;
}

/**
 * Command message for {@link EmbeddedCommandName.LEAVE_ROOM} (no payload).
 * @category Communication
 */
export interface EmbeddedLeaveRoomCommand {
	command: EmbeddedCommandName.LEAVE_ROOM;
}

/**
 * Command message for {@link EmbeddedCommandName.KICK_PARTICIPANT}: the command name plus its payload,
 * derived from {@link EmbeddedCommandPayloadFor}.
 * @category Communication
 */
export interface EmbeddedKickParticipantCommand {
	command: EmbeddedCommandName.KICK_PARTICIPANT;
	payload: EmbeddedCommandPayloadFor<EmbeddedCommandName.KICK_PARTICIPANT>;
}

/**
 * Discriminated union of every command message the host can send to the embedded app; narrow on
 * `command`. In the iframe integration this is the object posted verbatim over `postMessage`.
 * @category Communication
 */
export type EmbeddedCommand =
	| EmbeddedEndMeetingCommand
	| EmbeddedLeaveRoomCommand
	| EmbeddedKickParticipantCommand;

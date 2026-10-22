export const enum DistributedEventType {
	/**
	 * Event emitted when a egress is active.
	 */
	RECORDING_ACTIVE = 'recording_active',
	WHITEBOARD_OPERATION = 'whiteboard_operation'
}

export interface DistributedEventPayload {
	eventType: DistributedEventType;
	payload: Record<string, unknown>;
}

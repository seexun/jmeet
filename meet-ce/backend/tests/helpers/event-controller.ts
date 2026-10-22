import { container } from '../../src/config/dependency-injector.config';
import { DistributedEventType } from '../../src/models/distributed-event.model';
import { DistributedEventService } from '../../src/services/distributed-event.service';

export const eventController = {
	systemEventService: undefined as unknown as DistributedEventService,
	pausedEvents: new Map<string, Array<{ eventType: string; payload: any }>>(),
	isInitialized: false,
	originalEmit: null as any,

	initialize() {
		if (this.isInitialized) return;

		this.systemEventService = container.get(DistributedEventService);
		this.originalEmit = this.systemEventService['emitter'].emit;
		this.pausedEvents.clear();
		this.isInitialized = true;

		// Replace the emit method to intercept events
		this.systemEventService['emitter'].emit = (eventType: string, payload: any) => {
			console.log(`Event intercepted: ${eventType}`, payload);

			// Check if the event is paused for the room
			if (
				eventType === DistributedEventType.RECORDING_ACTIVE &&
				payload?.roomId &&
				this.pausedEvents.has(payload.roomId)
			) {
				console.log(`🔴 Pausing event ${eventType} for room ${payload.roomId}`);

				// Save the event to the pausedEvents map
				this.pausedEvents.get(payload.roomId)?.push({ eventType, payload });
				return true;
			}

			return this.originalEmit.call(this.systemEventService['emitter'], eventType, payload);
		};
	},

	pauseEventsForRoom(roomId: string) {
		if (!this.isInitialized) this.initialize();

		console.log(`🟠 Setting up pause for events in room: ${roomId}`);
		this.pausedEvents.set(roomId, []);
	},

	releaseEventsForRoom(roomId: string) {
		const events = this.pausedEvents.get(roomId) || [];
		this.pausedEvents.delete(roomId);

		console.log(`🟢 Releasing ${events.length} events for room ${roomId}`);

		events.forEach(({ eventType, payload }) => {
			console.log(`   Releasing event: ${eventType}`, payload);
			this.originalEmit.call(this.systemEventService['emitter'], eventType, payload);
		});
	},

	releaseAllEvents() {
		for (const roomId of this.pausedEvents.keys()) {
			this.releaseEventsForRoom(roomId);
		}
	},

	reset() {
		if (!this.isInitialized) return;

		this.systemEventService['emitter'].emit = this.originalEmit;

		this.pausedEvents.clear();
		this.isInitialized = false;
	}
};

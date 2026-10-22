import 'livekit-client';

declare module 'livekit-client' {
	interface Room {
		on(event: unknown, listener: (...args: any[]) => void): this;
		removeAllListeners(event?: unknown): this;
	}

	interface LocalTrack {
		addListener(event: string, listener: (...args: any[]) => void): this;
	}

	interface LocalTrackPublication {
		addListener(event: string, listener: (...args: any[]) => void): this;
	}
}

import type {
	ConnectionState,
	DataPublishOptions,
	E2EEOptions,
	Room,
	RoomOptions
} from '../../livekit/livekit-sdk.service';

export type OVRoom = Room;
export type OVRoomOptions = RoomOptions;
export type OVDataPublishOptions = DataPublishOptions;
export type OVE2EEOptions = E2EEOptions;
export type OVConnectionState = typeof ConnectionState;

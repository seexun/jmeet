import type { OVRoom, OVRoomOptions } from './room.interface';
import type { OVCreateLocalTracksOptions, OVLocalTrack } from './track.interface';

export interface LivekitAdapterInterface {
	createRoom(roomOptions: OVRoomOptions): OVRoom;
	connectRoom(room: OVRoom, livekitUrl: string, livekitToken: string): Promise<void>;
	disconnectRoom(room: OVRoom): Promise<void>;
	createLocalTracks(options: OVCreateLocalTracksOptions): Promise<OVLocalTrack[]>;
	getLocalDevices(): Promise<MediaDeviceInfo[]>;
}

import { Injectable, inject } from '@angular/core';
import { LivekitSdkService } from '../../livekit/livekit-sdk.service';
import { LivekitAdapterInterface } from '../interfaces/livekit.adapter.interface';
import { OVRoom, OVRoomOptions } from '../interfaces/room.interface';
import { OVCreateLocalTracksOptions, OVLocalTrack } from '../interfaces/track.interface';

@Injectable({
	providedIn: 'root'
})
export class LiveKitSdkAdapter implements LivekitAdapterInterface {
	private readonly livekitSdkService = inject(LivekitSdkService);

	createRoom(roomOptions: OVRoomOptions): OVRoom {
		return this.livekitSdkService.createRoom(roomOptions);
	}

	connectRoom(room: OVRoom, livekitUrl: string, livekitToken: string): Promise<void> {
		return this.livekitSdkService.connectRoom(room, livekitUrl, livekitToken);
	}

	disconnectRoom(room: OVRoom): Promise<void> {
		return this.livekitSdkService.disconnectRoom(room);
	}

	createLocalTracks(options: OVCreateLocalTracksOptions): Promise<OVLocalTrack[]> {
		return this.livekitSdkService.createLocalTracks(options);
	}

	getLocalDevices(): Promise<MediaDeviceInfo[]> {
		return this.livekitSdkService.getLocalDevices();
	}
}

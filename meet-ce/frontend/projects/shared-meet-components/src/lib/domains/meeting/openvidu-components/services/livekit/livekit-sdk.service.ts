import { Injectable } from '@angular/core';
import type { SwitchBackgroundProcessorOptions } from '@livekit/track-processors';
import {
	AudioPresets,
	ConnectionQuality,
	ConnectionState,
	createKeyMaterialFromString,
	createLocalTracks,
	DataPacket_Kind,
	deriveKeys,
	DisconnectReason,
	ExternalE2EEKeyProvider,
	LocalAudioTrack,
	LocalParticipant,
	LocalTrack,
	LocalTrackPublication,
	LocalVideoTrack,
	Participant,
	RemoteParticipant,
	RemoteTrack,
	RemoteTrackPublication,
	Room,
	RoomEvent,
	Track,
	TrackPublication,
	VideoPresets
} from 'livekit-client';

import type {
	AudioCaptureOptions,
	CreateLocalTracksOptions,
	DataPublishOptions,
	E2EEOptions,
	RoomOptions,
	ScreenShareCaptureOptions,
	TextStreamReader,
	TrackPublishOptions,
	VideoCaptureOptions,
	VideoEncoding
} from 'livekit-client';

@Injectable({
	providedIn: 'root'
})
export class LivekitSdkService {
	createRoom(roomOptions: RoomOptions): Room {
		return new Room(roomOptions);
	}

	async connectRoom(room: Room, livekitUrl: string, livekitToken: string): Promise<void> {
		await room.connect(livekitUrl, livekitToken);
	}

	async disconnectRoom(room: Room): Promise<void> {
		await room.disconnect();
	}

	async createLocalTracks(options: CreateLocalTracksOptions): Promise<LocalTrack[]> {
		return createLocalTracks(options);
	}

	async getLocalDevices(): Promise<MediaDeviceInfo[]> {
		// requestPermissions=false: never let enumeration fire a throwaway getUserMedia({audio,video})
		// just to reveal device labels. Media permission is obtained by the real track creation
		// (prejoin / connect); labels become available on the subsequent enumeration. Probing here
		// would re-acquire the camera/microphone redundantly at startup.
		return Room.getLocalDevices(undefined, false);
	}
}

export {
	AudioCaptureOptions,
	AudioPresets,
	ConnectionQuality,
	ConnectionState,
	createKeyMaterialFromString,
	createLocalTracks,
	CreateLocalTracksOptions,
	DataPacket_Kind,
	DataPublishOptions,
	deriveKeys,
	DisconnectReason,
	E2EEOptions,
	ExternalE2EEKeyProvider,
	LocalAudioTrack,
	LocalParticipant,
	LocalTrack,
	LocalTrackPublication,
	LocalVideoTrack,
	Participant,
	RemoteParticipant,
	RemoteTrack,
	RemoteTrackPublication,
	Room,
	RoomEvent,
	RoomOptions,
	ScreenShareCaptureOptions,
	SwitchBackgroundProcessorOptions,
	TextStreamReader,
	Track,
	TrackPublication,
	TrackPublishOptions,
	VideoCaptureOptions,
	VideoEncoding,
	VideoPresets
};

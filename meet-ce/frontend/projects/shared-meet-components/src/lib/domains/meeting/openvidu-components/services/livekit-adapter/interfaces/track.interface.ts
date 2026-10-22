import type {
	AudioCaptureOptions,
	CreateLocalTracksOptions,
	LocalAudioTrack,
	LocalTrack,
	LocalTrackPublication,
	LocalVideoTrack,
	RemoteTrack,
	RemoteTrackPublication,
	ScreenShareCaptureOptions,
	TextStreamReader,
	Track,
	TrackPublication,
	TrackPublishOptions,
	VideoCaptureOptions,
	VideoPresets
} from '../../livekit/livekit-sdk.service';

export type OVTrack = Track;
export type OVTrackPublication = TrackPublication;
export type OVLocalTrack = LocalTrack;
export type OVLocalTrackPublication = LocalTrackPublication;
export type OVLocalVideoTrack = LocalVideoTrack;
export type OVLocalAudioTrack = LocalAudioTrack;
export type OVRemoteTrack = RemoteTrack;
export type OVRemoteTrackPublication = RemoteTrackPublication;

export type OVTrackPublishOptions = TrackPublishOptions;
export type OVScreenShareCaptureOptions = ScreenShareCaptureOptions;
export type OVVideoCaptureOptions = VideoCaptureOptions;
export type OVAudioCaptureOptions = AudioCaptureOptions;
export type OVCreateLocalTracksOptions = CreateLocalTracksOptions;
export type OVTextStreamReader = TextStreamReader;
export type OVVideoPresets = typeof VideoPresets;

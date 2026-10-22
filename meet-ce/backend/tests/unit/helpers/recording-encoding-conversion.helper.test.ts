import { describe, expect, it } from '@jest/globals';
import {
	MeetRecordingAudioCodec,
	MeetRecordingEncodingOptions,
	MeetRecordingEncodingPreset,
	MeetRecordingVideoCodec
} from '@openvidu-meet/typings';
import { AudioCodec, EncodingOptions, EncodingOptionsPreset, VideoCodec } from 'livekit-server-sdk';
import { EncodingConverter } from '../../../src/helpers/encoding-converter.helper';

// Helper to create complete encoding options with all required fields
const createCompleteEncodingOptions = (
	overrides?: Partial<{
		video: Partial<MeetRecordingEncodingOptions['video']>;
		audio: Partial<MeetRecordingEncodingOptions['audio']>;
	}>
): MeetRecordingEncodingOptions => ({
	video: {
		width: 1920,
		height: 1080,
		framerate: 30,
		codec: MeetRecordingVideoCodec.H264_MAIN,
		bitrate: 4500,
		keyFrameInterval: 2,
		depth: 24,
		...overrides?.video
	},
	audio: {
		codec: MeetRecordingAudioCodec.OPUS,
		bitrate: 128,
		frequency: 48000,
		...overrides?.audio
	}
});

describe('EncodingConverter - Encoding Options Conversion', () => {
	describe('toLivekit', () => {
		describe('Preset Conversion', () => {
			it('Should convert H264_720P_30 preset correctly', () => {
				const result = EncodingConverter.toLivekit(MeetRecordingEncodingPreset.H264_720P_30);

				expect(result).toBe(EncodingOptionsPreset.H264_720P_30);
			});

			it('Should convert H264_720P_60 preset correctly', () => {
				const result = EncodingConverter.toLivekit(MeetRecordingEncodingPreset.H264_720P_60);

				expect(result).toBe(EncodingOptionsPreset.H264_720P_60);
			});

			it('Should convert H264_1080P_30 preset correctly', () => {
				const result = EncodingConverter.toLivekit(MeetRecordingEncodingPreset.H264_1080P_30);

				expect(result).toBe(EncodingOptionsPreset.H264_1080P_30);
			});

			it('Should convert H264_1080P_60 preset correctly', () => {
				const result = EncodingConverter.toLivekit(MeetRecordingEncodingPreset.H264_1080P_60);

				expect(result).toBe(EncodingOptionsPreset.H264_1080P_60);
			});

			it('Should convert PORTRAIT_H264_720P_30 preset correctly', () => {
				const result = EncodingConverter.toLivekit(MeetRecordingEncodingPreset.PORTRAIT_H264_720P_30);

				expect(result).toBe(EncodingOptionsPreset.PORTRAIT_H264_720P_30);
			});

			it('Should convert PORTRAIT_H264_720P_60 preset correctly', () => {
				const result = EncodingConverter.toLivekit(MeetRecordingEncodingPreset.PORTRAIT_H264_720P_60);

				expect(result).toBe(EncodingOptionsPreset.PORTRAIT_H264_720P_60);
			});

			it('Should convert PORTRAIT_H264_1080P_30 preset correctly', () => {
				const result = EncodingConverter.toLivekit(MeetRecordingEncodingPreset.PORTRAIT_H264_1080P_30);

				expect(result).toBe(EncodingOptionsPreset.PORTRAIT_H264_1080P_30);
			});

			it('Should convert PORTRAIT_H264_1080P_60 preset correctly', () => {
				const result = EncodingConverter.toLivekit(MeetRecordingEncodingPreset.PORTRAIT_H264_1080P_60);

				expect(result).toBe(EncodingOptionsPreset.PORTRAIT_H264_1080P_60);
			});
		});

		describe('Advanced Options Conversion', () => {
			it('Should convert complete encoding options correctly', () => {
				const meetOptions = createCompleteEncodingOptions();

				const result = EncodingConverter.toLivekit(meetOptions) as EncodingOptions;

				expect(result).toBeInstanceOf(EncodingOptions);
				expect(result.width).toBe(1920);
				expect(result.height).toBe(1080);
				expect(result.framerate).toBe(30);
				expect(result.videoCodec).toBe(VideoCodec.H264_MAIN);
				expect(result.videoBitrate).toBe(4500);
				expect(result.keyFrameInterval).toBe(2);
				expect(result.audioCodec).toBe(AudioCodec.OPUS);
				expect(result.audioBitrate).toBe(128);
				expect(result.audioFrequency).toBe(48000);
			});

			it('Should convert options with different video codec correctly', () => {
				const meetOptions = createCompleteEncodingOptions({
					video: { codec: MeetRecordingVideoCodec.VP8 }
				});

				const result = EncodingConverter.toLivekit(meetOptions) as EncodingOptions;

				expect(result.videoCodec).toBe(VideoCodec.VP8);
			});

			it('Should convert options with different audio codec correctly', () => {
				const meetOptions = createCompleteEncodingOptions({
					audio: { codec: MeetRecordingAudioCodec.AAC }
				});

				const result = EncodingConverter.toLivekit(meetOptions) as EncodingOptions;

				expect(result.audioCodec).toBe(AudioCodec.AAC);
			});

			it('Should convert options with different video dimensions correctly', () => {
				const meetOptions = createCompleteEncodingOptions({
					video: { width: 1280, height: 720, framerate: 60, bitrate: 3000 }
				});

				const result = EncodingConverter.toLivekit(meetOptions) as EncodingOptions;

				expect(result.width).toBe(1280);
				expect(result.height).toBe(720);
				expect(result.framerate).toBe(60);
				expect(result.videoBitrate).toBe(3000);
			});

			it('Should convert options with different audio settings correctly', () => {
				const meetOptions = createCompleteEncodingOptions({
					audio: { bitrate: 96, frequency: 44100 }
				});

				const result = EncodingConverter.toLivekit(meetOptions) as EncodingOptions;

				expect(result.audioBitrate).toBe(96);
				expect(result.audioFrequency).toBe(44100);
			});

			it('Should convert options with different keyFrameInterval correctly', () => {
				const meetOptions = createCompleteEncodingOptions({
					video: { keyFrameInterval: 4.5 }
				});

				const result = EncodingConverter.toLivekit(meetOptions) as EncodingOptions;

				expect(result.keyFrameInterval).toBe(4.5);
			});

			it('Should convert options with keyFrameInterval = 0 correctly', () => {
				const meetOptions = createCompleteEncodingOptions({
					video: { keyFrameInterval: 0 }
				});

				const result = EncodingConverter.toLivekit(meetOptions) as EncodingOptions;

				expect(result.keyFrameInterval).toBe(0);
			});

			it('Should convert all video codecs correctly', () => {
				const codecs: MeetRecordingVideoCodec[] = [
					MeetRecordingVideoCodec.H264_BASELINE,
					MeetRecordingVideoCodec.H264_MAIN,
					MeetRecordingVideoCodec.H264_HIGH,
					MeetRecordingVideoCodec.VP8
				];

				const expectedLivekitCodecs: VideoCodec[] = [
					VideoCodec.H264_BASELINE,
					VideoCodec.H264_MAIN,
					VideoCodec.H264_HIGH,
					VideoCodec.VP8
				];

				codecs.forEach((codec, index) => {
					const meetOptions = createCompleteEncodingOptions({
						video: { codec }
					});

					const result = EncodingConverter.toLivekit(meetOptions) as EncodingOptions;

					expect(result.videoCodec).toBe(expectedLivekitCodecs[index]);
				});
			});

			it('Should convert all audio codecs correctly', () => {
				const codecs: MeetRecordingAudioCodec[] = [MeetRecordingAudioCodec.OPUS, MeetRecordingAudioCodec.AAC];

				const expectedLivekitCodecs: AudioCodec[] = [AudioCodec.OPUS, AudioCodec.AAC];

				codecs.forEach((codec, index) => {
					const meetOptions = createCompleteEncodingOptions({
						audio: { codec }
					});

					const result = EncodingConverter.toLivekit(meetOptions) as EncodingOptions;

					expect(result.audioCodec).toBe(expectedLivekitCodecs[index]);
				});
			});

			it('Should bidirectionally convert keyFrameInterval correctly', () => {
				// Meet -> LiveKit
				const meetOptions = createCompleteEncodingOptions({
					video: { keyFrameInterval: 2.5 }
				});

				const livekitOptions = EncodingConverter.toLivekit(meetOptions) as EncodingOptions;
				expect(livekitOptions.keyFrameInterval).toBe(2.5);

				// LiveKit -> Meet (round trip)
				const convertedBack = EncodingConverter.fromLivekit(livekitOptions) as MeetRecordingEncodingOptions;
				expect(convertedBack.video.keyFrameInterval).toBe(2.5);
			});

			it('Should convert depth correctly', () => {
				const meetOptions = createCompleteEncodingOptions({
					video: { depth: 32 }
				});

				const result = EncodingConverter.toLivekit(meetOptions) as EncodingOptions;

				expect(result.depth).toBe(32);
			});

			it('Should bidirectionally convert depth correctly', () => {
				// Meet -> LiveKit
				const meetOptions = createCompleteEncodingOptions({
					video: { depth: 16 }
				});

				const livekitOptions = EncodingConverter.toLivekit(meetOptions) as EncodingOptions;
				expect(livekitOptions.depth).toBe(16);

				// LiveKit -> Meet (round trip)
				const convertedBack = EncodingConverter.fromLivekit(livekitOptions) as MeetRecordingEncodingOptions;
				expect(convertedBack.video.depth).toBe(16);
			});
		});

		describe('Edge Cases', () => {
			it('Should return undefined when encoding options is undefined', () => {
				const result = EncodingConverter.toLivekit(undefined);

				expect(result).toBeUndefined();
			});
		});
	});

	describe('fromLivekit', () => {
		describe('Preset Conversion from LiveKit', () => {
			it('Should convert H264_720P_30 preset from LiveKit correctly', () => {
				const result = EncodingConverter.fromLivekit(EncodingOptionsPreset.H264_720P_30);

				expect(result).toBe(MeetRecordingEncodingPreset.H264_720P_30);
			});

			it('Should convert H264_720P_60 preset from LiveKit correctly', () => {
				const result = EncodingConverter.fromLivekit(EncodingOptionsPreset.H264_720P_60);

				expect(result).toBe(MeetRecordingEncodingPreset.H264_720P_60);
			});

			it('Should convert H264_1080P_30 preset from LiveKit correctly', () => {
				const result = EncodingConverter.fromLivekit(EncodingOptionsPreset.H264_1080P_30);

				expect(result).toBe(MeetRecordingEncodingPreset.H264_1080P_30);
			});

			it('Should convert H264_1080P_60 preset from LiveKit correctly', () => {
				const result = EncodingConverter.fromLivekit(EncodingOptionsPreset.H264_1080P_60);

				expect(result).toBe(MeetRecordingEncodingPreset.H264_1080P_60);
			});

			it('Should convert PORTRAIT_H264_720P_30 preset from LiveKit correctly', () => {
				const result = EncodingConverter.fromLivekit(EncodingOptionsPreset.PORTRAIT_H264_720P_30);

				expect(result).toBe(MeetRecordingEncodingPreset.PORTRAIT_H264_720P_30);
			});

			it('Should convert PORTRAIT_H264_720P_60 preset from LiveKit correctly', () => {
				const result = EncodingConverter.fromLivekit(EncodingOptionsPreset.PORTRAIT_H264_720P_60);

				expect(result).toBe(MeetRecordingEncodingPreset.PORTRAIT_H264_720P_60);
			});

			it('Should convert PORTRAIT_H264_1080P_30 preset from LiveKit correctly', () => {
				const result = EncodingConverter.fromLivekit(EncodingOptionsPreset.PORTRAIT_H264_1080P_30);

				expect(result).toBe(MeetRecordingEncodingPreset.PORTRAIT_H264_1080P_30);
			});

			it('Should convert PORTRAIT_H264_1080P_60 preset from LiveKit correctly', () => {
				const result = EncodingConverter.fromLivekit(EncodingOptionsPreset.PORTRAIT_H264_1080P_60);

				expect(result).toBe(MeetRecordingEncodingPreset.PORTRAIT_H264_1080P_60);
			});

			it('Should return default preset for unknown LiveKit preset', () => {
				const unknownPreset = 999 as EncodingOptionsPreset;
				const result = EncodingConverter.fromLivekit(unknownPreset);

				expect(result).toBe(MeetRecordingEncodingPreset.H264_720P_30);
			});
		});

		describe('Advanced Options Conversion from LiveKit', () => {
			it('Should convert complete LiveKit options correctly', () => {
				const lkOptions = new EncodingOptions();
				lkOptions.width = 1920;
				lkOptions.height = 1080;
				lkOptions.framerate = 30;
				lkOptions.videoCodec = VideoCodec.H264_MAIN;
				lkOptions.videoBitrate = 4500;
				lkOptions.keyFrameInterval = 2;
				lkOptions.audioCodec = AudioCodec.OPUS;
				lkOptions.audioBitrate = 128;
				lkOptions.audioFrequency = 48000;

				const result = EncodingConverter.fromLivekit(lkOptions) as MeetRecordingEncodingOptions;

				// Both video and audio should be defined with all properties
				expect(result.video).toBeDefined();
				expect(result.video.width).toBe(1920);
				expect(result.video.height).toBe(1080);
				expect(result.video.framerate).toBe(30);
				expect(result.video.codec).toBe(MeetRecordingVideoCodec.H264_MAIN);
				expect(result.video.bitrate).toBe(4500);
				expect(result.video.keyFrameInterval).toBe(2);

				expect(result.audio).toBeDefined();
				expect(result.audio.codec).toBe(MeetRecordingAudioCodec.OPUS);
				expect(result.audio.bitrate).toBe(128);
				expect(result.audio.frequency).toBe(48000);
			});

			it('Should always include keyFrameInterval even when 0 (LiveKit default)', () => {
				const lkOptions = new EncodingOptions();
				// LiveKit initializes keyFrameInterval to 0 by default
				lkOptions.width = 1920;
				lkOptions.height = 1080;
				lkOptions.framerate = 30;
				lkOptions.videoCodec = VideoCodec.H264_MAIN;
				lkOptions.videoBitrate = 4500;
				lkOptions.audioCodec = AudioCodec.OPUS;
				lkOptions.audioBitrate = 128;
				lkOptions.audioFrequency = 48000;

				const result = EncodingConverter.fromLivekit(lkOptions) as MeetRecordingEncodingOptions;

				expect(result.video).toBeDefined();
				expect(result.video.keyFrameInterval).toBe(4);
			});

			it('Should use default depth of 24 when LiveKit does not provide depth', () => {
				const lkOptions = new EncodingOptions();
				lkOptions.width = 1920;
				lkOptions.height = 1080;
				lkOptions.framerate = 30;
				lkOptions.videoCodec = VideoCodec.H264_MAIN;
				lkOptions.videoBitrate = 4500;
				lkOptions.audioCodec = AudioCodec.OPUS;
				lkOptions.audioBitrate = 128;
				lkOptions.audioFrequency = 48000;
				// depth is not set in LiveKit

				const result = EncodingConverter.fromLivekit(lkOptions) as MeetRecordingEncodingOptions;

				expect(result.video).toBeDefined();
				expect(result.video.depth).toBe(24); // Default value
			});

			it('Should preserve depth value from LiveKit when provided', () => {
				const lkOptions = new EncodingOptions();
				lkOptions.width = 1920;
				lkOptions.height = 1080;
				lkOptions.framerate = 30;
				lkOptions.videoCodec = VideoCodec.H264_MAIN;
				lkOptions.videoBitrate = 4500;
				lkOptions.depth = 32; // Custom depth
				lkOptions.audioCodec = AudioCodec.OPUS;
				lkOptions.audioBitrate = 128;
				lkOptions.audioFrequency = 48000;

				const result = EncodingConverter.fromLivekit(lkOptions) as MeetRecordingEncodingOptions;

				expect(result.video).toBeDefined();
				expect(result.video.depth).toBe(32); // Preserved from LiveKit
			});

			it('Should convert LiveKit options with VP8 codec correctly', () => {
				const lkOptions = new EncodingOptions();
				lkOptions.width = 1280;
				lkOptions.height = 720;
				lkOptions.framerate = 60;
				lkOptions.videoCodec = VideoCodec.VP8;
				lkOptions.videoBitrate = 3000;
				lkOptions.keyFrameInterval = 4;
				lkOptions.audioCodec = AudioCodec.AAC;
				lkOptions.audioBitrate = 96;
				lkOptions.audioFrequency = 44100;

				const result = EncodingConverter.fromLivekit(lkOptions) as MeetRecordingEncodingOptions;

				expect(result.video.codec).toBe(MeetRecordingVideoCodec.VP8);
				expect(result.audio.codec).toBe(MeetRecordingAudioCodec.AAC);
			});

			it('Should handle LiveKit EncodingOptions with default initialization', () => {
				// LiveKit's EncodingOptions constructor sets default codecs
				const lkOptions = new EncodingOptions();

				const result = EncodingConverter.fromLivekit(lkOptions) as MeetRecordingEncodingOptions;

				// EncodingOptions has default codecs (H264_MAIN and OPUS)
				expect(result.video).toBeDefined();
				expect(result.video.codec).toBe(MeetRecordingVideoCodec.H264_MAIN);
				expect(result.video.width).toBe(1920);
				expect(result.video.height).toBe(1080);
				expect(result.video.framerate).toBe(30);
				expect(result.video.bitrate).toBe(128);
				expect(result.video.keyFrameInterval).toBe(4);
				expect(result.video.depth).toBe(24); // Default value

				expect(result.audio).toBeDefined();
				expect(result.audio.codec).toBe(MeetRecordingAudioCodec.OPUS);
				expect(result.audio.bitrate).toBe(128);
				expect(result.audio.frequency).toBe(44100);
			});

			it('Should convert all video codecs from LiveKit correctly', () => {
				const codecs: VideoCodec[] = [
					VideoCodec.H264_BASELINE,
					VideoCodec.H264_MAIN,
					VideoCodec.H264_HIGH,
					VideoCodec.VP8
				];

				const expectedMeetCodecs: MeetRecordingVideoCodec[] = [
					MeetRecordingVideoCodec.H264_BASELINE,
					MeetRecordingVideoCodec.H264_MAIN,
					MeetRecordingVideoCodec.H264_HIGH,
					MeetRecordingVideoCodec.VP8
				];

				codecs.forEach((codec, index) => {
					const lkOptions = new EncodingOptions();
					lkOptions.videoCodec = codec;

					const result = EncodingConverter.fromLivekit(lkOptions) as MeetRecordingEncodingOptions;

					expect(result.video.codec).toBe(expectedMeetCodecs[index]);
				});
			});

			it('Should convert all audio codecs from LiveKit correctly', () => {
				const codecs: AudioCodec[] = [AudioCodec.OPUS, AudioCodec.AAC];

				const expectedMeetCodecs: MeetRecordingAudioCodec[] = [
					MeetRecordingAudioCodec.OPUS,
					MeetRecordingAudioCodec.AAC
				];

				codecs.forEach((codec, index) => {
					const lkOptions = new EncodingOptions();
					lkOptions.audioCodec = codec;

					const result = EncodingConverter.fromLivekit(lkOptions) as MeetRecordingEncodingOptions;

					expect(result.audio.codec).toBe(expectedMeetCodecs[index]);
				});
			});

			it('Should return default codec for unknown LiveKit video codec', () => {
				const lkOptions = new EncodingOptions();
				lkOptions.videoCodec = 999 as VideoCodec;

				const result = EncodingConverter.fromLivekit(lkOptions) as MeetRecordingEncodingOptions;

				expect(result.video.codec).toBe(MeetRecordingVideoCodec.H264_MAIN);
			});

			it('Should return default codec for unknown LiveKit audio codec', () => {
				const lkOptions = new EncodingOptions();
				lkOptions.audioCodec = 999 as AudioCodec;

				const result = EncodingConverter.fromLivekit(lkOptions) as MeetRecordingEncodingOptions;

				expect(result.audio.codec).toBe(MeetRecordingAudioCodec.OPUS);
			});

			it('Should preserve all values in round-trip conversion', () => {
				const originalMeetOptions = createCompleteEncodingOptions({
					video: {
						width: 1280,
						height: 720,
						framerate: 60,
						codec: MeetRecordingVideoCodec.VP8,
						bitrate: 3000,
						keyFrameInterval: 4.5
					},
					audio: {
						codec: MeetRecordingAudioCodec.AAC,
						bitrate: 96,
						frequency: 44100
					}
				});

				// Meet -> LiveKit
				const livekitOptions = EncodingConverter.toLivekit(originalMeetOptions) as EncodingOptions;

				// LiveKit -> Meet
				const convertedBack = EncodingConverter.fromLivekit(livekitOptions) as MeetRecordingEncodingOptions;

				// Verify all values are preserved
				expect(convertedBack.video.width).toBe(1280);
				expect(convertedBack.video.height).toBe(720);
				expect(convertedBack.video.framerate).toBe(60);
				expect(convertedBack.video.codec).toBe(MeetRecordingVideoCodec.VP8);
				expect(convertedBack.video.bitrate).toBe(3000);
				expect(convertedBack.video.keyFrameInterval).toBe(4.5);
				expect(convertedBack.video.depth).toBe(24); // Default value from helper
				expect(convertedBack.audio.codec).toBe(MeetRecordingAudioCodec.AAC);
				expect(convertedBack.audio.bitrate).toBe(96);
				expect(convertedBack.audio.frequency).toBe(44100);
			});
		});

		describe('Edge Cases from LiveKit', () => {
			it('Should return default preset when undefined', () => {
				const result = EncodingConverter.fromLivekit(undefined);

				expect(result).toBe(MeetRecordingEncodingPreset.H264_720P_30);
			});
		});
	});
});

import type {
	MeetRecordingEncodingOptions} from '@openvidu-meet/typings';
import {
	MeetRecordingAudioCodec,
	MeetRecordingEncodingPreset,
	MeetRecordingVideoCodec
} from '@openvidu-meet/typings';
import { AudioCodec, EncodingOptions, EncodingOptionsPreset, VideoCodec } from 'livekit-server-sdk';

/**
 * Helper class for converting encoding configurations between JMeet and LiveKit formats.
 * Provides bidirectional conversion for presets, codecs, and advanced encoding options.
 */
export class EncodingConverter {
	private constructor() {
		// Prevent instantiation of this utility class
	}

	// Bidirectional mappings for encoding conversions
	private static readonly PRESET_MAP = new Map<MeetRecordingEncodingPreset, EncodingOptionsPreset>([
		[MeetRecordingEncodingPreset.H264_720P_30, EncodingOptionsPreset.H264_720P_30],
		[MeetRecordingEncodingPreset.H264_720P_60, EncodingOptionsPreset.H264_720P_60],
		[MeetRecordingEncodingPreset.H264_1080P_30, EncodingOptionsPreset.H264_1080P_30],
		[MeetRecordingEncodingPreset.H264_1080P_60, EncodingOptionsPreset.H264_1080P_60],
		[MeetRecordingEncodingPreset.PORTRAIT_H264_720P_30, EncodingOptionsPreset.PORTRAIT_H264_720P_30],
		[MeetRecordingEncodingPreset.PORTRAIT_H264_720P_60, EncodingOptionsPreset.PORTRAIT_H264_720P_60],
		[MeetRecordingEncodingPreset.PORTRAIT_H264_1080P_30, EncodingOptionsPreset.PORTRAIT_H264_1080P_30],
		[MeetRecordingEncodingPreset.PORTRAIT_H264_1080P_60, EncodingOptionsPreset.PORTRAIT_H264_1080P_60]
	]);

	private static readonly VIDEO_CODEC_MAP = new Map<MeetRecordingVideoCodec, VideoCodec>([
		[MeetRecordingVideoCodec.H264_BASELINE, VideoCodec.H264_BASELINE],
		[MeetRecordingVideoCodec.H264_MAIN, VideoCodec.H264_MAIN],
		[MeetRecordingVideoCodec.H264_HIGH, VideoCodec.H264_HIGH],
		[MeetRecordingVideoCodec.VP8, VideoCodec.VP8]
	]);

	private static readonly AUDIO_CODEC_MAP = new Map<MeetRecordingAudioCodec, AudioCodec>([
		[MeetRecordingAudioCodec.OPUS, AudioCodec.OPUS],
		[MeetRecordingAudioCodec.AAC, AudioCodec.AAC]
	]);

	/**
	 * Converts JMeet encoding options to LiveKit encoding options.
	 * Used when starting a recording to translate from Meet format to LiveKit SDK format.
	 *
	 * @param encoding - The encoding configuration in JMeet format
	 * @returns The encoding options in LiveKit format (preset or advanced)
	 */
	static toLivekit(
		encoding: MeetRecordingEncodingPreset | MeetRecordingEncodingOptions | undefined
	): EncodingOptions | EncodingOptionsPreset | undefined {
		if (!encoding) return undefined;

		// If it's a preset string
		if (typeof encoding === 'string') {
			return this.convertPresetToLivekit(encoding);
		}

		// It's advanced encoding options
		return this.convertAdvancedOptionsToLivekit(encoding);
	}

	/**
	 * Converts LiveKit encoding options back to JMeet format.
	 * Used when receiving webhook information about a recording.
	 *
	 * @param encodingOptions - The encoding options from LiveKit
	 * @returns The encoding configuration in JMeet format
	 */
	static fromLivekit(
		encodingOptions: EncodingOptions | EncodingOptionsPreset | undefined
	): MeetRecordingEncodingPreset | MeetRecordingEncodingOptions | undefined {
		// When undefined, recording is using default preset but EgressInfo does not specify it.
		// Return default preset.
		if (encodingOptions === undefined) return MeetRecordingEncodingPreset.H264_720P_30;

		// If it's a preset (number enum from LiveKit)
		if (typeof encodingOptions === 'number') {
			return this.convertPresetFromLivekit(encodingOptions);
		}

		// It's an EncodingOptions object
		return this.convertAdvancedOptionsFromLivekit(encodingOptions);
	}

	/**
	 * Converts JMeet encoding preset to LiveKit preset.
	 */
	private static convertPresetToLivekit(preset: MeetRecordingEncodingPreset): EncodingOptionsPreset {
		return this.PRESET_MAP.get(preset) ?? EncodingOptionsPreset.H264_720P_30;
	}

	/**
	 * Converts LiveKit encoding preset to JMeet preset.
	 */
	private static convertPresetFromLivekit(preset: EncodingOptionsPreset): MeetRecordingEncodingPreset {
		for (const [meetPreset, lkPreset] of this.PRESET_MAP) {
			if (lkPreset === preset) return meetPreset;
		}

		return MeetRecordingEncodingPreset.H264_720P_30;
	}

	/**
	 * Converts JMeet advanced encoding options to LiveKit EncodingOptions.
	 */
	private static convertAdvancedOptionsToLivekit(options: MeetRecordingEncodingOptions): EncodingOptions {
		const encodingOptions = new EncodingOptions();
		const { video, audio } = options;

		if (video) {
			Object.assign(encodingOptions, {
				width: video.width,
				height: video.height,
				framerate: video.framerate,
				videoBitrate: video.bitrate,
				videoCodec: this.convertVideoCodecToLivekit(video.codec),
				keyFrameInterval: video.keyFrameInterval,
				depth: video.depth
			});
		}

		if (audio) {
			Object.assign(encodingOptions, {
				audioBitrate: audio.bitrate,
				audioFrequency: audio.frequency,
				audioCodec: this.convertAudioCodecToLivekit(audio.codec)
			});
		}

		return encodingOptions;
	}

	/**
	 * Converts LiveKit EncodingOptions to JMeet advanced encoding options.
	 */
	private static convertAdvancedOptionsFromLivekit(options: EncodingOptions): MeetRecordingEncodingOptions {
		// In Meet, both video and audio are required with all their properties
		return {
			video: {
				width: options.width || 1920,
				height: options.height || 1080,
				framerate: options.framerate || 30,
				codec: this.convertVideoCodecFromLivekit(options.videoCodec),
				bitrate: options.videoBitrate || 128,
				keyFrameInterval: options.keyFrameInterval || 4,
				depth: options.depth || 24 // Use 24 as default when LiveKit returns 0 or undefined
			},
			audio: {
				codec: this.convertAudioCodecFromLivekit(options.audioCodec),
				bitrate: options.audioBitrate || 128,
				frequency: options.audioFrequency || 44100
			}
		};
	}

	/**
	 * Converts JMeet video codec to LiveKit video codec.
	 */
	private static convertVideoCodecToLivekit(codec: MeetRecordingVideoCodec): VideoCodec {
		return this.VIDEO_CODEC_MAP.get(codec) ?? VideoCodec.H264_MAIN;
	}

	/**
	 * Converts LiveKit video codec to JMeet video codec.
	 */
	private static convertVideoCodecFromLivekit(codec: VideoCodec): MeetRecordingVideoCodec {
		for (const [meetCodec, lkCodec] of this.VIDEO_CODEC_MAP) {
			if (lkCodec === codec) return meetCodec;
		}

		return MeetRecordingVideoCodec.H264_MAIN;
	}

	/**
	 * Converts JMeet audio codec to LiveKit audio codec.
	 */
	private static convertAudioCodecToLivekit(codec: MeetRecordingAudioCodec): AudioCodec {
		return this.AUDIO_CODEC_MAP.get(codec) ?? AudioCodec.OPUS;
	}

	/**
	 * Converts LiveKit audio codec to JMeet audio codec.
	 */
	private static convertAudioCodecFromLivekit(codec: AudioCodec): MeetRecordingAudioCodec {
		for (const [meetCodec, lkCodec] of this.AUDIO_CODEC_MAP) {
			if (lkCodec === codec) return meetCodec;
		}

		return MeetRecordingAudioCodec.OPUS;
	}
}

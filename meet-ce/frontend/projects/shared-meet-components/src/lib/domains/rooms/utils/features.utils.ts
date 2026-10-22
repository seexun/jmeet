import {
	MeetAppearanceConfig,
	MeetRoomCaptionsConfig,
	MeetRoomConfig,
	MeetRoomMemberPermissions
} from '@openvidu-meet/typings';
import { CaptionsStatus, RoomFeatures } from '../models/features.model';

/**
 * Utility class responsible for calculating the enabled features in the meeting based on room configuration, participant permissions, and global appearance settings.
 * This class provides static methods to apply different layers of configuration to derive the final set of features that should be available in the UI.
 */
export class FeatureCalculator {
	static applyRoomConfig(features: RoomFeatures, roomConfig: MeetRoomConfig, captionsGlobalEnabled: boolean): void {
		features.showStartStopRecording = roomConfig.recording.enabled;
		features.showChat = roomConfig.chat.enabled;
		features.showBackgrounds = roomConfig.virtualBackground.enabled;
		const captionsStatus = this.computeCaptionsStatus(roomConfig.captions, captionsGlobalEnabled);
		features.showCaptionsControls = captionsStatus !== 'HIDDEN';
		features.showCaptionsControlsDisabled = captionsStatus === 'DISABLED_WITH_WARNING';
	}

	static applyPermissions(features: RoomFeatures, permissions: MeetRoomMemberPermissions): void {
		// Recording
		if (features.showStartStopRecording) {
			features.showStartStopRecording = permissions.canRecord;
		}
		// Chat
		if (features.showChat) {
			features.showChat = permissions.canReadChat;
			// TODO: Handle canWriteChat permissions
			// features.showChatInput = permissions.canWriteChat;
		}
		// Backgrounds
		if (features.showBackgrounds) {
			features.showBackgrounds = permissions.canChangeVirtualBackground;
		}
		// Media features
		features.videoEnabled = permissions.canPublishVideo;
		features.showCamera = permissions.canPublishVideo;
		features.audioEnabled = permissions.canPublishAudio;
		features.showMicrophone = permissions.canPublishAudio;
		features.showScreenShare = permissions.canShareScreen;
		features.showShareAccessLinks = permissions.canShareAccessLinks;
		features.showMakeModerator = permissions.canMakeModerator;
		features.showEndMeeting = permissions.canEndMeeting;
		features.showKickParticipants = permissions.canKickParticipants;
		features.showViewRecordings = permissions.canRetrieveRecordings;
		features.showJoinMeeting = permissions.canJoinMeeting;
	}

	static applyAppearanceConfig(features: RoomFeatures, appearanceConfig: MeetAppearanceConfig): void {
		if (appearanceConfig?.themes.length > 0 && appearanceConfig.themes[0].enabled) {
			features.showThemeSelector = false;
		}
	}

	/**
	 * Computes the captions status based on room and global configuration
	 * HIDDEN: room config disabled
	 * ENABLED: room config enabled AND global config enabled
	 * DISABLED_WITH_WARNING: room config enabled BUT global config disabled
	 */
	protected static computeCaptionsStatus(
		roomCaptionsConfig: MeetRoomCaptionsConfig,
		globalEnabled: boolean
	): CaptionsStatus {
		if (!roomCaptionsConfig.enabled) {
			return 'HIDDEN';
		}
		return globalEnabled ? 'ENABLED' : 'DISABLED_WITH_WARNING';
	}
}

import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { MeetAppearanceConfig, MeetRoomConfig, MeetRoomMemberPermissions } from '@openvidu-meet/typings';
import { GlobalConfigService } from '../../../shared/services/global-config.service';
import { RuntimeConfigService } from '../../../shared/services/runtime-config.service';
import { ILogger, LoggerService } from '../../meeting/openvidu-components';
import { RoomMemberContextService } from '../../room-members/services/room-member-context.service';
import { RoomFeatures } from '../models/features.model';
import { FeatureCalculator } from '../utils/features.utils';

/**
 * Base configuration for features, used as a starting point before applying room-specific and user-specific configurations.
 * 录制与字幕为开源版不可用能力（企业版提供），默认关闭。
 */
const DEFAULT_FEATURES: RoomFeatures = {
	videoEnabled: true,
	audioEnabled: true,
	showCamera: true,
	showMicrophone: true,
	showScreenShare: true,
	showStartStopRecording: false,
	showViewRecordings: false,
	showFullscreen: true,
	showBackgrounds: true,
	showCaptionsControls: false,
	showCaptionsControlsDisabled: true,
	showChat: true,
	showParticipantList: true,
	showSettings: true,
	showThemeSelector: true,
	showLayoutSelector: true,
	showShareAccessLinks: false,
	showEndMeeting: false,
	showMakeModerator: false,
	showKickParticipants: false,
	showJoinMeeting: true
};

/**
 * Service responsible for calculating and providing the current set of enabled features in the meeting
 * based on room configuration, user permissions, and global settings.
 * This service acts as a single source of truth for feature availability across the app.
 */
@Injectable({
	providedIn: 'root'
})
export class RoomFeatureService {
	protected log: ILogger = inject(LoggerService).get('JMeet - RoomFeatureService');
	protected globalConfigService = inject(GlobalConfigService);
	protected roomMemberContextService = inject(RoomMemberContextService);
	private readonly runtimeConfigService = inject(RuntimeConfigService);

	// Signals to handle reactive state
	protected roomConfig = signal<MeetRoomConfig | undefined>(undefined);
	readonly currentRoomConfig = this.roomConfig.asReadonly();
	permissions = this.roomMemberContextService.permissions;

	// Computed signal to derive features based on current configurations
	public readonly features = computed<RoomFeatures>(() =>
		this.calculateFeatures(
			this.roomConfig(),
			this.permissions(),
			this.globalConfigService.roomAppearanceConfig()
		)
	);

	/**
	 * Loads global feature configuration once the service is ready for requests.
	 * This ensures HTTP requests don't fire with an empty URL (race condition in webcomponent mode).
	 */
	private readonly loadConfigEffect = effect(() => {
		if (this.runtimeConfigService.isReadyForRequests()) {
			untracked(() => {
				void this.loadGlobalFeatureConfigs();
			});
		}
	});

	/**
	 * Updates room config
	 */
	setRoomConfig(config: MeetRoomConfig): void {
		this.log.d('Updating room config', config);
		this.roomConfig.set(config);
	}

	protected async loadGlobalFeatureConfigs(): Promise<void> {
		try {
			await this.globalConfigService.loadRoomsAppearanceConfig();
		} catch (reason) {
			this.log.e('Could not load room appearance config for features:', reason);
		}
	}

	/**
	 * Core logic to calculate features based on all configurations
	 */
	protected calculateFeatures(
		roomConfig?: MeetRoomConfig,
		permissions?: MeetRoomMemberPermissions,
		appearanceConfig?: MeetAppearanceConfig
	): RoomFeatures {
		const features = structuredClone(DEFAULT_FEATURES);

		if (roomConfig) {
			// captionsGlobalEnabled 恒为 false：开源版不提供字幕能力
			FeatureCalculator.applyRoomConfig(features, roomConfig, false);
		}

		if (permissions) {
			FeatureCalculator.applyPermissions(features, permissions);
		}

		if (appearanceConfig) {
			FeatureCalculator.applyAppearanceConfig(features, appearanceConfig);
		}

		this.log.d('Calculated features', features);
		return features;
	}

	/**
	 * Resets all configurations to their initial values
	 */
	reset(): void {
		this.roomConfig.set(undefined);
	}
}

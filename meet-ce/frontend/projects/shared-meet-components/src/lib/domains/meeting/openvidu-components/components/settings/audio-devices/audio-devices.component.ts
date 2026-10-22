import { FormsModule } from '@angular/forms';
import { ChangeDetectionStrategy, Component, OnInit, Signal, WritableSignal, effect, inject, input, output } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzIconTypePipe } from '../../../../../../shared/pipes/nz-icon-type.pipe';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { CustomDevice } from '../../../models/device.model';
import { ILogger } from '../../../models/logger.model';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { DeviceService } from '../../../services/device/device.service';
import { LoggerService } from '../../../services/logger/logger.service';
import { ParticipantService } from '../../../services/participant/participant.service';
import { StorageService } from '../../../services/storage/storage.service';
import { AudioNoiseSuppressionService } from '../../../services/track-processor/audio-noise-suppression.service';

/**
 * @internal
 */
@Component({
	selector: 'ov-audio-devices-select',
	imports: [FormsModule, NzIconModule, NzIconTypePipe, NzDropDownModule, NzSwitchModule, NzTooltipModule, NzSelectModule, TranslatePipe, NzMenuModule],
	templateUrl: './audio-devices.component.html',
	styleUrl: './audio-devices.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true
})
export class AudioDevicesComponent implements OnInit {
	readonly compact = input(false);
	readonly onAudioDeviceChanged = output<CustomDevice>();
	readonly onAudioEnabledChanged = output<boolean>();

	microphoneStatusChanging: boolean = false;
	isMicrophoneEnabled: boolean = false;
	aiNoiseSuppressionEnabled = false;
	musicModeEnabled = false;
	musicModePending = false;
	private log: ILogger = {
		d: () => {},
		v: () => {},
		w: () => {},
		e: () => {}
	};

	// Expose signals directly from service (reactive)
	protected readonly microphones: WritableSignal<CustomDevice[]>;
	protected readonly microphoneSelected: WritableSignal<CustomDevice | undefined>;
	protected readonly hasAudioDevices: Signal<boolean>;

	private readonly deviceSrv = inject(DeviceService);
	private readonly storageSrv = inject(StorageService);
	private readonly participantService = inject(ParticipantService);
	private readonly loggerSrv = inject(LoggerService);
	protected readonly noiseSuppression = inject(AudioNoiseSuppressionService);

	constructor() {
		this.log = this.loggerSrv.get('AudioDevicesComponent');
		this.microphones = this.deviceSrv.microphones;
		this.microphoneSelected = this.deviceSrv.microphoneSelected;
		this.hasAudioDevices = this.deviceSrv.hasAudioDevices;

		// Use effect instead of subscription for reactive updates
		effect(() => {
			const participant = this.participantService.localParticipant();
			if (participant) {
				this.isMicrophoneEnabled = participant.isMicrophoneEnabled;
				this.storageSrv.setMicrophoneEnabled(this.isMicrophoneEnabled);
			}
		});
	}

	async ngOnInit() {
		this.isMicrophoneEnabled = this.participantService.isMyMicrophoneEnabled();
		this.musicModeEnabled = this.storageSrv.isMusicModeEnabled();
		this.aiNoiseSuppressionEnabled = !this.musicModeEnabled && this.storageSrv.isAiNoiseSuppressionEnabled();
		if (this.aiNoiseSuppressionEnabled) {
			this.aiNoiseSuppressionEnabled = await this.participantService.setAiNoiseSuppressionEnabled(true);
		}
	}

	async toggleAiNoiseSuppression(enabled: boolean) {
		// 音乐模式与降噪互斥:开启降噪先关音乐模式
		if (enabled && this.musicModeEnabled) {
			await this.toggleMusicMode(false);
		}
		this.aiNoiseSuppressionEnabled = enabled;
		const applied = await this.participantService.setAiNoiseSuppressionEnabled(enabled);
		this.aiNoiseSuppressionEnabled = enabled && applied;
		this.storageSrv.setAiNoiseSuppressionEnabled(this.aiNoiseSuppressionEnabled);
	}

	/** 音乐模式（高保真音频）:关回声消除/降噪/增益,双声道高码率发布 */
	async toggleMusicMode(enabled: boolean) {
		if (this.musicModePending) return;
		this.musicModePending = true;
		try {
			// 与 AI 降噪互斥:降噪关不掉就不进入音乐模式,避免两条处理链打架
			if (enabled && this.aiNoiseSuppressionEnabled) {
				const nsDisabled = await this.participantService.setAiNoiseSuppressionEnabled(false);
				if (nsDisabled) {
					this.aiNoiseSuppressionEnabled = false;
					this.storageSrv.setAiNoiseSuppressionEnabled(false);
				} else {
					return;
				}
			}
			const applied = await this.participantService.setMusicModeEnabled(enabled);
			this.musicModeEnabled = enabled && applied;
		} finally {
			this.musicModePending = false;
		}
	}

	async toggleMic(event: MouseEvent) {
		event.stopPropagation();
		this.microphoneStatusChanging = true;
		this.isMicrophoneEnabled = !this.isMicrophoneEnabled;
		await this.participantService.setMicrophoneEnabled(this.isMicrophoneEnabled);
		this.microphoneStatusChanging = false;
		this.storageSrv.setMicrophoneEnabled(this.isMicrophoneEnabled);
		this.onAudioEnabledChanged.emit(this.isMicrophoneEnabled);
	}

	async onMicrophoneSelected(event: { value: CustomDevice }) {
		try {
			const device: CustomDevice = event?.value;
			if (this.deviceSrv.needUpdateAudioTrack(device)) {
				this.microphoneStatusChanging = true;
				await this.participantService.switchMicrophone(device.device);
				if (this.aiNoiseSuppressionEnabled) {
					this.aiNoiseSuppressionEnabled = await this.participantService.setAiNoiseSuppressionEnabled(true);
				}
				this.deviceSrv.setMicSelected(device.device);
				const selectedMicrophone = this.microphoneSelected();
				if (selectedMicrophone) {
					this.onAudioDeviceChanged.emit(selectedMicrophone);
				}
			}
		} catch (error) {
			this.log.e('Error switching microphone', error);
		} finally {
			this.microphoneStatusChanging = false;
		}
	}

	/** nz-select 版选择入口：传 deviceId，内部复用既有切换逻辑 */
	onMicrophoneIdSelected(deviceId: string): void {
		const device = this.microphones().find((m) => m.device === deviceId);
		if (device) this.onMicrophoneSelected({ value: device });
	}
}

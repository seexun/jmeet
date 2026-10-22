import { ChangeDetectionStrategy, Component, OnInit, Signal, WritableSignal, effect, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzIconTypePipe } from '../../../../../../shared/pipes/nz-icon-type.pipe';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { CustomDevice } from '../../../models/device.model';
import { ILogger } from '../../../models/logger.model';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { DeviceService } from '../../../services/device/device.service';
import { LoggerService } from '../../../services/logger/logger.service';
import { ParticipantService } from '../../../services/participant/participant.service';
import { StorageService } from '../../../services/storage/storage.service';

/**
 * @internal
 */
@Component({
	selector: 'ov-video-devices-select',
	imports: [FormsModule, NzIconTypePipe, NzIconModule, NzDropDownModule, NzTooltipModule, NzSelectModule, TranslatePipe, NzMenuModule],
	templateUrl: './video-devices.component.html',
	styleUrl: './video-devices.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true
})
export class VideoDevicesComponent implements OnInit {
	readonly compact = input(false);
	readonly onVideoDeviceChanged = output<CustomDevice>();
	readonly onVideoEnabledChanged = output<boolean>();

	cameraStatusChanging: boolean = false;
	isCameraEnabled: boolean = false;

	protected readonly cameras: WritableSignal<CustomDevice[]>;
	protected readonly cameraSelected: WritableSignal<CustomDevice | undefined>;
	protected readonly hasVideoDevices: Signal<boolean>;

	private log: ILogger = {
		d: () => {},
		v: () => {},
		w: () => {},
		e: () => {}
	};

	private readonly storageSrv = inject(StorageService);
	private readonly deviceSrv = inject(DeviceService);
	private readonly participantService = inject(ParticipantService);
	private readonly loggerSrv = inject(LoggerService);

	constructor() {
		this.log = this.loggerSrv.get('VideoDevicesComponent');
		this.cameras = this.deviceSrv.cameras;
		this.cameraSelected = this.deviceSrv.cameraSelected;
		this.hasVideoDevices = this.deviceSrv.hasVideoDevices;

		// Use effect instead of subscription for reactive updates
		effect(() => {
			const participant = this.participantService.localParticipant();
			if (participant) {
				this.isCameraEnabled = participant.isCameraEnabled;
				this.storageSrv.setCameraEnabled(this.isCameraEnabled);
			}
		});
	}

	async ngOnInit() {
		this.isCameraEnabled = this.participantService.isMyCameraEnabled();
	}

	async toggleCam(event: MouseEvent) {
		event.stopPropagation();
		this.cameraStatusChanging = true;
		this.isCameraEnabled = !this.isCameraEnabled;
		await this.participantService.setCameraEnabled(this.isCameraEnabled);
		this.storageSrv.setCameraEnabled(this.isCameraEnabled);
		this.onVideoEnabledChanged.emit(this.isCameraEnabled);
		this.cameraStatusChanging = false;
	}

	async onCameraSelected(event: { value: CustomDevice }) {
		try {
			const device: CustomDevice = event?.value;

			// Is New deviceId different from the old one?
			if (this.deviceSrv.needUpdateVideoTrack(device)) {
				this.cameraStatusChanging = true;
				await this.participantService.switchCamera(device.device);
				this.deviceSrv.setCameraSelected(device.device);
				const selectedCamera = this.cameraSelected();
				if (selectedCamera) {
					this.onVideoDeviceChanged.emit(selectedCamera);
				}
			}
		} catch (error) {
			this.log.e('Error switching camera', error);
		} finally {
			this.cameraStatusChanging = false;
		}
	}

	/** nz-select 版选择入口：传 deviceId，内部复用既有切换逻辑 */
	onCameraIdSelected(deviceId: string): void {
		const device = this.cameras().find((c) => c.device === deviceId);
		if (device) this.onCameraSelected({ value: device });
	}
}

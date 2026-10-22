import { TestBed } from '@angular/core/testing';
import { OPENVIDU_COMPONENTS_CONFIG } from '../../config/openvidu-components-angular.config';
import { DeviceService } from './device.service';
import { MEETING_TRANSLATIONS } from '../../../lang/meeting-translations';
import { provideTranslations } from '../../../../../shared/models/translation-bundle.model';
import { MeetingTranslateService } from '../translate/meeting-translate.service';
import { StorageService } from '../storage/storage.service';

describe('DeviceService (system default device)', () => {
	let service: DeviceService;
	let storageSrv: StorageService;

	const fakeDevices = [
		// 浏览器指针条目（音频有 default/communications；摄像头在 Chrome 无指针条目）
		{ kind: 'audioinput', deviceId: 'default', label: '默认 - 麦克风阵列 (Realtek Audio)' },
		{ kind: 'audioinput', deviceId: 'communications', label: '通信 - 麦克风阵列 (Realtek Audio)' },
		{ kind: 'audioinput', deviceId: 'mic-1', label: '麦克风阵列 (Realtek Audio)' },
		{ kind: 'audioinput', deviceId: 'mic-2', label: 'ToDesk Virtual Audio' },
		{ kind: 'videoinput', deviceId: 'cam-1', label: 'Integrated Camera' },
		{ kind: 'videoinput', deviceId: 'cam-2', label: 'OBS Virtual Camera' }
	] as MediaDeviceInfo[];

	const videoTrack = (deviceId: string) =>
		({ kind: 'video', mediaStreamTrack: { getSettings: () => ({ deviceId }) } }) as any;
	const audioTrack = (deviceId: string) =>
		({ kind: 'audio', mediaStreamTrack: { getSettings: () => ({ deviceId }) } }) as any;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			providers: [
				{ provide: OPENVIDU_COMPONENTS_CONFIG, useValue: {} },
				provideTranslations(MEETING_TRANSLATIONS)
			]
		}).compileComponents();
		// 应用默认中文；测试环境默认语言是 en，切到 cn 并等待异步加载完成
		const translateSrv = TestBed.inject(MeetingTranslateService);
		translateSrv.setCurrentLanguage('cn');
		for (let i = 0; i < 40 && translateSrv.translate('DEVICE.DEFAULT') !== '系统默认'; i++) {
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
		service = TestBed.inject(DeviceService);
		storageSrv = TestBed.inject(StorageService);
		// 枚举走 LiveKit adapter——这里替换为可控的假枚举
		(service as any).livekitAdapter.getLocalDevices = async () => fakeDevices;
		spyOn(storageSrv, 'getVideoDevice').and.returnValue(null);
		spyOn(storageSrv, 'getAudioDevice').and.returnValue(null);
	});

	it('places a "系统默认" entry first for cameras and microphones', async () => {
		await service.initializeDevices();
		expect(service.cameras()[0].device).toBe('default');
		expect(service.microphones()[0].device).toBe('default');
	});

	it('composes the audio default label with the concrete OS default device name', async () => {
		await service.initializeDevices();
		// 浏览器 default 指针条目 label 为 "默认 - 麦克风阵列 (Realtek Audio)" → 组合出具体设备名
		expect(service.microphones()[0].label).toBe('系统默认 · 麦克风阵列 (Realtek Audio)');
	});

	it('selects the system default entry when no stored preference exists', async () => {
		await service.initializeDevices();
		expect(service.cameraSelected()?.device).toBe('default');
		expect(service.microphoneSelected()?.device).toBe('default');
	});

	it('falls back to the system default entry when the stored device disappeared', async () => {
		(storageSrv.getVideoDevice as jasmine.Spy).and.returnValue({ device: 'gone-device', label: 'gone' });
		(storageSrv.getAudioDevice as jasmine.Spy).and.returnValue({ device: 'gone-device', label: 'gone' });
		await service.initializeDevices();
		expect(service.cameraSelected()?.device).toBe('default');
		expect(service.microphoneSelected()?.device).toBe('default');
	});

	it('enriches the camera default label from the actually opened track without overriding the selection', async () => {
		await service.initializeDevices();
		await service.syncDevicesAfterTrackCreation([videoTrack('cam-1'), audioTrack('mic-1')]);
		expect(service.cameraSelected()?.device).toBe('default'); // 不被具体设备顶替
		expect(service.microphoneSelected()?.device).toBe('default');
		// 摄像头没有浏览器指针条目：由轨道 settings 反推设备名
		expect(service.cameras()[0].label).toBe('系统默认 · Integrated Camera');
	});

	it('keeps an explicit stored preference over the system default', async () => {
		(storageSrv.getVideoDevice as jasmine.Spy).and.returnValue({ device: 'cam-2', label: 'OBS Virtual Camera' });
		(storageSrv.getAudioDevice as jasmine.Spy).and.returnValue({ device: 'mic-2', label: 'ToDesk Virtual Audio' });
		await service.initializeDevices();
		expect(service.cameraSelected()?.device).toBe('cam-2');
		expect(service.microphoneSelected()?.device).toBe('mic-2');
	});
});

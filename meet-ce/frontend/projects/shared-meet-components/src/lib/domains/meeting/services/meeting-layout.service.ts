import { effect, inject, Injectable } from '@angular/core';
import { MeetStorageService } from '../../../shared/services/storage.service';
import { SmartLayoutMode, SmartLayoutService } from '../openvidu-components';

@Injectable({ providedIn: 'root' })
export class MeetingLayoutService extends SmartLayoutService {
	private readonly storageService = inject(MeetStorageService);

	constructor() {
		super();
		this.loadLayoutModeFromStorage();
		this.loadMaxVisibleParticipantsFromStorage();
		this.setupStoragePersistence();
	}

	private loadLayoutModeFromStorage(): void {
		const storedMode = this.storageService.getLayoutMode();
		if (storedMode) this.setLayoutMode(storedMode as SmartLayoutMode);
	}

	private loadMaxVisibleParticipantsFromStorage(): void {
		const storedCount = this.storageService.getMaxVisibleRemoteParticipants();
		if (storedCount) this.setMaxVisibleRemoteParticipants(storedCount);
	}

	private setupStoragePersistence(): void {
		effect(() => this.storageService.setLayoutMode(this.layoutMode()));
		effect(() => this.storageService.setMaxVisibleRemoteParticipants(this.maxVisibleRemoteParticipants()));
	}
}

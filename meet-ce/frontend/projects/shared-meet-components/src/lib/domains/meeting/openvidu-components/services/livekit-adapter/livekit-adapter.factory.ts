import { Injectable, inject } from '@angular/core';
import { LiveKitSdkAdapter } from './implementations/livekit-sdk.adapter';
import { LivekitAdapterInterface } from './interfaces/livekit.adapter.interface';

@Injectable({
	providedIn: 'root'
})
export class LivekitAdapterFactory {
	private readonly liveKitSdkAdapter = inject(LiveKitSdkAdapter);

	createLiveKitAdapter(): LivekitAdapterInterface {
		return this.liveKitSdkAdapter;
	}
}

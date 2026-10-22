import { inject, Injectable } from '@angular/core';
import { MeetApiKey } from '@openvidu-meet/typings';
import { HttpService } from './http.service';

@Injectable({
	providedIn: 'root'
})
export class ApiKeyService {
	protected httpService = inject(HttpService);

	protected readonly API_KEYS_API = `${HttpService.INTERNAL_API_PATH_PREFIX}/api-keys`;

	async generateApiKey(): Promise<MeetApiKey> {
		const path = `${this.API_KEYS_API}`;
		return this.httpService.postRequest<MeetApiKey>(path);
	}

	async getApiKeys(): Promise<MeetApiKey[]> {
		const path = `${this.API_KEYS_API}`;
		return this.httpService.getRequest<MeetApiKey[]>(path);
	}

	async deleteApiKeys(): Promise<any> {
		const path = `${this.API_KEYS_API}`;
		return this.httpService.deleteRequest(path);
	}
}

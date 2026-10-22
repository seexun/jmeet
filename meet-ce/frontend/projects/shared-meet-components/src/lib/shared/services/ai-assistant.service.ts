import { inject, Injectable } from '@angular/core';
import {
	MeetAssistantCapabilityName,
	MeetCreateAssistantRequest,
	MeetCreateAssistantResponse
} from '@openvidu-meet/typings';
import { HttpService } from './http.service';

@Injectable({
	providedIn: 'root'
})
export class AiAssistantService {
	protected httpService = inject(HttpService);

	protected readonly AI_ASSISTANT_API = `${HttpService.INTERNAL_API_PATH_PREFIX}/ai/assistants`;

	async cancelAssistant(assistantId: string): Promise<void> {
		const path = `${this.AI_ASSISTANT_API}/${assistantId}`;
		await this.httpService.deleteRequest<void>(path);
	}

	async createLiveCaptionsAssistant(): Promise<MeetCreateAssistantResponse> {
		const request: MeetCreateAssistantRequest = {
			capabilities: [{ name: MeetAssistantCapabilityName.LIVE_CAPTIONS }]
		};

		return this.createAssistant(request);
	}

	private async createAssistant(request: MeetCreateAssistantRequest): Promise<MeetCreateAssistantResponse> {
		return this.httpService.postRequest<MeetCreateAssistantResponse>(this.AI_ASSISTANT_API, request);
	}
}

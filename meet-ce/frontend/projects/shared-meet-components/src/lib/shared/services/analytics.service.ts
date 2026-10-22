import { inject, Injectable } from '@angular/core';
import { MeetAnalytics } from '@openvidu-meet/typings';
import { HttpService } from './http.service';

@Injectable({
	providedIn: 'root'
})
export class AnalyticsService {
	protected httpService = inject(HttpService);

	protected readonly ANALYTICS_API = `${HttpService.INTERNAL_API_PATH_PREFIX}/analytics`;

	/**
	 * Retrieves usage analytics for JMeet.
	 * Includes metrics for rooms and recordings.
	 *
	 * @returns Analytics data with room and recording metrics
	 */
	async getAnalytics(): Promise<MeetAnalytics> {
		return this.httpService.getRequest(this.ANALYTICS_API);
	}
}

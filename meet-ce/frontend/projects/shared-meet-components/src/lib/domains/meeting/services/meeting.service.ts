import { inject, Injectable } from '@angular/core';
import { MeetMeetingHostState, MeetMeetingSecurityConfig, MeetParticipantModerationAction } from '@openvidu-meet/typings';
import { HttpService } from '../../../shared/services/http.service';
import { LoggerService } from '../openvidu-components';

@Injectable({
	providedIn: 'root'
})
export class MeetingService {
	protected readonly MEETINGS_API = `${HttpService.INTERNAL_API_PATH_PREFIX}/meetings`;
	protected readonly ROOMS_API = `${HttpService.INTERNAL_API_PATH_PREFIX}/rooms`;

	protected httpService = inject(HttpService);
	protected loggerService = inject(LoggerService);
	protected log = this.loggerService.get('JMeet - MeetingService');

	/**
	 * Ends a meeting by its room ID.
	 *
	 * @param roomId - The unique identifier of the meeting room
	 * @returns A promise that resolves when the meeting has been ended
	 */
	async endMeeting(roomId: string): Promise<any> {
		const path = `${this.MEETINGS_API}/${roomId}`;
		return this.httpService.deleteRequest(path);
	}

	/**
	 * Kicks a participant from a meeting.
	 *
	 * @param roomId - The unique identifier of the meeting room
	 * @param participantIdentity - The identity of the participant to be kicked
	 * @returns A promise that resolves when the participant has been kicked
	 */
	async kickParticipant(roomId: string, participantIdentity: string, blockRejoin = false): Promise<void> {
		const path = `${this.MEETINGS_API}/${roomId}/participants/${participantIdentity}?blockRejoin=${blockRejoin}`;
		await this.httpService.deleteRequest(path);
		this.log.d(`Participant '${participantIdentity}' kicked from room '${roomId}'`);
	}

	stopParticipantCamera(roomId: string, participantIdentity: string): Promise<{ stoppedTracks: number }> {
		return this.httpService.postRequest(`${this.MEETINGS_API}/${roomId}/participants/${participantIdentity}/stop-camera`, {});
	}

	stopParticipantScreenShare(roomId: string, participantIdentity: string): Promise<{ stoppedTracks: number }> {
		return this.httpService.postRequest(`${this.MEETINGS_API}/${roomId}/participants/${participantIdentity}/stop-screen-share`, {});
	}

	/**
	 * Changes the role of a participant in a meeting.
	 *
	 * @param roomId - The unique identifier of the meeting room
	 * @param participantIdentity - The identity of the participant whose role is to be changed
	 * @param action - Moderation action to apply
	 */
	async changeParticipantRole(
		roomId: string,
		participantIdentity: string,
		action: MeetParticipantModerationAction
	): Promise<void> {
		const path = `${this.MEETINGS_API}/${roomId}/participants/${participantIdentity}/role`;
		const body = { action };
		await this.httpService.putRequest(path, body);
		this.log.d(`Applied moderation action '${action}' to participant '${participantIdentity}' in room '${roomId}'`);
	}

	async muteAllParticipants(roomId: string): Promise<{ mutedTracks: number; message: string }> {
		const path = `${this.MEETINGS_API}/${roomId}/participants/mute-all`;
		return this.httpService.postRequest(path, {});
	}

	async muteParticipant(
		roomId: string,
		participantIdentity: string
	): Promise<{ mutedTracks: number; message: string }> {
		const path = `${this.MEETINGS_API}/${roomId}/participants/${participantIdentity}/mute`;
		return this.httpService.postRequest(path, {});
	}

	requestParticipantUnmute(roomId: string, participantIdentity: string): Promise<{ message: string }> {
		return this.httpService.postRequest(
			`${this.MEETINGS_API}/${roomId}/participants/${participantIdentity}/request-unmute`,
			{}
		);
	}

	getMeetingHost(roomId: string): Promise<MeetMeetingHostState> {
		return this.httpService.getRequest(`${this.MEETINGS_API}/${roomId}/host`);
	}

	transferMeetingHost(roomId: string, targetParticipantIdentity: string): Promise<MeetMeetingHostState> {
		return this.httpService.putRequest(`${this.MEETINGS_API}/${roomId}/host`, { targetParticipantIdentity });
	}

	prepareHostLeave(roomId: string, targetIdentity?: string): Promise<{ ok: boolean; targetIdentity?: string }> {
		return this.httpService.postRequest(`${this.MEETINGS_API}/${roomId}/host/leave`, targetIdentity ? { targetIdentity } : {});
	}

	claimMeetingHost(roomId: string): Promise<MeetMeetingHostState> {
		return this.httpService.postRequest(`${this.MEETINGS_API}/${roomId}/host/claim`, {});
	}

	updateHandState(roomId: string, raised: boolean): Promise<void> {
		return this.httpService.putRequest(`${this.MEETINGS_API}/${roomId}/hand`, { raised });
	}

	requestScreenShare(roomId: string): Promise<{ message: string }> {
		return this.httpService.postRequest(`${this.MEETINGS_API}/${roomId}/screen-share/request`, {});
	}

	grantScreenShare(roomId: string, participantIdentity: string): Promise<{ message: string }> {
		return this.httpService.postRequest(
			`${this.MEETINGS_API}/${roomId}/participants/${participantIdentity}/screen-share/grant`,
			{}
		);
	}

	async updateMeetingSecurity(roomId: string, security: MeetMeetingSecurityConfig): Promise<{ security: MeetMeetingSecurityConfig }> {
		return this.httpService.putRequest(`${this.MEETINGS_API}/${roomId}/security`, security);
	}
}

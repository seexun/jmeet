import { inject, Injectable } from '@angular/core';
import {
	MeetRoom,
	MeetRoomAccess,
	MeetRoomAccessConfig,
	MeetRoomConfig,
	MeetRoomDeletionPolicyWithMeeting,
	MeetRoomDeletionPolicyWithRecordings,
	MeetRoomDeletionSuccessCode,
	MeetRoomField,
	MeetRoomFilters,
	MeetRoomOptions,
	MeetRoomRoles,
	MeetRoomRolesConfig,
	MeetRoomStatus,
	ProjectedMeetRoom
} from '@openvidu-meet/typings';
import { HttpService } from '../../../shared/services/http.service';
import { ILogger, LoggerService } from '../../meeting/openvidu-components';
import type { MeetRoomClientResponseOptions } from '../models/room-request';
import type { MeetRoomQueryOptionsWithFields } from '../types/room-projection.types';
import { RoomFeatureService } from './room-feature.service';

@Injectable({
	providedIn: 'root'
})
export class RoomService {
	protected httpService: HttpService = inject(HttpService);
	protected roomFeatureService: RoomFeatureService = inject(RoomFeatureService);
	protected loggerService: LoggerService = inject(LoggerService);
	protected log: ILogger = this.loggerService.get('JMeet - RoomService');

	protected readonly ROOMS_API = `${HttpService.API_PATH_PREFIX}/rooms`;
	protected readonly INTERNAL_ROOMS_API = `${HttpService.INTERNAL_API_PATH_PREFIX}/rooms`;

	constructor() {}

	/**
	 * Creates a new room with the specified options.
	 *
	 * @param options - The options for creating the room
	 * @returns A promise that resolves to the created MeetRoom object
	 */
	async createRoom(options?: MeetRoomOptions): Promise<MeetRoom>;

	async createRoom<const TFields extends readonly [MeetRoomField, ...MeetRoomField[]]>(
		options: MeetRoomOptions | undefined,
		responseOptions: MeetRoomQueryOptionsWithFields<TFields>
	): Promise<ProjectedMeetRoom<TFields>>;

	async createRoom(
		options?: MeetRoomOptions,
		responseOptions?: MeetRoomClientResponseOptions
	): Promise<MeetRoom | Partial<MeetRoom>> {
		const headers: Record<string, string> = {
			'X-Fields': responseOptions?.fields ? responseOptions.fields.join(',') : '',
			'X-ExtraFields': responseOptions?.extraFields ? responseOptions.extraFields.join(',') : ''
		};
		return this.httpService.postRequest(this.ROOMS_API, options, headers);
	}

	/**
	 * Lists rooms with optional filters.
	 *
	 * @param filters - Optional filters
	 * @return A promise that resolves to an object containing rooms and pagination info
	 */
	async listRooms(filters?: MeetRoomFilters): Promise<{
		rooms: MeetRoom[];
		pagination: {
			isTruncated: boolean;
			nextPageToken?: string;
			maxItems: number;
		};
	}> {
		let path = this.ROOMS_API;

		if (filters) {
			const queryParams = new URLSearchParams();

			Object.entries(filters).forEach(([key, value]) => {
				if (value) {
					const stringValue = Array.isArray(value) ? value.join(',') : value.toString();
					queryParams.set(key, stringValue);
				}
			});

			const queryString = queryParams.toString();
			if (queryString) {
				path += `?${queryString}`;
			}
		}
		return this.httpService.getRequest(path);
	}

	/**
	 * Looks up a room by its numeric meeting code (join-by-code entry).
	 * Returns a minimal projection (roomId/roomName/status) for routing into the join flow.
	 *
	 * @param meetingCode - The 9-12 digit numeric meeting code
	 * @return A promise that resolves to the join-by-code lookup result
	 */
	getRoomByMeetingCode(meetingCode: string): Promise<{ roomId: string; meetingCode: string; roomName: string; status: string }> {
		return this.httpService.getRequest(`${this.ROOMS_API}/code/${encodeURIComponent(meetingCode)}`);
	}

	/**
	 * Gets a room by its ID.
	 *
	 * @param roomId - The unique identifier of the room
	 * @return A promise that resolves to the MeetRoom object
	 */
	async getRoom(roomId: string): Promise<MeetRoom>;

	async getRoom<const TFields extends readonly [MeetRoomField, ...MeetRoomField[]]>(
		roomId: string,
		responseOptions: MeetRoomQueryOptionsWithFields<TFields>
	): Promise<ProjectedMeetRoom<TFields>>;

	async getRoom(
		roomId: string,
		responseOptions?: MeetRoomClientResponseOptions
	): Promise<MeetRoom | Partial<MeetRoom>>;

	async getRoom(
		roomId: string,
		responseOptions?: MeetRoomClientResponseOptions
	): Promise<MeetRoom | Partial<MeetRoom>> {
		const queryParams = new URLSearchParams();
		if (responseOptions?.fields) {
			queryParams.set('fields', responseOptions.fields.join(','));
		}
		if (responseOptions?.extraFields) {
			queryParams.set('extraFields', responseOptions.extraFields.join(','));
		}
		const queryString = queryParams.toString();
		const path = `${this.ROOMS_API}/${roomId}${queryString ? `?${queryString}` : ''}`;

		return this.httpService.getRequest(path);
	}

	/**
	 * Retrieves the config for a specific room.
	 *
	 * @param roomId - The unique identifier of the room
	 * @return A promise that resolves to the MeetRoomConfig object
	 */
	async getRoomConfig(roomId: string): Promise<MeetRoomConfig> {
		const path = `${this.ROOMS_API}/${roomId}/config`;
		return this.httpService.getRequest<MeetRoomConfig>(path);
	}

	/**
	 * Loads the room config and updates the feature configuration service.
	 *
	 * @param roomId - The unique identifier of the room
	 */
	async loadRoomConfig(roomId: string): Promise<void> {
		this.log.d('Fetching room config for roomId:', roomId);

		try {
			const config = await this.getRoomConfig(roomId);
			this.roomFeatureService.setRoomConfig(config);
			this.log.d('Room config loaded:', config);
		} catch (error) {
			this.log.e('Error loading room config', error);
			throw new Error('Failed to load room config');
		}
	}

	/**
	 * Saves new room config.
	 *
	 * @param roomId - The unique identifier of the room
	 * @param config - The room config to be saved.
	 * @returns A promise that resolves when the config have been saved.
	 */
	async updateRoomConfig(roomId: string, config: Partial<MeetRoomConfig>): Promise<MeetRoomConfig> {
		this.log.d('Saving room config', config);
		const path = `${this.ROOMS_API}/${roomId}/config`;
		return this.httpService.putRequest(path, { config });
	}

	/**
	 * Updates the status of a room.
	 *
	 * @param roomId - The unique identifier of the room
	 * @param status - The new status to be set
	 * @return A promise that resolves to the updated room
	 */
	async updateRoomStatus(roomId: string, status: MeetRoomStatus): Promise<MeetRoom>;

	async updateRoomStatus<const TFields extends readonly [MeetRoomField, ...MeetRoomField[]]>(
		roomId: string,
		status: MeetRoomStatus,
		responseOptions: MeetRoomQueryOptionsWithFields<TFields>
	): Promise<ProjectedMeetRoom<TFields>>;

	async updateRoomStatus(
		roomId: string,
		status: MeetRoomStatus,
		responseOptions?: MeetRoomClientResponseOptions
	): Promise<MeetRoom | Partial<MeetRoom>> {
		const headers: Record<string, string> = {
			'X-Fields': responseOptions?.fields ? responseOptions.fields.join(',') : '',
			'X-ExtraFields': responseOptions?.extraFields ? responseOptions.extraFields.join(',') : ''
		};
		const path = `${this.ROOMS_API}/${roomId}/status`;
		return this.httpService.putRequest(path, { status }, headers);
	}

	/**
	 * Updates the roles permissions of a room.
	 *
	 * @param roomId - The unique identifier of the room
	 * @param rolesConfig - The new roles configuration to be set
	 * @returns A promise that resolves when the roles configuration has been updated
	 */
	async updateRoomRoles(roomId: string, rolesConfig: MeetRoomRolesConfig): Promise<MeetRoomRoles> {
		const path = `${this.ROOMS_API}/${roomId}/roles`;
		return this.httpService.putRequest(path, { roles: rolesConfig });
	}

	/**
	 * Updates the access configuration of a room.
	 *
	 * @param roomId - The unique identifier of the room
	 * @param accessConfig - The new access configuration to be set
	 * @returns A promise that resolves when the access configuration has been updated
	 */
	async updateRoomAccess(roomId: string, accessConfig: MeetRoomAccessConfig): Promise<MeetRoomAccess> {
		const path = `${this.ROOMS_API}/${roomId}/access`;
		return this.httpService.putRequest(path, { access: accessConfig });
	}

	/**
	 * Deletes a room by its ID.
	 *
	 * @param roomId - The unique identifier of the room to be deleted
	 * @param withMeeting - Policy for handling rooms with active meetings
	 * @param withRecordings - Policy for handling rooms with recordings
	 * @return A promise that resolves to an object containing the success code and message
	 */
	async deleteRoom(
		roomId: string,
		withMeeting: MeetRoomDeletionPolicyWithMeeting = MeetRoomDeletionPolicyWithMeeting.FAIL,
		withRecordings: MeetRoomDeletionPolicyWithRecordings = MeetRoomDeletionPolicyWithRecordings.FAIL
	): Promise<{ successCode: MeetRoomDeletionSuccessCode; message: string; room?: MeetRoom }> {
		const queryParams = new URLSearchParams();
		queryParams.set('withMeeting', withMeeting);
		queryParams.set('withRecordings', withRecordings);

		const path = `${this.ROOMS_API}/${roomId}?${queryParams.toString()}`;
		return this.httpService.deleteRequest(path);
	}

	/**
	 * Bulk deletes rooms by their IDs.
	 *
	 * @param roomIds - An array of room IDs to be deleted
	 * @param withMeeting - Policy for handling rooms with active meetings
	 * @param withRecordings - Policy for handling rooms with recordings
	 * @return A promise that resolves when the rooms have been deleted
	 */
	async bulkDeleteRooms(
		roomIds: string[],
		withMeeting: MeetRoomDeletionPolicyWithMeeting = MeetRoomDeletionPolicyWithMeeting.FAIL,
		withRecordings: MeetRoomDeletionPolicyWithRecordings = MeetRoomDeletionPolicyWithRecordings.FAIL
	): Promise<{
		message: string;
		deleted: { roomId: string; successCode: MeetRoomDeletionSuccessCode; message: string; room?: MeetRoom }[];
		failed: { roomId: string; error: string; message: string }[];
	}> {
		if (roomIds.length === 0) {
			throw new Error('No room IDs provided for bulk deletion');
		}

		const queryParams = new URLSearchParams();
		queryParams.set('roomIds', roomIds.join(','));
		queryParams.set('withMeeting', withMeeting);
		queryParams.set('withRecordings', withRecordings);

		const path = `${this.ROOMS_API}?${queryParams.toString()}`;
		return this.httpService.deleteRequest(path);
	}
}

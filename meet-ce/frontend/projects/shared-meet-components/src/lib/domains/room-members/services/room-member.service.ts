import { inject, Injectable } from '@angular/core';
import {
	MeetRoomMember,
	MeetRoomMemberField,
	MeetRoomMemberFilters,
	MeetRoomMemberOptions,
	MeetRoomMemberTokenOptions,
	ProjectedMeetRoomMember
} from '@openvidu-meet/typings';
import { HttpService } from '../../../shared/services/http.service';
import type { MeetRoomMemberClientResponseOptions } from '../models/room-member-request';
import type { MeetRoomMemberQueryOptionsWithFields } from '../types/room-member-projection.types';

@Injectable({
	providedIn: 'root'
})
export class RoomMemberService {
	protected httpService = inject(HttpService);

	protected readonly ROOM_MEMBERS_API = `${HttpService.API_PATH_PREFIX}/rooms`;
	protected readonly INTERNAL_ROOM_MEMBERS_API = `${HttpService.INTERNAL_API_PATH_PREFIX}/rooms`;

	/**
	 * Constructs the API path for room member operations based on the provided room ID.
	 *
	 * @param roomId - The unique identifier of the room
	 * @returns The API path for room member operations
	 */
	protected getRoomMemberApiPath(roomId: string, internal = false): string {
		const baseApi = internal ? this.INTERNAL_ROOM_MEMBERS_API : this.ROOM_MEMBERS_API;
		return `${baseApi}/${roomId}/members`;
	}

	/**
	 * Creates a new room member with the specified options.
	 *
	 * @param roomId - The unique identifier of the room
	 * @param options - The options for creating the room member
	 * @returns A promise that resolves to the created MeetRoomMember object
	 */
	async createRoomMember(roomId: string, options: MeetRoomMemberOptions): Promise<MeetRoomMember>;

	async createRoomMember<const TFields extends readonly [MeetRoomMemberField, ...MeetRoomMemberField[]]>(
		roomId: string,
		options: MeetRoomMemberOptions,
		responseOptions: MeetRoomMemberQueryOptionsWithFields<TFields>
	): Promise<ProjectedMeetRoomMember<TFields>>;

	async createRoomMember(
		roomId: string,
		options: MeetRoomMemberOptions,
		responseOptions?: MeetRoomMemberClientResponseOptions
	): Promise<MeetRoomMember | Partial<MeetRoomMember>> {
		const headers: Record<string, string> = {
			'X-Fields': responseOptions?.fields ? responseOptions.fields.join(',') : '',
			'X-ExtraFields': responseOptions?.extraFields ? responseOptions.extraFields.join(',') : ''
		};
		const path = this.getRoomMemberApiPath(roomId);
		return this.httpService.postRequest(path, options, headers);
	}

	/**
	 * Lists room members with optional filters.
	 *
	 * @param roomId - The unique identifier of the room
	 * @param filters - Optional filters for pagination and fields
	 * @returns A promise that resolves to an object containing room members and pagination info
	 */
	async listRoomMembers(
		roomId: string,
		filters?: MeetRoomMemberFilters
	): Promise<{
		members: MeetRoomMember[];
		pagination: {
			isTruncated: boolean;
			nextPageToken?: string;
			maxItems: number;
		};
	}> {
		let path = this.getRoomMemberApiPath(roomId);

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
	 * Gets a specific room member by their ID.
	 *
	 * @param roomId - The unique identifier of the room
	 * @param memberId - The unique identifier of the room member
	 * @returns A promise that resolves to the MeetRoomMember object
	 */
	async getRoomMember(roomId: string, memberId: string): Promise<MeetRoomMember>;

	async getRoomMember<const TFields extends readonly [MeetRoomMemberField, ...MeetRoomMemberField[]]>(
		roomId: string,
		memberId: string,
		responseOptions: MeetRoomMemberQueryOptionsWithFields<TFields>
	): Promise<ProjectedMeetRoomMember<TFields>>;

	async getRoomMember(
		roomId: string,
		memberId: string,
		responseOptions?: MeetRoomMemberClientResponseOptions
	): Promise<MeetRoomMember | Partial<MeetRoomMember>> {
		const queryParams = new URLSearchParams();
		if (responseOptions?.fields) {
			queryParams.set('fields', responseOptions.fields.join(','));
		}
		if (responseOptions?.extraFields) {
			queryParams.set('extraFields', responseOptions.extraFields.join(','));
		}
		const queryString = queryParams.toString();
		const path = `${this.getRoomMemberApiPath(roomId)}/${memberId}${queryString ? `?${queryString}` : ''}`;

		return this.httpService.getRequest(path);
	}

	/**
	 * Updates a room member's information.
	 *
	 * @param roomId - The unique identifier of the room
	 * @param memberId - The unique identifier of the room member
	 * @param updates - The updates to apply to the room member
	 * @returns A promise that resolves to the updated MeetRoomMember object
	 */
	async updateRoomMember(
		roomId: string,
		memberId: string,
		updates: Partial<MeetRoomMemberOptions>
	): Promise<MeetRoomMember>;

	async updateRoomMember<const TFields extends readonly [MeetRoomMemberField, ...MeetRoomMemberField[]]>(
		roomId: string,
		memberId: string,
		updates: Partial<MeetRoomMemberOptions>,
		responseOptions: MeetRoomMemberQueryOptionsWithFields<TFields>
	): Promise<ProjectedMeetRoomMember<TFields>>;

	async updateRoomMember(
		roomId: string,
		memberId: string,
		updates: Partial<MeetRoomMemberOptions>,
		responseOptions?: MeetRoomMemberClientResponseOptions
	): Promise<MeetRoomMember | Partial<MeetRoomMember>> {
		const headers: Record<string, string> = {
			'X-Fields': responseOptions?.fields ? responseOptions.fields.join(',') : '',
			'X-ExtraFields': responseOptions?.extraFields ? responseOptions.extraFields.join(',') : ''
		};
		const path = `${this.getRoomMemberApiPath(roomId)}/${memberId}`;
		return this.httpService.putRequest(path, updates, headers);
	}

	/**
	 * Deletes a room member by their ID.
	 *
	 * @param roomId - The unique identifier of the room
	 * @param memberId - The unique identifier of the room member to delete
	 * @returns A promise that resolves when the room member is deleted
	 */
	async deleteRoomMember(roomId: string, memberId: string): Promise<void> {
		const path = `${this.getRoomMemberApiPath(roomId)}/${memberId}`;
		return this.httpService.deleteRequest(path);
	}

	/**
	 * Bulk deletes multiple room members by their IDs.
	 *
	 * @param roomId - The unique identifier of the room
	 * @param memberIds - An array of room member IDs to delete
	 * @returns A promise that resolves when the room members are deleted
	 */
	async bulkDeleteRoomMembers(
		roomId: string,
		memberIds: string[]
	): Promise<{
		message: string;
		deleted: string[];
		failed: { memberId: string; error: string; message: string }[];
	}> {
		if (memberIds.length === 0) {
			throw new Error('No room member IDs provided for bulk deletion');
		}

		const path = `${this.getRoomMemberApiPath(roomId)}?memberIds=${memberIds.join(',')}`;
		return this.httpService.deleteRequest(path);
	}

	/**
	 * Generates a room member token for accessing the room and its resources.
	 *
	 * @param roomId - The unique identifier of the room
	 * @param tokenOptions - The options for the token generation
	 * @param headers - Optional additional headers to include in the token generation request
	 * @returns A promise that resolves to an object containing the generated token
	 */
	async generateRoomMemberToken(
		roomId: string,
		tokenOptions: MeetRoomMemberTokenOptions,
		headers?: Record<string, string>
	): Promise<{ token: string }> {
		const path = `${this.getRoomMemberApiPath(roomId, true)}/token`;
		return this.httpService.postRequest(path, tokenOptions, headers);
	}

	/**
	 * Refreshes a room member token for a participant already inside a meeting.
	 *
	 * @param roomId - The unique identifier of the room
	 * @returns A promise that resolves to an object containing the refreshed token
	 */
	async refreshRoomMemberToken(roomId: string): Promise<{ token: string }> {
		const path = `${this.getRoomMemberApiPath(roomId, true)}/token/refresh`;
		// Note: The previous token is expected to be sent in the corresponding header by the HTTP interceptor
		return this.httpService.postRequest(path, {});
	}
}

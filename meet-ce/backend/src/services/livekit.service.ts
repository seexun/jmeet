import { ParticipantInfo_Kind, TrackSource, TrackType } from '@livekit/protocol';
import { inject, injectable } from 'inversify';
import type {
	CreateOptions,
	ParticipantInfo,
	ParticipantPermission,
	Room,
	SendDataOptions
} from 'livekit-server-sdk';
import {
	DataPacket_Kind,
	RoomServiceClient
} from 'livekit-server-sdk';
import { INTERNAL_CONFIG } from '../config/internal-config.js';
import { MEET_ENV } from '../environment.js';
import {
	errorLivekitNotAvailable,
	errorParticipantNotFound,
	errorRoomNotFound,
	internalError,
	OpenViduMeetError
} from '../models/error.model.js';
import { runConcurrently } from '../utils/concurrency.utils.js';
import { LoggerService } from './logger.service.js';

/**
 * 过滤 LiveKit 里的基础设施参会者（kind 为数字枚举，AGENT 如实时字幕 ASR 代理；服务端 SDK 返回枚举数值而非字符串）。
 * 所有现有消费方（管控列表、主持人在场判断、人数统计）语义都是"真人"。
 */
export function filterHumanParticipants(list: ParticipantInfo[]): ParticipantInfo[] {
	return list.filter((p) => p.kind !== ParticipantInfo_Kind.AGENT);
}

@injectable()
export class LiveKitService {
	private readonly requestTimeoutMs = 8_000;
	private roomClient: RoomServiceClient;

	constructor(@inject(LoggerService) protected logger: LoggerService) {
		const livekitUrlHostname = MEET_ENV.LIVEKIT_URL_PRIVATE.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');
		this.roomClient = new RoomServiceClient(
			livekitUrlHostname,
			MEET_ENV.LIVEKIT_API_KEY,
			MEET_ENV.LIVEKIT_API_SECRET
		);
	}

	async createRoom(options: CreateOptions): Promise<Room> {
		try {
			// 开源版硬限制：单会议 50 人（媒体层强制，配合 ResourceQuotaService 的并发会议准入）
			const clamped: CreateOptions = {
				...options,
				maxParticipants: Math.min(options.maxParticipants ?? Number.MAX_SAFE_INTEGER, 50)
			};
			return await Promise.race([
				this.roomClient.createRoom(clamped),
				new Promise<never>((_, reject) =>
					setTimeout(() => reject(new Error(`LiveKit request timed out after ${this.requestTimeoutMs}ms`)), this.requestTimeoutMs)
				)
			]);
		} catch (error) {
			this.logger.error('Error creating LiveKit room:', error);
			throw internalError('creating LiveKit room');
		}
	}

	async probeHealth(): Promise<boolean> {
		await Promise.race([
			this.roomClient.listRooms([]),
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error('LiveKit health check timed out')), 3_000)
			)
		]);
		return true;
	}

	/**
	 * Checks if multiple rooms exist in LiveKit using a single API call.
	 *
	 * @param roomNames - Array of room names to check
	 * @returns A Map with room names as keys and boolean indicating existence as values
	 */
	async roomsExist(roomNames: string[]): Promise<Map<string, boolean>> {
		const result = new Map<string, boolean>();

		if (roomNames.length === 0) {
			return result;
		}

		try {
			const existingRooms = await this.roomClient.listRooms(roomNames);
			const existingRoomNames = new Set(existingRooms.map((room) => room.name));

			for (const roomName of roomNames) {
				result.set(roomName, existingRoomNames.has(roomName));
			}
		} catch (error) {
			this.logger.error(`Error batch checking rooms: ${error}`);

			// If the API call fails, assume no rooms exist
			for (const roomName of roomNames) {
				result.set(roomName, false);
			}
		}

		return result;
	}

	/**
	 * Checks if a room with the specified name exists in LiveKit.
	 *
	 * @param roomName - The name of the room to check
	 * @returns A Promise that resolves to true if the room exists, false otherwise
	 * @throws Will rethrow service availability or other unexpected errors
	 */
	async roomExists(roomName: string): Promise<boolean> {
		try {
			await this.getRoom(roomName);
			return true;
		} catch (error) {
			if (error instanceof OpenViduMeetError && error.statusCode === 404) {
				return false;
			}

			// Rethrow other errors as they indicate we couldn't determine if the room exists
			this.logger.error(`Error checking if room ${roomName} exists:`, error);
			throw error;
		}
	}

	/**
	 * Checks if a LiveKit room has at least one participant.
	 *
	 * @param roomName - The name of the room to check
	 * @returns A promise that resolves to true if the room has at least one participant,
	 *          or false if the room has no participants or if an error occurs
	 */
	async roomHasParticipants(roomName: string): Promise<boolean> {
		try {
			const participants = await this.listRoomParticipants(roomName);
			return participants.length > 0;
		} catch (error) {
			return false;
		}
	}

	async getRoom(roomName: string): Promise<Room> {
		let rooms: Room[] = [];

		try {
			rooms = await this.roomClient.listRooms([roomName]);
		} catch (error) {
			this.logger.error(`Error getting room: ${error}`);
			throw internalError(`getting LiveKit room '${roomName}'`);
		}

		if (rooms.length === 0) {
			throw errorRoomNotFound(roomName);
		}

		return rooms[0];
	}

	/**
	 * Retrieves the metadata associated with a LiveKit room.
	 *
	 * @param roomName - The name of the room to get metadata from
	 * @returns The room's metadata as a string if it exists, or undefined if the room has no metadata or an error occurs
	 */
	async getRoomMetadata(roomName: string): Promise<string | undefined> {
		try {
			const room = await this.getRoom(roomName);

			if (room.metadata) {
				return room.metadata;
			}

			return undefined;
		} catch (error) {
			return undefined;
		}
	}

	async listRooms(): Promise<Room[]> {
		try {
			return await this.roomClient.listRooms();
		} catch (error) {
			this.logger.error(`Error getting LiveKit rooms: ${error}`);
			throw internalError('getting LiveKit rooms');
		}
	}

	async deleteRoom(roomName: string): Promise<void> {
		try {
			try {
				await this.getRoom(roomName);
			} catch (error) {
				this.logger.warn(`Livekit Room ${roomName} not found. Skipping deletion.`);
				return Promise.resolve();
			}

			await this.roomClient.deleteRoom(roomName);
		} catch (error) {
			this.logger.error(`Error deleting LiveKit room: ${error}`);
			throw internalError(`deleting LiveKit room '${roomName}'`);
		}
	}

	/**
	 * Deletes multiple LiveKit rooms with bounded concurrency to avoid overwhelming the server.
	 *
	 * @param roomNames - Array of room names to delete
	 * @returns Promise that resolves when all room deletions have been processed
	 */
	async batchDeleteRooms(roomNames: string[]): Promise<void> {
		const concurrency = INTERNAL_CONFIG.CONCURRENCY_BULK_DELETE_ROOMS;
		await runConcurrently<string, void>(
			roomNames,
			async (roomName) => {
				try {
					await this.deleteRoom(roomName);
					this.logger.verbose(`Deleted LiveKit room '${roomName}' successfully.`);
				} catch (error) {
					this.logger.warn(`Error deleting LiveKit room '${roomName}': ${error}`);
					// Continue with deletion of other rooms even if one fails
				}
			},
			{ concurrency, failFast: true }
		);
	}

	/**
	 * Lists all participants in a LiveKit room.
	 *
	 * @param roomName - The name of the room to list participants from
	 * @returns A promise that resolves to an array of participant information
	 */
	async listRoomParticipants(roomName: string): Promise<ParticipantInfo[]> {
		try {
			const participants = await this.roomClient.listParticipants(roomName);
			return filterHumanParticipants(participants);
		} catch (error) {
			this.logger.error(`Error listing participants for room '${roomName}': ${error}`);
			throw internalError(`listing participants for room '${roomName}'`);
		}
	}

	async participantExists(roomName: string, participantIdentity: string): Promise<boolean> {
		try {
			const participants: ParticipantInfo[] = await this.listRoomParticipants(roomName);
			return participants.some((participant) => {
				return participant.identity === participantIdentity;
			});
		} catch (error: any) {
			this.logger.error(error);

			if (error?.cause?.code === 'ECONNREFUSED') {
				throw errorLivekitNotAvailable();
			}

			return false;
		}
	}

	/**
	 * Retrieves information about a specific participant in a LiveKit room.
	 *
	 * @param roomName - The name of the room where the participant is located
	 * @param participantIdentity - The identity of the participant to retrieve
	 * @returns A Promise that resolves to the participant's information
	 * @throws An internal error if the participant cannot be found or another error occurs
	 */
	async getParticipant(roomName: string, participantIdentity: string): Promise<ParticipantInfo> {
		try {
			return await this.roomClient.getParticipant(roomName, participantIdentity);
		} catch (error) {
			this.logger.warn(`Participant ${participantIdentity} not found in room ${roomName}: ${error}`);
			throw errorParticipantNotFound(participantIdentity, roomName);
		}
	}

	/**
	 * Updates the metadata of a participant in a LiveKit room.
	 *
	 * @param roomName - The name of the room where the participant is located
	 * @param participantIdentity - The identity of the participant whose metadata will be updated
	 * @param metadata - The new metadata to set for the participant
	 * @returns A Promise that resolves when the metadata has been successfully updated
	 * @throws An internal error if there is an issue updating the metadata
	 */
	async updateParticipantMetadata(roomName: string, participantIdentity: string, metadata: string): Promise<void> {
		try {
			await this.roomClient.updateParticipant(roomName, participantIdentity, metadata);
			this.logger.verbose(`Updated metadata for participant '${participantIdentity}' in room '${roomName}'`);
		} catch (error) {
			this.logger.error(
				`Error updating metadata for participant '${participantIdentity}' in room '${roomName}': ${error}`
			);
			throw internalError(`updating metadata for participant '${participantIdentity}' in room '${roomName}'`);
		}
	}

	async updateParticipantPermissions(
		roomName: string,
		participantIdentity: string,
		permission: Partial<ParticipantPermission>
	): Promise<void> {
		try {
			await this.roomClient.updateParticipant(roomName, participantIdentity, { permission });
		} catch (error) {
			this.logger.error(`Error updating permissions for participant '${participantIdentity}' in room '${roomName}': ${error}`);
			throw internalError(`updating permissions for participant '${participantIdentity}' in room '${roomName}'`);
		}
	}

	async allowParticipantMicrophone(roomName: string, participantIdentity: string): Promise<void> {
		const participant = await this.getParticipant(roomName, participantIdentity);
		const currentSources = participant.permission?.canPublishSources ?? [];
		const canPublishSources = currentSources.includes(TrackSource.MICROPHONE)
			? currentSources
			: [...currentSources, TrackSource.MICROPHONE];
		await this.updateParticipantPermissions(roomName, participantIdentity, {
			...participant.permission,
			canPublish: true,
			canPublishSources
		});
	}

	async allowParticipantScreenShare(roomName: string, participantIdentity: string): Promise<void> {
		const participant = await this.getParticipant(roomName, participantIdentity);
		const currentSources = participant.permission?.canPublishSources ?? [];
		const canPublishSources = [...new Set([...currentSources, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO])];
		await this.updateParticipantPermissions(roomName, participantIdentity, {
			...participant.permission,
			canPublish: true,
			canPublishSources
		});
	}

	/**
	 * Mutes every currently published microphone track in a room.
	 * Returns the number of tracks changed so the caller can provide accurate feedback.
	 */
	async muteAllMicrophones(roomName: string): Promise<number> {
		const participants = await this.listRoomParticipants(roomName);
		const audioTracks = participants.flatMap((participant) =>
			participant.tracks
				.filter((track) => track.type === TrackType.AUDIO && !track.muted)
				.map((track) => ({ participantIdentity: participant.identity, trackSid: track.sid }))
		);

		await runConcurrently(
			audioTracks,
			async ({ participantIdentity, trackSid }) => {
				await this.roomClient.mutePublishedTrack(roomName, participantIdentity, trackSid, true);
			},
			{ concurrency: 20, failFast: true }
		);

		this.logger.info(`Muted ${audioTracks.length} microphone track(s) in room '${roomName}'`);
		return audioTracks.length;
	}

	async muteParticipantMicrophone(roomName: string, participantIdentity: string): Promise<number> {
		const participant = await this.getParticipant(roomName, participantIdentity);
		const audioTracks = participant.tracks.filter((track) => track.type === TrackType.AUDIO && !track.muted);

		await runConcurrently(
			audioTracks,
			async (track) => {
				await this.roomClient.mutePublishedTrack(roomName, participantIdentity, track.sid, true);
			},
			{ concurrency: 4, failFast: true }
		);

		this.logger.info(
			`Muted ${audioTracks.length} microphone track(s) for participant '${participantIdentity}' in room '${roomName}'`
		);
		return audioTracks.length;
	}

	async stopParticipantCamera(roomName: string, participantIdentity: string): Promise<number> {
		return this.muteParticipantTracks(roomName, participantIdentity, (track) =>
			track.type === TrackType.VIDEO && track.source === TrackSource.CAMERA
		);
	}

	async stopParticipantScreenShare(roomName: string, participantIdentity: string): Promise<number> {
		return this.muteParticipantTracks(roomName, participantIdentity, (track) =>
			track.source === TrackSource.SCREEN_SHARE || track.source === TrackSource.SCREEN_SHARE_AUDIO
		);
	}

	private async muteParticipantTracks(
		roomName: string,
		participantIdentity: string,
		predicate: (track: ParticipantInfo['tracks'][number]) => boolean
	): Promise<number> {
		const participant = await this.getParticipant(roomName, participantIdentity);
		const tracks = participant.tracks.filter((track) => predicate(track) && !track.muted);
		await runConcurrently(tracks, async (track) => {
			await this.roomClient.mutePublishedTrack(roomName, participantIdentity, track.sid, true);
		}, { concurrency: 10, failFast: true });
		return tracks.length;
	}

	async deleteParticipant(roomName: string, participantIdentity: string): Promise<void> {
		const participantExists = await this.participantExists(roomName, participantIdentity);

		if (!participantExists) {
			throw errorParticipantNotFound(participantIdentity, roomName);
		}

		await this.roomClient.removeParticipant(roomName, participantIdentity);
	}

	async sendData(roomName: string, rawData: Record<string, any>, options: SendDataOptions): Promise<void> {
		// Check if the room exists before sending data
		const roomExists = await this.roomExists(roomName);

		if (!roomExists) {
			this.logger.warn(`Skipping sending data because LiveKit room '${roomName}' does not exist`);
			return;
		}

		try {
			const data: Uint8Array = new TextEncoder().encode(JSON.stringify(rawData));
			await this.roomClient.sendData(roomName, data, DataPacket_Kind.RELIABLE, options);
		} catch (error) {
			this.logger.error(`Error sending data: ${error}`);
			throw internalError(`sending data to LiveKit room '${roomName}'`);
		}
	}

	/**
	 * Checks if a participant is a standard participant (web clients).
	 * @param participant
	 */
	isStandardParticipant(participant: ParticipantInfo): boolean {
		return participant.kind === ParticipantInfo_Kind.STANDARD;
	}
}

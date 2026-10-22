import type {
	MeetRoom,
	MeetRoomAccess,
	MeetRoomAccessConfig,
	MeetRoomConfig,
	MeetRoomField,
	MeetRoomMemberPermissions,
	MeetRoomOptions,
	MeetRoomRoles,
	MeetRoomRolesConfig,
	MeetUser,
	ProjectedMeetRoom
} from '@openvidu-meet/typings';
import {
	MeetingEndAction,
	MeetRoomDeletionErrorCode,
	MeetRoomDeletionPolicyWithMeeting,
	MeetRoomDeletionPolicyWithRecordings,
	MeetRoomDeletionSuccessCode,
	MeetRoomStatus,
	MeetRoomMemberUIBadge,
	MeetUserRole
} from '@openvidu-meet/typings';
import { inject, injectable } from 'inversify';
import type { CreateOptions, Room } from 'livekit-server-sdk';
import { TrackSource } from 'livekit-server-sdk';
import merge from 'lodash.merge';
import ms from 'ms';
import { uid as secureUid } from 'uid/secure';
import { uid } from 'uid/single';
import { container } from '../config/dependency-injector.config.js';
import { INTERNAL_CONFIG } from '../config/internal-config.js';
import { MEET_ENV } from '../environment.js';
import { MeetRoomHelper } from '../helpers/room.helper.js';
import {
	errorDeletingRoom,
	errorRoomActiveMeeting,
	errorMeetingCodeNotFound,
	errorRoomNotFound,
	internalError,
	OpenViduMeetError
} from '../models/error.model.js';
import type { MeetRoomDeletionOptions } from '../models/request-context.model.js';
import { MeetRoomModel } from '../models/mongoose-schemas/room.schema.js';
import { RoomMemberRepository } from '../repositories/room-member.repository.js';
import { RoomRepository } from '../repositories/room.repository.js';
import type {
	MeetRoomPage,
	RoomQuery,
	RoomQueryWithFields,
	RoomQueryWithProjection
} from '../types/room-projection.types.js';
import { runConcurrently } from '../utils/concurrency.utils.js';
import { FrontendEventService } from './frontend-event.service.js';
import { LiveKitService } from './livekit.service.js';
import { LoggerService } from './logger.service.js';
import { RequestSessionService } from './request-session.service.js';
import type { RoomMemberService } from './room-member.service.js';

/**
 * Service for managing JMeet rooms.
 *
 * This service provides methods to create, list, retrieve, delete, and send signals to OpenVidu rooms.
 * It uses the LiveKitService to interact with the underlying LiveKit rooms.
 */
@injectable()
export class RoomService {
	constructor(
		@inject(LoggerService) protected logger: LoggerService,
		@inject(RoomRepository) protected roomRepository: RoomRepository,
		@inject(RoomMemberRepository) protected roomMemberRepository: RoomMemberRepository,
		@inject(LiveKitService) protected livekitService: LiveKitService,
		@inject(FrontendEventService) protected frontendEventService: FrontendEventService,
		@inject(RequestSessionService) protected requestSessionService: RequestSessionService
	) {}

	private async getRoomMemberService(): Promise<RoomMemberService> {
		const { RoomMemberService } = await import('./room-member.service.js');
		return container.get(RoomMemberService);
	}

	/**
	 * Creates an JMeet room with the specified options.
	 *
	 * @param {MeetRoomOptions} roomOptions - The options for creating the OpenVidu room.
	 * @param {MeetRoomServerResponseOptions} responseOpts - Options for controlling the response format (fields, extraFields)
	 * @returns {Promise<MeetRoom>} A promise that resolves to the created OpenVidu room.
	 *
	 * @throws {Error} If the room creation fails.
	 *
	 */
	async createMeetRoom(roomOptions: MeetRoomOptions): Promise<MeetRoom> {
		const { roomName, schedule, autoDeletionDate, autoDeletionPolicy, config, roles, access } = roomOptions;

		// Generate a unique room ID based on the room name
		const roomIdPrefix = MeetRoomHelper.createRoomIdPrefixFromRoomName(roomName!) || 'room';
		const roomId = `${roomIdPrefix}-${uid(15)}`;
		const meetingCode = await this.generateUniqueMeetingCode();

		const user = this.requestSessionService.getAuthenticatedUser();

		if (!user) {
			throw internalError('Cannot create room without an authenticated user');
		}

		const defaultModeratorPermissions: MeetRoomMemberPermissions = {
			canRecord: true,
			canRetrieveRecordings: true,
			canDeleteRecordings: true,
			canJoinMeeting: true,
			canShareAccessLinks: true,
			canMakeModerator: true,
			canKickParticipants: true,
			canEndMeeting: true,
			canPublishVideo: true,
			canPublishAudio: true,
			canShareScreen: true,
			canReadChat: true,
			canWriteChat: true,
			canChangeVirtualBackground: true
		};
		const defaultSpeakerPermissions: MeetRoomMemberPermissions = {
			canRecord: false,
			canRetrieveRecordings: true,
			canDeleteRecordings: false,
			canJoinMeeting: true,
			canShareAccessLinks: false,
			canMakeModerator: false,
			canKickParticipants: false,
			canEndMeeting: false,
			canPublishVideo: true,
			canPublishAudio: true,
			canShareScreen: true,
			canReadChat: true,
			canWriteChat: true,
			canChangeVirtualBackground: true
		};

		const roomRoles: MeetRoomRoles = {
			moderator: {
				permissions: { ...defaultModeratorPermissions, ...roles?.moderator?.permissions }
			},
			speaker: {
				permissions: { ...defaultSpeakerPermissions, ...roles?.speaker?.permissions }
			}
		};

		const accessConfig: MeetRoomAccess = {
			anonymous: {
				moderator: {
					enabled: access?.anonymous?.moderator?.enabled ?? true,
					url: `/room/${roomId}?secret=${secureUid(10)}`
				},
				speaker: {
					enabled: access?.anonymous?.speaker?.enabled ?? true,
					url: `/room/${roomId}?secret=${secureUid(10)}`
				},
				recording: {
					enabled: access?.anonymous?.recording?.enabled ?? true,
					url: `/room/${roomId}/recordings?secret=${secureUid(10)}`
				}
			},
			user: {
				enabled: access?.user?.enabled ?? false,
				url: `/room/${roomId}`
			}
		};

		const now = Date.now();
		const meetRoom: MeetRoom = {
			roomId,
			meetingCode,
			roomName: roomName!,
			owner: user.userId,
			creationDate: now,
			schedule,
			// maxParticipants,
			autoDeletionDate,
			autoDeletionPolicy: autoDeletionDate ? autoDeletionPolicy : undefined,
			config: config as MeetRoomConfig,
			roles: roomRoles,
			access: accessConfig,
			status: MeetRoomStatus.OPEN,
			rolesUpdatedAt: now,
			meetingEndAction: MeetingEndAction.NONE
		};
		return this.roomRepository.create(meetRoom);
	}

	/**
	 * Creates a LiveKit room for the specified Meet Room.
	 *
	 * This method creates a LiveKit room with the specified room name and metadata.
	 * The metadata includes the room options from the Meet Room.
	 **/
	async createLivekitRoom(roomId: string): Promise<Room> {
		const roomExists = await this.livekitService.roomExists(roomId);

		if (roomExists) {
			this.logger.verbose(`Room ${roomId} already exists in LiveKit.`);
			return this.livekitService.getRoom(roomId);
		}

		const meetRoom: MeetRoom = await this.getMeetRoom(roomId);
		const { MEETING_DEPARTURE_TIMEOUT, MEETING_EMPTY_TIMEOUT } = INTERNAL_CONFIG;
		const livekitRoomOptions: CreateOptions = {
			name: roomId,
			metadata: JSON.stringify({
				createdBy: MEET_ENV.NAME_ID,
				roomOptions: MeetRoomHelper.toRoomOptions(meetRoom)
			}),
			emptyTimeout: MEETING_EMPTY_TIMEOUT ? ms(MEETING_EMPTY_TIMEOUT) / 1000 : undefined,
			departureTimeout: MEETING_DEPARTURE_TIMEOUT ? ms(MEETING_DEPARTURE_TIMEOUT) / 1000 : undefined
			// maxParticipants: maxParticipants || undefined,
		};

		const room = await this.livekitService.createRoom(livekitRoomOptions);
		this.logger.verbose(`Room ${roomId} created in LiveKit with options: ${JSON.stringify(livekitRoomOptions)}.`);
		return room;
	}

	/**
	 * Updates the configuration of a specific meeting room.
	 * Supports partial updates - only provided fields will be updated.
	 *
	 * @param roomId - The unique identifier of the meeting room to update
	 * @param config - Partial config with the fields to update
	 * @returns A Promise that resolves to the updated MeetRoom object
	 */
	async updateMeetRoomConfig(roomId: string, config: Partial<MeetRoomConfig>): Promise<MeetRoom> {
		const room = await this.getMeetRoom(roomId, ['config', 'status']);

		if (room.status === MeetRoomStatus.ACTIVE_MEETING) {
			// Reject config updates during active meetings
			throw errorRoomActiveMeeting(roomId);
		}

		// Merge existing config with new config (partial update)
		const updatedConfig = merge({}, room.config, config);

		// Disable recording if E2EE is enabled
		if (updatedConfig.e2ee.enabled && updatedConfig.recording.enabled) {
			updatedConfig.recording.enabled = false;
		}

		const updatedRoom = await this.roomRepository.updatePartial(roomId, { config: updatedConfig });
		// Send signal to frontend.
		// Note: Rooms updates are not allowed during active meetings, so we don't need to send an immediate update signal to participants,
		// as they will receive the updated config when they join the meeting or when the meeting is restarted.
		// await this.frontendEventService.sendRoomConfigUpdatedSignal(roomId, updatedRoom);
		return updatedRoom;
	}

	/** Updates meeting-wide security rules while a meeting is active and broadcasts the new policy. */
	async updateActiveMeetingSecurity(
		roomId: string,
		security: MeetRoomConfig['security']
	): Promise<MeetRoom> {
		const room = await this.getMeetRoom(roomId, ['config']);
		const updatedConfig = merge({}, room.config, { security }) as MeetRoomConfig;
		const updatedRoom = await this.roomRepository.updatePartial(roomId, { config: updatedConfig });
		if (await this.livekitService.roomExists(roomId)) {
			const participants = await this.livekitService.listRoomParticipants(roomId);
			await runConcurrently(participants, async (participant) => {
				try {
					const metadata = JSON.parse(participant.metadata || '{}') as {
						badge?: MeetRoomMemberUIBadge;
						permissions?: MeetRoomMemberPermissions;
					};
					if (!metadata.permissions) return;
					const isModerator = metadata.badge && metadata.badge !== MeetRoomMemberUIBadge.OTHER;
					const canShareScreen = metadata.permissions.canShareScreen &&
						(security.screenSharePolicy === 'all_participants' || !!isModerator);
					const canPublishSources: TrackSource[] = [];
					if (metadata.permissions.canPublishAudio && (security.allowSelfUnmute || !!isModerator)) {
						canPublishSources.push(TrackSource.MICROPHONE);
					}
					if (metadata.permissions.canPublishVideo) canPublishSources.push(TrackSource.CAMERA);
					if (canShareScreen) canPublishSources.push(TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO);
					await this.livekitService.updateParticipantPermissions(roomId, participant.identity, {
						canPublish: canPublishSources.length > 0,
						canPublishSources,
						canSubscribe: true,
						canPublishData: true,
						canUpdateMetadata: true
					});
				} catch (error) {
					this.logger.warn(`Could not apply meeting security policy to '${participant.identity}': ${error}`);
				}
			}, { concurrency: 20, failFast: false });
		}
		await this.frontendEventService.sendRoomConfigUpdatedSignal(roomId, updatedRoom);
		return updatedRoom;
	}

	/**
	 * Updates the status of a specific meeting room.
	 *
	 * @param roomId - The unique identifier of the meeting room to update
	 * @param status - The new status to apply to the meeting room
	 * @returns A Promise that resolves to an object containing the updated room
	 * and a boolean indicating if the update was immediate or scheduled
	 */
	async updateMeetRoomStatus(roomId: string, status: MeetRoomStatus): Promise<{ room: MeetRoom; updated: boolean }> {
		const { status: currentStatus } = await this.getMeetRoom(roomId, ['status']);
		let updated = true;
		let fieldsToUpdate: Partial<MeetRoom>;

		// If closing the room while a meeting is active, mark it to be closed when the meeting ends
		if (status === MeetRoomStatus.CLOSED && currentStatus === MeetRoomStatus.ACTIVE_MEETING) {
			fieldsToUpdate = { meetingEndAction: MeetingEndAction.CLOSE };
			updated = false;
		} else {
			fieldsToUpdate = { status, meetingEndAction: MeetingEndAction.NONE };
		}

		const updatedRoom = await this.roomRepository.updatePartial(roomId, fieldsToUpdate);
		return { room: updatedRoom, updated };
	}

	async updateMeetingSchedule(roomId:string,schedule:MeetRoom['schedule']):Promise<MeetRoom>{return this.roomRepository.updatePartial(roomId,{schedule})}

	async cancelMeeting(roomId:string):Promise<MeetRoom>{const room=await this.getMeetRoom(roomId,['access']);const rotate=(path:string)=>`${path.split('?')[0]}?secret=${secureUid(10)}`;return this.roomRepository.updatePartial(roomId,{status:MeetRoomStatus.CLOSED,meetingEndAction:MeetingEndAction.NONE,access:{...room.access,anonymous:{moderator:{enabled:false,url:rotate(room.access.anonymous.moderator.url)},speaker:{enabled:false,url:rotate(room.access.anonymous.speaker.url)},recording:{enabled:false,url:rotate(room.access.anonymous.recording.url)}},user:{...room.access.user,enabled:false}}})}

	/**
	 * Updates the roles permissions of a specific meeting room.
	 *
	 * @param roomId - The unique identifier of the meeting room to update
	 * @param roles - Partial roles config with the fields to update
	 * @returns A Promise that resolves to the updated MeetRoom object
	 */
	async updateMeetRoomRoles(roomId: string, roles: MeetRoomRolesConfig): Promise<MeetRoom> {
		const room = await this.getMeetRoom(roomId, ['roles', 'status']);

		if (room.status === MeetRoomStatus.ACTIVE_MEETING) {
			throw errorRoomActiveMeeting(roomId);
		}

		// Merge existing roles with new roles (partial update)
		const updatedRoles = merge({}, room.roles, roles);
		const updatedRoom = await this.roomRepository.updatePartial(roomId, {
			roles: updatedRoles,
			rolesUpdatedAt: Date.now()
		});

		// Update existing room members with new effective permissions
		const roomMemberService = await this.getRoomMemberService();
		await roomMemberService.updateAllRoomMemberPermissions(roomId, updatedRoom.roles);

		return updatedRoom;
	}

	/**
	 * Updates the access configuration of a specific meeting room.
	 *
	 * @param roomId - The unique identifier of the meeting room to update
	 * @param access - Partial access config with the fields to update
	 * @returns A Promise that resolves to the updated MeetRoom object
	 */
	async updateMeetRoomAccess(roomId: string, access: MeetRoomAccessConfig): Promise<MeetRoom> {
		const room = await this.getMeetRoom(roomId, ['access', 'status']);

		if (room.status === MeetRoomStatus.ACTIVE_MEETING) {
			throw errorRoomActiveMeeting(roomId);
		}

		// Merge existing access config with new access config (partial update)
		const updatedAccess = merge({}, room.access, access);
		const updatedRoom = await this.roomRepository.updatePartial(roomId, {
			access: updatedAccess,
			rolesUpdatedAt: Date.now()
		});

		return updatedRoom;
	}

	/**
	 * Checks if a meeting room with the specified ID exists
	 *
	 * @param roomId - The ID of the meeting room to check
	 * @returns A Promise that resolves to true if the room exists, false otherwise
	 */
	async meetRoomExists(roomId: string): Promise<boolean> {
		const meetRoom = await this.roomRepository.findByRoomId(roomId, ['roomId']);
		return !!meetRoom;
	}

	/**
	 * Retrieves a list of rooms based on the provided filtering, pagination, and sorting options.
	 *
	 * @param filters - Filtering, pagination and sorting options, including optional internal access-scope filters
	 * @returns A Promise that resolves to paginated room list (with DB-optimized fields, but no HTTP filtering)
	 * @throws If there was an error retrieving the rooms
	 */
	async getAllMeetRooms(filters?: RoomQuery): Promise<MeetRoomPage<MeetRoom>>;

	async getAllMeetRooms<const TFields extends readonly MeetRoomField[]>(
		_filters: RoomQueryWithProjection<TFields>
	): Promise<MeetRoomPage<ProjectedMeetRoom<TFields>>>;

	async getAllMeetRooms(filters: RoomQueryWithFields): Promise<MeetRoomPage<MeetRoom | Partial<MeetRoom>>>;

	async getAllMeetRooms(
		filters: RoomQueryWithFields = {}
	): Promise<MeetRoomPage<MeetRoom | ProjectedMeetRoom<readonly MeetRoomField[]>>> {
		return this.roomRepository.find(filters);
	}

	/**
	 * Retrieves a specific meeting room by its unique identifier.
	 *
	 * @param roomId - The name of the room to retrieve.
	 * @param fields - Array of fields to retrieve from database (for query optimization)
	 * @returns A promise that resolves to an {@link MeetRoom} object if found, or rejects with an error if not found.
	 */
	async getMeetRoom(roomId: string): Promise<MeetRoom>;

	async getMeetRoom<const TFields extends readonly MeetRoomField[]>(
		roomId: string,
		fields: TFields
	): Promise<ProjectedMeetRoom<TFields>>;

	async getMeetRoom(roomId: string, fields?: readonly MeetRoomField[]): Promise<MeetRoom | Partial<MeetRoom>>;

	async getMeetRoom(roomId: string, fields?: readonly MeetRoomField[]): Promise<MeetRoom | Partial<MeetRoom>> {
		const room = await this.roomRepository.findByRoomId(roomId, fields);

		if (!room) {
			this.logger.error(`Meet room with ID ${roomId} not found.`);
			throw errorRoomNotFound(roomId);
		}

		return room as MeetRoom | Partial<MeetRoom>;
	}

	/**
	 * Looks up a room by its numeric meeting code (join-by-code entry).
	 * Returns a minimal projection: enough for the joiner to route into the room and
	 * confirm they typed the right meeting, without leaking access configuration.
	 */
	async getMeetRoomByMeetingCode(
		meetingCode: string
	): Promise<Pick<MeetRoom, 'roomId' | 'meetingCode' | 'roomName' | 'status'>> {
		const room = await this.roomRepository.findByMeetingCode(meetingCode, ['roomId', 'meetingCode', 'roomName', 'status']);

		if (!room) {
			this.logger.warn(`No room found for meeting code ${meetingCode}.`);
			throw errorMeetingCodeNotFound(meetingCode);
		}

		return room as Pick<MeetRoom, 'roomId' | 'meetingCode' | 'roomName' | 'status'>;
	}

	/**
	 * Generates a meeting code that does not collide with any persisted room.
	 * The sparse unique index is the final guard; this loop keeps the common path clean.
	 */
	private async generateUniqueMeetingCode(maxAttempts = 5): Promise<string> {
		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			const candidate = MeetRoomHelper.generateMeetingCode();
			const existing = await this.roomRepository.findByMeetingCode(candidate, ['roomId']);
			if (!existing) return candidate;
			this.logger.warn(`Meeting code collision on ${candidate} (attempt ${attempt}/${maxAttempts}), regenerating`);
		}
		throw internalError('Could not generate a unique meeting code');
	}

	/**
	 * Idempotent backfill: assigns a meeting code to every room created before this feature.
	 * Safe to run on every startup — rooms that already have a code are skipped.
	 */
	async backfillMeetingCodes(): Promise<number> {
		const legacyRooms = await MeetRoomModel.find({ $or: [{ meetingCode: null }, { meetingCode: { $exists: false } }] })
			.select({ roomId: 1, _id: 0 })
			.lean<{ roomId: string }[]>()
			.exec();

		if (legacyRooms.length === 0) return 0;

		let assigned = 0;
		for (const { roomId } of legacyRooms) {
			try {
				const meetingCode = await this.generateUniqueMeetingCode();
				await MeetRoomModel.updateOne(
					{ roomId, $or: [{ meetingCode: null }, { meetingCode: { $exists: false } }] },
					{ $set: { meetingCode } }
				);
				assigned++;
			} catch (error) {
				this.logger.error(`Failed to backfill meeting code for room ${roomId}:`, error);
			}
		}

		this.logger.info(`Meeting code backfill: assigned ${assigned}/${legacyRooms.length} legacy rooms`);
		return assigned;
	}

	/**
	 * Deletes a room based on the specified policies for handling active meetings and recordings.
	 *
	 * @param roomId - The unique identifier of the room to delete
	 * @param options - Deletion options including policies for handling active meetings and recordings
	 * @returns Promise with deletion result including status code, success code, message and room (if updated instead of deleted)
	 * @throws Error with specific error codes for conflict scenarios
	 */
	async deleteMeetRoom(
		roomId: string,
		options: MeetRoomDeletionOptions = {}
	): Promise<{
		successCode: MeetRoomDeletionSuccessCode;
		message: string;
		room?: MeetRoom;
	}> {
		const {
			withMeeting = MeetRoomDeletionPolicyWithMeeting.FAIL,
			withRecordings = MeetRoomDeletionPolicyWithRecordings.FAIL,
			fields
		} = options;

		try {
			this.logger.info(
				`Deleting room '${roomId}' with policies: withMeeting=${withMeeting}, withRecordings=${withRecordings}`
			);

			const { status } = await this.getMeetRoom(roomId, ['status']);
			const hasActiveMeeting = status === MeetRoomStatus.ACTIVE_MEETING;
			const hasRecordings = false; // 开源版不含录制功能

			this.logger.debug(
				`Room '${roomId}' status: hasActiveMeeting=${hasActiveMeeting}, hasRecordings=${hasRecordings}`
			);

			// Pass room object to avoid second DB fetch
			let updatedRoom = await this.executeDeletionStrategy(
				roomId,
				hasActiveMeeting,
				hasRecordings,
				withMeeting,
				withRecordings
			);

			// Apply field filters to the updated room if it is not deleted and fields were requested
			updatedRoom = updatedRoom ? MeetRoomHelper.applyFieldFilters(updatedRoom, fields) : undefined;

			return this.getDeletionResponse(
				roomId,
				hasActiveMeeting,
				hasRecordings,
				withMeeting,
				withRecordings,
				updatedRoom
			);
		} catch (error) {
			this.logger.error(`Error deleting room '${roomId}': ${error}`);
			throw error;
		}
	}

	/**
	 * Executes the deletion strategy for a room based on its state and the provided deletion policies.
	 * - Validates the deletion policies (throws if not allowed).
	 * - If no active meeting and no recordings, deletes the room directly (and its members).
	 * - If there is an active meeting, sets the meeting end action (DELETE or CLOSE) and optionally ends the meeting.
	 * - If there are recordings and policy is CLOSE, closes the room.
	 * - If force delete is requested, deletes the room and all recordings and members.
	 *
	 * @param room - The room object (already fetched from DB) to avoid duplicate queries
	 */
	protected async executeDeletionStrategy(
		roomId: string,
		hasActiveMeeting: boolean,
		hasRecordings: boolean,
		withMeeting: MeetRoomDeletionPolicyWithMeeting,
		withRecordings: MeetRoomDeletionPolicyWithRecordings
	): Promise<MeetRoom | undefined> {
		// Validate policies first (fail-fast)
		this.validateDeletionPolicies(roomId, hasActiveMeeting, hasRecordings, withMeeting, withRecordings);

		// No meeting, no recordings: simple deletion
		if (!hasActiveMeeting && !hasRecordings) {
			await Promise.all([
				this.roomMemberRepository.deleteAllByRoomId(roomId),
				this.roomRepository.deleteByRoomId(roomId)
			]);
			return undefined;
		}

		// Determine actions based on policies
		const shouldForceEndMeeting = hasActiveMeeting && withMeeting === MeetRoomDeletionPolicyWithMeeting.FORCE;
		const shouldCloseRoom = hasRecordings && withRecordings === MeetRoomDeletionPolicyWithRecordings.CLOSE;

		if (hasActiveMeeting) {
			// Set meeting end action (DELETE or CLOSE) depending on recording policy
			const meetingEndAction = shouldCloseRoom ? MeetingEndAction.CLOSE : MeetingEndAction.DELETE;
			const updatedRoom = await this.roomRepository.updatePartial(roomId, { meetingEndAction });

			if (shouldForceEndMeeting) {
				// Force end meeting by deleting the LiveKit room
				await this.livekitService.deleteRoom(roomId);
			}

			return updatedRoom;
		}

		if (shouldCloseRoom) {
			// Close room instead of deleting if recordings exist and policy is CLOSE
			const updatedRoom = await this.roomRepository.updatePartial(roomId, { status: MeetRoomStatus.CLOSED });
			return updatedRoom;
		}

		// Force delete: delete room and all members
		await Promise.all([
			this.roomMemberRepository.deleteAllByRoomId(roomId),
			this.roomRepository.deleteByRoomId(roomId)
		]);
		return undefined;
	}

	/**
	 * Validates deletion policies and throws appropriate errors for conflicts.
	 */
	protected validateDeletionPolicies(
		roomId: string,
		hasActiveMeeting: boolean,
		hasRecordings: boolean,
		withMeeting: MeetRoomDeletionPolicyWithMeeting,
		withRecordings: MeetRoomDeletionPolicyWithRecordings
	) {
		const baseMessage = `Room '${roomId}'`;

		// Meeting policy validation
		if (hasActiveMeeting && withMeeting === MeetRoomDeletionPolicyWithMeeting.FAIL) {
			if (hasRecordings) {
				throw errorDeletingRoom(
					MeetRoomDeletionErrorCode.ROOM_WITH_RECORDINGS_HAS_ACTIVE_MEETING,
					`${baseMessage} with recordings cannot be deleted because it has an active meeting.`
				);
			} else {
				throw errorDeletingRoom(
					MeetRoomDeletionErrorCode.ROOM_HAS_ACTIVE_MEETING,
					`${baseMessage} cannot be deleted because it has an active meeting.`
				);
			}
		}

		// Recording policy validation
		if (hasRecordings && withRecordings === MeetRoomDeletionPolicyWithRecordings.FAIL) {
			if (hasActiveMeeting) {
				if (withMeeting === MeetRoomDeletionPolicyWithMeeting.WHEN_MEETING_ENDS) {
					throw errorDeletingRoom(
						MeetRoomDeletionErrorCode.ROOM_WITH_ACTIVE_MEETING_HAS_RECORDINGS_CANNOT_SCHEDULE_DELETION,
						`${baseMessage} with active meeting cannot be scheduled to be deleted because it has recordings.`
					);
				} else {
					throw errorDeletingRoom(
						MeetRoomDeletionErrorCode.ROOM_WITH_ACTIVE_MEETING_HAS_RECORDINGS,
						`${baseMessage} with active meeting cannot be deleted because it has recordings.`
					);
				}
			} else {
				throw errorDeletingRoom(
					MeetRoomDeletionErrorCode.ROOM_HAS_RECORDINGS,
					`${baseMessage} cannot be deleted because it has recordings.`
				);
			}
		}
	}

	/**
	 * Gets the appropriate response information based on room state and policies.
	 */
	private getDeletionResponse(
		roomId: string,
		hasActiveMeeting: boolean,
		hasRecordings: boolean,
		withMeeting: MeetRoomDeletionPolicyWithMeeting,
		withRecordings: MeetRoomDeletionPolicyWithRecordings,
		room?: MeetRoom
	): {
		successCode: MeetRoomDeletionSuccessCode;
		message: string;
		room?: MeetRoom;
	} {
		const baseMessage = `Room '${roomId}'`;

		// No meeting, no recordings
		if (!hasActiveMeeting && !hasRecordings) {
			return {
				successCode: MeetRoomDeletionSuccessCode.ROOM_DELETED,
				message: `${baseMessage} deleted successfully`
			};
		}

		// Has active meeting, no recordings
		if (hasActiveMeeting && !hasRecordings) {
			switch (withMeeting) {
				case MeetRoomDeletionPolicyWithMeeting.FORCE:
					return {
						successCode: MeetRoomDeletionSuccessCode.ROOM_WITH_ACTIVE_MEETING_DELETED,
						message: `${baseMessage} with active meeting deleted successfully`
					};
				case MeetRoomDeletionPolicyWithMeeting.WHEN_MEETING_ENDS:
					return {
						successCode: MeetRoomDeletionSuccessCode.ROOM_WITH_ACTIVE_MEETING_SCHEDULED_TO_BE_DELETED,
						message: `${baseMessage} with active meeting scheduled to be deleted when the meeting ends`,
						room
					};
				default:
					throw internalError(`Unexpected meeting deletion policy: ${withMeeting}`);
			}
		}

		// No active meeting, has recordings
		if (!hasActiveMeeting && hasRecordings) {
			switch (withRecordings) {
				case MeetRoomDeletionPolicyWithRecordings.FORCE:
					return {
						successCode: MeetRoomDeletionSuccessCode.ROOM_AND_RECORDINGS_DELETED,
						message: `${baseMessage} and its recordings deleted successfully`
					};
				case MeetRoomDeletionPolicyWithRecordings.CLOSE:
					return {
						successCode: MeetRoomDeletionSuccessCode.ROOM_CLOSED,
						message: `${baseMessage} has been closed instead of deleted because it has recordings`,
						room
					};
				default:
					throw internalError(`Unexpected recording deletion policy: ${withRecordings}`);
			}
		}

		// Has active meeting, has recordings
		switch (withMeeting) {
			case MeetRoomDeletionPolicyWithMeeting.FORCE: {
				switch (withRecordings) {
					case MeetRoomDeletionPolicyWithRecordings.FORCE:
						return {
							successCode: MeetRoomDeletionSuccessCode.ROOM_WITH_ACTIVE_MEETING_AND_RECORDINGS_DELETED,
							message: `${baseMessage} with active meeting and its recordings deleted successfully`
						};
					case MeetRoomDeletionPolicyWithRecordings.CLOSE:
						return {
							successCode: MeetRoomDeletionSuccessCode.ROOM_WITH_ACTIVE_MEETING_CLOSED,
							message: `${baseMessage} with active meeting has been closed instead of deleted because it has recordings`,
							room
						};
					default:
						throw internalError(`Unexpected recording deletion policy: ${withRecordings}`);
				}
			}

			case MeetRoomDeletionPolicyWithMeeting.WHEN_MEETING_ENDS: {
				switch (withRecordings) {
					case MeetRoomDeletionPolicyWithRecordings.FORCE:
						return {
							successCode:
								MeetRoomDeletionSuccessCode.ROOM_WITH_ACTIVE_MEETING_AND_RECORDINGS_SCHEDULED_TO_BE_DELETED,
							message: `${baseMessage} with active meeting and its recordings scheduled to be deleted when the meeting ends`,
							room
						};
					case MeetRoomDeletionPolicyWithRecordings.CLOSE:
						return {
							successCode: MeetRoomDeletionSuccessCode.ROOM_WITH_ACTIVE_MEETING_SCHEDULED_TO_BE_CLOSED,
							message: `${baseMessage} with active meeting scheduled to be closed when the meeting ends because it has recordings`,
							room
						};
					default:
						throw internalError(`Unexpected recording deletion policy: ${withRecordings}`);
				}
			}

			default:
				throw internalError(`Unexpected meeting deletion policy: ${withMeeting}`);
		}
	}

	/**
	 * Deletes multiple rooms in bulk using the deleteMeetRoom method, processing them in batches.
	 *
	 * @param roomsOrRoomIds - Array of room identifiers to be deleted.
	 * If an array of MeetRoom objects is provided, the roomId will be extracted from each object.
	 * @param options - Deletion options including policies for handling active meetings and recordings
	 * @returns Promise with arrays of successful and failed deletions
	 */
	async bulkDeleteMeetRooms(
		roomsOrRoomIds: string[] | MeetRoom[],
		options: MeetRoomDeletionOptions = {}
	): Promise<{
		successful: {
			roomId: string;
			successCode: MeetRoomDeletionSuccessCode;
			message: string;
			room?: MeetRoom;
		}[];
		failed: {
			roomId: string;
			error: string;
			message: string;
		}[];
	}> {
		const {
			withMeeting = MeetRoomDeletionPolicyWithMeeting.FAIL,
			withRecordings = MeetRoomDeletionPolicyWithRecordings.FAIL,
			fields
		} = options;

		this.logger.info(
			`Starting bulk deletion of ${roomsOrRoomIds.length} rooms with policies: withMeeting=${withMeeting}, withRecordings=${withRecordings}`
		);

		type SuccessfulDelete = {
			roomId: string;
			successCode: MeetRoomDeletionSuccessCode;
			message: string;
			room?: MeetRoom;
		};
		type FailedDelete = {
			roomId: string;
			error: string;
			message: string;
		};

		const settledResults = await runConcurrently<string | MeetRoom, SuccessfulDelete>(
			roomsOrRoomIds,
			async (room) => {
				const roomId = typeof room === 'string' ? room : room.roomId;

				try {
					const deletionResult =
						typeof room === 'string'
							? await this.deleteMeetRoom(roomId, { withMeeting, withRecordings, fields })
							: await this.deleteMeetRoom(roomId, {
									withMeeting: room.autoDeletionPolicy?.withMeeting,
									withRecordings: room.autoDeletionPolicy?.withRecordings,
									fields
								});
					this.logger.info(deletionResult.message);

					return {
						roomId,
						successCode: deletionResult.successCode,
						message: deletionResult.message,
						room: deletionResult.room
					};
				} catch (error) {
					const meetError =
						error instanceof OpenViduMeetError ? error : internalError(`deleting room '${roomId}'`);

					throw {
						roomId,
						error: meetError.name,
						message: meetError.message
					} as FailedDelete;
				}
			},
			{ concurrency: INTERNAL_CONFIG.CONCURRENCY_BULK_DELETE_ROOMS }
		);

		const successful: SuccessfulDelete[] = [];
		const failed: FailedDelete[] = [];

		settledResults.forEach((result) => {
			if (result.status === 'fulfilled') {
				successful.push(result.value);
			} else {
				failed.push(result.reason as FailedDelete);
			}
		});

		this.logger.info(
			`Bulk deletion completed: ${successful.length}/${roomsOrRoomIds.length} successful, ${failed.length}/${roomsOrRoomIds.length} failed`
		);
		return { successful, failed };
	}

	/**
	 * Checks if a user is the owner of a room.
	 *
	 * @param roomId - The ID of the room
	 * @param userId - The ID of the user
	 * @returns A promise that resolves to true if the user is the owner, false otherwise
	 * @throws Error if room not found
	 */
	async isRoomOwner(roomId: string, userId: string): Promise<boolean> {
		const { owner } = await this.getMeetRoom(roomId, ['owner']);
		return owner === userId;
	}

	/**
	 * Validates if the provided secret matches one of the room's secrets for anonymous access.
	 *
	 * @param roomId - The ID of the room
	 * @param secret - The secret to validate
	 * @returns A promise that resolves to true if the secret is valid, false otherwise
	 * @throws Error if room not found
	 */
	async isValidRoomSecret(roomId: string, secret: string): Promise<boolean> {
		const { access } = await this.getMeetRoom(roomId, ['access']);
		const { moderatorSecret, speakerSecret, recordingSecret } = MeetRoomHelper.extractSecretsFromRoom(access);
		const allSecrets = [moderatorSecret, speakerSecret, recordingSecret];
		return allSecrets.includes(secret);
	}

	/**
	 * Retrieves the permissions of the authenticated room member.
	 *
	 * - If the user is authenticated via room member token, their permissions are obtained from the token metadata.
	 * - If the user is admin or the room owner, they have all permissions.
	 * - If the user is a room member, their permissions are obtained from their room member info.
	 * - If the user is authenticated but not a room member, permissions depend on whether user access is enabled
	 * (speaker permissions if enabled, no permissions if not).
	 * - If there's no authenticated user nor room member token, returns all permissions.
	 * This is necessary for methods invoked by system processes (e.g., room auto-deletion).
	 *
	 * @param roomId The ID of the room.
	 * @returns A promise that resolves to the MeetRoomMemberPermissions object.
	 */
	async getAuthenticatedRoomMemberPermissions(roomId: string): Promise<MeetRoomMemberPermissions> {
		const roomMemberService = await this.getRoomMemberService();
		const user = this.requestSessionService.getAuthenticatedUser();
		const memberRoomId = this.requestSessionService.getRoomIdFromMember();

		// Room member token
		if (memberRoomId) {
			if (memberRoomId !== roomId) {
				return roomMemberService.getNoPermissions();
			}

			return this.requestSessionService.getRoomMemberPermissions()!;
		}

		// Authenticated user
		if (user) {
			const isAdmin = user.role === MeetUserRole.ADMIN;
			const { owner, access, roles } = await this.getMeetRoom(roomId, ['owner', 'access', 'roles']);
			const isOwner = owner === user.userId;

			// Admins and owners have all permissions
			if (isAdmin || isOwner) {
				return roomMemberService.getAllPermissions();
			}

			// Get permissions for room members
			const member = await roomMemberService.getRoomMember(roomId, user.userId, ['effectivePermissions']);

			if (member) {
				return member.effectivePermissions;
			}

			// If not a room member, check if user access is enabled to determine if we should return speaker permissions or no permissions
			if (access.user.enabled) {
				return roles.speaker.permissions;
			}

			return roomMemberService.getNoPermissions();
		}

		// No authenticated user nor room member token - return all permissions for system processes
		return roomMemberService.getAllPermissions();
	}

	/**
	 * Checks if a user can access a specific room based on their role.
	 *
	 * @param roomId The ID of the room to check access for.
	 * @param user The user object containing user details and role.
	 * @returns A promise that resolves to true if the user can access the room, false otherwise.
	 * @throws Error if room not found
	 */
	async canUserAccessRoom(roomId: string, user: MeetUser): Promise<boolean> {
		// Verify room exists first (throws 404 if not found)
		const { owner, access } = await this.getMeetRoom(roomId, ['owner', 'access']);

		if (user.role === MeetUserRole.ADMIN) {
			// Admins can access all rooms
			return true;
		}

		if (access.user.enabled) {
			// Users can access rooms with user access enabled
			return true;
		}

		// Users can access rooms they own or are members of
		const isOwner = owner === user.userId;

		if (isOwner) {
			return true;
		}

		const roomMemberService = await this.getRoomMemberService();
		const isMember = await roomMemberService.isRoomMember(roomId, user.userId);
		return isMember;
	}
}

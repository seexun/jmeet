import type {
	LiveKitPermissions,
	MeetRoomMember,
	MeetRoomMemberField,
	MeetRoomMemberOptions,
	MeetRoomMemberPermissions,
	MeetRoomMemberTokenMetadata,
	MeetRoomMemberTokenOptions,
	MeetRoomRoles,
	ProjectedMeetRoomMember
} from '@openvidu-meet/typings';
import {
	MeetParticipantModerationAction,
	MeetRoomMemberRole,
	MeetRoomMemberType,
	MeetRoomMemberUIBadge,
	MeetRoomStatus,
	MeetUserRole,
	TrackSource
} from '@openvidu-meet/typings';
import { inject, injectable } from 'inversify';
import type { ParticipantInfo } from 'livekit-server-sdk';
import merge from 'lodash.merge';
import { uid as secureUid } from 'uid/secure';
import { uid } from 'uid/single';
import { INTERNAL_CONFIG } from '../config/internal-config.js';
import { MEET_ENV } from '../environment.js';
import { MeetRoomHelper } from '../helpers/room.helper.js';
import {
	errorAnonymousAccessDisabled,
	errorInsufficientPermissions,
	errorInvalidRoomSecret,
	errorInvalidToken,
	errorMeetingLocked,
	errorHostNotPresent,
	errorParticipantCannotBeDemotedFromModerator,
	errorParticipantCannotBePromotedToModerator,
	errorParticipantNameRequiredForMeetingJoin,
	errorRoomClosed,
	errorRoomMemberAlreadyExists,
	errorRoomMemberCannotBeOwnerOrAdmin,
	errorRoomMemberNotFound,
	errorUnauthorized,
	errorUserNotFound,
	OpenViduMeetError
} from '../models/error.model.js';
import { RoomMemberRepository } from '../repositories/room-member.repository.js';
import type {
	MeetRoomMemberPage,
	RoomMemberQuery,
	RoomMemberQueryWithFields,
	RoomMemberQueryWithProjection
} from '../types/room-member-projection.types.js';
import { runConcurrently } from '../utils/concurrency.utils.js';
import { FrontendEventService } from './frontend-event.service.js';
import { LiveKitService } from './livekit.service.js';
import { LoggerService } from './logger.service.js';
import { ParticipantNameService } from './participant-name.service.js';
import { RequestSessionService } from './request-session.service.js';
import { RoomService } from './room.service.js';
import { TokenService } from './token.service.js';
import { UserService } from './user.service.js';

interface ResolvedPermissionSource {
	memberId?: string;
	userId?: string;
	name?: string;
	permissions: MeetRoomMemberPermissions;
	badge?: MeetRoomMemberUIBadge;
}

interface ParticipantMeetingMetadata extends MeetRoomMemberTokenMetadata {
	originalPermissions?: MeetRoomMemberPermissions;
}

/**
 * Service for managing room members and meeting participants.
 */
@injectable()
export class RoomMemberService {
	constructor(
		@inject(LoggerService) protected logger: LoggerService,
		@inject(RoomMemberRepository) protected roomMemberRepository: RoomMemberRepository,
		@inject(RoomService) protected roomService: RoomService,
		@inject(UserService) protected userService: UserService,
		@inject(ParticipantNameService) protected participantNameService: ParticipantNameService,
		@inject(FrontendEventService) protected frontendEventService: FrontendEventService,
		@inject(LiveKitService) protected livekitService: LiveKitService,
		@inject(TokenService) protected tokenService: TokenService,
		@inject(RequestSessionService) protected requestSessionService: RequestSessionService
	) {}

	/**
	 * Creates a new room member.
	 *
	 * @param roomId - The ID of the room
	 * @param memberOptions - The options for creating the room member
	 * @returns A promise that resolves to the created MeetRoomMember object
	 */
	async createRoomMember(roomId: string, memberOptions: MeetRoomMemberOptions): Promise<MeetRoomMember> {
		const { userId, name, baseRole, customPermissions } = memberOptions;

		let memberId: string;
		let memberName: string;
		let memberType: MeetRoomMemberType;
		let accessUrl = `/room/${roomId}`;

		if (userId) {
			// User
			const user = await this.userService.getUser(userId, ['userId', 'name', 'role']);

			if (!user) {
				throw errorUserNotFound(userId);
			}

			// Check if user is already a member of the room
			const memberExists = await this.isRoomMember(roomId, userId);

			if (memberExists) {
				throw errorRoomMemberAlreadyExists(roomId, userId);
			}

			// Check that user is not admin or the owner of the room
			const isOwner = await this.roomService.isRoomOwner(roomId, userId);

			if (user.role === MeetUserRole.ADMIN || isOwner) {
				throw errorRoomMemberCannotBeOwnerOrAdmin(roomId, userId);
			}

			// Use userId as memberId and user's name
			memberId = userId;
			memberName = user.name;
			memberType = MeetRoomMemberType.USER;
		} else if (name) {
			// Identified guest
			// Generate memberId and use provided name
			memberId = `guest-${secureUid(10)}`;
			memberName = name;
			memberType = MeetRoomMemberType.IDENTIFIED_GUEST;
			accessUrl += `?secret=${memberId}`;
		} else {
			throw new Error('Either userId or name must be provided');
		}

		// Compute effective permissions
		const { roles } = await this.roomService.getMeetRoom(roomId, ['roles']);
		const effectivePermissions = this.computeEffectivePermissions(roles, baseRole, customPermissions);

		const now = Date.now();
		const roomMember = {
			memberId,
			roomId,
			type: memberType,
			name: memberName,
			membershipDate: now,
			accessUrl,
			baseRole,
			customPermissions,
			effectivePermissions,
			permissionsUpdatedAt: now
		};
		return this.roomMemberRepository.create(roomMember);
	}

	/**
	 * Computes effective permissions by merging base role permissions with custom permissions.
	 *
	 * @param roomRoles - The room roles configuration
	 * @param baseRole - The base role of the member
	 * @param customPermissions - Optional custom permissions that override the base role
	 * @returns The effective permissions object
	 */
	protected computeEffectivePermissions(
		roomRoles: MeetRoomRoles,
		baseRole: MeetRoomMemberRole,
		customPermissions?: Partial<MeetRoomMemberPermissions>
	): MeetRoomMemberPermissions {
		const basePermissions = roomRoles[baseRole].permissions;
		return merge({}, basePermissions, customPermissions);
	}

	/**
	 * Checks if a user or identified guest is a member of a room.
	 *
	 * @param roomId - The ID of the room
	 * @param memberId - The ID of the member
	 * @returns A promise that resolves to true if the user is a member, false otherwise
	 * @throws Error if room not found
	 */
	async isRoomMember(roomId: string, memberId: string): Promise<boolean> {
		// Verify room exists first
		await this.roomService.getMeetRoom(roomId, ['roomId']);
		const member = await this.roomMemberRepository.findByRoomAndMemberId(roomId, memberId, ['memberId']);
		return !!member;
	}

	/**
	 * Retrieves a specific room member by their ID.
	 *
	 * @param roomId - The ID of the room
	 * @param memberId - The ID of the member
	 * @param fields - Array of field names to include in the result
	 * @returns A promise that resolves to the MeetRoomMember object or null if not found
	 */
	async getRoomMember(roomId: string, memberId: string): Promise<MeetRoomMember | null>;

	async getRoomMember<const TFields extends readonly MeetRoomMemberField[]>(
		roomId: string,
		memberId: string,
		fields: TFields
	): Promise<ProjectedMeetRoomMember<TFields> | null>;

	async getRoomMember(
		roomId: string,
		memberId: string,
		fields?: readonly MeetRoomMemberField[]
	): Promise<MeetRoomMember | Partial<MeetRoomMember> | null>;

	async getRoomMember(
		roomId: string,
		memberId: string,
		fields?: readonly MeetRoomMemberField[]
	): Promise<MeetRoomMember | Partial<MeetRoomMember> | null> {
		return this.roomMemberRepository.findByRoomAndMemberId(roomId, memberId, fields);
	}

	/**
	 * Retrieves all members of a room with filtering and pagination.
	 *
	 * @param roomId - The ID of the room
	 * @param filters - Filters for the query
	 * @returns A promise that resolves to an object containing the members and pagination info
	 */
	async getAllRoomMembers(roomId: string, filters?: RoomMemberQuery): Promise<MeetRoomMemberPage<MeetRoomMember>>;

	async getAllRoomMembers<const TFields extends readonly MeetRoomMemberField[]>(
		roomId: string,
		filters: RoomMemberQueryWithProjection<TFields>
	): Promise<MeetRoomMemberPage<ProjectedMeetRoomMember<TFields>>>;

	async getAllRoomMembers(
		roomId: string,
		filters: RoomMemberQueryWithFields
	): Promise<MeetRoomMemberPage<MeetRoomMember | Partial<MeetRoomMember>>>;

	async getAllRoomMembers(
		roomId: string,
		filters: RoomMemberQueryWithFields = {}
	): Promise<MeetRoomMemberPage<MeetRoomMember | Partial<MeetRoomMember>>> {
		const response = await this.roomMemberRepository.findByRoomId(roomId, filters);
		return response;
	}

	/**
	 * Updates an existing room member.
	 *
	 * @param roomId - The ID of the room
	 * @param memberId - The ID of the member to update
	 * @param updates - The fields to update (baseRole and/or customPermissions)
	 * @returns A promise that resolves to the updated MeetRoomMember object
	 */
	async updateRoomMember(
		roomId: string,
		memberId: string,
		updates: { baseRole?: MeetRoomMemberRole; customPermissions?: Partial<MeetRoomMemberPermissions> }
	): Promise<MeetRoomMember> {
		const member = await this.getRoomMember(roomId, memberId, ['baseRole', 'customPermissions']);

		if (!member) {
			throw errorRoomMemberNotFound(roomId, memberId);
		}

		const nextBaseRole = updates.baseRole ?? member.baseRole;
		const nextCustomPermissions = updates.customPermissions ?? member.customPermissions;

		// Recompute effective permissions
		const { roles } = await this.roomService.getMeetRoom(roomId, ['roles']);
		const effectivePermissions = this.computeEffectivePermissions(roles, nextBaseRole, nextCustomPermissions);

		const updatedMember = await this.roomMemberRepository.updatePartial(roomId, memberId, {
			baseRole: nextBaseRole,
			customPermissions: nextCustomPermissions,
			effectivePermissions,
			permissionsUpdatedAt: Date.now()
		});

		if (!effectivePermissions.canJoinMeeting) {
			// If member lost permission to join meeting, kick them out if they are currently in a meeting
			await this.kickMembersFromMeetingInBatches(roomId, [memberId]);
		} else {
			// Send a signal to the participant to regenerate their token and update permissions in real-time if they are currently in a meeting
			await this.notifyParticipantPermissionsUpdate(roomId, memberId);
		}

		return updatedMember;
	}

	/**
	 * Updates effective permissions for all members of a room based on the new room roles permissions.
	 * This method should be called when room roles are updated to ensure all members
	 * have their effective permissions recalculated.
	 *
	 * @param roomId - The ID of the room
	 * @param roomRoles - The updated room roles configuration
	 * @returns A promise that resolves when all members have been updated
	 */
	async updateAllRoomMemberPermissions(roomId: string, roomRoles: MeetRoomRoles): Promise<void> {
		this.logger.verbose(`Updating effective permissions for all members in room '${roomId}'`);

		let batchNumber = 0;
		let nextPageToken: string | undefined;
		let totalUpdated = 0;

		do {
			batchNumber++;

			// Get a batch of members
			const {
				members,
				isTruncated,
				nextPageToken: token
			} = await this.getAllRoomMembers(roomId, {
				maxItems: 100,
				nextPageToken,
				fields: ['memberId', 'baseRole', 'customPermissions']
			});

			if (members.length === 0) {
				break;
			}

			this.logger.verbose(`Processing batch ${batchNumber} with ${members.length} members in room '${roomId}'`);

			// Update each member's effective permissions in this batch
			await runConcurrently(
				members,
				async (member) => {
					try {
						// Recalculate effective permissions based on new room roles
						const effectivePermissions = this.computeEffectivePermissions(
							roomRoles,
							member.baseRole,
							member.customPermissions
						);

						// Update the member with new effective permissions
						await this.roomMemberRepository.updatePartial(roomId, member.memberId, {
							effectivePermissions,
							permissionsUpdatedAt: Date.now()
						});

						this.logger.verbose(
							`Updated effective permissions for member '${member.memberId}' in room '${roomId}'`
						);
					} catch (error) {
						this.logger.error(
							`Failed to update effective permissions for member '${member.memberId}' in room '${roomId}':`,
							error
						);
						// Continue with other members even if one fails
					}
				},
				{ concurrency: INTERNAL_CONFIG.CONCURRENCY_BULK_UPDATE_PERMISSIONS, failFast: true }
			);

			totalUpdated += members.length;
			nextPageToken = isTruncated ? token : undefined;

			this.logger.verbose(`Completed batch ${batchNumber}, total updated: ${totalUpdated} members`);
		} while (nextPageToken);

		if (totalUpdated === 0) {
			this.logger.verbose(`No members found in room '${roomId}' to update`);
			return;
		}

		this.logger.info(`Successfully updated effective permissions for ${totalUpdated} members in room '${roomId}'`);
	}

	/**
	 * Deletes a room member.
	 *
	 * @param roomId - The ID of the room
	 * @param memberId - The ID of the member to delete
	 */
	async deleteRoomMember(roomId: string, memberId: string): Promise<void> {
		const memberExists = await this.isRoomMember(roomId, memberId);

		if (!memberExists) {
			throw errorRoomMemberNotFound(roomId, memberId);
		}

		// If member is currently in a meeting, kick them out first
		await this.kickMembersFromMeetingInBatches(roomId, [memberId]);

		return this.roomMemberRepository.deleteByRoomAndMemberId(roomId, memberId);
	}

	/**
	 * Deletes multiple room members in bulk.
	 *
	 * @param roomId - The ID of the room
	 * @param memberIds - Array of member IDs to delete
	 * @returns A promise that resolves to an object with successful and failed deletions
	 */
	async bulkDeleteRoomMembers(
		roomId: string,
		memberIds: string[]
	): Promise<{
		deleted: string[];
		failed: { memberId: string; error: string }[];
	}> {
		const membersToDelete = await this.roomMemberRepository.findByRoomAndMemberIds(roomId, memberIds, ['memberId']);
		const foundMemberIds = membersToDelete.map((m) => m.memberId);
		const foundMemberIdsSet = new Set(foundMemberIds);

		const failed = memberIds
			.filter((id) => !foundMemberIdsSet.has(id))
			.map((id) => ({ memberId: id, error: 'Room member not found' }));

		if (foundMemberIds.length > 0) {
			// Kick participants that are currently in a meeting before deletion
			await this.kickMembersFromMeetingInBatches(roomId, foundMemberIds);

			await this.roomMemberRepository.deleteByRoomIdAndMemberIds(roomId, foundMemberIds);
		}

		return {
			deleted: foundMemberIds,
			failed
		};
	}

	/**
	 * Generates a room member token.
	 *
	 * @param roomId - The room identifier
	 * @param tokenOptions - Options for token generation
	 * @param previousToken - An optional existing token to regenerate from
	 * @returns A promise that resolves to the generated token
	 */
	async generateRoomMemberToken(
		roomId: string,
		tokenOptions: MeetRoomMemberTokenOptions,
		previousToken?: string
	): Promise<string> {
		const { secret, joinMeeting = false, participantName, waitingRequestId } = tokenOptions;

		const [secretSource, authenticatedSource, room] = await Promise.all([
			secret ? this.resolvePermissionSourceFromSecret(roomId, secret) : Promise.resolve(undefined),
			this.resolvePermissionSourceFromAuthenticatedUser(roomId),
			this.roomService.getMeetRoom(roomId, ['roles'])
		]);

		if (!secretSource && !authenticatedSource) {
			throw errorUnauthorized();
		}

		const mergedPermissions = this.mergePermissions(secretSource?.permissions, authenticatedSource?.permissions);
		let badge = authenticatedSource?.badge;

		if (!badge) {
			badge = this.resolveBadgeFromPermissions(mergedPermissions, room.roles.moderator.permissions);
		}

		const tokenMetadata: MeetRoomMemberTokenMetadata = {
			iat: Date.now(),
			roomId,
			memberId: secretSource?.memberId || authenticatedSource?.memberId,
			userId: authenticatedSource?.userId,
			permissions: mergedPermissions,
			badge
		};

		if (joinMeeting) {
			tokenMetadata.livekitUrl = MEET_ENV.LIVEKIT_URL;
			let resolvedParticipantName = participantName || secretSource?.name || authenticatedSource?.name;
			let participantIdentity: string | undefined;

			// If regenerating an existing token for joining a meeting, use the participant identity from the previous token's context
			// to ensure they keep the same identity in LiveKit and maintain their presence in the meeting.
			if (previousToken) {
				const tokenContext = await this.getValidatedRoomMemberTokenContext(roomId, previousToken);

				if (tokenContext.participantIdentity && tokenContext.participantName) {
					participantIdentity = tokenContext.participantIdentity;
					resolvedParticipantName = tokenContext.participantName;
				}
			}

			return this.generateTokenForJoiningMeeting(
				roomId,
				tokenMetadata,
				resolvedParticipantName,
				participantIdentity,
				waitingRequestId
			);
		}

		this.logger.verbose(
			`Generating room member token for accessing room resources but not joining a meeting for room '${roomId}'`
		);
		return this.tokenService.generateRoomMemberToken({ tokenMetadata });
	}

	/**
	 * Generates a room member token for joining a meeting. This method handles both initial token generation when joining a meeting
	 * for the first time and token regeneration when refreshing an existing token while in a meeting.
	 * When regenerating a token, it ensures that the participant keeps the same identity in LiveKit to maintain their presence in the meeting
	 * and updates their permissions based on the current LiveKit participant metadata.
	 *
	 * @param roomId - The ID of the room
	 * @param tokenMetadata - The metadata to include in the token
	 * @param participantName - The name of the participant (required for initial generation)
	 * @param participantIdentity - The identity of the participant (required for regeneration)
	 * @returns A promise that resolves to the generated token
	 */
	protected async generateTokenForJoiningMeeting(
		roomId: string,
		tokenMetadata: MeetRoomMemberTokenMetadata,
		participantName?: string,
		participantIdentity?: string,
		waitingRequestId?: string
	): Promise<string> {
		// Check that room is open
		const { status, roles, config } = await this.roomService.getMeetRoom(roomId, ['status', 'roles', 'config']);

		if (status === MeetRoomStatus.CLOSED) {
			throw errorRoomClosed(roomId);
		}

		// Check that member has permission to join meeting
		if (!tokenMetadata.permissions.canJoinMeeting) {
			throw errorInsufficientPermissions();
		}

		const isRefresh = !!participantIdentity;
		const isModerator = tokenMetadata.badge !== MeetRoomMemberUIBadge.OTHER;
		const security = config?.security;

		if (!isRefresh && !isModerator && security?.locked) {
			throw errorMeetingLocked(roomId);
		}

		if (!isRefresh && !isModerator && security?.allowJoinBeforeHost === false) {
			const participants = (await this.livekitService.roomExists(roomId))
				? await this.livekitService.listRoomParticipants(roomId)
				: [];
			const hostPresent = participants.some((participant) => {
				try {
					const metadata = JSON.parse(participant.metadata || '{}') as MeetRoomMemberTokenMetadata;
					return metadata.badge && metadata.badge !== MeetRoomMemberUIBadge.OTHER;
				} catch {
					return false;
				}
			});
			if (!hostPresent) throw errorHostNotPresent(roomId);
		}

		if (!isRefresh) {
			// GENERATION MODE

			// Name is required for joining a meeting
			if (!participantName) {
				throw errorParticipantNameRequiredForMeetingJoin();
			}

			this.logger.verbose(
				`Generating room member token for joining a meeting for '${participantName}' in room '${roomId}'`
			);

			try {
				// Reserve a unique name for the participant
				participantName = await this.participantNameService.reserveUniqueName(roomId, participantName);
				this.logger.verbose(`Reserved unique name '${participantName}' for room '${roomId}'`);
			} catch (error) {
				this.logger.error(`Failed to reserve unique name '${participantName}' for room '${roomId}':`, error);
				throw error;
			}

			// Create the LiveKit room if it doesn't exist. Release the reserved
			// participant name when infrastructure is unavailable so a retry can
			// reuse the original name immediately.
			try {
				await this.roomService.createLivekitRoom(roomId);
			} catch (error) {
				await this.participantNameService.releaseName(roomId, participantName);
				throw error;
			}

			if (tokenMetadata.memberId || tokenMetadata.userId) {
				// Use memberId as participant identity for identified members
				// (users or identified guests with a record in the database)
				// Use userId as participant identity for users without a member record
				participantIdentity = tokenMetadata.memberId || tokenMetadata.userId;
			} else {
				// For anonymous users, create a unique participant identity based on the provided participant name
				const identityPrefix = this.createParticipantIdentityPrefixFromName(participantName) || 'participant';
				participantIdentity = `${identityPrefix}-${uid(15)}`;
			}
		} else {
			// REFRESH MODE
			this.logger.verbose(
				`Regenerating room member token for participant '${participantIdentity}' in room '${roomId}'`
			);

			const participant = await this.getParticipantFromMeeting(roomId, participantIdentity!);
			participantName = participant.name || participantName;

			const participantMetadata = this.parseParticipantMeetingMetadata(participant.metadata);
			const isCurrentlyPromotedModerator = participantMetadata.isPromotedModerator === true;

			if (isCurrentlyPromotedModerator && tokenMetadata.badge === MeetRoomMemberUIBadge.OTHER) {
				const mergedPermissions = this.mergePermissions(
					tokenMetadata.permissions,
					roles[MeetRoomMemberRole.MODERATOR].permissions
				);

				// Keep current promotion status while refreshing to new non-moderator base permissions.
				participantMetadata.originalPermissions = tokenMetadata.permissions;
				participantMetadata.permissions = mergedPermissions;

				tokenMetadata.permissions = mergedPermissions;
				tokenMetadata.badge = MeetRoomMemberUIBadge.MODERATOR;
				tokenMetadata.isPromotedModerator = true;

				await this.livekitService.updateParticipantMetadata(
					roomId,
					participantIdentity!,
					JSON.stringify(participantMetadata)
				);
			} else {
				await this.livekitService.updateParticipantMetadata(
					roomId,
					participantIdentity!,
					JSON.stringify(tokenMetadata)
				);
			}
		}

		const effectivePermissions = !isModerator
			? {
				...tokenMetadata.permissions,
				canShareScreen: security?.screenSharePolicy === 'moderators_only' ? false : tokenMetadata.permissions.canShareScreen,
				canPublishAudio: security?.allowSelfUnmute === false ? false : tokenMetadata.permissions.canPublishAudio
			}
			: tokenMetadata.permissions;
		const livekitPermissions = this.getLiveKitPermissions(roomId, effectivePermissions);
		return this.tokenService.generateRoomMemberToken({
			tokenMetadata,
			livekitPermissions,
			participantName,
			participantIdentity
		});
	}

	/**
	 * Refreshes a room member token by verifying the previous token and generating a new one
	 * with metadata obtained from the current LiveKit participant.
	 * This method should be called when a participant wants to refresh their token while in a meeting to get updated permissions
	 * based on their current LiveKit participant metadata.
	 *
	 * @param roomId - The ID of the room
	 * @param previousToken - The previous room member token to refresh
	 * @returns A promise that resolves to the new refreshed token
	 * @throws Error if the previous token is invalid, expired, or if the participant is not found in the meeting
	 */
	async refreshRoomMemberToken(roomId: string, previousToken: string): Promise<string> {
		const { participantIdentity, participantName } = await this.getValidatedRoomMemberTokenContext(
			roomId,
			previousToken
		);

		if (!participantIdentity || !participantName) {
			throw errorInvalidToken();
		}

		const tokenMetadata = await this.buildTokenMetadataFromParticipant(roomId, participantIdentity);
		const { config } = await this.roomService.getMeetRoom(roomId, ['config']);
		const effectivePermissions = tokenMetadata.badge === MeetRoomMemberUIBadge.OTHER
			? {
				...tokenMetadata.permissions,
				canShareScreen: config?.security?.screenSharePolicy === 'moderators_only' ? false : tokenMetadata.permissions.canShareScreen,
				canPublishAudio: config?.security?.allowSelfUnmute === false ? false : tokenMetadata.permissions.canPublishAudio
			}
			: tokenMetadata.permissions;
		const livekitPermissions = this.getLiveKitPermissions(roomId, effectivePermissions);
		return this.tokenService.generateRoomMemberToken({
			tokenMetadata,
			livekitPermissions,
			participantName: participantName,
			participantIdentity
		});
	}

	/**
	 * Validates a room member token and extracts the participant identity and name from its claims, as well as the token metadata.
	 * This method is used during token refresh to ensure the previous token is valid and to obtain the participant's current context in the meeting.
	 *
	 * @param roomId - The ID of the room
	 * @param roomMemberToken - The room member token to validate
	 * @returns An object containing the participant identity, name, and token metadata if valid
	 * @throws Error if the token is invalid, expired, or if the room ID in the token does not match
	 */
	protected async getValidatedRoomMemberTokenContext(
		roomId: string,
		roomMemberToken: string
	): Promise<{ participantIdentity?: string; participantName?: string; tokenMetadata: MeetRoomMemberTokenMetadata }> {
		try {
			const {
				sub: participantIdentity,
				name: participantName,
				metadata
			} = await this.tokenService.verifyToken(roomMemberToken, INTERNAL_CONFIG.REFRESH_CLOCK_TOLERANCE_SECONDS);

			if (!metadata) {
				throw errorInvalidToken();
			}

			const tokenMetadata = this.tokenService.parseRoomMemberTokenMetadata(metadata);

			if (tokenMetadata.roomId !== roomId) {
				throw errorInsufficientPermissions();
			}

			return { participantIdentity, participantName, tokenMetadata };
		} catch (error) {
			if (error instanceof OpenViduMeetError) {
				throw error;
			}

			this.logger.warn(
				`Room member token validation rejected for room '${roomId}': token verification failed`,
				error
			);
			throw errorInvalidToken();
		}
	}

	/**
	 * Resolves permission source from a room secret, which can be either an identified guest member secret or an anonymous access secret.
	 *
	 * - If the secret starts with 'guest-', it is treated as an identified guest member ID and looks up the corresponding member record in the database.
	 * - If the secret does not start with 'guest-', it is treated as an anonymous access secret
	 * and resolves permissions based on matching it to the room's anonymous access secrets for moderator, speaker, or recording roles.
	 *
	 * @param roomId - The ID of the room
	 * @param secret - The secret provided for access
	 * @returns The resolved permission source for the secret
	 * @throws Error if the secret is invalid, if no member is found for an identified guest member secret,
	 * or if anonymous access for the corresponding role is disabled
	 */
	protected async resolvePermissionSourceFromSecret(
		roomId: string,
		secret: string
	): Promise<ResolvedPermissionSource> {
		const isIdentifiedGuestMemberId = secret.startsWith('guest-');

		if (isIdentifiedGuestMemberId) {
			const member = await this.getRoomMember(roomId, secret, ['memberId', 'name', 'effectivePermissions']);

			if (!member) {
				throw errorRoomMemberNotFound(roomId, secret);
			}

			return {
				memberId: member.memberId,
				name: member.name,
				permissions: member.effectivePermissions
			};
		}

		return this.resolveAnonymousAccessBySecret(roomId, secret);
	}

	/**
	 * Resolves anonymous access and effective permissions from a room secret.
	 *
	 * - Moderator and speaker secrets map to their room role permissions.
	 * - Recording secret maps to read-only recording permissions.
	 *
	 * @param roomId - The ID of the room
	 * @param secret - The secret provided for anonymous access
	 * @returns The resolved permission source for the anonymous user
	 * @throws Error if the secret is invalid or if anonymous access for the corresponding role is disabled
	 */
	protected async resolveAnonymousAccessBySecret(roomId: string, secret: string): Promise<ResolvedPermissionSource> {
		const { roles, access } = await this.roomService.getMeetRoom(roomId, ['roles', 'access']);
		const { moderatorSecret, speakerSecret, recordingSecret } = MeetRoomHelper.extractSecretsFromRoom(access);

		const anonymousRole: MeetRoomMemberRole | 'recording' | undefined =
			secret === moderatorSecret
				? MeetRoomMemberRole.MODERATOR
				: secret === speakerSecret
					? MeetRoomMemberRole.SPEAKER
					: secret === recordingSecret
						? 'recording'
						: undefined;

		if (!anonymousRole) {
			throw errorInvalidRoomSecret(roomId, secret);
		}

		if (!access.anonymous[anonymousRole].enabled) {
			throw errorAnonymousAccessDisabled(roomId, anonymousRole);
		}

		if (anonymousRole === 'recording') {
			return {
				permissions: this.getRecordingReadOnlyPermissions()
			};
		}

		return {
			permissions: roles[anonymousRole].permissions
		};
	}

	/**
	 * Resolves permission source for an authenticated user by checking their role, room ownership, and membership.
	 * Users without a member record may still get permissions based on user access settings.
	 *
	 * @param roomId - The ID of the room
	 * @returns The resolved permission source for the authenticated user, or undefined if no access
	 */
	protected async resolvePermissionSourceFromAuthenticatedUser(
		roomId: string
	): Promise<ResolvedPermissionSource | undefined> {
		const user = this.requestSessionService.getAuthenticatedUser();

		if (!user) {
			return undefined;
		}

		const isAdmin = user.role === MeetUserRole.ADMIN;
		const isOwner = await this.roomService.isRoomOwner(roomId, user.userId);

		if (isAdmin || isOwner) {
			// Admins and room owner get all permissions without needing a member record in the database
			return {
				userId: user.userId,
				name: user.name,
				permissions: this.getAllPermissions(),
				badge: isOwner ? MeetRoomMemberUIBadge.OWNER : MeetRoomMemberUIBadge.ADMIN
			};
		}

		const member = await this.getRoomMember(roomId, user.userId, ['name', 'effectivePermissions']);

		if (member) {
			return {
				memberId: user.userId,
				userId: user.userId,
				name: member.name,
				permissions: member.effectivePermissions
			};
		}

		// If user is not a member, they may still have access if user access is enabled,
		// granting them the speaker role permissions as a default for users without a member record.
		const { access, roles } = await this.roomService.getMeetRoom(roomId, ['access', 'roles']);

		if (!access.user.enabled) {
			return undefined;
		}

		return {
			userId: user.userId,
			name: user.name,
			permissions: roles.speaker.permissions
		};
	}

	/**
	 * Merges two sets of permissions by taking the logical OR of each permission field.
	 * If a permission is true in either set, it will be true in the merged result.
	 *
	 * @param first - The first set of permissions to merge
	 * @param second - The second set of permissions to merge
	 * @returns The merged permissions object
	 */
	protected mergePermissions(
		first?: MeetRoomMemberPermissions,
		second?: MeetRoomMemberPermissions
	): MeetRoomMemberPermissions {
		const sources = [first, second].filter((p): p is MeetRoomMemberPermissions => !!p);
		const basePermissions = this.getNoPermissions();

		return (Object.keys(basePermissions) as Array<keyof MeetRoomMemberPermissions>).reduce(
			(merged, permission) => ({
				...merged,
				[permission]: sources.some((source) => source[permission] === true)
			}),
			basePermissions
		);
	}

	/**
	 * Determines the UI badge for a room member based on their permissions compared to moderator permissions.
	 *
	 * @param permissions - The effective permissions of the room member
	 * @param moderatorPermissions - The permissions associated with the moderator role for the room
	 * @returns The UI badge to display for the room member (MODERATOR or OTHER)
	 */
	protected resolveBadgeFromPermissions(
		permissions: MeetRoomMemberPermissions,
		moderatorPermissions: MeetRoomMemberPermissions
	): MeetRoomMemberUIBadge {
		const hasModeratorPermissions = Object.entries(moderatorPermissions).every(([permission, allowed]) => {
			if (!allowed) {
				return true;
			}

			return permissions[permission as keyof MeetRoomMemberPermissions] === true;
		});

		return hasModeratorPermissions ? MeetRoomMemberUIBadge.MODERATOR : MeetRoomMemberUIBadge.OTHER;
	}

	/**
	 * Builds token metadata for a room member token based on the current LiveKit participant metadata.
	 * This is used when refreshing a token while in a meeting to ensure the new token reflects any permission changes
	 * that may have occurred during the meeting (e.g., being promoted to moderator).
	 *
	 * @param roomId - The ID of the room
	 * @param participantIdentity - The LiveKit identity of the participant
	 * @returns The token metadata to include in the refreshed token
	 */
	protected async buildTokenMetadataFromParticipant(
		roomId: string,
		participantIdentity: string
	): Promise<MeetRoomMemberTokenMetadata> {
		const participant = await this.getParticipantFromMeeting(roomId, participantIdentity);
		const participantMetadata = this.parseParticipantMeetingMetadata(participant.metadata);

		return {
			iat: Date.now(),
			roomId,
			memberId: participantMetadata.memberId,
			userId: participantMetadata.userId,
			permissions: participantMetadata.permissions,
			badge: participantMetadata.badge,
			isPromotedModerator: participantMetadata.isPromotedModerator,
			livekitUrl: participantMetadata.livekitUrl
		};
	}

	/**
	 * Gets all permissions set to true.
	 */
	getAllPermissions(): MeetRoomMemberPermissions {
		return {
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
	}

	/**
	 * Gets all permissions set to false.
	 */
	getNoPermissions(): MeetRoomMemberPermissions {
		return {
			canRecord: false,
			canRetrieveRecordings: false,
			canDeleteRecordings: false,
			canJoinMeeting: false,
			canShareAccessLinks: false,
			canMakeModerator: false,
			canKickParticipants: false,
			canEndMeeting: false,
			canPublishVideo: false,
			canPublishAudio: false,
			canShareScreen: false,
			canReadChat: false,
			canWriteChat: false,
			canChangeVirtualBackground: false
		};
	}

	/**
	 * Gets a permission set that only allows retrieving recordings.
	 */
	getRecordingReadOnlyPermissions(): MeetRoomMemberPermissions {
		return {
			...this.getNoPermissions(),
			canRetrieveRecordings: true
		};
	}

	/**
	 * Gets the LiveKit permissions for a room member based on their Meet permissions.
	 *
	 * @param roomId - The ID of the room
	 * @returns The LiveKit permissions for the room member
	 */
	protected getLiveKitPermissions(roomId: string, permissions: MeetRoomMemberPermissions): LiveKitPermissions {
		const canPublishSources: TrackSource[] = [];

		if (permissions.canPublishAudio) {
			canPublishSources.push(TrackSource.MICROPHONE);
		}

		if (permissions.canPublishVideo) {
			canPublishSources.push(TrackSource.CAMERA);
		}

		if (permissions.canShareScreen) {
			canPublishSources.push(TrackSource.SCREEN_SHARE);
			canPublishSources.push(TrackSource.SCREEN_SHARE_AUDIO);
		}

		const livekitPermissions: LiveKitPermissions = {
			room: roomId,
			roomJoin: true,
			canPublish: permissions.canPublishAudio || permissions.canPublishVideo || permissions.canShareScreen,
			canPublishSources,
			canSubscribe: true,
			canPublishData: true,
			canUpdateOwnMetadata: true
		};
		return livekitPermissions;
	}

	/**
	 * Applies a moderation action to a participant currently in a meeting.
	 *
	 * - `UPGRADE`: promotes an eligible participant to moderator by merging moderator permissions.
	 * - `DOWNGRADE`: reverts a promoted moderator to their original permissions.
	 *
	 * After updating participant metadata in LiveKit, it sends a targeted role-updated signal
	 * so the affected participant can refresh their token and notify the UI.
	 *
	 * @param roomId - The ID of the room where the participant is connected.
	 * @param participantIdentity - The LiveKit identity of the participant to moderate.
	 * @param action - The moderation action to apply.
	 */

	async updateParticipantRole(
		roomId: string,
		participantIdentity: string,
		action: MeetParticipantModerationAction
	): Promise<void> {
		try {
			const { roles } = await this.roomService.getMeetRoom(roomId, ['roles']);
			const participant = await this.getParticipantFromMeeting(roomId, participantIdentity);
			const metadata = this.parseParticipantMeetingMetadata(participant.metadata);

			if (action === MeetParticipantModerationAction.UPGRADE) {
				if (metadata.badge !== MeetRoomMemberUIBadge.OTHER) {
					throw errorParticipantCannotBePromotedToModerator(participantIdentity, roomId);
				}

				metadata.originalPermissions = metadata.permissions;
				metadata.permissions = this.mergePermissions(
					metadata.permissions,
					roles[MeetRoomMemberRole.MODERATOR].permissions
				);
				metadata.badge = MeetRoomMemberUIBadge.MODERATOR;
				metadata.isPromotedModerator = true;
			} else {
				if (
					metadata.badge !== MeetRoomMemberUIBadge.MODERATOR ||
					!metadata.isPromotedModerator ||
					!metadata.originalPermissions
				) {
					throw errorParticipantCannotBeDemotedFromModerator(participantIdentity, roomId);
				}

				metadata.permissions = metadata.originalPermissions;
				metadata.badge = MeetRoomMemberUIBadge.OTHER;
				metadata.isPromotedModerator = undefined;
				delete metadata.originalPermissions;
			}

			await this.livekitService.updateParticipantMetadata(roomId, participantIdentity, JSON.stringify(metadata));
			await this.frontendEventService.sendParticipantRoleUpdatedSignal(
				roomId,
				participantIdentity,
				metadata.badge
			);
		} catch (error) {
			this.logger.error('Error applying participant moderation action:', error);
			throw error;
		}
	}

	/**
	 * Sends a signal to the participant to regenerate their token and update their permissions in real-time.
	 * This is used after a participant's permissions have been updated while they are in a meeting.
	 *
	 * @param roomId - The ID of the room
	 * @param participantIdentity - The identity of the participant to send the signal to
	 */
	async notifyParticipantPermissionsUpdate(roomId: string, participantIdentity: string): Promise<void> {
		const isParticipantInMeeting = await this.existsParticipantInMeeting(roomId, participantIdentity);

		if (!isParticipantInMeeting) {
			this.logger.verbose(
				`Not sending permissions updated signal to participant '${participantIdentity}' in room '${roomId}'
				because they are not currently in a meeting`
			);
			return;
		}

		await this.frontendEventService.sendParticipantPermissionsUpdatedSignal(roomId, participantIdentity);
	}

	/**
	 * Kicks multiple members from a meeting in batches.
	 * This method processes the kicks in parallel batches to avoid overwhelming the system.
	 *
	 * @param roomId - The ID of the room
	 * @param memberIds - Array of member IDs to kick from the meeting
	 * @param concurrency - Number of kicks to process in parallel (default: {@link INTERNAL_CONFIG.CONCURRENCY_BULK_KICK_MEMBERS})
	 */
	protected async kickMembersFromMeetingInBatches(
		roomId: string,
		memberIds: string[],
		concurrency = INTERNAL_CONFIG.CONCURRENCY_BULK_KICK_MEMBERS
	): Promise<void> {
		if (memberIds.length === 0) {
			return;
		}

		type KickOutcome = 'kicked' | 'skipped' | 'failed';

		const kickResults = await runConcurrently<string, KickOutcome>(
			memberIds,
			async (memberId) => {
				try {
					await this.kickParticipantFromMeeting(roomId, memberId);
					this.logger.verbose(`Kicked participant '${memberId}' from meeting in room '${roomId}'`);
					return 'kicked';
				} catch (error) {
					const isParticipantNotFound = error instanceof OpenViduMeetError && error.statusCode === 404;

					if (!isParticipantNotFound) {
						// Real error, log warning
						this.logger.warn(
							`Failed to kick participant '${memberId}' from meeting in room '${roomId}':`,
							error
						);
						return 'failed';
					}

					// Participant not in meeting, nothing to do
					this.logger.verbose(
						`Skipping participant '${memberId}' in room '${roomId}' because they are not in the meeting`
					);
					return 'skipped';
				}
			},
			{ concurrency, failFast: true }
		);

		let kickedCount = 0;
		let skippedCount = 0;
		let failedCount = 0;

		// Count outcomes separately to distinguish real kicks from skipped/non-present members.
		kickResults.forEach((result) => {
			if (result === 'kicked') {
				kickedCount++;
			} else if (result === 'skipped') {
				skippedCount++;
			} else {
				failedCount++;
			}
		});

		if (kickedCount > 0) {
			this.logger.info(`Kicked ${kickedCount} participant(s) from meeting in room '${roomId}'`);
		}

		if (failedCount > 0) {
			this.logger.warn(`Failed to kick ${failedCount} participant(s) from meeting in room '${roomId}'`);
		}

		if (skippedCount > 0) {
			this.logger.info(`Skipped ${skippedCount} participant(s) not present in meeting in room '${roomId}'`);
		}
	}

	async kickParticipantFromMeeting(roomId: string, participantIdentity: string, blockRejoin = false): Promise<void> {
		this.logger.verbose(
			`Kicking participant '${participantIdentity}' from room '${roomId}'${blockRejoin ? ' (rejoin blocked)' : ''}`
		);
		return this.livekitService.deleteParticipant(roomId, participantIdentity);
	}

	protected async existsParticipantInMeeting(roomId: string, participantIdentity: string): Promise<boolean> {
		this.logger.verbose(`Checking if participant '${participantIdentity}' exists in room '${roomId}'`);
		return this.livekitService.participantExists(roomId, participantIdentity);
	}

	protected async getParticipantFromMeeting(roomId: string, participantIdentity: string): Promise<ParticipantInfo> {
		this.logger.verbose(`Fetching participant '${participantIdentity}' from room '${roomId}'`);
		return this.livekitService.getParticipant(roomId, participantIdentity);
	}

	protected parseParticipantMeetingMetadata(metadata: string): ParticipantMeetingMetadata {
		const parsed = JSON.parse(metadata || '{}') as ParticipantMeetingMetadata;
		const normalized = this.tokenService.parseRoomMemberTokenMetadata(JSON.stringify(parsed));

		return {
			...parsed,
			...normalized
		};
	}

	/**
	 * Creates a sanitized participant identity prefix from the given participant name.
	 *
	 * This method normalizes the participant name by:
	 * - Decomposing combined characters (e.g., á -> a + ´)
	 * - Converting to lowercase
	 * - Replacing hyphens and spaces with underscores
	 * - Allowing only lowercase letters, numbers, and underscores
	 * - Replacing multiple consecutive underscores with a single underscore
	 * - Removing leading and trailing underscores
	 *
	 * @param participantName The original participant name.
	 * @returns A sanitized string suitable for use as a participant identity prefix.
	 */
	protected createParticipantIdentityPrefixFromName(participantName: string): string {
		return participantName
			.normalize('NFD') // Decompose combined characters (e.g., á -> a + ´)
			.toLowerCase() // Convert to lowercase
			.replace(/[-\s]/g, '_') // Replace hyphens and spaces with underscores
			.replace(/[^a-z0-9_]/g, '') // Allow only lowercase letters, numbers and underscores
			.replace(/_+/g, '_') // Replace multiple consecutive underscores with a single underscore
			.replace(/_+$/, '') // Remove trailing underscores
			.replace(/^_+/, ''); // Remove leading underscores
	}

	/**
	 * Releases a participant's reserved name when they disconnect from meeting.
	 * This should be called when a participant leaves the meeting to free up the name.
	 *
	 * @param roomId - The room identifier
	 * @param participantName - The participant name to release
	 */
	async releaseParticipantName(roomId: string, participantName: string): Promise<void> {
		try {
			await this.participantNameService.releaseName(roomId, participantName);
			this.logger.verbose(`Released participant name '${participantName}' for room '${roomId}'`);
		} catch (error) {
			this.logger.warn(`Error releasing participant name '${participantName}' for room '${roomId}':`, error);
		}
	}

	/**
	 * Cleans up expired participant name reservations for a meeting.
	 * This can be called during room cleanup or periodically.
	 *
	 * @param roomId - The room identifier
	 */
	async cleanupParticipantNames(roomId: string): Promise<void> {
		await this.participantNameService.cleanupExpiredReservations(roomId);
	}
}

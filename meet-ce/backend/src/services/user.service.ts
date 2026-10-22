import type { MeetUser, MeetUserDTO, MeetUserField, MeetUserFilters, MeetUserOptions } from '@openvidu-meet/typings';
import { MeetUserRole } from '@openvidu-meet/typings';
import { inject, injectable } from 'inversify';
import { randomUUID } from 'node:crypto';
import { container } from '../config/dependency-injector.config.js';
import { INTERNAL_CONFIG } from '../config/internal-config.js';
import { MEET_ENV } from '../environment.js';
import { PasswordHelper } from '../helpers/password.helper.js';
import {
	errorCannotChangeOwnRole,
	errorCannotChangeRootAdminRole,
	errorCannotDeleteOwnAccount,
	errorCannotDeleteRootAdmin,
	errorCannotResetOwnPassword,
	errorCannotResetRootAdminPassword,
	errorInvalidPassword,
	errorUserAlreadyExists,
	errorUserNotFound
} from '../models/error.model.js';
import { RoomMemberRepository } from '../repositories/room-member.repository.js';
import { RoomRepository } from '../repositories/room.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import type { ProjectedMeetUser } from '../types/user-projection.types.js';
import { runConcurrently } from '../utils/concurrency.utils.js';
import { LoggerService } from './logger.service.js';
import { MeetingPresenceService } from './meeting-presence.service.js';
import { RequestSessionService } from './request-session.service.js';
import type { RoomMemberService } from './room-member.service.js';
import { TokenService } from './token.service.js';

@injectable()
export class UserService {
	constructor(
		@inject(LoggerService) protected logger: LoggerService,
		@inject(UserRepository) protected userRepository: UserRepository,
		@inject(RoomRepository) protected roomRepository: RoomRepository,
		@inject(RoomMemberRepository) protected roomMemberRepository: RoomMemberRepository,
		@inject(MeetingPresenceService) protected meetingPresenceService: MeetingPresenceService,
		@inject(RequestSessionService) protected requestSessionService: RequestSessionService,
		@inject(TokenService) protected tokenService: TokenService
	) {}

	/**
	 * TODO: Prevent circular imports when refactoring backend code
	 */
	private async getRoomMemberService(): Promise<RoomMemberService> {
		const { RoomMemberService } = await import('./room-member.service.js');
		return container.get(RoomMemberService);
	}

	private async getRootAdmin(): Promise<MeetUser> {
		const admin = await this.userRepository.findByLoginName(MEET_ENV.INITIAL_ADMIN_USER);
		if (!admin) throw errorUserNotFound(MEET_ENV.INITIAL_ADMIN_USER);
		return admin;
	}

	/**
	 * Initializes the default admin user
	 */
	async initializeAdminUser(): Promise<void> {
		// Check if the admin user already exists
		const existingUser = await this.userRepository.findByLoginName(MEET_ENV.INITIAL_ADMIN_USER);

		if (existingUser) {
			this.logger.info('Admin user already initialized, skipping admin user initialization');
			return;
		}

		const admin: MeetUser = {
			userId: randomUUID(),
			loginName: MEET_ENV.INITIAL_ADMIN_USER.toLowerCase(),
			name: 'Admin',
			registrationDate: Date.now(),
			role: MeetUserRole.ADMIN,
			roleUpdatedAt: Date.now(),
			passwordHash: await PasswordHelper.hashPassword(MEET_ENV.INITIAL_ADMIN_PASSWORD),
			mustChangePassword: false,
			enabled: true,
			authVersion: 1
		};

		await this.userRepository.create(admin);
		this.logger.info(`Admin user initialized with default credentials`);
	}

	async createUser(userOptions: MeetUserOptions): Promise<MeetUser> {
		const loginName = userOptions.loginName.trim().toLowerCase();
		const existingUser = await this.userRepository.findByLoginName(loginName);

		if (existingUser) {
			throw errorUserAlreadyExists(loginName);
		}

		const passwordHash = await PasswordHelper.hashPassword(userOptions.password);
		const now = Date.now();
		const user: MeetUser = {
			userId: randomUUID(),
			loginName,
			name: userOptions.name,
			email: userOptions.email?.trim().toLowerCase() || undefined,
			employeeNumber: userOptions.employeeNumber?.trim() || undefined,
			registrationDate: now,
			role: userOptions.role,
			roleUpdatedAt: now,
			passwordHash,
			mustChangePassword: true,
			enabled: true,
			authVersion: 1
		};

		return this.userRepository.create(user);
	}

	async findOrCreateFederatedUser(options: { loginName: string; name: string; email?: string; role: MeetUserRole; autoProvision: boolean; identityProviderId?: string; externalSubject?: string; accountLinkingStrategy?: 'strict' | 'email' }): Promise<MeetUser> {
		const bySubject = options.identityProviderId && options.externalSubject ? await this.userRepository.findByExternalIdentity(options.identityProviderId, options.externalSubject) : null;
		const loginName = options.loginName.trim().toLowerCase();
		const byLoginName = await this.userRepository.findByLoginName(loginName);
		const byEmail = options.email ? await this.userRepository.findByEmail(options.email) : null;
		if (byLoginName && (byLoginName.identityProviderId !== options.identityProviderId || byLoginName.externalSubject !== options.externalSubject)) {
			const verifiedEmailLink = options.accountLinkingStrategy === 'email' && options.email && byLoginName.email?.toLowerCase() === options.email.toLowerCase();
			if (!verifiedEmailLink) throw new Error('Federated account identifier conflicts with an existing identity');
		}
		if (byEmail && byEmail.userId !== byLoginName?.userId && byEmail.userId !== bySubject?.userId && options.accountLinkingStrategy !== 'email') throw new Error('Enterprise email is already assigned to another account');
		const existing = bySubject ?? byLoginName ?? (options.accountLinkingStrategy === 'email' ? byEmail : null);
		if (existing) {
			return this.userRepository.updatePartial(existing.userId, {
				name: options.name,
				email: options.email ?? existing.email,
				role: options.role,
				roleUpdatedAt: existing.role === options.role ? existing.roleUpdatedAt : Date.now(),
				enabled: true,
				identityProviderId: options.identityProviderId ?? existing.identityProviderId,
				externalSubject: options.externalSubject ?? existing.externalSubject,
				lastIdentitySyncAt: Date.now()
			});
		}
		if (!options.autoProvision) throw errorUserNotFound(loginName);
		const now = Date.now();
		return this.userRepository.create({
			userId: randomUUID(),
			loginName,
			name: options.name,
			email: options.email,
			registrationDate: now,
			role: options.role,
			roleUpdatedAt: now,
			passwordHash: await PasswordHelper.hashPassword(randomUUID()),
			mustChangePassword: false,
			enabled: true,
			authVersion: 1,
			identityProviderId: options.identityProviderId,
			externalSubject: options.externalSubject,
			lastIdentitySyncAt: now
		});
	}

	async getUsers(filters: MeetUserFilters): Promise<{
		users: MeetUser[];
		isTruncated: boolean;
		nextPageToken?: string;
		totalCount: number;
	}> {
		const { maxItems, nextPageToken, sortField, sortOrder, ...countFilters } = filters;
		const [page, totalCount] = await Promise.all([
			this.userRepository.find({ maxItems, nextPageToken, sortField, sortOrder, ...countFilters }),
			this.userRepository.countMatching(countFilters)
		]);

		return { ...page, totalCount };
	}

	async authenticateUser(loginName: string, password: string): Promise<MeetUser | null> {
		const user = await this.userRepository.findByLoginName(loginName);

		if (!user || user.enabled === false || !(await PasswordHelper.verifyPassword(password, user.passwordHash))) {
			return null;
		}

		return user;
	}

	async revokeAllSessions(userId: string): Promise<MeetUser> {
		const user = await this.userRepository.findByUserId(userId);
		if (!user) throw errorUserNotFound(userId);
		return this.userRepository.updatePartial(userId, { authVersion: (user.authVersion ?? 1) + 1 });
	}

	async setAccountEnabled(userId: string, enabled: boolean): Promise<MeetUser> {
		const user = await this.userRepository.findByUserId(userId);
		if (!user) throw errorUserNotFound(userId);
		const updated = await this.userRepository.updatePartial(userId, { enabled, authVersion: (user.authVersion ?? 1) + 1 });
		if (!enabled) {
			await this.tokenService.revokeAllUserRefreshSessions(userId);
			const meetings = await this.meetingPresenceService.getUserMeetings(userId);
			if (meetings.length) { const roomMembers = await this.getRoomMemberService(); await Promise.allSettled(meetings.map(({ roomId, participantIdentity }) => roomMembers.kickParticipantFromMeeting(roomId, participantIdentity))); }
		}
		return updated;
	}

	disableFederatedAccountsMissing(providerId: string, externalSubjects: string[]): Promise<number> {
		return this.userRepository.disableFederatedAccountsMissing(providerId, externalSubjects);
	}

	async deprovisionFederatedAccounts(providerId: string, externalSubjects: string[], transferToUserId?: string): Promise<number> {
		const missing = await this.userRepository.findFederatedAccountsMissing(providerId, externalSubjects);
		const target = transferToUserId || (await this.getRootAdmin()).userId;
		if (!await this.userRepository.findByUserId(target)) throw errorUserNotFound(target);
		for (const user of missing) { await this.transferOwnedRooms(user.userId, target); await this.setAccountEnabled(user.userId, false); }
		return missing.length;
	}

	async transferOwnedRooms(fromUserId: string, toUserId: string): Promise<number> {
		const ownedRooms = await this.roomRepository.findByOwner(fromUserId, ['roomId']);
		await runConcurrently(ownedRooms, async (room) =>
			this.roomRepository.updatePartial(room.roomId, { owner: toUserId })
		, { concurrency: INTERNAL_CONFIG.CONCURRENCY_BULK_CLEANUP_USER_RESOURCES, failFast: true });
		return ownedRooms.length;
	}

	async getUser(userId: string): Promise<MeetUser | null>;

	async getUser<const TFields extends readonly MeetUserField[]>(
		userId: string,
		fields: TFields
	): Promise<ProjectedMeetUser<TFields> | null>;

	async getUser(userId: string, fields?: readonly MeetUserField[]): Promise<MeetUser | Partial<MeetUser> | null>;

	async getUser(userId: string, fields?: readonly MeetUserField[]): Promise<MeetUser | Partial<MeetUser> | null> {
		return this.userRepository.findByUserId(userId, fields);
	}

	async getUserAssociatedWithApiKey(): Promise<MeetUser | null> {
		// Return admin user for API key access
		return this.userRepository.findByLoginName(MEET_ENV.INITIAL_ADMIN_USER);
	}

	async changePassword(userId: string, currentPassword: string, newPassword: string) {
		const user = await this.userRepository.findByUserId(userId, ['passwordHash', 'authVersion']);

		if (!user) {
			throw errorUserNotFound(userId);
		}

		const isCurrentPasswordValid = await PasswordHelper.verifyPassword(currentPassword, user.passwordHash);

		if (!isCurrentPasswordValid) {
			throw errorInvalidPassword();
		}

		await this.userRepository.updatePartial(userId, {
			passwordHash: await PasswordHelper.hashPassword(newPassword),
			mustChangePassword: false,
			authVersion: (user.authVersion ?? 1) + 1
		});
	}

	/**
	 * Reset user password by admin. This is used when a user forgets their password.
	 * The mustChangePassword flag is set to true to force the user to change the password on next login.
	 *
	 * @param userId - The ID of the user whose password will be reset
	 * @param newPassword - The new temporary password set by admin
	 */
	async resetUserPassword(userId: string, newPassword: string): Promise<void> {
		// Prevent resetting own password (use change-password endpoint instead)
		const authenticatedUser = this.requestSessionService.getAuthenticatedUser();

		if (authenticatedUser && authenticatedUser.userId === userId) {
			throw errorCannotResetOwnPassword();
		}

		// Prevent resetting password for the root admin user
		if (userId === (await this.getRootAdmin()).userId) {
			throw errorCannotResetRootAdminPassword();
		}

		const user = await this.userRepository.findByUserId(userId, ['userId', 'authVersion']);

		if (!user) {
			throw errorUserNotFound(userId);
		}

		await this.userRepository.updatePartial(userId, {
			passwordHash: await PasswordHelper.hashPassword(newPassword),
			mustChangePassword: true,
			authVersion: (user.authVersion ?? 1) + 1
		});
		this.logger.info(`Password reset for user '${userId}' by admin. User must change password on next login.`);
	}

	/**
	 * Change user role by admin.
	 *
	 * @param userId - The ID of the user whose role will be changed
	 * @param newRole - The new role to assign to the user
	 */
	async changeUserRole(userId: string, newRole: MeetUserRole): Promise<MeetUser> {
		// Prevent changing role of the root admin user
		if (userId === (await this.getRootAdmin()).userId) {
			throw errorCannotChangeRootAdminRole();
		}

		// Prevent changing own role
		const authenticatedUser = this.requestSessionService.getAuthenticatedUser();

		if (authenticatedUser && authenticatedUser.userId === userId) {
			throw errorCannotChangeOwnRole();
		}

		const user = await this.userRepository.findByUserId(userId);

		if (!user) {
			throw errorUserNotFound(userId);
		}

		const oldRole = user.role;

		// If the role is the same, no update is needed
		if (oldRole === newRole) {
			this.logger.info(`User '${userId}' already has role '${newRole}', no update needed`);
			return user;
		}

		// If ADMIN or ROOM_MANAGER becomes ROOM_MEMBER, transfer owned rooms to root admin.
		if ((oldRole === MeetUserRole.ADMIN || oldRole === MeetUserRole.ROOM_MANAGER) && newRole === MeetUserRole.ROOM_MEMBER) {
			const ownedRooms = await this.roomRepository.findByOwner(userId, ['roomId']);
			const rootAdminUserId = (await this.getRootAdmin()).userId;

			if (ownedRooms.length > 0) {
				await runConcurrently(
					ownedRooms,
					async (room) => {
						await this.roomRepository.updatePartial(room.roomId, { owner: rootAdminUserId });
					},
					{ concurrency: INTERNAL_CONFIG.CONCURRENCY_BULK_CLEANUP_USER_RESOURCES, failFast: true }
				);

				this.logger.info(
					`Transferred ownership of ${ownedRooms.length} room(s) from user '${userId}' to admin '${MEET_ENV.INITIAL_ADMIN_USER}' due to role change to '${MeetUserRole.ROOM_MEMBER}'`
				);
			}
		}

		// If ROOM_MANAGER or ROOM_MEMBER becomes ADMIN, remove room memberships.
		if ((oldRole === MeetUserRole.ROOM_MANAGER || oldRole === MeetUserRole.ROOM_MEMBER) && newRole === MeetUserRole.ADMIN) {
			await this.roomMemberRepository.deleteAllByMemberId(userId);
			this.logger.info(
				`Removed room memberships for user '${userId}' due to role change to '${MeetUserRole.ADMIN}'`
			);
		}

		const updatedUser = await this.userRepository.updatePartial(userId, {
			role: newRole,
			roleUpdatedAt: Date.now()
		});

		const activeMeetings = await this.meetingPresenceService.getUserMeetings(userId);

		if (activeMeetings.length > 0) {
			const roomMemberService = await this.getRoomMemberService();
			const notifyResults = await runConcurrently(
				activeMeetings,
				async ({ roomId, participantIdentity }) => {
					await roomMemberService.notifyParticipantPermissionsUpdate(roomId, participantIdentity);
					return { roomId, participantIdentity };
				},
				{ concurrency: INTERNAL_CONFIG.CONCURRENCY_BULK_UPDATE_PERMISSIONS }
			);

			const failedNotifications = notifyResults.filter((result) => result.status === 'rejected');

			if (failedNotifications.length > 0) {
				this.logger.warn(
					`Failed to notify ${failedNotifications.length} active participant(s) about role update for user '${userId}'`
				);
			}
		}

		this.logger.info(`Role for user '${userId}' changed to '${newRole}' by admin`);
		return updatedUser;
	}

	async deleteUser(userId: string): Promise<void> {
		// Prevent deleting the root admin user
		if (userId === (await this.getRootAdmin()).userId) {
			throw errorCannotDeleteRootAdmin();
		}

		// Prevent self-deletion
		const authenticatedUser = this.requestSessionService.getAuthenticatedUser();

		if (authenticatedUser && authenticatedUser.userId === userId) {
			throw errorCannotDeleteOwnAccount();
		}

		const user = await this.userRepository.findByUserId(userId, ['userId']);

		if (!user) {
			throw errorUserNotFound(userId);
		}

		// Clean up user resources using bulk method
		await this.bulkCleanupUserResources([userId]);

		// Finally, delete the user
		await this.userRepository.deleteByUserId(userId);
		this.logger.info(`User '${userId}' deleted successfully`);
	}

	async bulkDeleteUsers(
		userIds: string[]
	): Promise<{ deleted: string[]; failed: { userId: string; error: string }[] }> {
		const rootAdminUserId = (await this.getRootAdmin()).userId;
		const authenticatedUser = this.requestSessionService.getAuthenticatedUser();

		// Filter out the root admin user and authenticated user from the deletion list
		const failed: { userId: string; error: string }[] = [];
		let filteredUserIds = [...userIds];

		if (userIds.includes(rootAdminUserId)) {
			failed.push({ userId: rootAdminUserId, error: 'Cannot delete the root admin user' });
			filteredUserIds = filteredUserIds.filter((id) => id !== rootAdminUserId);
		}

		if (
			authenticatedUser &&
			authenticatedUser?.userId !== rootAdminUserId &&
			userIds.includes(authenticatedUser.userId)
		) {
			failed.push({ userId: authenticatedUser.userId, error: 'Cannot delete your own account' });
			filteredUserIds = filteredUserIds.filter((id) => id !== authenticatedUser.userId);
		}

		const usersToDelete = await this.userRepository.findByUserIds(filteredUserIds, ['userId']);
		const foundUserIds = usersToDelete.map((u) => u.userId);

		failed.push(
			...filteredUserIds
				.filter((id) => !foundUserIds.includes(id))
				.map((id) => ({ userId: id, error: 'User not found' }))
		);

		if (foundUserIds.length > 0) {
			// Clean up resources for all users in batches
			await this.bulkCleanupUserResources(foundUserIds);

			// Delete all users after cleanup
			await this.userRepository.deleteByUserIds(foundUserIds);
			this.logger.info(`Bulk deleted ${foundUserIds.length} user(s) successfully`);
		}

		return {
			deleted: foundUserIds,
			failed
		};
	}

	/**
	 * Cleans up resources for multiple users in batches:
	 * - Deletes all room memberships
	 * - Transfers ownership of owned rooms to the global admin
	 * - Removes user from all active meetings
	 *
	 * @param userIds - Array of user IDs to clean up
	 */
	private async bulkCleanupUserResources(userIds: string[]): Promise<void> {
		const adminUserId = (await this.getRootAdmin()).userId;
		const concurrency = INTERNAL_CONFIG.CONCURRENCY_BULK_CLEANUP_USER_RESOURCES;
		const roomMemberService = await this.getRoomMemberService();

		const userCleanupResults = await runConcurrently(
			userIds,
			async (userId) => {
				const activeMeetings = await this.meetingPresenceService.getUserMeetings(userId);

				if (activeMeetings.length > 0) {
					const kickResults = await runConcurrently(
						activeMeetings,
						async ({ roomId, participantIdentity }) => {
							await roomMemberService.kickParticipantFromMeeting(roomId, participantIdentity);
							return { roomId, participantIdentity };
						},
						{ concurrency }
					);

					const failedKicks = kickResults.filter((result) => result.status === 'rejected');

					if (failedKicks.length > 0) {
						this.logger.warn(
							`Failed to kick ${failedKicks.length} participant(s) for user '${userId}' during account cleanup`
						);
					}
				}

				const [ownedRooms] = await Promise.all([
					this.roomRepository.findByOwner(userId, ['roomId']),
					this.roomMemberRepository.deleteAllByMemberId(userId),
					this.meetingPresenceService.removeUserFromAllRooms(userId)
				]);

				return ownedRooms;
			},
			{ concurrency, failFast: true }
		);

		const allOwnedRooms = userCleanupResults.flat();

		if (allOwnedRooms.length > 0) {
			await runConcurrently(
				allOwnedRooms,
				async (room) => {
					// Transfer ownership to admin user
					await this.roomRepository.updatePartial(room.roomId, { owner: adminUserId });
				},
				{ concurrency, failFast: true }
			);

			this.logger.info(
				`Transferred ownership of ${allOwnedRooms.length} room(s) from ${userIds.length} user(s) to admin '${adminUserId}'`
			);
		}

		this.logger.info(`Completed cleanup for ${userIds.length} user(s)`);
	}

	// Convert user to UserDTO to remove sensitive information
	/** Self-service profile update (whitelisted fields only; controller validates values). */
	async updateOwnProfile(
		userId: string,
		patch: {
			name?: string;
			avatarDataUrl?: string | null;
			preferredLanguage?: 'cn' | 'en';
			notificationsMuted?: boolean;
		}
	): Promise<MeetUser | null> {
		const update: Partial<MeetUser> = {};
		if (patch.name !== undefined) update.name = patch.name;
		if (patch.avatarDataUrl !== undefined) update.avatarDataUrl = patch.avatarDataUrl === null ? '' : patch.avatarDataUrl;
		if (patch.preferredLanguage !== undefined) update.preferredLanguage = patch.preferredLanguage;
		if (patch.notificationsMuted !== undefined) update.notificationsMuted = patch.notificationsMuted;
		if (Object.keys(update).length === 0) return this.userRepository.findByUserId(userId);
		return this.userRepository.updateProfileFields(userId, update);
	}

	convertToDTO(user: MeetUser): MeetUserDTO {
		const { passwordHash, mustChangePassword, ...userDTO } = user;
		void passwordHash;
		void mustChangePassword;
		return userDTO;
	}
}

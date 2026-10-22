import { MeetRoom, MeetRoomMemberPermissions, MeetRoomMemberRole, MeetRoomMemberUIBadge } from '@openvidu-meet/typings';
import { test, type Browser, type Page } from '@playwright/test';
import { createReadyMemberUser, createReadyUser, type ReadyUser } from './helpers/auth.helper';
import { expectLobbyAccessRestricted, expectNameInput } from './helpers/access.helper';
import { createRoom, createRoomMember, deleteRooms, deleteUsers } from './helpers/meet-api.helper';
import {
	expectEndMeetingOption,
	expectNoEndMeetingOption,
	openLobby,
	openMeeting
} from './helpers/meeting-navigation.helper';
import {
	expectBackgroundsButtonAvailable,
	expectCameraButtonAvailable,
	expectMicButtonAvailable,
	expectNoBackgroundsButton,
	expectNoCameraButton,
	expectNoMicButton,
	expectNoScreenshareButton,
	expectScreenshareButtonAvailable
} from './helpers/media-controls.helper';
import { expectChatAvailable, expectNoChat, toggleParticipantsPanel } from './helpers/panels.helper';
import {
	expectKickButton,
	expectMakeModeratorButton,
	expectNoKickButton,
	expectNoMakeModeratorButton,
	expectParticipantBadge,
	getLocalParticipantId,
	getParticipantIdByName,
	joinParticipants
} from './helpers/participant-management.helper';
import { expectNoShareAccessLink, expectShareAccessLinkAvailable } from './helpers/share-link.helper';

/**
 * Permission tests verify one permission at a time on the page where it applies, then verify that a
 * combination of access methods grants the union of both methods' permissions. A member with exactly
 * one permission flipped is built via `createRoomMember(..., { customPermissions })`, which overrides
 * the base-role permissions for that single key.
 */
test.describe('Permissions E2E Tests', () => {
	const createdUserIds: string[] = [];
	const createdRoomIds: string[] = [];
	let memberSequence = 0;

	let room: MeetRoom;
	let adminUser: ReadyUser;

	test.beforeAll(async () => {
		test.setTimeout(180_000);

		room = await createRoom();
		createdRoomIds.push(room.roomId);

		adminUser = await createReadyUser('Perm Admin');
		createdUserIds.push(adminUser.userId);
	});

	test.afterAll(async () => {
		await Promise.all([deleteRooms(createdRoomIds), deleteUsers(createdUserIds)]);
	});

	/**
	 * Creates an identified-guest member of the shared room with the given base role and custom
	 * permission overrides — the access URL requires no login, so the member can be driven directly.
	 */
	const createGuest = (customPermissions: Partial<MeetRoomMemberPermissions>, baseRole = MeetRoomMemberRole.SPEAKER) =>
		createRoomMember(room.roomId, { name: `perm-${memberSequence++}`, baseRole, customPermissions });

	/**
	 * Joins the meeting as a fresh guest with the given custom permissions and returns the member.
	 */
	const joinAsGuest = async (
		page: Page,
		customPermissions: Partial<MeetRoomMemberPermissions>,
		options: { baseRole?: MeetRoomMemberRole; skipPrejoinMediaCheck?: boolean } = {}
	) => {
		const member = await createGuest(customPermissions, options.baseRole);
		await openMeeting(page, member.accessUrl, { skipPrejoinMediaCheck: options.skipPrejoinMediaCheck });
		return member;
	};

	// ── Lobby permissions ─────────────────────────────────────────────────────────

	test.describe('Room lobby', () => {
		test('canJoinMeeting granted: the lobby join form is shown', async ({ page }) => {
			const member = await createGuest({ canJoinMeeting: true });
			await openLobby(page, member.accessUrl);

			await expectNameInput(page, { value: member.name, editable: false });
		});

		test('canJoinMeeting denied: the lobby shows the access-restricted card', async ({ page }) => {
			const member = await createGuest({ canJoinMeeting: false });
			await page.goto(member.accessUrl, { waitUntil: 'domcontentloaded' });

			await expectLobbyAccessRestricted(page);
		});
	});

	// ── Meeting permissions (single participant) ────────────────────────────────────

	test.describe('Meeting', () => {
		test('canReadChat granted: the chat panel button is available', async ({ page }) => {
			await joinAsGuest(page, { canReadChat: true });
			await expectChatAvailable(page);
		});

		test('canReadChat denied: the chat panel button is not available', async ({ page }) => {
			await joinAsGuest(page, { canReadChat: false });
			await expectNoChat(page);
		});

		test('canChangeVirtualBackground granted: the backgrounds control is available', async ({ page }) => {
			await joinAsGuest(page, { canChangeVirtualBackground: true });
			await expectBackgroundsButtonAvailable(page);
		});

		test('canChangeVirtualBackground denied: the backgrounds control is not available', async ({ page }) => {
			await joinAsGuest(page, { canChangeVirtualBackground: false });
			await expectNoBackgroundsButton(page);
		});

		test('canPublishVideo granted: the camera button is available', async ({ page }) => {
			await joinAsGuest(page, { canPublishVideo: true });
			await expectCameraButtonAvailable(page);
		});

		test('canPublishVideo denied: the camera button is not available', async ({ page }) => {
			await joinAsGuest(page, { canPublishVideo: false }, { skipPrejoinMediaCheck: true });
			await expectNoCameraButton(page);
		});

		test('canPublishAudio granted: the microphone button is available', async ({ page }) => {
			await joinAsGuest(page, { canPublishAudio: true });
			await expectMicButtonAvailable(page);
		});

		test('canPublishAudio denied: the microphone button is not available', async ({ page }) => {
			await joinAsGuest(page, { canPublishAudio: false }, { skipPrejoinMediaCheck: true });
			await expectNoMicButton(page);
		});

		test('canShareScreen granted: the screen-share button is available', async ({ page }) => {
			await joinAsGuest(page, { canShareScreen: true });
			await expectScreenshareButtonAvailable(page);
		});

		test('canShareScreen denied: the screen-share button is not available', async ({ page }) => {
			await joinAsGuest(page, { canShareScreen: false });
			await expectNoScreenshareButton(page);
		});

		test('canShareAccessLinks granted: the share-access-link controls are available', async ({ page }) => {
			await joinAsGuest(page, { canShareAccessLinks: true });
			await expectShareAccessLinkAvailable(page);
		});

		test('canShareAccessLinks denied: the share-access-link controls are not available', async ({ page }) => {
			await joinAsGuest(page, { canShareAccessLinks: false });
			await expectNoShareAccessLink(page);
		});

		test('canEndMeeting granted: the end-meeting option is available', async ({ page }) => {
			await joinAsGuest(page, { canEndMeeting: true });
			await expectEndMeetingOption(page);
		});

		test('canEndMeeting denied: the end-meeting option is not available', async ({ page }) => {
			await joinAsGuest(page, { canEndMeeting: false });
			await expectNoEndMeetingOption(page);
		});

		// canWriteChat is not wired to the UI yet (see features.utils.ts — showChatInput is commented
		// out), so it cannot be asserted. Re-enable when the permission gates the chat input.
		test.fixme('canWriteChat controls the chat input', async () => {
			// When implemented: join with { canReadChat: true, canWriteChat: false }, open the chat panel,
			// and assert #chat-input is disabled; with canWriteChat: true assert it is editable.
		});
	});

	// ── Meeting permissions (require a second participant) ───────────────────────────

	test.describe('Meeting (moderation over another participant)', () => {
		const withTarget = async (
			browser: Browser,
			actorPermissions: Partial<MeetRoomMemberPermissions>,
			assertion: (actorPage: Page, targetId: string) => Promise<void>
		): Promise<void> => {
			const { byName, removeAllParticipants } = await joinParticipants(browser, {
				roomId: room.roomId,
				// The moderation buttons key off the target's presence in the participants panel, not its
				// media, so the remote-stream wait is skipped to avoid unrelated media-timing flakiness.
				skipRemoteStreamCheck: true,
				participants: [
					{ name: 'Actor', baseRole: MeetRoomMemberRole.SPEAKER, customPermissions: actorPermissions },
					{ name: 'Target', baseRole: MeetRoomMemberRole.SPEAKER, headless: true }
				]
			});

			try {
				const actorPage = byName['Actor'];
				await toggleParticipantsPanel(actorPage);
				const targetId = await getParticipantIdByName(actorPage, 'Target');
				await assertion(actorPage, targetId);
			} finally {
				await removeAllParticipants();
			}
		};

		test('canMakeModerator granted: the make-moderator button is available', async ({ browser }) => {
			await withTarget(browser, { canMakeModerator: true }, expectMakeModeratorButton);
		});

		test('canMakeModerator denied: the make-moderator button is not available', async ({ browser }) => {
			await withTarget(browser, { canMakeModerator: false }, expectNoMakeModeratorButton);
		});

		test('canKickParticipants granted: the kick button is available', async ({ browser }) => {
			await withTarget(browser, { canKickParticipants: true }, expectKickButton);
		});

		test('canKickParticipants denied: the kick button is not available', async ({ browser }) => {
			await withTarget(browser, { canKickParticipants: false }, expectNoKickButton);
		});
	});

	// ── Merged permissions (union of combined access methods) ─────────────────────────

	test.describe('Merged permissions', () => {
		test('authenticated admin via anonymous speaker link gains admin permissions (union)', async ({ page }) => {
			// The speaker link alone grants neither end-meeting nor the ADMIN badge; merged with the
			// authenticated admin identity it grants both.
			await openLobby(page, room.access.user.url, {
				login: { userId: adminUser.userId, password: adminUser.password }
			});
			await openMeeting(page, room.access.anonymous.speaker.url);

			await expectCameraButtonAvailable(page);
			await expectEndMeetingOption(page);

			await toggleParticipantsPanel(page);
			const participantId = await getLocalParticipantId(page);
			await expectParticipantBadge(page, participantId, MeetRoomMemberUIBadge.ADMIN);
		});

		test('authenticated member via anonymous moderator link gains moderator permissions (union)', async ({
			page
		}) => {
			// The member is a speaker (no end-meeting); the moderator link adds moderator permissions.
			const { user } = await createReadyMemberUser(room.roomId, {
				name: 'Union Member',
				baseRole: MeetRoomMemberRole.SPEAKER
			});
			createdUserIds.push(user.userId);

			await openLobby(page, room.access.user.url, {
				login: { userId: user.userId, password: user.password }
			});
			await openMeeting(page, room.access.anonymous.moderator.url);

			await expectEndMeetingOption(page);

			await toggleParticipantsPanel(page);
			const participantId = await getLocalParticipantId(page);
			await expectParticipantBadge(page, participantId, MeetRoomMemberUIBadge.MODERATOR);
		});
	});
});

import { MeetRoom, MeetRoomMemberRole, MeetRoomMemberUIBadge, MeetUserRole } from '@openvidu-meet/typings';
import { expect, test } from '@playwright/test';
import {
	expectParticipantPanelMuted,
	expectParticipantPanelUnmuted,
	startScreensharing,
	stopScreensharing,
	toggleCamera,
	toggleMicrophone,
	toggleParticipantPanelMute
} from './helpers/media-controls.helper';
import {
	createRoom,
	createRoomAsUser,
	createUser,
	deleteRooms,
	deleteUsers,
	getUserAccessToken
} from './helpers/meet-api.helper';
import { openMeeting } from './helpers/meeting-navigation.helper';
import { toggleParticipantsPanel } from './helpers/panels.helper';
import {
	expectKickButton,
	expectMakeModeratorButton,
	expectModerationControls,
	expectNoKickButton,
	expectNoMakeModeratorButton,
	expectNoModerationControls,
	expectNoParticipantBadge,
	expectNoRemoveModeratorButton,
	expectParticipantBadge,
	expectRemoveModeratorButton,
	getLocalParticipantId,
	getParticipantIdByName,
	joinParticipants,
	kickParticipant,
	makeParticipantModerator,
	removeParticipantModerator
} from './helpers/participant-management.helper';

test.describe('Participants E2E Tests', () => {
	const createdRoomIds: string[] = [];
	const createdUserIds: string[] = [];
	const moderatorName = 'Moderator';
	const speakerName = 'Speaker';

	let room: MeetRoom;
	let roomId: string;

	test.beforeEach(async () => {
		room = await createRoom();
		roomId = room.roomId;
		createdRoomIds.push(roomId);
	});

	test.afterAll(async () => {
		await Promise.all([deleteRooms(createdRoomIds), deleteUsers(createdUserIds)]);
	});

	test.describe('Participant Badges', () => {
		// Freshly created users must change their password on first login, so tests provide both.
		const INITIAL_PASSWORD = 'changeme1';
		const NEW_PASSWORD = 'changed11';

		test('should show the moderator badge for a moderator participant', async ({ browser }) => {
			const { byName, removeAllParticipants } = await joinParticipants(browser, {
				roomId,
				participants: [{ name: moderatorName, baseRole: MeetRoomMemberRole.MODERATOR }]
			});

			try {
				const moderatorPage = byName[moderatorName];
				await toggleParticipantsPanel(moderatorPage);

				const moderatorId = await getLocalParticipantId(moderatorPage);
				await expectParticipantBadge(moderatorPage, moderatorId, MeetRoomMemberUIBadge.MODERATOR);
			} finally {
				await removeAllParticipants();
			}
		});

		test('should show no badge for a regular participant', async ({ browser }) => {
			const { byName, removeAllParticipants } = await joinParticipants(browser, {
				roomId,
				participants: [{ name: speakerName, baseRole: MeetRoomMemberRole.SPEAKER }]
			});

			try {
				const speakerPage = byName[speakerName];
				await toggleParticipantsPanel(speakerPage);

				const speakerId = await getLocalParticipantId(speakerPage);
				await expectNoParticipantBadge(speakerPage, speakerId);
			} finally {
				await removeAllParticipants();
			}
		});

		test('should show the admin badge for an admin user', async ({ page }) => {
			const userId = `admin${Date.now()}`;
			await createUser({ userId, name: 'Admin User', role: MeetUserRole.ADMIN, password: INITIAL_PASSWORD });
			createdUserIds.push(userId);

			// The admin joins a room they do NOT own (owned by the seeded admin) → ADMIN badge.
			// Being a first login, the app forces the password-change step before reaching the room.
			await openMeeting(page, room.access.user.url, {
				login: { userId, password: INITIAL_PASSWORD, newPassword: NEW_PASSWORD }
			});

			await toggleParticipantsPanel(page);
			const adminId = await getLocalParticipantId(page);
			await expectParticipantBadge(page, adminId, MeetRoomMemberUIBadge.ADMIN);
		});

		test('should show the owner badge for the room owner', async ({ page }) => {
			const userId = `owner${Date.now()}`;
			await createUser({
				userId,
				name: 'Owner User',
				role: MeetUserRole.ROOM_MANAGER,
				password: INITIAL_PASSWORD
			});
			createdUserIds.push(userId);

			// Obtain a full access token (the first login requires a password change) and create the
			// room AS this user, via their token instead of the API key, so they become its owner.
			const accessToken = await getUserAccessToken(userId, INITIAL_PASSWORD, NEW_PASSWORD);
			const ownedRoom = await createRoomAsUser(accessToken);
			createdRoomIds.push(ownedRoom.roomId);

			// The password was already changed via the API, so the UI login skips the change step.
			await openMeeting(page, ownedRoom.access.user.url, {
				login: { userId, password: NEW_PASSWORD }
			});

			await toggleParticipantsPanel(page);
			const ownerId = await getLocalParticipantId(page);
			await expectParticipantBadge(page, ownerId, MeetRoomMemberUIBadge.OWNER);
		});
	});

	test.describe('Promote and demote moderator (canMakeModerator)', () => {
		test('should let a participant with canMakeModerator promote and demote a regular participant', async ({
			browser
		}) => {
			const { byName, removeAllParticipants } = await joinParticipants(browser, {
				roomId,
				participants: [
					{ name: moderatorName, baseRole: MeetRoomMemberRole.MODERATOR },
					{ name: speakerName, baseRole: MeetRoomMemberRole.SPEAKER, headless: true }
				]
			});

			try {
				const moderatorPage = byName[moderatorName];
				const speakerPage = byName[speakerName];

				await toggleParticipantsPanel(moderatorPage);
				const speakerId = await getParticipantIdByName(moderatorPage, speakerName);

				// Before promotion: promote available, demote not, no badge.
				await expectMakeModeratorButton(moderatorPage, speakerId);
				await expectNoRemoveModeratorButton(moderatorPage, speakerId);
				await expectNoParticipantBadge(moderatorPage, speakerId);

				// Promote → the participant becomes a moderator, so the demote button replaces promote.
				await makeParticipantModerator(moderatorPage, speakerId);
				await expectParticipantBadge(moderatorPage, speakerId, MeetRoomMemberUIBadge.MODERATOR);
				await expectModerationControls(moderatorPage, speakerId);
				await expectRemoveModeratorButton(moderatorPage, speakerId);
				await expectNoMakeModeratorButton(moderatorPage, speakerId);

				// The promotion is reflected reactively on the promoted participant's own view.
				await toggleParticipantsPanel(speakerPage);
				const speakerLocalId = await getLocalParticipantId(speakerPage);
				await expectParticipantBadge(speakerPage, speakerLocalId, MeetRoomMemberUIBadge.MODERATOR);

				// Demote → back to the original role (no badge, promote available again).
				await removeParticipantModerator(moderatorPage, speakerId);
				await expectNoParticipantBadge(moderatorPage, speakerId);
				await expectMakeModeratorButton(moderatorPage, speakerId);
				await expectNoRemoveModeratorButton(moderatorPage, speakerId);

				await expectNoParticipantBadge(speakerPage, speakerLocalId);
			} finally {
				await removeAllParticipants();
			}
		});

		test('should not let a participant without canMakeModerator promote others', async ({ browser }) => {
			const { byName, removeAllParticipants } = await joinParticipants(browser, {
				roomId,
				participants: [
					{
						name: moderatorName,
						baseRole: MeetRoomMemberRole.MODERATOR,
						customPermissions: { canMakeModerator: false }
					},
					{ name: speakerName, baseRole: MeetRoomMemberRole.SPEAKER, headless: true }
				]
			});

			try {
				const moderatorPage = byName[moderatorName];
				await toggleParticipantsPanel(moderatorPage);
				const speakerId = await getParticipantIdByName(moderatorPage, speakerName);

				await expectNoMakeModeratorButton(moderatorPage, speakerId);
			} finally {
				await removeAllParticipants();
			}
		});

		test('should propagate promote and demote changes to other moderators', async ({ browser }) => {
			const moderator1Name = 'Moderator 1';
			const moderator2Name = 'Moderator 2';
			const { byName, removeAllParticipants } = await joinParticipants(browser, {
				roomId,
				participants: [
					{ name: moderator1Name, baseRole: MeetRoomMemberRole.MODERATOR },
					{ name: moderator2Name, baseRole: MeetRoomMemberRole.MODERATOR },
					{ name: speakerName, baseRole: MeetRoomMemberRole.SPEAKER, headless: true }
				]
			});

			try {
				const moderator1Page = byName[moderator1Name];
				const moderator2Page = byName[moderator2Name];

				await toggleParticipantsPanel(moderator1Page);
				await toggleParticipantsPanel(moderator2Page);

				// The participant SID is stable across pages, so it can be reused on both moderators' views.
				const speakerId = await getParticipantIdByName(moderator1Page, speakerName);
				await expectNoParticipantBadge(moderator1Page, speakerId);

				// Moderator 1 promotes the speaker...
				await makeParticipantModerator(moderator1Page, speakerId);
				await expectParticipantBadge(moderator1Page, speakerId, MeetRoomMemberUIBadge.MODERATOR);

				// ...and moderator 2 sees the promotion reactively (badge + demote control appear).
				await expectParticipantBadge(moderator2Page, speakerId, MeetRoomMemberUIBadge.MODERATOR);
				await expectRemoveModeratorButton(moderator2Page, speakerId);

				// Moderator 2 demotes the promoted moderator...
				await removeParticipantModerator(moderator2Page, speakerId);
				await expectNoParticipantBadge(moderator2Page, speakerId);

				// ...and moderator 1 sees the demotion reactively (badge gone, promote available again).
				await expectNoParticipantBadge(moderator1Page, speakerId);
				await expectMakeModeratorButton(moderator1Page, speakerId);
			} finally {
				await removeAllParticipants();
			}
		});
	});

	test.describe('Kick participant (canKickParticipants)', () => {
		test('should let a participant with canKickParticipants kick a regular participant', async ({ browser }) => {
			const { byName, removeAllParticipants } = await joinParticipants(browser, {
				roomId,
				participants: [
					{ name: moderatorName, baseRole: MeetRoomMemberRole.MODERATOR },
					{ name: speakerName, baseRole: MeetRoomMemberRole.SPEAKER, headless: true }
				]
			});

			try {
				const moderatorPage = byName[moderatorName];
				const speakerPage = byName[speakerName];

				await toggleParticipantsPanel(moderatorPage);
				const speakerId = await getParticipantIdByName(moderatorPage, speakerName);

				await expectKickButton(moderatorPage, speakerId);
				await kickParticipant(moderatorPage, speakerId);

				// The kicked participant is disconnected; the moderator stays in the meeting.
				await expect(speakerPage.locator('#layout-container')).toHaveCount(0, { timeout: 10_000 });
				await expect(moderatorPage.locator('#layout-container')).toBeVisible();
			} finally {
				await removeAllParticipants();
			}
		});

		test('should let a participant with canKickParticipants kick a promoted moderator', async ({ browser }) => {
			const { byName, removeAllParticipants } = await joinParticipants(browser, {
				roomId,
				participants: [
					{ name: moderatorName, baseRole: MeetRoomMemberRole.MODERATOR },
					{ name: speakerName, baseRole: MeetRoomMemberRole.SPEAKER, headless: true }
				]
			});

			try {
				const moderatorPage = byName[moderatorName];
				const speakerPage = byName[speakerName];

				await toggleParticipantsPanel(moderatorPage);
				const speakerId = await getParticipantIdByName(moderatorPage, speakerName);

				// Promote the participant to moderator — unlike an original moderator, a promoted
				// moderator keeps a MODERATOR badge but can still be kicked.
				await makeParticipantModerator(moderatorPage, speakerId);
				await expectParticipantBadge(moderatorPage, speakerId, MeetRoomMemberUIBadge.MODERATOR);
				await expectKickButton(moderatorPage, speakerId);

				await kickParticipant(moderatorPage, speakerId);

				// The kicked promoted moderator is disconnected; the original moderator stays in the meeting.
				await expect(speakerPage.locator('#layout-container')).toHaveCount(0, { timeout: 10_000 });
				await expect(moderatorPage.locator('#layout-container')).toBeVisible();
			} finally {
				await removeAllParticipants();
			}
		});

		test('should not let a participant without canKickParticipants kick others', async ({ browser }) => {
			const { byName, removeAllParticipants } = await joinParticipants(browser, {
				roomId,
				participants: [
					{
						name: moderatorName,
						baseRole: MeetRoomMemberRole.MODERATOR,
						customPermissions: { canKickParticipants: false }
					},
					{ name: speakerName, baseRole: MeetRoomMemberRole.SPEAKER, headless: true }
				]
			});

			try {
				const moderatorPage = byName[moderatorName];
				await toggleParticipantsPanel(moderatorPage);
				const speakerId = await getParticipantIdByName(moderatorPage, speakerName);

				await expectNoKickButton(moderatorPage, speakerId);
			} finally {
				await removeAllParticipants();
			}
		});
	});

	test.describe('Original moderator protection', () => {
		test('should not let a promoted moderator demote or kick an original moderator', async ({ browser }) => {
			const { byName, removeAllParticipants } = await joinParticipants(browser, {
				roomId,
				participants: [
					{ name: moderatorName, baseRole: MeetRoomMemberRole.MODERATOR },
					{ name: speakerName, baseRole: MeetRoomMemberRole.SPEAKER, headless: true }
				]
			});

			try {
				const originalModeratorPage = byName[moderatorName];
				const promotedModeratorPage = byName[speakerName];

				// The original moderator promotes the regular participant to moderator.
				await toggleParticipantsPanel(originalModeratorPage);
				const promotedId = await getParticipantIdByName(originalModeratorPage, speakerName);
				await makeParticipantModerator(originalModeratorPage, promotedId);
				await expectParticipantBadge(originalModeratorPage, promotedId, MeetRoomMemberUIBadge.MODERATOR);

				// The promoted moderator has full moderator permissions but must not be able to demote
				// or kick the original moderator (protection is based on the target, not the actor).
				await toggleParticipantsPanel(promotedModeratorPage);
				const originalModeratorId = await getParticipantIdByName(promotedModeratorPage, moderatorName);

				await expectParticipantBadge(
					promotedModeratorPage,
					originalModeratorId,
					MeetRoomMemberUIBadge.MODERATOR
				);
				await expectNoRemoveModeratorButton(promotedModeratorPage, originalModeratorId);
				await expectNoKickButton(promotedModeratorPage, originalModeratorId);
				await expectNoModerationControls(promotedModeratorPage, originalModeratorId);
			} finally {
				await removeAllParticipants();
			}
		});
	});

	test.describe('Participant Panel Indicators', () => {
		test('should reactively toggle screen-share, camera-off, and mic-off indicators while the panel is open', async ({
			browser
		}) => {
			const { pages, removeAllParticipants } = await joinParticipants(browser, {
				roomId,
				participants: [{ name: 'participant-0' }, { name: 'participant-1', headless: true }]
			});
			const [pageA, pageB] = pages;

			try {
				// A opens the participants panel BEFORE B's state changes — the panel must react in place.
				await toggleParticipantsPanel(pageA);
				await expect(pageA.locator('.local-participant-container')).toBeVisible({ timeout: 5_000 });
				const remoteItem = pageA.locator('#remote-participant-item ov-participant-panel-item').first();
				await expect(remoteItem).toBeVisible({ timeout: 5_000 });
				const screenIcon = remoteItem.locator('#screen-share-indicator');
				const micOffIcon = remoteItem.locator('#mic-off-indicator');
				const cameraOffIcon = remoteItem.locator('#camera-off-indicator');

				// Initially: camera on, mic on, no screen sharing → no indicators visible.
				await expect(screenIcon).toHaveCount(0);
				await expect(micOffIcon).toHaveCount(0);
				await expect(cameraOffIcon).toHaveCount(0);

				// B turns their camera off → camera-off icon appears, then back on → it disappears.
				await toggleCamera(pageB);
				await expect(cameraOffIcon).toHaveCount(1, { timeout: 10_000 });
				await expect(cameraOffIcon).toBeVisible();

				await toggleCamera(pageB);
				await expect(cameraOffIcon).toHaveCount(0, { timeout: 10_000 });

				// B starts screen sharing → screen-share icon appears.
				await startScreensharing(pageB);
				await expect(screenIcon).toHaveCount(1, { timeout: 10_000 });
				await expect(screenIcon).toBeVisible();

				// B mutes their mic → mic-off icon appears (screen-share icon still visible).
				await toggleMicrophone(pageB);
				await expect(micOffIcon).toHaveCount(1, { timeout: 5_000 });
				await expect(micOffIcon).toBeVisible();
				await expect(screenIcon).toHaveCount(1);

				// B un-mutes → mic-off icon disappears.
				await toggleMicrophone(pageB);
				await expect(micOffIcon).toHaveCount(0, { timeout: 5_000 });

				// B stops screen sharing → screen-share icon disappears.
				await stopScreensharing(pageB);
				await expect(screenIcon).toHaveCount(0, { timeout: 10_000 });
			} finally {
				await removeAllParticipants();
			}
		});
	});

	test.describe('Mute remote participant audio', () => {
		test('should toggle muting a remote participant audio from the participants panel', async ({ browser }) => {
			const { byName, removeAllParticipants } = await joinParticipants(browser, {
				roomId,
				participants: [{ name: 'participant-0' }, { name: 'participant-1', headless: true }]
			});

			try {
				const localPage = byName['participant-0'];
				const remoteName = 'participant-1';

				await toggleParticipantsPanel(localPage);

				// The remote participant starts unmuted; the local user mutes and then unmutes them.
				await expectParticipantPanelUnmuted(localPage, remoteName);

				await toggleParticipantPanelMute(localPage, remoteName);
				await expectParticipantPanelMuted(localPage, remoteName);

				await toggleParticipantPanelMute(localPage, remoteName);
				await expectParticipantPanelUnmuted(localPage, remoteName);
			} finally {
				await removeAllParticipants();
			}
		});
	});
});

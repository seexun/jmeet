import { MeetRoomMemberRole } from '@openvidu-meet/typings';
import { expect, test, type Page } from '@playwright/test';
import { createRoom, createRoomMember, deleteRooms, MEET_BASE_URL } from './helpers/meet-api.helper';
import { openLobby, openMeeting } from './helpers/meeting-navigation.helper';
import { expectCopiedText, expectHidden, installClipboardCapture } from './helpers/ui-utils.helper';

const API_KEY = process.env['E2E_API_KEY'] || 'meet-api-key';

/**
 * Turns the room waiting room off before anyone joins. Dev 企业策略在创建时强制等候室开
 * （创建载荷中的 waitingRoomEnabled 被服务端覆盖），须在入会前经 PUT config 关闭（批次5移交处方；
 * 会议活跃时该端点 409，故只在会前调用）。
 */
const disableWaitingRoom = async (roomId: string): Promise<void> => {
	const response = await fetch(`${MEET_BASE_URL}/api/v1/rooms/${encodeURIComponent(roomId)}/config`, {
		method: 'PUT',
		headers: {
			'content-type': 'application/json',
			'x-api-key': API_KEY
		},
		body: JSON.stringify({
			config: {
				security: {
					waitingRoomEnabled: false,
					locked: false,
					accessScope: 'anyone_with_link',
					allowJoinBeforeHost: true,
					muteOnEntry: true,
					allowSelfUnmute: true,
					screenSharePolicy: 'all_participants',
					allowParticipantRename: true,
					allowMultipleDevices: false,
					watermarkEnabled: false
				}
			}
		})
	});

	if (!response.ok) {
		throw new Error(
			`Disable waiting room failed for room '${roomId}' (${response.status}): ${await response.text()}`
		);
	}
};

test.describe('Share Link E2E Tests', () => {
	const createdRoomIds: string[] = [];

	let roomId: string;
	// Every share point copies the anonymous *speaker* room access link. The lobby surface copies
	// the full secret-bearing URL, while the in-meeting invite dialog copies its public display
	// form (host + path, no scheme/secret) — the clipboard expectation is derived per entry below.
	let speakerAccessLink: string;

	/**
	 * 遗留清扫口径处置（2026-10-14）：旧工具栏复制按钮（#copy-speaker-link）与参与者面板内嵌
	 * invite 面板（#invite-panel / ov-share-room-access-link）均已停用（组件存在但 SPA 零实例化，
	 * 运行 UI 不渲染）。现行用户可达的复制链接入口为：
	 *  1. 大厅 `.jmeet-lobby-invite` 复制按钮（CDK execCommand 复制完整 speaker 链接）；
	 *  2. 参与者面板底部「邀请」按钮 `.participants-footer .invite-button`（打开邀请对话框）；
	 *  3. 成员空态「立即邀请」按钮 `.members-empty-invite-btn`（同上）。
	 * 邀请对话框（.invite-dialog）内 `复制入会链接`（aria-label）经 navigator.clipboard.writeText
	 * 复制链接的公开展示形态（host+pathname，无协议无 secret）。本文件断言语义不变：复制链接可用。
	 */

	// Lobby copy entry (ghost button inside the lobby invite strip).
	const lobbyInviteCopyButton = (page: Page) =>
		page.locator('.jmeet-lobby-invite button');
	// Participants panel footer invite entry (opens the invite dialog).
	const panelInviteButton = (page: Page) =>
		page.locator('.participants-footer .invite-button');
	// Participants panel empty-state invite entry (shown while alone).
	const emptyStateInviteButton = (page: Page) =>
		page.locator('.members-empty-invite-btn');
	// Invite dialog "copy join link" control.
	const inviteDialogCopyLinkButton = (page: Page) =>
		page.locator('button[aria-label="复制入会链接"]');

	/**
	 * Opens the participants panel. At the desktop dock the visible entry is the pill button
	 * (`#toolbar-participants-entry-btn`); the top tab strip (`#participants-panel-btn`) renders
	 * hidden in this layout, so prefer the dock entry and fall back to the tab.
	 */
	const openParticipantsPanel = async (page: Page): Promise<void> => {
		const dockEntry = page.locator('#toolbar-participants-entry-btn');

		if (await dockEntry.isVisible()) {
			await dockEntry.click();
			return;
		}

		await page.locator('#participants-panel-btn').click();
	};

	test.beforeEach(async () => {
		const room = await createRoom();
		roomId = room.roomId;
		speakerAccessLink = room.access.anonymous.speaker.url;
		createdRoomIds.push(roomId);
		// Dev 企业策略强制新建房等候室开（创建载荷被覆盖）。会前 PUT config 关闭（批次5移交处方），
		// 否则被拒成员（customPermissions 使徽标退化为 OTHER）会停在等候室到不了会中。
		await disableWaitingRoom(roomId);
	});

	test.afterAll(async () => {
		await deleteRooms(createdRoomIds);
	});

	/**
	 * Public display form of the speaker link (host + path, no scheme/secret) — exactly what the
	 * invite dialog shows in its link field and puts on the clipboard when copying.
	 */
	const publicSpeakerLink = (): string => {
		const url = new URL(speakerAccessLink);
		return `${url.host}${url.pathname}`;
	};

	/**
	 * The invite dialog copies via `navigator.clipboard.writeText`, which fires no `copy` event;
	 * clipboard capture alone cannot observe it, so grant read/write to let the assertion fall
	 * back to `navigator.clipboard.readText()`.
	 */
	const grantClipboardAccess = async (page: Page): Promise<void> => {
		await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
	};

	/**
	 * Creates a room member and returns its access URL. Visibility of the share access link is driven
	 * by the `canShareAccessLinks` permission — granted to moderators and denied to speakers by
	 * default — so we set it explicitly (via customPermissions) to test the permission in isolation
	 * from the base role.
	 */
	const createMemberAccessUrl = async (
		canShareAccessLinks: boolean,
		baseRole: MeetRoomMemberRole = MeetRoomMemberRole.MODERATOR
	): Promise<string> => {
		const member = await createRoomMember(roomId, {
			name: `member-${Date.now()}`,
			baseRole,
			customPermissions: { canShareAccessLinks }
		});
		return member.accessUrl;
	};

	test.describe('Lobby', () => {
		test('should render the share room access link in the lobby when member can share access links', async ({
			page
		}) => {
			const accessUrl = await createMemberAccessUrl(true);

			await openLobby(page, accessUrl);

			await expect(page.locator('.jmeet-lobby-invite')).toBeVisible();
			await expect(lobbyInviteCopyButton(page)).toBeVisible();
		});

		test('should not render the share room access link in the lobby when member cannot share access links', async ({
			page
		}) => {
			const accessUrl = await createMemberAccessUrl(false);

			await openLobby(page, accessUrl);

			await expectHidden(page, '.jmeet-lobby-invite');
		});
	});

	test.describe('In-meeting share points', () => {
		test('should render the participants panel invite entry and invite dialog when member can share access links', async ({
			page
		}) => {
			const accessUrl = await createMemberAccessUrl(true);

			await openMeeting(page, accessUrl);

			// Participants panel invite entry (opens the invite dialog)
			await openParticipantsPanel(page);
			await expect(panelInviteButton(page)).toBeVisible();
			await panelInviteButton(page).click();
			await expect(inviteDialogCopyLinkButton(page)).toBeVisible();
		});

		test('should not render the invite entry when member cannot share access links', async ({
			page
		}) => {
			const accessUrl = await createMemberAccessUrl(false);

			await openMeeting(page, accessUrl);

			await openParticipantsPanel(page);
			await expectHidden(page, '.participants-footer .invite-button');
			await expectHidden(page, '.members-empty-invite-btn');
		});

	});

	test.describe('Copying the anonymous speaker access link', () => {
		test('should copy the anonymous speaker access link from the lobby', async ({ page }) => {
			const accessUrl = await createMemberAccessUrl(true);

			await openLobby(page, accessUrl);
			await installClipboardCapture(page);

			await lobbyInviteCopyButton(page).click();
			await expectCopiedText(page, speakerAccessLink);
		});

		test('should copy the anonymous speaker access link from the participants panel invite button', async ({
			page
		}) => {
			const accessUrl = await createMemberAccessUrl(true);

			await openMeeting(page, accessUrl);
			await grantClipboardAccess(page);

			await openParticipantsPanel(page);
			await panelInviteButton(page).click();
			await expect(inviteDialogCopyLinkButton(page)).toBeVisible();
			await inviteDialogCopyLinkButton(page).click();
			await expectCopiedText(page, publicSpeakerLink());
		});

		test('should copy the anonymous speaker access link from the participants panel empty-state invite button', async ({
			page
		}) => {
			const accessUrl = await createMemberAccessUrl(true);

			await openMeeting(page, accessUrl);
			await grantClipboardAccess(page);

			await openParticipantsPanel(page);
			await emptyStateInviteButton(page).click();
			await expect(inviteDialogCopyLinkButton(page)).toBeVisible();
			await inviteDialogCopyLinkButton(page).click();
			await expectCopiedText(page, publicSpeakerLink());
		});

		test('should show and copy the anonymous speaker access link from the invite dialog link field', async ({
			page
		}) => {
			const accessUrl = await createMemberAccessUrl(true);

			await openMeeting(page, accessUrl);
			await grantClipboardAccess(page);

			await openParticipantsPanel(page);
			await panelInviteButton(page).click();

			// The dialog link field displays the public link form before copying.
			const linkField = page.locator('.invite-field--link strong');
			await expect(linkField).toBeVisible();
			await expect(linkField).toHaveText(publicSpeakerLink());

			await inviteDialogCopyLinkButton(page).click();
			await expectCopiedText(page, publicSpeakerLink());
		});
	});
});

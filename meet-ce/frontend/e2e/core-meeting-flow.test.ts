import { expect, test } from '@playwright/test';
import { DEFAULT_MEETING_SECURITY_CONFIG, MeetRoomMemberRole } from '@openvidu-meet/typings';
import { createRoom, createRoomMember, deleteRooms } from './helpers/meet-api.helper';
import { endMeeting, expectEndMeetingOption, expectNoEndMeetingOption, openMeeting } from './helpers/meeting-navigation.helper';
import { joinParticipants } from './helpers/participant-management.helper';
import { expectStreamCount } from './helpers/stream.helper';

test.describe('Enterprise core meeting flow', () => {
	test.describe.configure({ timeout: 90_000 });

	let roomId = '';

	test.afterEach(async () => {
		if (roomId) {
			await deleteRooms([roomId]).catch(() => undefined);
			roomId = '';
		}
	});

	test('creates a room, admits a member, then ends the meeting for everyone', async ({ browser }) => {
		const room = await createRoom({
			roomName: `core-flow-${Date.now()}`,
			config: { security: { ...DEFAULT_MEETING_SECURITY_CONFIG, waitingRoomEnabled: true } }
		});
		roomId = room.roomId;

		const moderator = await createRoomMember(roomId, { name: '主持人', baseRole: MeetRoomMemberRole.MODERATOR });
		const moderatorPage = await browser.newPage();
		await openMeeting(moderatorPage, moderator.accessUrl);
		const member = await createRoomMember(roomId, { name: '企业成员', baseRole: MeetRoomMemberRole.SPEAKER });
		const memberPage = await browser.newPage();
		const joining = openMeeting(memberPage, member.accessUrl, { timeoutMs: 30_000 }).then(() => undefined, (error: Error) => error);

		try {
			await expect(memberPage.locator('.jmeet-lobby-waiting')).toBeVisible({ timeout: 15_000 });
			await moderatorPage.locator('#more-options-btn').click();
			await moderatorPage.locator('#waiting-room-button').click();
			await moderatorPage.getByRole('button', { name: '允许入会', exact: true }).click();
			await moderatorPage.keyboard.press('Escape');
			const joinError = await joining;
			if (joinError) throw joinError;
			await expectStreamCount(moderatorPage, 2);
			await expectStreamCount(memberPage, 2);
			await expectEndMeetingOption(moderatorPage);
			await expectNoEndMeetingOption(memberPage);

			await endMeeting(moderatorPage);
			await expect(memberPage.locator('#layout-container')).toHaveCount(0, { timeout: 15_000 });
			await expect(memberPage.locator('.disconnected-container')).toBeVisible({ timeout: 15_000 });
		} finally {
			await memberPage.close();
			await moderatorPage.close();
		}
	});

	test('recovers the same participant after a 10 second network interruption', async ({ browser }) => {
		const room = await createRoom({
			roomName: `recovery-${Date.now()}`,
			config: { security: { ...DEFAULT_MEETING_SECURITY_CONFIG, waitingRoomEnabled: false } }
		});
		roomId = room.roomId;

		const participants = await joinParticipants(browser, {
			roomId,
			mode: 'sequential',
			participants: [
				{ name: '恢复测试用户', baseRole: MeetRoomMemberRole.MODERATOR },
				{ name: '在线成员', baseRole: MeetRoomMemberRole.SPEAKER }
			]
		});
		const recoveryPage = participants.byName['恢复测试用户'];

		try {
			await expectStreamCount(recoveryPage, 2);
			await recoveryPage.context().setOffline(true);
			await expect(recoveryPage.locator('.connection-alert')).toBeVisible({ timeout: 10_000 });
			await recoveryPage.waitForTimeout(10_000);
			await recoveryPage.context().setOffline(false);

			await expect(recoveryPage.locator('.connection-alert')).toHaveCount(0, { timeout: 20_000 });
			await expect(recoveryPage.locator('#layout-container')).toBeVisible();
			await expectStreamCount(recoveryPage, 2);
		} finally {
			await recoveryPage.context().setOffline(false).catch(() => undefined);
			await participants.removeAllParticipants();
		}
	});
});

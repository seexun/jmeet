import { expect, test } from '@playwright/test';
import { MeetRoomMemberRole, MeetUserRole } from '@openvidu-meet/typings';
import { randomUUID } from 'node:crypto';
import {
	createUser,
	deleteUsers,
	getUserAccessToken,
	createRoomAsUser,
	createRoomMember,
	deleteRooms,
	MEET_BASE_URL
} from './helpers/meet-api.helper';

test.describe('Template UI regressions', () => {
	let userId = '';
	let roomId = '';
	let accessToken = '';

	test.beforeEach(async ({ context }) => {
		const loginName = `ui_${randomUUID().slice(0, 16)}`;
		const password = `Ui-${randomUUID()}!`;
		const user = await createUser({ loginName, name: '布局回归用户', password, role: MeetUserRole.ROOM_MANAGER });
		userId = user.userId;
		accessToken = await getUserAccessToken(loginName, password, `${password}New`);
		await context.addInitScript((token) => localStorage.setItem('ovMeet-accessToken', token), accessToken);
	});

	test.afterEach(async () => {
		try {
			if (roomId) await deleteRooms([roomId]);
		} finally {
			roomId = '';
			if (userId) await deleteUsers([userId]);
			userId = '';
		}
	});

	test('member action closes its menu and cancelling removal preserves the member', async ({ page }) => {
		const room = await createRoomAsUser(accessToken, { roomName: '成员操作回归' });
		roomId = room.roomId;
		const member = await createRoomMember(roomId, { name: '测试成员', baseRole: MeetRoomMemberRole.SPEAKER });
		await page.goto(`${MEET_BASE_URL}/app/rooms/${roomId}?tab=members`);
		const search = page.locator('#members-search-field input[nz-input]');
		await expect(search).toBeVisible();
		await expect.poll(async () => (await search.boundingBox())?.height).toBe(32);
		await page.goto(`${MEET_BASE_URL}/app/rooms/${roomId}/members/new`);
		const memberDialog = page.getByRole('dialog');
		await expect(memberDialog.locator('.room-member-dialog-page')).toBeVisible();
		const surfaceWidth = (await memberDialog.locator('.ant-modal-content').boundingBox())!.width;
		const contentWidth = (await memberDialog.locator('.ant-modal').boundingBox())!.width;
		expect(Math.abs(surfaceWidth - contentWidth)).toBeLessThanOrEqual(2);
		await memberDialog.getByRole('button', { name: '取消', exact: true }).click();
		await expect(memberDialog).toHaveCount(0);
		const menuButton = page.locator(`#more-member-actions-${member.memberId}`);
		await menuButton.click();
		await page.locator(`#delete-member-btn-${member.memberId}`).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog.getByRole('heading', { name: '移除成员' })).toBeVisible();
		await expect(page.getByRole('menu')).toHaveCount(0);
		await dialog.getByRole('button', { name: '取消', exact: true }).click();
		await expect(dialog).toHaveCount(0);
		await expect(menuButton).toBeVisible();
	});
});

import { MeetRoom, MeetRoomStatus } from '@openvidu-meet/typings';
import { RoomUiUtils } from './ui';

describe('RoomUiUtils.canEnterMeeting', () => {
	const now = 1_000_000;
	const scheduledRoom = {
		status: MeetRoomStatus.OPEN,
		schedule: {
			startDate: now + 60 * 60_000,
			allowEarlyJoinMinutes: 15
		}
	} as MeetRoom;

	it('allows a host to open a scheduled meeting before the participant join window', () => {
		expect(RoomUiUtils.canEnterMeeting(scheduledRoom, now, true)).toBeTrue();
	});

	it('keeps a regular participant outside before the participant join window', () => {
		expect(RoomUiUtils.canEnterMeeting(scheduledRoom, now, false)).toBeFalse();
	});
});

describe('RoomUiUtils.isUpcomingMeeting', () => {
	const startDate = 1_000_000;
	const scheduledRoom = {
		status: MeetRoomStatus.OPEN,
		schedule: {
			startDate,
			allowEarlyJoinMinutes: 15
		}
	} as MeetRoom;

	it('includes a scheduled room before early join opens', () => {
		const joinOpensAt = startDate - 15 * 60_000;
		expect(RoomUiUtils.isUpcomingMeeting(scheduledRoom, joinOpensAt - 1)).toBeTrue();
		expect(RoomUiUtils.isNotStarted(scheduledRoom, joinOpensAt - 1)).toBeTrue();
	});

	it('includes a scheduled room during early join before official start', () => {
		const duringEarlyJoin = startDate - 5 * 60_000;
		expect(RoomUiUtils.isUpcomingMeeting(scheduledRoom, duringEarlyJoin)).toBeTrue();
		expect(RoomUiUtils.isNotStarted(scheduledRoom, duringEarlyJoin)).toBeFalse();
	});

	it('excludes a scheduled room after official start', () => {
		expect(RoomUiUtils.isUpcomingMeeting(scheduledRoom, startDate)).toBeFalse();
	});

	it('excludes instant open rooms without a schedule', () => {
		const instantRoom = { status: MeetRoomStatus.OPEN } as MeetRoom;
		expect(RoomUiUtils.isUpcomingMeeting(instantRoom)).toBeFalse();
	});
});

describe('RoomUiUtils.formatMeetingCode', () => {
	it('formats a 9-digit code into Tencent-style 3-3-3 hyphen groups', () => {
		expect(RoomUiUtils.formatMeetingCode('488898380')).toBe('488-898-380');
	});

	it('returns non-9-digit input untouched (defensive)', () => {
		expect(RoomUiUtils.formatMeetingCode('4888983800')).toBe('4888983800');
		expect(RoomUiUtils.formatMeetingCode('12345678')).toBe('12345678');
	});

	it('returns an empty string for nullish codes', () => {
		expect(RoomUiUtils.formatMeetingCode(null)).toBe('');
		expect(RoomUiUtils.formatMeetingCode(undefined)).toBe('');
	});
});

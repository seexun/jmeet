import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MeetRoomMemberUIBadge } from '@openvidu-meet/typings';
import { LeaveRedirectService } from '../../../shared/services/leave-redirect.service';
import { NavigationService } from '../../../shared/services/navigation.service';
import { RuntimeConfigService } from '../../../shared/services/runtime-config.service';
import { AuthService } from '../../auth/services/auth.service';
import { RoomMemberContextService } from '../../room-members/services/room-member-context.service';
import { RoomService } from '../../rooms/services/room.service';
import { LoggerService } from '../openvidu-components';
import { MeetingContextService } from './meeting-context.service';
import { MeetingLobbyService } from './meeting-lobby.service';
import { MeetingService } from './meeting.service';
import { RoomAccessLinkService } from './room-access-link.service';

describe('MeetingLobbyService scheduled meeting access', () => {
	let service: MeetingLobbyService;
	const memberBadge = signal(MeetRoomMemberUIBadge.OTHER);

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [
				MeetingLobbyService,
				{ provide: RoomService, useValue: {} },
				{ provide: RoomAccessLinkService, useValue: { speakerPublicLink: signal(undefined) } },
				{ provide: MeetingContextService, useValue: { meetingUI: signal({ showJoinMeeting: true }) } },
				{ provide: AuthService, useValue: {} },
				{ provide: RoomMemberContextService, useValue: { memberBadge } },
				{ provide: NavigationService, useValue: {} },
				{ provide: LeaveRedirectService, useValue: {} },
				{ provide: RuntimeConfigService, useValue: { isEmbeddedMode: () => false } },
				{ provide: LoggerService, useValue: { get: () => ({}) } },
				{ provide: MeetingService, useValue: {} }
			]
		});

		service = TestBed.inject(MeetingLobbyService);
		(service as any)._room.set({
			schedule: {
				startDate: Date.now() + 60 * 60_000,
				allowEarlyJoinMinutes: 15
			}
		});
	});

	it('allows the room owner to start a scheduled meeting before the early-join window', () => {
		memberBadge.set(MeetRoomMemberUIBadge.OWNER);
		expect(service.canJoinMeeting()).toBeTrue();
	});

	it('keeps regular participants outside a scheduled meeting before the early-join window', () => {
		memberBadge.set(MeetRoomMemberUIBadge.OTHER);
		expect(service.canJoinMeeting()).toBeFalse();
	});
});

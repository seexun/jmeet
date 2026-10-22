import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { ActivatedRoute } from '@angular/router';
import { LeftEventReason } from '@openvidu-meet/typings';
import { AssetsService } from '../../../../shared/services/assets.service';
import { PlatformBrandingService } from '../../../../shared/services/platform-branding.service';
import { LeaveRedirectService } from '../../../../shared/services/leave-redirect.service';
import { NavigationService } from '../../../../shared/services/navigation.service';
import { RuntimeConfigService } from '../../../../shared/services/runtime-config.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { AuthService } from '../../../auth/services/auth.service';
import { MeetingThemeService } from '../../services/meeting-theme.service';

@Component({
	selector: 'ov-end-meeting',
	imports: [NzIconModule, TranslatePipe],
	templateUrl: './end-meeting.component.html',
	styleUrl: './end-meeting.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class EndMeetingComponent implements OnInit {
	private route = inject(ActivatedRoute);
	protected authService = inject(AuthService);
	protected navService = inject(NavigationService);
	protected leaveRedirect = inject(LeaveRedirectService);
	protected runtimeConfigService = inject(RuntimeConfigService);
	private readonly assets = inject(AssetsService);
	protected readonly branding = inject(PlatformBrandingService);
	// 会议域作用域挂载点：注入即给 body 挂 meeting-ui；root 单例应用级常驻，路由切换不摘（见 MeetingThemeService）。
	private readonly meetingTheme = inject(MeetingThemeService);

	/** Default OpenVidu logo served as a static asset (resolves in SPA & WC modes). */
	protected readonly logoUrl = this.assets.logo;

	/**
	 * Optional reason override, used when the component is rendered outside
	 * the Angular Router (e.g. inside the Web Component, which has no
	 * routing).
	 */
	readonly reason = input<string | undefined>(undefined);

	// Hold translation KEYS (not resolved text) and translate reactively in the template, so the
	// screen follows the active language even though non-English locales load asynchronously.
	disconnectedTitleKey = signal('END_MEETING.LEFT_TITLE');
	disconnectReasonKey = signal('END_MEETING.LEFT_MESSAGE');

	showBackButton = signal(true);
	backButtonTextKey = signal('END_MEETING.BACK');

	ngOnInit() {
		this.setDisconnectReason();
		this.setBackButtonText();
	}

	/**
	 * Resolves the disconnect reason from (in order): the `reason` input, the
	 * `reason` route query parameter. Falls back to the default title/message
	 * if neither is set.
	 */
	private setDisconnectReason() {
		const reason = this.reason() ?? this.route.snapshot.queryParams['reason'];
		if (reason) {
			const { titleKey, messageKey } = this.mapReasonToTitleAndMessage(reason);
			this.disconnectedTitleKey.set(titleKey);
			this.disconnectReasonKey.set(messageKey);
		}
	}

	/**
	 * Maps technical disconnect reasons to user-friendly title/message translation keys
	 */
	private mapReasonToTitleAndMessage(reason: string): { titleKey: string; messageKey: string } {
		const reasonMap: { [key in LeftEventReason]: { titleKey: string; messageKey: string } } = {
			[LeftEventReason.VOLUNTARY_LEAVE]: {
				titleKey: 'END_MEETING.LEFT_TITLE',
				messageKey: 'END_MEETING.LEFT_MESSAGE'
			},
			[LeftEventReason.PARTICIPANT_KICKED]: {
				titleKey: 'END_MEETING.KICKED_TITLE',
				messageKey: 'END_MEETING.KICKED_MESSAGE'
			},
			[LeftEventReason.MEETING_ENDED]: {
				titleKey: 'END_MEETING.ENDED_TITLE',
				messageKey: 'END_MEETING.ENDED_MESSAGE'
			},
			[LeftEventReason.MEETING_ENDED_BY_SELF]: {
				titleKey: 'END_MEETING.ENDED_TITLE',
				messageKey: 'END_MEETING.ENDED_BY_SELF_MESSAGE'
			},
			[LeftEventReason.NETWORK_DISCONNECT]: {
				titleKey: 'END_MEETING.DISCONNECTED_TITLE',
				messageKey: 'END_MEETING.NETWORK_MESSAGE'
			},
			[LeftEventReason.SERVER_SHUTDOWN]: {
				titleKey: 'END_MEETING.DISCONNECTED_TITLE',
				messageKey: 'END_MEETING.SERVER_SHUTDOWN_MESSAGE'
			},
			[LeftEventReason.DUPLICATE_IDENTITY]: {
				titleKey: 'END_MEETING.DISCONNECTED_TITLE',
				messageKey: 'END_MEETING.DUPLICATE_MESSAGE'
			},
			[LeftEventReason.UNKNOWN]: {
				titleKey: 'END_MEETING.DISCONNECTED_TITLE',
				messageKey: 'END_MEETING.UNKNOWN_MESSAGE'
			}
		};

		const normalizedReason = Object.values(LeftEventReason).find((enumValue) => enumValue === reason) as
			| LeftEventReason
			| undefined;
		return reasonMap[normalizedReason ?? LeftEventReason.UNKNOWN];
	}

	/**
	 * Sets the back button text based on the application mode and user authentication
	 */
	private async setBackButtonText() {
		const isStandaloneMode = !this.runtimeConfigService.isEmbeddedMode();
		const redirection = this.leaveRedirect.getLeaveRedirectURL();
		const isAuthenticated = await this.authService.isUserAuthenticated();

		// If in standalone mode without redirection and user is not authenticated,
		// hide back button (user has no where to go back to)
		if (isStandaloneMode && !redirection && !isAuthenticated) {
			this.showBackButton.set(false);
			return;
		}

		this.showBackButton.set(true);
		this.backButtonTextKey.set(
			isStandaloneMode && !redirection && isAuthenticated ? 'END_MEETING.BACK_TO_ROOMS' : 'END_MEETING.ACCEPT'
		);
	}

	/**
	 * Back-button handler. Defers WC-vs-SPA branching to
	 * {@link NavigationService.goBackFromMeeting}.
	 */
	async goBack() {
		await this.navService.goBackFromMeeting('/app/rooms', true);
	}
}

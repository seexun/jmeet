import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LeaveRedirectService } from '../../services/leave-redirect.service';
import { NavigationService } from '../../services/navigation.service';
import { RuntimeConfigService } from '../../services/runtime-config.service';
import { describeNavigationError } from '../../utils/navigation-error.util';
import { AuthService } from '../../../domains/auth/services/auth.service';

@Component({
	selector: 'ov-error',
	imports: [NzIconModule, TranslatePipe],
	templateUrl: './error.component.html',
	styleUrl: './error.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ErrorComponent implements OnInit {
	private route = inject(ActivatedRoute);
	protected authService = inject(AuthService);
	protected navService = inject(NavigationService);
	protected leaveRedirect = inject(LeaveRedirectService);
	protected runtimeConfigService = inject(RuntimeConfigService);

	/**
	 * Optional error reason. When set it takes precedence over the `reason` route query param, so the
	 * component can be embedded directly (e.g. the web component shell, which has no `/error` route)
	 * the same way it works as the SPA's routed `/error` page.
	 */
	readonly reason = input<string>('');

	// Effective reason: explicit input wins, otherwise the SPA route's `?reason=` query param.
	private readonly effectiveReason = computed(() => this.reason() || this.route.snapshot.queryParams['reason'] || '');
	private readonly description = computed(() =>
		this.effectiveReason() ? describeNavigationError(this.effectiveReason()) : null
	);

	// Translation KEYS resolved by the `translate` pipe in the template, so the copy reacts to a live
	// language switch / lazily-loaded locale (resolving imperatively would freeze it to the English
	// fallback for non-English users).
	readonly errorTitleKey = computed(() => this.description()?.titleKey ?? 'ERROR.DEFAULT_TITLE');
	readonly errorMessageKey = computed(() => this.description()?.messageKey ?? '');

	showBackButton = signal(true);
	backButtonTextKey = signal('ERROR.BACK');

	ngOnInit() {
		this.setBackButtonText();
	}

	/**
	 * Sets the back button text based on the application mode and user authentication
	 */
	async setBackButtonText() {
		const isStandaloneMode = !this.runtimeConfigService.isWebcomponentMode();
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
			isStandaloneMode && !redirection && isAuthenticated ? 'ERROR.BACK_TO_CONSOLE' : 'ERROR.ACCEPT'
		);
	}

	/**
	 * Back-button handler. Defers WC-vs-SPA branching to
	 * {@link NavigationService.goBackFromMeeting} (which falls back to the
	 * console route in SPA mode).
	 */
	async goBack() {
		await this.navService.goBackFromMeeting('/', true);
	}
}

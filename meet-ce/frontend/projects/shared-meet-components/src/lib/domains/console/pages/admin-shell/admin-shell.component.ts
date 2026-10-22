import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ConsoleNavLink } from '../../../../shared/models/sidenav.model';
import { AuthService } from '../../../auth/services/auth.service';
import { ConsoleNavComponent } from '../../components/console-nav/console-nav.component';

@Component({
	selector: 'ov-admin-shell',
	imports: [ConsoleNavComponent],
	template: `
		<ov-console-nav
			[navLinks]="navLinks"
			[portalLabel]="'PORTAL.ADMIN'"
			[portalSwitchLabel]="'PORTAL.SWITCH_TO_WORKSPACE'"
			portalSwitchRoute="/app"
			profileRoute="/app/profile"
			(onLogoutClicked)="logout()"
		/>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminShellComponent {
	private readonly authService = inject(AuthService);

	get navLinks(): ConsoleNavLink[] {
		return [
			{ label: 'NAV.USERS', route: '/admin/users', icon: 'manage_accounts', iconClass: 'ov-users', group: 'NAV.GROUP_GOVERNANCE' }
		];
	}

	async logout() {
		await this.authService.logout();
	}
}

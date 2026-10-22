import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MeetUserRole } from '@openvidu-meet/typings';
import { ConsoleNavLink } from '../../../../shared/models/sidenav.model';
import { AuthService } from '../../../auth/services/auth.service';
import { ConsoleNavComponent } from '../../components/console-nav/console-nav.component';

@Component({
	selector: 'ov-workspace-shell',
	imports: [ConsoleNavComponent],
	template: `
		<ov-console-nav
			[navLinks]="navLinks"
			[portalLabel]="'PORTAL.WORKSPACE'"
			[portalSwitchLabel]="isAdmin() ? 'PORTAL.SWITCH_TO_ADMIN' : undefined"
			[portalSwitchRoute]="isAdmin() ? '/admin' : undefined"
			profileRoute="/app/profile"
			(onLogoutClicked)="logout()"
		/>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkspaceShellComponent {
	private readonly authService = inject(AuthService);

	// 测试类入口只允许出现在管理员端（见 admin-shell），用户端一律不放
	readonly navLinks: ConsoleNavLink[] = [
		{ label: 'NAV.ROOMS', route: '/app/rooms', icon: 'videocam', iconClass: 'ov-room-icon' }
	];
	readonly isAdmin = signal(false);

	constructor() {
		void this.authService.getUserRole().then((role) => this.isAdmin.set(role === MeetUserRole.ADMIN));
	}

	async logout() {
		await this.authService.logout();
	}
}

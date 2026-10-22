import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ConsoleNavLink } from '../../../../shared/models/sidenav.model';
import { AuthService } from '../../../auth/services/auth.service';
import { ConsoleNavComponent } from '../../components/console-nav/console-nav.component';
import { consoleChildRoutes } from '../../routes/console.routes';

@Component({
	selector: 'ov-console',
	imports: [ConsoleNavComponent],
	templateUrl: './console.component.html',
	styleUrl: './console.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConsoleComponent implements OnInit {
	private authService = inject(AuthService);

	navLinks = signal<ConsoleNavLink[]>([]);

	async ngOnInit() {
		const role = await this.authService.getUserRole();

		const filteredLinks = consoleChildRoutes
			.filter((config) => {
				if (!config.navMetadata) return false;
				return role !== undefined && config.navMetadata.allowedRoles.includes(role);
			})
			.map((config) => ({
				label: config.navMetadata!.label,
				route: config.navMetadata!.route,
				icon: config.navMetadata!.icon,
				iconClass: config.navMetadata?.iconClass
			}))
			.sort((a, b) => {
				// Sort by order
				const orderA =
					consoleChildRoutes.find((r) => r.navMetadata?.route === a.route)?.navMetadata?.order ?? 999;
				const orderB =
					consoleChildRoutes.find((r) => r.navMetadata?.route === b.route)?.navMetadata?.order ?? 999;
				return orderA - orderB;
			});

		this.navLinks.set(filteredLinks);
	}

	async logout() {
		await this.authService.logout();
	}
}

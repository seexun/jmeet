import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzIconTypePipe } from '../../../../shared/pipes/nz-icon-type.pipe';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../../auth/services/auth.service';
import { BreadcrumbComponent } from '../../../../shared/components/breadcrumb/breadcrumb.component';
import { JmeetAppShellComponent } from '../../../../shared/components/app-shell/app-shell.component';
import { ConsoleNavLink } from '../../../../shared/models/sidenav.model';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { AppContextService } from '../../../../shared/services/app-context.service';
import { BreadcrumbService } from '../../../../shared/services/breadcrumb.service';
import { PlatformBrandingService } from '../../../../shared/services';
import { AssetsService } from '../../../../shared/services/assets.service';

@Component({
	selector: 'ov-console-nav',
	imports: [
		JmeetAppShellComponent,
		BreadcrumbComponent,
		NzDropDownModule,
		NzIconModule, NzIconTypePipe,
		RouterModule,
		TranslatePipe,
		NzMenuModule,
	],
	templateUrl: './console-nav.component.html',
	styleUrl: './console-nav.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { '(document:keydown.escape)': 'closeSidebar()' }
})
export class ConsoleNavComponent {
	private appCtxService = inject(AppContextService);
	private breakpointObserver = inject(BreakpointObserver);
	private destroyRef = inject(DestroyRef);
	protected readonly assets = inject(AssetsService);
	protected readonly branding = inject(PlatformBrandingService);
	private readonly router = inject(Router);
	protected readonly breadcrumbs = inject(BreadcrumbService).items;
	private readonly authService = inject(AuthService);
	readonly userName = signal('');
	readonly userInitial = computed(() => this.userName().trim().charAt(0).toUpperCase());
	private readonly currentPath = signal(this.router.url);
	readonly activeNavLabel = computed(() => {
		const path = this.currentPath().split(/[?#]/)[0];
		return this.navLinks()
			.filter((link) => link.route && (path === link.route || path.startsWith(`${link.route}/`)))
			.sort((a, b) => b.route!.length - a.route!.length)[0]?.label ?? (path === this.profileRoute() ? 'NAV.PROFILE' : this.portalLabel());
	});

	/** Below this width the sidebar renders as an overlay drawer (standard §29). */
	readonly isDrawerTier = signal(false);
	readonly sidebarOpen = signal(false);
	/** Dropdown open state, mirrored to aria-expanded on the trigger buttons (nz-dropdown emits no aria attributes). */
	readonly moreMenuOpen = signal(false);
	readonly version = `v${this.appCtxService.version()} (${this.appCtxService.edition()})`;

	navLinks = input<ConsoleNavLink[]>([]);
	portalLabel = input('PORTAL.ADMIN');
	portalSwitchLabel = input<string | undefined>(undefined);
	portalSwitchRoute = input<string | undefined>(undefined);
	profileRoute = input('/app/profile');
	onLogoutClicked = output<void>();

	readonly groupedNavLinks = computed(() => {
		const sections: { group: string | null; links: ConsoleNavLink[] }[] = [];
		for (const link of this.navLinks()) {
			const group = link.group ?? null;
			const last = sections[sections.length - 1];
			if (last && last.group === group) {
				last.links.push(link);
			} else {
				sections.push({ group, links: [link] });
			}
		}
		return sections;
	});

	constructor() {
		this.router.events.pipe(filter((event) => event instanceof NavigationEnd), takeUntilDestroyed())
			.subscribe((event) => this.currentPath.set(event.urlAfterRedirects));
		void this.branding.ensureLoaded();
		void this.authService.getUserName().then((name) => this.userName.set(name ?? '')).catch(() => this.userName.set(''));
		this.breakpointObserver
			.observe(['(max-width: 767px)'])
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((state) => {
				this.isDrawerTier.set(state.breakpoints['(max-width: 767px)']);
				if (!this.isDrawerTier()) this.sidebarOpen.set(false);
			});
	}

	toggleSidebar(): void {
		this.sidebarOpen.update((open) => !open);
	}

	closeSidebar(): void {
		this.sidebarOpen.set(false);
	}

	onNavLinkClicked(link: ConsoleNavLink): void {
		link.clickHandler?.();
		this.closeSidebar();
	}
}

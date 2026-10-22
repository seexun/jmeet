import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';
import { BreadcrumbItem } from '../components/breadcrumb/breadcrumb.component';

/**
 * Shared breadcrumb trail rendered in the console topbar (standard §11).
 *
 * Detail pages push their trail via {@link set}; the trail is cleared
 * automatically on every navigation start so stale trails never linger.
 */
@Injectable({ providedIn: 'root' })
export class BreadcrumbService {
	private readonly router = inject(Router);

	readonly items = signal<BreadcrumbItem[]>([]);

	constructor() {
		this.router.events
			.pipe(filter((event) => event instanceof NavigationStart), takeUntilDestroyed())
			.subscribe(() => this.items.set([]));
	}

	set(items: BreadcrumbItem[]): void {
		this.items.set(items);
	}
}

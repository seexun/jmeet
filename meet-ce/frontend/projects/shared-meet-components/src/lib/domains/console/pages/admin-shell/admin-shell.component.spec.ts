import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../../auth/services/auth.service';
import { AdminShellComponent } from './admin-shell.component';

describe('AdminShellComponent', () => {
	const makeComponent = () => {
		TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: { logout: () => Promise.resolve() } }] });
		return TestBed.runInInjectionContext(() => new AdminShellComponent());
	};

	it('exposes only the user-management entry in the admin console', () => {
		const component = makeComponent();

		const labels = component.navLinks.map((link) => link.label);
		expect(labels).toEqual(['NAV.USERS']);
		expect(component.navLinks[0].route).toBe('/admin/users');
	});
});

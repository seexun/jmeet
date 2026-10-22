import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { TranslateService } from '../../../../shared/services/i18n/translate.service';
import { NavigationService } from '../../../../shared/services/navigation.service';
import { NotificationService } from '../../../../shared/services/notification.service';
import { PlatformBrandingService } from '../../../../shared/services/platform-branding.service';
import { AuthService } from '../../services/auth.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
	let fixture: ComponentFixture<LoginComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [LoginComponent],
			providers: [
				{ provide: ActivatedRoute, useValue: { queryParams: of({}) } },
				{ provide: NavigationService, useValue: {} },
				{ provide: NotificationService, useValue: { showSnackbar: () => {} } },
				{
					provide: PlatformBrandingService,
					useValue: {
						displayName: signal('JMeet'),
						logoUrl: signal(undefined),
						ensureLoaded: () => Promise.resolve()
					}
				},
				{
					provide: AuthService,
					useValue: { getAuthenticationOptions: () => Promise.resolve({ localLoginEnabled: true, identityProviders: [] }) }
				},
				{
					provide: TranslateService,
					useValue: { translationsLoaded: signal(1), translate: (key: string) => key }
				}
			]
		}).compileComponents();

		fixture = TestBed.createComponent(LoginComponent);
		fixture.detectChanges();
	});

	it('renders the enterprise SaaS login structure', () => {
		const host = fixture.nativeElement as HTMLElement;
		const text = host.textContent ?? '';
		expect(text).toContain('AUTH.LOGIN.REMEMBER_ME');
		expect(text).toContain('AUTH.LOGIN.FORGOT_PASSWORD');
		expect(text).toContain('AUTH.LOGIN.HERO_TITLE_PREFIX');
		expect(text).toContain('AUTH.LOGIN.FEATURE_BAND_1_TITLE');
		expect(text).toContain('AUTH.LOGIN.TOP_HELP'); // 帮助中心：顶栏 + 页脚
		// 实景照片背景 + 语言切换存在；旧水印层与日程浮层已移除
		expect(host.querySelector('.login-bg-photo')).toBeTruthy();
		expect(host.querySelector('.lang-select')).toBeTruthy();
		expect(host.querySelector('.login-bg-watermark')).toBeNull();
		expect(host.querySelector('.agenda-glass')).toBeNull();
	});

	it('keeps the account and password fields identifiable before the user types', () => {
		const host = fixture.nativeElement as HTMLElement;
		const accountInput = host.querySelector<HTMLInputElement>('#userId-input');
		const passwordInput = host.querySelector<HTMLInputElement>('#password-input');

		expect(accountInput?.placeholder).toBe('AUTH.LOGIN.USER_ID');
		expect(accountInput?.getAttribute('aria-label')).toBe('AUTH.LOGIN.USER_ID');
		expect(passwordInput?.placeholder).toBe('AUTH.LOGIN.PASSWORD');
		expect(passwordInput?.getAttribute('aria-label')).toBe('AUTH.LOGIN.PASSWORD');
	});

	it('renders supported prefix icons instead of clipped icon ligature text', () => {
		const icons = Array.from(
			(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.login-field-row > nz-icon.login-field-icon')
		);

		expect(icons.map((icon) => icon.getAttribute('ng-reflect-type') ?? icon.getAttribute('nzType'))).toEqual([
			'user',
			'lock'
		]);
	});
});

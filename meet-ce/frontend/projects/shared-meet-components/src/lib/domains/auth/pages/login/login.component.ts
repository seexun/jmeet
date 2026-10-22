import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzIconTypePipe } from '../../../../shared/pipes/nz-icon-type.pipe';
import { NzInputModule } from 'ng-zorro-antd/input';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { TranslateService } from '../../../../shared/services/i18n/translate.service';
import { NavigationService } from '../../../../shared/services/navigation.service';
import { NotificationService } from '../../../../shared/services/notification.service';
import { PlatformBrandingService } from '../../../../shared/services/platform-branding.service';
import { AssetsService } from '../../../../shared/services/assets.service';
import { AuthService } from '../../services/auth.service';

@Component({
	selector: 'ov-login',
	imports: [
		ReactiveFormsModule,
		FormsModule,
		NzIconModule, NzIconTypePipe,
		NzInputModule,
		RouterModule,
		TranslatePipe
	],
	templateUrl: './login.component.html',
	styleUrl: './login.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent implements OnInit {
	private navigationService = inject(NavigationService);
	private route = inject(ActivatedRoute);
	private authService = inject(AuthService);
	protected readonly branding = inject(PlatformBrandingService);
	protected readonly assets = inject(AssetsService);
	private readonly translateService = inject(TranslateService);
	private readonly notificationService = inject(NotificationService);

	loginForm = new FormGroup({
		userId: new FormControl('', [Validators.required]),
		password: new FormControl('', [Validators.required]),
		otp: new FormControl('')
	});

	showPassword = signal(false);
	loginErrorMessage = signal<string | undefined>(undefined);
	localLoginEnabled = signal(true);
	identityProviders = signal<Array<{ id: string; type: string; displayName: string }>>([]);
	selectedDirectoryProvider = signal<{ id: string; displayName: string } | undefined>(undefined);
	mfaRequired = signal(false);
	emergencyLogin = signal(false);

	/** 「记住我」：仅记住用户名，密码永不持久化 */
	rememberMe = signal(false);
	private static readonly REMEMBER_KEY = 'jmeet-login-remember-user';

	// 语言下拉：测试桩的 TranslateService 可能没有这些方法，可选调用 + 兜底保持兼容
	readonly languages = this.translateService.getAvailableLanguages?.() ?? [];
	readonly currentLang =
		this.translateService.selectedLanguageOption ?? signal({ name: 'English', lang: 'en' });

	onLanguageChange(event: Event): void {
		const lang = (event.target as HTMLSelectElement).value as Parameters<
			typeof this.translateService.setCurrentLanguage
		>[0];
		this.translateService.setCurrentLanguage?.(lang);
	}

	forgotPassword(): void {
		this.notificationService.showSnackbar(this.translateService.translate('AUTH.LOGIN.FORGOT_PASSWORD_HINT'));
	}

	showSupportHint(): void {
		this.notificationService.showSnackbar(this.translateService.translate('AUTH.LOGIN.SUPPORT_HINT'));
	}

	/**
	 * Where to navigate after a successful login. Bound directly when rendered outside the
	 * Angular Router (the webcomponent shell, which has no route query params); the SPA leaves
	 * it empty and reads `redirectTo` from the route query params instead.
	 */
	readonly redirectToInput = input<string>('', { alias: 'redirectTo' });

	redirectTo = signal('/app'); // Daily-use workspace is the default for every platform role.

	async ngOnInit() {
		// Webcomponent: the input carries the destination. SPA: fall back to the route query param.
		const fromInput = this.redirectToInput();
		if (fromInput) {
			this.redirectTo.set(fromInput);
		}

		this.route.queryParams.subscribe((params) => {
			if (params['redirectTo']) {
				this.redirectTo.set(params['redirectTo']);
			}
			this.emergencyLogin.set(params['emergency'] === '1');
		});
		try {
			await this.branding.ensureLoaded();
			const options = await this.authService.getAuthenticationOptions();
			this.localLoginEnabled.set(options.localLoginEnabled);
			this.identityProviders.set(options.identityProviders);
		} catch { /* keep the emergency local login available */ }

		// 「记住我」：仅回填用户名，密码永不持久化
		try {
			const remembered = localStorage.getItem(LoginComponent.REMEMBER_KEY);
			if (remembered) {
				this.loginForm.controls.userId.setValue(remembered);
				this.rememberMe.set(true);
			}
		} catch { /* storage unavailable (embedded mode) */ }

		const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
		const ticket = fragment.get('ticket');
		if (ticket) {
			await this.authService.exchangeEnterpriseTicket(ticket);
			window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
			await this.navigationService.redirectTo(fragment.get('redirectTo') || this.redirectTo());
		}
	}

	/** 企业登录：先探测后端能否发起跳转，失败时给出友好提示而不是裸错误页。 */
	async startEnterpriseLogin(providerId: string): Promise<void> {
		const url = this.authService.startEnterpriseLoginUrl(providerId, this.redirectTo());
		try {
			// redirect:'manual' 下 302 表现为 opaqueredirect（不可读 Location），据此判断成功
			const res = await fetch(url, { redirect: 'manual' });
			if (res.type !== 'opaqueredirect' && !res.ok) {
				this.loginErrorMessage.set(this.translateService.translate('AUTH.LOGIN.SSO_UNAVAILABLE'));
				return;
			}
		} catch {
			this.loginErrorMessage.set(this.translateService.translate('AUTH.LOGIN.SSO_UNAVAILABLE'));
			return;
		}
		window.location.assign(url);
	}

	selectDirectoryProvider(provider: { id: string; displayName: string }): void {
		this.selectedDirectoryProvider.set(provider);
		this.loginErrorMessage.set(undefined);
	}

	useLocalLogin(): void {
		this.selectedDirectoryProvider.set(undefined);
		this.loginErrorMessage.set(undefined);
	}

	async login() {
		this.loginErrorMessage.set(undefined);
		const { userId, password, otp } = this.loginForm.value;

		// 「记住我」只持久化用户名；勾选取消时立即清除
		try {
			if (this.rememberMe() && userId) {
				localStorage.setItem(LoginComponent.REMEMBER_KEY, userId);
			} else {
				localStorage.removeItem(LoginComponent.REMEMBER_KEY);
			}
		} catch { /* storage unavailable (embedded mode) */ }

		try {
			const directory = this.selectedDirectoryProvider();
			if (directory) {
				await this.authService.loginWithDirectory(directory.id, userId!, password!);
				await this.navigationService.redirectTo(this.redirectTo());
				return;
			}
			const { mustChangePassword, mfaRequired } = await this.authService.login(userId!, password!, otp || undefined);
			if (mfaRequired) { this.mfaRequired.set(true); this.loginForm.controls.otp.setValidators([Validators.required, Validators.pattern(/^(\d{6}|[a-f0-9]{10})$/i)]); this.loginForm.controls.otp.updateValueAndValidity(); return; }

			// Redirect to dedicated mandatory password page after first login or password reset
			if (mustChangePassword) {
				await this.navigationService.redirectToChangePasswordPage(this.redirectTo(), true);
				return;
			}

			await this.navigationService.redirectTo(this.redirectTo());
		} catch (error) {
			// 423 = 后端连续失败锁（auth-login-failure 计数达阈值），与 429 限流同样提示"稍后重试"而非误导为密码错误
			const status = (error as HttpErrorResponse).status;
			if (status === 429 || status === 423) {
				this.loginErrorMessage.set(this.translateService.translate('AUTH.LOGIN.ERROR_TOO_MANY_ATTEMPTS'));
			} else {
				this.loginErrorMessage.set(this.translateService.translate('AUTH.LOGIN.ERROR_INVALID_CREDENTIALS'));
			}
		}
	}
}

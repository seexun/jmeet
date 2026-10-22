import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzIconTypePipe } from '../../../../shared/pipes/nz-icon-type.pipe';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { ActivatedRoute } from '@angular/router';
import { MeetUserDTO, MeetUserRole } from '@openvidu-meet/typings';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
	JmeetLoadingSkeletonComponent,
	JmeetPageHeaderComponent,
	JmeetPaginationComponent,
	JmeetStatusTagComponent,
	type JmeetStatusTagVariant
} from '../../../../shared/components';
import { DialogPresetsService } from '../../../../shared/services/dialog-presets.service';
import { NavigationService } from '../../../../shared/services/navigation.service';
import { NotificationService, DIALOG_WIDTH } from '../../../../shared/services/notification.service';
import { TranslateService } from '../../../../shared/services/i18n/translate.service';
import { AuthService } from '../../../auth/services/auth.service';
import { ResetPasswordDialogComponent } from '../../components/reset-password-dialog/reset-password-dialog.component';
import { UpdateRoleDialogComponent } from '../../components/update-role-dialog/update-role-dialog.component';
import { UserService } from '../../services/user.service';
import { UsersUiUtils } from '../../utils/ui';
import { downscaleImageToDataUrl } from '../../../../shared/utils/image.utils';
import { ProfilePasswordDialogComponent } from './profile-password-dialog.component';

@Component({
	selector: 'ov-profile',
	imports: [
		JmeetPageHeaderComponent,
		JmeetLoadingSkeletonComponent,
		JmeetPaginationComponent,
		JmeetStatusTagComponent,
		DatePipe,
		FormsModule,
		NzIconModule, NzIconTypePipe,
		NzSelectModule,
		NzSwitchModule,
		NzTooltipModule,
		NzDividerModule,
		TranslatePipe
	],
	templateUrl: './profile.component.html',
	styleUrl: './profile.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileComponent implements OnInit {
	private authService = inject(AuthService);
	private userService = inject(UserService);
	private notificationService = inject(NotificationService);
	protected readonly translateService = inject(TranslateService);
	private dialogPresetsService = inject(DialogPresetsService);
	private route = inject(ActivatedRoute);
	private navigationService = inject(NavigationService);

	isLoading = signal(true);
	isOwnProfile = signal(true);
	isAdminViewing = signal(false);
	isRootAdmin = signal(false);

	sessions = signal<Array<{ sessionId: string; createdAt: number; lastSeenAt: number; ipAddress?: string; userAgent?: string }>>([]);

	// 登录设备分页：设备可能积累很多，默认每页 10 条（全站统一分页口径）。
	readonly sessionsPageIndex = signal(0);
	readonly sessionsPageSize = signal(10);

	targetUser = signal<MeetUserDTO | null>(null);
	protected readonly UsersUiUtils = UsersUiUtils;

	// ─── 头像 / 昵称 / 偏好（自助资料维护） ───────────────────────────────
	avatarBusy = signal(false);
	editingName = signal(false);
	nameDraft = signal('');

	/** 选择图片后前端降采样为 256×256 JPEG（data URL），控制体积与服务端存储 */
	async onAvatarSelected(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
			this.notificationService.showSnackbar('仅支持 PNG、JPEG 或 WebP 图片');
			return;
		}
		this.avatarBusy.set(true);
		try {
			const dataUrl = await downscaleImageToDataUrl(file, 256);
			const updated = await this.userService.updateMe({ avatarDataUrl: dataUrl });
			this.targetUser.set(updated);
			this.notificationService.showSnackbar('头像已更新');
		} catch {
			this.notificationService.showSnackbar('头像更新失败，请重试');
		} finally {
			this.avatarBusy.set(false);
		}
	}

	startEditName() {
		this.nameDraft.set(this.targetUser()?.name ?? '');
		this.editingName.set(true);
	}

	cancelEditName() {
		this.editingName.set(false);
	}

	async saveName() {
		const name = this.nameDraft().trim();
		if (!name) return;
		try {
			const updated = await this.userService.updateMe({ name });
			this.targetUser.set(updated);
			this.editingName.set(false);
			this.notificationService.showSnackbar('姓名已更新');
		} catch {
			this.notificationService.showSnackbar('姓名更新失败，请重试');
		}
	}

	onLanguageChange(lang: 'cn' | 'en') {
		this.translateService.setCurrentLanguage(lang);
		this.userService
			.updateMe({ preferredLanguage: lang })
			.catch(() => this.notificationService.showSnackbar('语言偏好保存失败'));
	}

	async onMuteChange(muted: boolean) {
		try {
			await this.userService.updateMe({ notificationsMuted: muted });
			this.targetUser.update((user) => (user ? { ...user, notificationsMuted: muted } : user));
		} catch {
			this.notificationService.showSnackbar('通知偏好保存失败');
		}
	}

	/** 偏好回显：个人资料加载后把后端语言偏好应用到界面 */
	protected applyPreferredLanguage() {
		const preferred = this.targetUser()?.preferredLanguage;
		if (preferred && preferred !== this.translateService.getCurrentLanguage()) {
			this.translateService.setCurrentLanguage(preferred);
		}
	}
	readonly pagedSessions = () => {
		const start = this.sessionsPageIndex() * this.sessionsPageSize();
		return this.sessions().slice(start, start + this.sessionsPageSize());
	};

	onSessionsPageChange(change: { pageIndex: number; pageSize: number }) {
		this.sessionsPageIndex.set(change.pageIndex);
		this.sessionsPageSize.set(change.pageSize);
	}

	async ngOnInit() {
		this.isLoading.set(true);

		const userId = this.route.snapshot.paramMap.get('user-id');
		const authenticatedUserId = await this.authService.getUserId();
		const isAdmin = await this.authService.isAdmin();

		// Redirect to profile page if user tries to access their own profile through /users/:userId route
		if (userId && userId === authenticatedUserId) {
			await this.navigationService.navigateTo('/profile', {}, true);
			return;
		}

		try {
			if (userId && userId !== authenticatedUserId) {
				// Admin viewing another user's profile
				if (isAdmin) {
					this.isAdminViewing.set(true);
				}

				const [user, rootAdmin] = await Promise.all([
					this.userService.getUser(userId),
					this.userService.getRootAdmin()
				]);
				this.targetUser.set(user);
				this.isOwnProfile.set(false);
				this.isRootAdmin.set(UsersUiUtils.isRootAdmin(user, rootAdmin?.userId ?? ''));
			} else {
				// Own profile
				const user = await this.userService.getMe();
				this.targetUser.set(user);
				this.isOwnProfile.set(true);
				await this.loadSessions();
				this.isAdminViewing.set(false);
			}
		} catch (error) {
			console.error('Error loading profile:', error);
			this.notificationService.showSnackbar(this.translateService.translate('USERS.ERRORS.PROFILE_LOAD_FAILED'));
			await this.navigationService.navigateTo('/users', {}, true);
		} finally {
			this.isLoading.set(false);
		}
	}







	async loadSessions() {
		try { this.sessions.set((await this.authService.listSessions()).sessions); }
		catch { this.sessions.set([]); }
	}

	/** 把原始 UA 串解析成「浏览器 · 系统」摘要，避免登录设备列表出现整段 UA 文本 */
	describeDevice(userAgent?: string): string {
		if (!userAgent) return '';
		const browser =
			(/Edg\/([\d.]+)/.exec(userAgent)?.[0] ??
				/OPR\/[\d.]+/.exec(userAgent)?.[0] ??
				/Chrome\/([\d.]+)/.exec(userAgent)?.[0] ??
				/Firefox\/[\d.]+/.exec(userAgent)?.[0] ??
				/Version\/[\d.]+.*Safari/.exec(userAgent)?.[0]) ?? '';
		const system = /Windows/.test(userAgent)
			? 'Windows'
			: /Android/.test(userAgent)
				? 'Android'
				: /iPhone|iPad|iOS/.test(userAgent)
					? 'iOS'
					: /Mac OS X/.test(userAgent)
						? 'macOS'
						: /Linux/.test(userAgent)
							? 'Linux'
							: '';
		const browserName = browser
			.replace(/^Edg\//, 'Edge ')
			.replace(/^OPR\//, 'Opera ')
			.replace(/^Chrome\//, 'Chrome ')
			.replace(/^Firefox\//, 'Firefox ')
			.replace(/^Version\//, 'Safari ')
			.replace(/\.[\d.]+$/, '');
		return [browserName, system].filter(Boolean).join(' · ') || userAgent;
	}

	async revokeSession(sessionId: string) {
		await this.authService.revokeSession(sessionId);
		this.sessions.update((sessions) => sessions.filter((session) => session.sessionId !== sessionId));
		this.notificationService.showSnackbar('登录会话已撤销');
	}

	/** 修改密码走对话框（国内惯例：低频敏感操作收进弹窗） */
	async openChangePassword() {
		await firstValueFrom(
			this.notificationService
				.openModal({
					nzContent: ProfilePasswordDialogComponent,
					nzWidth: DIALOG_WIDTH.form,
					nzClosable: false,
					nzMaskClosable: false
				})
					.afterClose
		);
	}

	// ─── Admin actions ──────────────────────────────────────────────────────────

	async onUpdateRole() {
		const user = this.targetUser();
		if (!user) {
			return;
		}

		const updatedUser = await firstValueFrom(
			this.notificationService
				.openModal({
					nzContent: UpdateRoleDialogComponent,
					nzData: { user },
					nzWidth: DIALOG_WIDTH.standard,
					nzClosable: false,
					nzMaskClosable: false
				})
				.afterClose
		);

		if (!updatedUser) {
			return;
		}

		this.targetUser.set(updatedUser);
		// Role is shown in the users list — invalidate it so the change is reflected on return
		this.navigationService.invalidateCachedRoute('users');
	}

	async onResetPassword() {
		const user = this.targetUser();
		if (!user) return;

		this.notificationService.openModal({
			nzContent: ResetPasswordDialogComponent,
			nzData: { user },
			nzWidth: DIALOG_WIDTH.standard,
			nzClosable: false,
			nzMaskClosable: false
		});
	}

	async onDeleteUser() {
		const user = this.targetUser();
		if (!user) return;

		this.notificationService.showDialog({
			...this.dialogPresetsService.getDeleteUserDialogPreset(user.name, user.userId),
			confirmCallback: async () => {
				try {
					await this.userService.deleteUser(user.userId);
					this.notificationService.showSnackbar(
						`${this.translateService.translate('USERS.ERRORS.USER_DELETED_PREFIX')}${user.name}${this.translateService.translate('USERS.ERRORS.USER_DELETED_SUFFIX')}`
					);
					await this.navigationService.navigateToAndInvalidate('/users', 'users', {}, true);
				} catch (error) {
					console.error('Error deleting user:', error);
					this.notificationService.showSnackbar(this.translateService.translate('USERS.ERRORS.USER_DELETE_FAILED'));
				}
			}
		});
	}


	roleVariant(role: MeetUserRole): JmeetStatusTagVariant {
		if (role === 'admin') return 'processing';
		if (role === 'room_manager') return 'warning';
		return 'default';
	}
}

import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { MeetAnalytics } from '@openvidu-meet/typings';
import {
	JmeetEmptyStateComponent,
	JmeetLoadingSkeletonComponent,
	JmeetPageHeaderComponent,
	JmeetStatCardComponent,
	JmeetStatusTagComponent
} from '../../../../shared/components';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { AnalyticsService } from '../../../../shared/services/analytics.service';
import { NavigationService } from '../../../../shared/services/navigation.service';
import { HttpService } from '../../../../shared/services/http.service';

interface SystemHealth {
	status: 'operational' | 'degraded';
	checkedAt: number;
	components: Array<{
		name: 'mongodb' | 'redis' | 'livekit' | 'storage';
		status: 'operational' | 'degraded';
		latencyMs: number;
		message?: string;
	}>;
}

@Component({
	selector: 'ov-overview',
	imports: [
		JmeetPageHeaderComponent,
		JmeetStatCardComponent,
		JmeetStatusTagComponent,
		JmeetLoadingSkeletonComponent,
		JmeetEmptyStateComponent,

		NzIconModule,
		TranslatePipe
	],
	templateUrl: './overview.component.html',
	styleUrl: './overview.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewComponent implements OnInit {
	private analyticsService: AnalyticsService = inject(AnalyticsService);
	private navigationService: NavigationService = inject(NavigationService);
	private httpService: HttpService = inject(HttpService);

	stats = signal<MeetAnalytics>({
		totalRooms: 0,
		activeRooms: 0,
		totalRecordings: 0,
		completeRecordings: 0
	});

	isLoading = signal(true);
	healthLoading = signal(true);
	systemHealth = signal<SystemHealth | null>(null);
	degradedComponents = computed(() =>
		(this.systemHealth()?.components ?? []).filter((component) => component.status === 'degraded')
	);
	meetingCode = signal('');
	readonly todayLabel = signal(
		new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())
	);

	async ngOnInit() {
		await Promise.all([this.loadStats(), this.loadSystemHealth()]);
	}

	async loadSystemHealth() {
		this.healthLoading.set(true);
		try {
			this.systemHealth.set(
				await this.httpService.getRequest<SystemHealth>(`${HttpService.INTERNAL_API_PATH_PREFIX}/system-health`)
			);
		} catch {
			this.systemHealth.set({
				status: 'degraded',
				checkedAt: Date.now(),
				components: []
			});
		} finally {
			this.healthLoading.set(false);
		}
	}

	private async loadStats() {
		this.isLoading.set(true);

		try {
			const stats = await this.analyticsService.getAnalytics();
			this.stats.set(stats);
		} catch {
			console.error('Error loading analytics data');
		} finally {
			this.isLoading.set(false);
		}
	}

	async navigateTo(section: 'rooms' | 'rooms/new' | 'recordings' | 'config' | 'embedded') {
		try {
			await this.navigationService.navigateTo(`/${section}`);
		} catch (error) {
			console.error(`Error navigating to ${section}:`, error);
		}
	}

	async joinMeeting() {
		const code = this.meetingCode().trim();
		if (!code) return;

		const roomId = this.normalizeMeetingCode(code);
		await this.navigationService.navigateTo(`/room/${encodeURIComponent(roomId)}`);
	}

	private normalizeMeetingCode(value: string): string {
		try {
			const url = new URL(value);
			const roomMatch = url.pathname.match(/\/room\/([^/?#]+)/);
			return roomMatch?.[1] ? decodeURIComponent(roomMatch[1]) : value;
		} catch {
			return value.replace(/\s+/g, '');
		}
	}
}

import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal, effect } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MeetRoomMemberOptions, MeetRoomOptions } from '@openvidu-meet/typings';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { BreadcrumbItem } from '../../../../shared/components/breadcrumb/breadcrumb.component';
import { BreadcrumbService } from '../../../../shared/services/breadcrumb.service';
import {
	JmeetLoadingSkeletonComponent,
	JmeetPageHeaderComponent
} from '../../../../shared/components';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { TranslateService } from '../../../../shared/services/i18n/translate.service';
import { NavigationService } from '../../../../shared/services/navigation.service';
import { NotificationService } from '../../../../shared/services/notification.service';
import { RoomMemberService } from '../../../room-members/services/room-member.service';
import { StepIndicatorComponent } from '../../components/step-indicator/step-indicator.component';
import { WizardNavComponent } from '../../components/wizard-nav/wizard-nav.component';
import { WizardStep, WizardStepId } from '../../models/wizard.model';
import { RoomService } from '../../services/room.service';
import { RoomWizardStateService } from '../../services/wizard-state.service';
import { RoomBasicCreationComponent } from '../room-basic-creation/room-basic-creation.component';
import { RecordingConfigComponent } from './steps/recording-config/recording-config.component';
import { RecordingLayoutComponent } from './steps/recording-layout/recording-layout.component';
import { RecordingTriggerComponent } from './steps/recording-trigger/recording-trigger.component';
import { RoomAccessComponent } from './steps/room-access/room-access.component';
import { RoomConfigComponent } from './steps/room-config/room-config.component';
import { RoomWizardRoomDetailsComponent } from './steps/room-details/room-details.component';

@Component({
	selector: 'ov-room-wizard',
	imports: [
		JmeetPageHeaderComponent,
		JmeetLoadingSkeletonComponent,
		StepIndicatorComponent,
		WizardNavComponent,
		NzIconModule,

		RoomBasicCreationComponent,
		RoomWizardRoomDetailsComponent,
		RoomAccessComponent,
		RecordingConfigComponent,
		RecordingTriggerComponent,
		RecordingLayoutComponent,
		RoomConfigComponent,
		TranslatePipe
	],
	templateUrl: './room-wizard.component.html',
	styleUrl: './room-wizard.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoomWizardComponent implements OnInit {
	private wizardService = inject(RoomWizardStateService);
	protected roomService = inject(RoomService);
	protected roomMemberService = inject(RoomMemberService);
	protected notificationService = inject(NotificationService);
	private navigationService = inject(NavigationService);
	private readonly breadcrumbService = inject(BreadcrumbService);
	private route = inject(ActivatedRoute);
	private readonly translateService = inject(TranslateService);

	roomId?: string;
	existingRoomData?: MeetRoomOptions; // Edit mode

	isCreatingRoom = signal(false);
	isBasicCreation = signal(true);
	private readonly editRoomName = signal('');

	initialized = this.wizardService.isInitialized;
	editMode = this.wizardService.editMode;
	steps = this.wizardService.steps;
	currentStep = this.wizardService.currentStep;
	currentStepIndex = this.wizardService.currentStepIndex;
	navigationConfig = computed(() => this.wizardService.getNavigationConfig());

	// 页头标题：编辑态不显示「创建」字样（左侧 Tab 改版 2026-10-21）
	pageTitle = computed(() => {
		this.translateService.selectedLanguageOption();
		this.translateService.translationsLoaded();
		return this.translateService.translate(
			this.editMode() ? 'ROOMS.WIZARD.EDIT_TITLE' : 'ROOMS.WIZARD.TITLE'
		);
	});

	breadcrumbItems = computed<BreadcrumbItem[]>(() => {
		this.translateService.selectedLanguageOption();
		this.translateService.translationsLoaded();
		const roomsItem: BreadcrumbItem = {
			label: this.translateService.translate('ROOMS.WIZARD.BREADCRUMB_ROOMS'),
			action: () => this.navigationService.navigateTo('/rooms', undefined, true)
		};
		// 基础创建模式对外就叫「预定会议」，面包屑不再出现第三个名字「高级会议」
		const currentItem: BreadcrumbItem = {
			label:
				this.isBasicCreation() && !this.editMode()
					? this.translateService.translate('ROOMS.BASIC_CREATION.TITLE')
					: this.pageTitle()
		};
		if (this.editMode() && this.roomId) {
			return [
				roomsItem,
				{
					label: this.editRoomName() || this.roomId,
					action: () => this.navigationService.navigateTo(`/rooms/${this.roomId}`, undefined, true)
				},
				currentItem
			];
		}
		return [roomsItem, currentItem];
	});

	// Publish the trail to the shared topbar breadcrumb (standard §11).
	protected readonly breadcrumbEffect = effect(() => this.breadcrumbService.set(this.breadcrumbItems()));
	protected readonly WizardStepId = WizardStepId;

	async ngOnInit() {
		// Detect edit mode from route
		const editMode = this.detectEditMode();

		// If in edit mode, load room data
		if (editMode && this.roomId) {
			await this.loadRoomData();
		}

		// Initialize wizard with edit mode and existing data
		this.wizardService.initializeWizard(editMode, this.existingRoomData);

		// Jump to a specific step if requested via query param
		const requestedStep = this.route.snapshot.queryParamMap.get('step') as WizardStepId | null;
		if (requestedStep && Object.values(WizardStepId).includes(requestedStep)) {
			this.wizardService.goToStepById(requestedStep);
		}
	}

	private detectEditMode(): boolean {
		// Check if URL contains '/edit' to determine edit mode
		const url = this.route.snapshot.url;
		const editMode = url.some((segment) => segment.path === 'edit');

		// Get roomId from route parameters when in edit mode
		if (editMode) {
			this.roomId = this.route.snapshot.paramMap.get('room-id') || undefined;
		}

		return editMode;
	}

	private async loadRoomData() {
		if (!this.roomId) return;

		try {
			const { roomName, autoDeletionDate, autoDeletionPolicy, config, access, roles } =
				await this.roomService.getRoom(this.roomId, {
					fields: ['roomName', 'autoDeletionDate', 'autoDeletionPolicy', 'config', 'access', 'roles'],
					// 'config' and 'roles' are extra fields, excluded by default, so request them explicitly
					extraFields: ['config', 'roles']
				});

			// Populate existing room options based on fetched data
			this.existingRoomData = { roomName, autoDeletionDate, autoDeletionPolicy, config, roles };
			this.existingRoomData.access = {
				anonymous: {
					moderator: { enabled: access.anonymous.moderator.enabled },
					speaker: { enabled: access.anonymous.speaker.enabled },
					recording: { enabled: access.anonymous.recording.enabled }
				},
				user: {
					enabled: access.user.enabled
				}
			};

			if (this.existingRoomData) {
				this.isBasicCreation.set(false);
				this.editRoomName.set(this.existingRoomData.roomName?.trim() || this.roomId || '');
			}
		} catch (error) {
			console.error('Error loading room data:', error);
			// Navigate back to rooms list if room not found
			await this.navigationService.navigateTo('/rooms', undefined, true);
		}
	}

	onOpenAdvancedMode() {
		this.isBasicCreation.set(false);
		this.wizardService.goToStep(0); // Reset to first step
	}

	onPrevious() {
		this.wizardService.goToPreviousStep();
	}

	onBack() {
		this.isBasicCreation.set(true);
	}

	onNext() {
		this.wizardService.goToNextStep();
	}

	onStepClick(event: { index: number; step: WizardStep }) {
		this.wizardService.goToStep(event.index);
	}

	async onCancel() {
		const destination = this.editMode() && this.roomId ? `/rooms/${this.roomId}` : '/rooms';
		await this.navigationService.navigateTo(destination, undefined, true);
		this.wizardService.resetWizard();
	}

	async createRoomBasic(roomOptions: MeetRoomOptions) {
		// Activate loading state
		const delayLoader = setTimeout(() => {
			this.isCreatingRoom.set(true);
		}, 200);

		try {
			// Create room with basic config
			const { access } = await this.roomService.createRoom(roomOptions, { fields: ['roomId', 'access'] });

			// Refresh the rooms list so the new room appears when the user returns to it
			this.navigationService.invalidateCachedRoute('rooms');

			if (roomOptions.schedule) {
				await this.navigationService.navigateToAndInvalidate('/rooms', 'rooms', undefined, true);
				this.notificationService.showSnackbar(
					this.translateService.translate('ROOMS.ERRORS.ROOM_CREATED_SUCCESS')
				);
			} else {
				const url = new URL(access.user.url);
				await this.navigationService.redirectTo(url.pathname);
			}
		} catch (error) {
			const errorMessage = `${this.translateService.translate('ROOMS.ERRORS.FAILED_CREATE_ROOM_NAMED_PREFIX')}${roomOptions.roomName ?? ''}`;
			this.notificationService.showSnackbar(errorMessage);
			console.error(errorMessage, error);
		} finally {
			this.wizardService.resetWizard();
			// Deactivate loading state
			clearTimeout(delayLoader);
			this.isCreatingRoom.set(false);
		}
	}

	async createRoomAdvance() {
		const roomOptions = this.wizardService.roomOptions();
		const pendingMembers = this.wizardService.pendingMembers();

		// Activate loading state
		const delayLoader = setTimeout(() => {
			this.isCreatingRoom.set(true);
		}, 200);

		try {
			if (this.editMode() && this.roomId) {
				// Update only the fields that are editable in the wizard (config, access and roles)
				if (roomOptions.config) {
					await this.roomService.updateRoomConfig(this.roomId, roomOptions.config);
				}
				if (roomOptions.access) {
					await this.roomService.updateRoomAccess(this.roomId, roomOptions.access);
				}
				if (roomOptions.roles) {
					await this.roomService.updateRoomRoles(this.roomId, roomOptions.roles);
				}

				// Navigate to the room detail page after update, refreshing the rooms list
				// and this room's detail so the changes are reflected
				await this.navigationService.navigateToAndInvalidate(
					`/rooms/${this.roomId}`,
					'rooms',
					undefined,
					true
				);
				this.notificationService.showSnackbar(this.translateService.translate('ROOMS.ERRORS.ROOM_UPDATED'));
			} else {
				// Create new room
				const { roomId, access } = await this.roomService.createRoom(roomOptions, {
					fields: ['roomId', 'access']
				});

				// TODO: Should this creation of pending members be handled by the backend as part of the room creation?
				// Create pending members (best-effort – failures are reported as warnings)
				if (pendingMembers.length > 0) {
					await this.createPendingMembers(roomId, pendingMembers);
				}

				// Refresh the rooms list so the new room appears when the user returns to it
				this.navigationService.invalidateCachedRoute('rooms');

				// Extract the path from the access URL and navigate to it
				const url = new URL(access.user.url);
				const path = url.pathname;
				await this.navigationService.redirectTo(path);
			}
		} catch (error) {
			const errorMessage = this.editMode()
				? this.translateService.translate('ROOMS.ERRORS.FAILED_UPDATE_ROOM')
				: this.translateService.translate('ROOMS.ERRORS.FAILED_CREATE_ROOM');
			this.notificationService.showSnackbar(errorMessage);
			console.error(errorMessage, error);

			// A partial update may have been applied — invalidate so the list/detail reload fresh
			const destination = this.editMode() && this.roomId ? `/rooms/${this.roomId}` : '/rooms';
			await this.navigationService.navigateToAndInvalidate(destination, 'rooms', undefined, true);
		} finally {
			this.wizardService.resetWizard();
			// Deactivate loading state
			clearTimeout(delayLoader);
			this.isCreatingRoom.set(false);
		}
	}

	private async createPendingMembers(roomId: string, members: MeetRoomMemberOptions[]): Promise<void> {
		const results = await Promise.allSettled(
			members.map((m) => this.roomMemberService.createRoomMember(roomId, m))
		);
		const failed = results.filter((r) => r.status === 'rejected');
		if (failed.length > 0) {
			const failedIds = members
				.filter((_, i) => results[i].status === 'rejected')
				.map((m) => m.userId || m.name)
				.join(', ');
			this.notificationService.showSnackbar(
				`${this.translateService.translate('ROOMS.ERRORS.ROOM_CREATED_MEMBERS_FAILED_PREFIX')}${failed.length}${this.translateService.translate('ROOMS.ERRORS.ROOM_CREATED_MEMBERS_FAILED_MIDDLE')}${failedIds}`
			);
			console.warn('Failed to add members:', failed);
		}
	}
}

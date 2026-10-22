import { inject, Injectable, signal } from '@angular/core';
import { ILogger } from '../../models/logger.model';
import { PanelSettingsOptions, PanelStatusInfo, PanelType } from '../../models/panel.model';
import { LoggerService } from '../logger/logger.service';

@Injectable({
	providedIn: 'root'
})
export class PanelService {
	private readonly log = inject(LoggerService).get('PanelService');

	/**
	 * Panel signal which emits the panel status in every update.
	 */
	readonly panelOpened = signal<PanelStatusInfo>({ isOpened: false });
	private isExternalOpened: boolean = false;
	private externalType: string = '';
	private panelTypes: string[] = Object.values(PanelType);

	/**
	 * @internal
	 */
	clear() {
		this.panelOpened.set({ isOpened: false });
	}

	/**
	 * Open or close the panel type received. Calling this method with the panel opened and the same type panel, will close the panel.
	 * If the type is differente, it will switch to the properly panel.
	 */
	togglePanel(panelType: PanelType | string, subOptionType?: PanelSettingsOptions | string) {
		const previousState = this.panelOpened();
		const isDefaultPanel = this.panelTypes.includes(panelType);

		this.log.d(`Toggling ${isDefaultPanel ? panelType : 'external'} menu`);

		// Set the next panel state
		let nextOpenedValue: boolean;

		if (panelType === previousState.panelType) {
			// Same panel clicked, toggle it
			nextOpenedValue = !previousState.isOpened;
		} else {
			// Different panel clicked, always open it
			nextOpenedValue = true;
		}

		// Update external panel tracking
		if (isDefaultPanel) {
			this.isExternalOpened = false;
			this.externalType = '';
		} else {
			this.isExternalOpened = nextOpenedValue;
			this.externalType = nextOpenedValue ? panelType : '';
		}

		// Update the panel state
		this.panelOpened.set({
			isOpened: nextOpenedValue,
			panelType,
			subOptionType,
			previousPanelType: previousState.panelType
		});
	}

	/**
	 * @internal
	 */
	isPanelOpened(): boolean {
		return this.panelOpened().isOpened;
	}

	/**
	 * Closes the panel if it is opened.
	 */
	closePanel(): void {
		this.panelOpened.set({ isOpened: false, panelType: undefined, subOptionType: undefined, previousPanelType: undefined });
	}

	/**
	 * Whether the chat panel is opened or not.
	 */
	isChatPanelOpened(): boolean {
		const panelState = this.panelOpened();
		return panelState.isOpened && panelState.panelType === PanelType.CHAT;
	}

	/**
	 * Whether the participants panel is opened or not.
	 */
	isParticipantsPanelOpened(): boolean {
		const panelState = this.panelOpened();
		return panelState.isOpened && panelState.panelType === PanelType.PARTICIPANTS;
	}

	/**
	 * Whether the activities panel is opened or not.
	 */
	isActivitiesPanelOpened(): boolean {
		const panelState = this.panelOpened();
		return panelState.isOpened && panelState.panelType === PanelType.ACTIVITIES;
	}

	/**
	 * Whether the settings panel is opened or not.
	 */
	isSettingsPanelOpened(): boolean {
		const panelState = this.panelOpened();
		return panelState.isOpened && panelState.panelType === PanelType.SETTINGS;
	}

	/**
	 * Whether the background effects panel is opened or not.
	 */
	isBackgroundEffectsPanelOpened(): boolean {
		const panelState = this.panelOpened();
		return panelState.isOpened && panelState.panelType === PanelType.BACKGROUND_EFFECTS;
	}

	isMediaQualityPanelOpened(): boolean {
		const panelState = this.panelOpened();
		return panelState.isOpened && panelState.panelType === PanelType.MEDIA_QUALITY;
	}

	/**
	 * Returns whether the external panel (a panel adding by the final user) is opened or not.
	 */
	isExternalPanelOpened(): boolean {
		return this.isExternalOpened;
	}
}

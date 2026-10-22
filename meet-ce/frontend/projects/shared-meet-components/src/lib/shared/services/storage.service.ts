import { Injectable } from '@angular/core';
import { SmartLayoutMode, StorageService } from '../../domains/meeting/openvidu-components';
import { MeetStorageKeys, STORAGE_PREFIX } from '../models/storage.model';

@Injectable({
	providedIn: 'root'
})
export class MeetStorageService extends StorageService {
	constructor() {
		super();
		this.PREFIX_KEY = STORAGE_PREFIX;
	}

	/**
	 * Sets the layout mode in the storage.
	 *
	 * @param layoutMode - The layout mode to be set.
	 */
	setLayoutMode(layoutMode: SmartLayoutMode): void {
		this.set(MeetStorageKeys.LAYOUT_MODE, layoutMode);
	}

	/**
	 * Retrieves the current layout mode from storage.
	 *
	 * @returns {SmartLayoutMode | null} The layout mode stored in the storage, or null if not found.
	 */
	getLayoutMode(): SmartLayoutMode | null {
		return this.get(MeetStorageKeys.LAYOUT_MODE) || null;
	}

	/**
	 * Sets the maximum number of visible remote participants for smart layout mode.
	 *
	 * @param count - The maximum number of visible remote participants.
	 */
	setMaxVisibleRemoteParticipants(count: number): void {
		this.set(MeetStorageKeys.MAX_VISIBLE_REMOTE_PARTICIPANTS, count.toString());
	}

	/**
	 * Retrieves the maximum number of visible remote participants from storage.
	 *
	 * Falls back to the legacy key to preserve stored user preferences after the rename.
	 */
	getMaxVisibleRemoteParticipants(): number | null {
		const value = this.get(MeetStorageKeys.MAX_VISIBLE_REMOTE_PARTICIPANTS) ?? this.get('maxRemoteSpeakers');
		return value ? parseInt(value, 10) : null;
	}
}

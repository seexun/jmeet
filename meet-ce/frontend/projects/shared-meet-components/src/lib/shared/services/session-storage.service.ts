import { Injectable } from '@angular/core';

@Injectable({
	providedIn: 'root'
})
/**
 * Service for managing session storage operations.
 * Provides methods to store, retrieve, and remove data from sessionStorage.
 */
export class SessionStorageService {
	private readonly ROOM_SECRET_KEY = 'ovMeet-roomSecret';
	private readonly REDIRECT_URL_KEY = 'ovMeet-redirectUrl';
	private readonly E2EE_DATA_KEY = 'ovMeet-e2eeData';
	private readonly MUST_CHANGE_PASSWORD_KEY = 'ovMeet-mustChangePassword';

	/**
	 * Stores the room secret.
	 *
	 * @param secret The secret to store.
	 */
	public setRoomSecret(secret: string): void {
		this.set(this.ROOM_SECRET_KEY, secret);
	}

	/**
	 * Retrieves the room secret.
	 *
	 * @returns The stored secret or null if not found.
	 */
	public getRoomSecret(): string | null {
		return this.get<string>(this.ROOM_SECRET_KEY);
	}

	/**
	 * Removes the stored room secret.
	 */
	public removeRoomSecret(): void {
		this.remove(this.ROOM_SECRET_KEY);
	}

	/**
	 * Stores a redirect URL to be used after leaving JMeet.
	 *
	 * @param redirectUrl The URL to redirect to.
	 */
	public setRedirectUrl(redirectUrl: string): void {
		this.set(this.REDIRECT_URL_KEY, redirectUrl);
	}

	/**
	 * Retrieves the redirect URL stored in sessionStorage.
	 *
	 * @returns The redirect URL or null if not found.
	 */
	public getRedirectUrl(): string | null {
		return this.get<string>(this.REDIRECT_URL_KEY);
	}

	/**
	 * Removes the stored redirect URL.
	 */
	public removeRedirectUrl(): void {
		this.remove(this.REDIRECT_URL_KEY);
	}

	/**
	 * Stores the E2EE key data (key and origin flag).
	 *
	 * @param e2eeKey The E2EE key to store.
	 * @param fromUrl True if the E2EE key came from a URL parameter.
	 */
	public setE2EEData(e2eeKey: string, fromUrl: boolean): void {
		this.set(this.E2EE_DATA_KEY, { key: e2eeKey, fromUrl });
	}

	/**
	 * Retrieves the E2EE key data (key and origin flag).
	 *
	 * @returns The stored E2EE data or null if not found.
	 */
	public getE2EEData(): { key: string; fromUrl: boolean } | null {
		return this.get<{ key: string; fromUrl: boolean }>(this.E2EE_DATA_KEY);
	}

	/**
	 * Removes the stored E2EE key data.
	 */
	public removeE2EEData(): void {
		this.remove(this.E2EE_DATA_KEY);
	}

	/**
	 * Stores whether the authenticated user must change password before accessing the app.
	 *
	 * @param required True when password change is required.
	 */
	public setMustChangePasswordRequired(required: boolean): void {
		this.set(this.MUST_CHANGE_PASSWORD_KEY, required);
	}

	/**
	 * Retrieves whether the authenticated user must change password before continuing.
	 *
	 * @returns True if password change is required; otherwise false.
	 */
	public getMustChangePasswordRequired(): boolean {
		return this.get<boolean>(this.MUST_CHANGE_PASSWORD_KEY) ?? false;
	}

	/**
	 * Removes the stored mandatory password change flag.
	 */
	public removeMustChangePasswordRequired(): void {
		this.remove(this.MUST_CHANGE_PASSWORD_KEY);
	}

	/**
	 * Clears all data related to the meeting,including room secret, redirect URL, and E2EE data.
	 */
	public clearMeetingData(): void {
		this.removeRoomSecret();
		this.removeRedirectUrl();
		this.removeE2EEData();
	}

	/**
	 * Stores a value in sessionStorage.
	 * The value is converted to a JSON string before saving.
	 *
	 * @param key The key under which the value will be stored.
	 * @param value The value to be stored (any type).
	 */
	protected set(key: string, value: any): void {
		const jsonValue = JSON.stringify(value);
		sessionStorage.setItem(key, jsonValue);
	}

	/**
	 * Retrieves a value from sessionStorage.
	 * The value is parsed from JSON back to its original type.
	 *
	 * @param key The key of the item to retrieve.
	 * @returns The stored value or null if the key does not exist.
	 */
	protected get<T>(key: string): T | null {
		const jsonValue = sessionStorage.getItem(key);
		return jsonValue ? (JSON.parse(jsonValue) as T) : null;
	}

	/**
	 * Removes a specific item from sessionStorage.
	 *
	 * @param key The key of the item to remove.
	 */
	protected remove(key: string): void {
		sessionStorage.removeItem(key);
	}
}

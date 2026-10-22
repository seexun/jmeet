import { Injectable, WritableSignal, signal } from '@angular/core';
import { Edition } from '../models';

/**
 * Application-level metadata that is not derivable from the runtime
 * environment: edition (CE/PRO) and version.
 */
@Injectable({
	providedIn: 'root'
})
export class AppContextService {
	private readonly _edition: WritableSignal<Edition> = signal(Edition.CE);
	private readonly _version: WritableSignal<string> = signal('');

	readonly edition = this._edition.asReadonly();
	readonly version = this._version.asReadonly();

	setEdition(edition: Edition): void {
		this._edition.set(edition);
	}

	setVersion(version: string): void {
		this._version.set(version);
	}
}

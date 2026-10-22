import type { Request } from 'express';
import { injectable } from 'inversify';
import { MEET_ENV } from '../environment.js';

@injectable()
export class BaseUrlService {
	private baseUrl: string;

	constructor() {
		this.baseUrl = this.getDefaultBaseUrl();
	}

	/**
	 * Sets the base URL from the request
	 */
	setBaseUrlFromRequest(req: Request): void {
		const protocol = req.protocol;
		const host = req.get('host');
		this.baseUrl = `${protocol}://${host}`;
	}

	/**
	 * Gets the base URL from the current context
	 */
	getBaseUrl(): string {
		return this.baseUrl;
	}

	/**
	 * Clears the current base URL by resetting to default
	 */
	clearBaseUrl(): void {
		this.baseUrl = this.getDefaultBaseUrl();
	}

	private getDefaultBaseUrl(): string {
		return `http://localhost:${MEET_ENV.SERVER_PORT}`;
	}
}

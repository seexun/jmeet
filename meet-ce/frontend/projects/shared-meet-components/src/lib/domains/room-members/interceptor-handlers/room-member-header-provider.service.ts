import { Injectable, inject } from '@angular/core';
import { HTTP_HEADERS } from '../../../shared/constants/http-headers.constants';
import {
	HttpHeaderContext,
	HttpHeaderProvider,
	HttpHeaderProviderService
} from '../../../shared/services/http-header-provider.service';
import { RoomMemberContextService } from '../services/room-member-context.service';

/**
 * Provider for room member token headers.
 * Adds the room member token only to requests made from room pages.
 */
@Injectable({
	providedIn: 'root'
})
export class RoomMemberHeaderProviderService implements HttpHeaderProvider {
	private readonly roomMemberContextService = inject(RoomMemberContextService);
	private readonly headerProviderService = inject(HttpHeaderProviderService);

	/**
	 * Registers this provider with the header provider service
	 */
	init(): void {
		this.headerProviderService.register(this);
	}

	/**
	 * Determines if this provider should add headers for the given context
	 */
	canProvide(context: HttpHeaderContext): boolean {
		if (!this.roomMemberContextService.roomMemberToken()) {
			return false;
		}
		return context.pageUrl.startsWith('/room/') || context.pageUrl.startsWith('/recording/');
	}

	/**
	 * Provides the room member token header
	 */
	provideHeaders(): Record<string, string> | null {
		const roomMemberToken = this.roomMemberContextService.roomMemberToken();
		if (!roomMemberToken) {
			return null;
		}

		return {
			[HTTP_HEADERS.ROOM_MEMBER_TOKEN]: `Bearer ${roomMemberToken}`
		};
	}
}

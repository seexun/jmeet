import { Route } from '@angular/router';
import { MeetUserRole } from '@openvidu-meet/typings';

/**
 * Navigation metadata for a domain route that should appear in the console navigation
 */
export interface DomainNavMetadata {
	/** Display label for the navigation link */
	label: string;
	/** Route path (relative to console) */
	route: string;
	/** Material icon name */
	icon: string;
	/** Optional CSS class for the icon */
	iconClass?: string;
	/** Order for sorting navigation items */
	order: number;
	/** Roles allowed to see this nav item */
	allowedRoles: MeetUserRole[];
}

/**
 * Complete route configuration for a domain
 * Includes both the route definition and optional navigation metadata
 */
export interface DomainRouteConfig {
	/** Angular route configuration */
	route: Route;
	/** Optional navigation metadata (if this route should appear in console nav) */
	navMetadata?: DomainNavMetadata;
}

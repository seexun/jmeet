export interface ConsoleNavLink {
	label: string; // Link name
	icon?: string; // Optional icon
	iconClass?: string; // Optional icon CSS class
	route?: string; // Route for navigation (optional)
	href?: string; // External URL: opens in a new tab, takes precedence over route (optional)
	clickHandler?: () => void; // Function to handle clicks (optional)
	group?: string; // i18n key of the sidebar section title (optional)
}

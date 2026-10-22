# Design System Styles

The design-system Sass source of truth now lives in `projects/shared-meet-components/styles`.

Internal consumers in this workspace resolve those files through Sass `includePaths`, so this folder no longer contains runtime style sources.

If you need to change tokens, mixins, utilities, animations, or runtime theme behavior, edit `projects/shared-meet-components/styles` instead.

Contains utility classes:

- Text utilities (`.ov-text-center`, `.ov-text-truncate`)
- Spacing utilities (`.ov-mt-*`, `.ov-mb-*`, `.ov-padding-*`)
- Theme classes (`.ov-theme-transition`)
- Conceptual icon classes (`.ov-room-icon`, `.ov-recording-icon`, etc.)
- Surface and background classes

## Usage Examples

The usage remains exactly the same as before:

```scss
// Import the design tokens (same as before)
@import 'design-tokens';

// Use mixins (same as before)
.my-component {
	@include ov-card;
	@include ov-hover-lift(-3px);

	// Use CSS variables (same as before)
	padding: var(--ov-meet-spacing-lg);
	color: var(--ov-meet-text-primary);
}

// Use utility classes (same as before)
.my-element {
	@extend .ov-flex-center;
}
```

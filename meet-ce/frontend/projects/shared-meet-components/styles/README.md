# JMeet Design System

**Authority:** `docs/enterprise-light-saas-ui-frontend-standard.md`  
**Rewrite spec:** `docs/superpowers/specs/2026-09-04-enterprise-ui-full-refactor-design.md`  
**Page blueprints:** `docs/superpowers/specs/page-blueprints.md`

## Token layers

| Layer | Path | Rule |
|-------|------|------|
| Primitive | `styles/tokens/_primitives.scss` | Raw scales only (hex allowed here) |
| Semantic | `styles/tokens/_semantic.scss` | Light-only purpose tokens |
| Component | `styles/tokens/_components.scss` | Button/card/layout contracts |
| Legacy | `styles/_legacy-token-aliases.scss` | `--ov-meet-*` until Phase 4 |

Root `_tokens-*.scss` files forward into `tokens/`.

## Layer 2 components

Import from `@openvidu-meet/shared-components`:

- Admin: `JmeetAppShellComponent`, `JmeetPageHeaderComponent`, `JmeetFilterBarComponent`, `JmeetDataTableComponent`, `JmeetStatCardComponent`, `JmeetEmptyStateComponent`, `JmeetLoadingSkeletonComponent`, `JmeetStatusTagComponent`
- Meeting: `JmeetMeetingShellComponent`, `JmeetMeetingToolbarComponent`, `JmeetMeetingPanelComponent`

## Page rewrite rules

1. Delete old HTML/SCSS; write from Page Blueprints (Replace, not Migrate).
2. Page SCSS limits: Dashboard 30, List/Settings 50, Meeting panel 40 lines.
3. Ban legacy selectors: `workspace-*`, `metric-strip`, `ov-settings-panel`, etc.
4. Hardcoded colors require `design-system-allow-hardcoded: <reason>` on the same line.

## Verification

```bash
pnpm run test:design-system
pnpm run lint:design-system:strict
pnpm run check:page-scss-lines
pnpm run build
```

Light-only product: no dark theme tokens, selectors, or UI entry points.

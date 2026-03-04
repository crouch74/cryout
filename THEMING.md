# Theming Framework

This project uses a **base + scenario overlay** theme model:

- Base theme: `revolutionary-ink-paper`
- Overlay theme IDs: `burnt-earth-resistance`, `rainforest-sovereignty`, `dossier-of-the-disappeared`, `desert-horizon`, `night-map-escalation`
- Runtime resolver: `src/theme/themeRuntime.ts`
- Scenario mapping: `src/theme/scenarioThemeMap.ts`

The base theme is always applied. Scenario overlays only override allowed emotional/tactical tokens.

## Token Contract

All components must consume tokens (CSS variables), not hardcoded palette values.

Required token groups in `ThemeDefinition`:

- `colors`
- `shadows`
- `radius`
- `spacing`
- `typography`
- `motion`

Canonical CSS variables are declared in:

- `src/styles/foundation/tokens.css`

Core required color vars:

- `--color-background`
- `--color-surface`
- `--color-surface-elevated`
- `--color-focus-surface`
- `--color-border`
- `--color-text-primary`
- `--color-text-muted`
- `--color-accent`
- `--color-accent-strong`
- `--color-danger`
- `--color-success`

## Naming Rules

- Theme IDs are lowercase kebab-case.
- Scenario IDs remain engine-authored IDs (for example `base_design`).
- Theme token names use semantic purpose, not hue names:
  - Good: `accent`, `backgroundWash`
  - Avoid: `red500`, `greenDark2`

## Safe Overlay Overrides

Scenario overlays are intended to override:

- `colors.accent`
- `colors.accentStrong`
- `colors.heroTone`
- `colors.backgroundWash`
- `colors.selectionHighlight`
- `colors.tokenGlow`
- `colors.surfaceTint`

Avoid overriding typography scale, spacing scale, or radius in overlays unless a scenario has a strong accessibility reason. Keep global rhythm stable.

## Scenario Mapping

Current mapping policy (`Contextual Split`):

| Ruleset ID | Overlay Theme ID |
| --- | --- |
| `base_design` | `burnt-earth-resistance` |
| `tahrir_square` | `night-map-escalation` |
| `woman_life_freedom` | `dossier-of-the-disappeared` |
| `algerian_war_of_independence` | `desert-horizon` |

Additional implemented overlay:

- `rainforest-sovereignty` (available for future scenario mapping)

Unknown `rulesetId` values fall back to base theme only.

## Adding a New Overlay

1. Add a new `ScenarioOverlayId` union member in `src/theme/types.ts`.
2. Add overlay definition in `SCENARIO_THEME_OVERLAYS` in `src/theme/themeRegistry.ts`.
3. Add optional mapping in `SCENARIO_THEME_MAP` in `src/theme/scenarioThemeMap.ts`.
4. Verify runtime output:
   - `data-theme-id` updates
   - `data-scenario-theme` updates (or clears on fallback)
5. Add or update tests in `tests/unit/theme-framework.test.ts`.

## Accessibility and RTL Guardrails

- Preserve visible focus styles (`:focus-visible`) on interactive controls.
- Keep contrast-safe defaults when overlay accents shift.
- Respect reduced motion:
  - `html[data-motion='reduced']` disables non-essential animation.
  - Framer Motion paths must branch off when reduced mode is active.
- Ensure RTL-aware spacing/alignment for utility controls and form affordances using logical properties or explicit `html[dir='rtl']` rules.

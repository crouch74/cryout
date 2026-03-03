# Localization Audit Report

## Scope

- Locale catalogs: `src/i18n/en.json`, `src/i18n/ar-EG.json`
- UI and helper layers: `src/app/**`, `src/features/**`, `src/game/**`, `src/ui/**`
- Engine-presented copy: `engine/**`
- Scenario and card content surfaced through localization lookups

## Audit Summary

| Surface | Finding | Status |
| --- | --- | --- |
| UI catalogs | English and Arabic catalogs were out of parity. | Fixed |
| Legacy catalogs | `ui.legacyLanding` and `ui.legacyDashboard` were orphaned and unreferenced. | Pruned |
| Engine runtime | `ui.runtime.*` keys were missing; English fallbacks were still acting as source text. | Fixed |
| UI helpers | Several visible strings in `gameUiHelpers.ts` were hardcoded in English. | Fixed |
| Selectors | Phase summaries were hardcoded in English. | Fixed |
| Setup UI | Room URL placeholder was hardcoded. | Fixed |
| Presentation labels | Several fallbacks still exposed `Bodies` instead of `Comrades`. | Fixed |
| Ruleset metadata | Arabic lacked top-level ruleset localization for `tahrir_square` and `woman_life_freedom`. | Fixed |

## High-Impact Term Rewrites

| Before | After |
| --- | --- |
| Bodies | Comrades / الرفاق |
| End Resolution with every region at 1 Extraction or less. | Reach the end of Resolution with every region at 1 Extraction Token or fewer. |
| Feedback | Aftermath |
| Operational Briefing | Campaign Briefing |
| Asymmetric Factions | Distinct Movements |

## Literal Translation Cleanups

- Reworked Arabic home, guide, mode, and runtime copy away from flat mirrored syntax.
- Replaced colloquial or mechanically translated phrases in setup and rules copy with a more deliberate literary Egyptian register.
- Tightened mode descriptions so `Liberation` and `Symbolic` carry equivalent emotional weight without using the same sentence structure as English.

## Hardcoded Strings Removed

- `engine/selectors.ts`
- `engine/runtime.ts`
- `src/game/presentation/gameUiHelpers.ts`
- `src/features/session-setup/ui/SessionSetupScreen.tsx`
- presentation fallbacks in `src/game/screens/GameSessionScreen.tsx`, `src/game/presentation/historyPresentation.ts`, `src/game/board/RegionHoverCard.tsx`, `src/game/board/WorldMapBoard.tsx`, and `src/game/hud/PlayerStrip.tsx`

## Missing Keys Resolved

- Added `ui.runtime.*` in both locales.
- Added `ui.home.roomUrlPlaceholder` in both locales.
- Added `ui.game.currentMode`, `ui.game.modeDescLiberation`, `ui.game.modeDescSymbolic`, `ui.game.beginStruggle`, and `ui.game.phaseSummary*` in both locales.
- Added Arabic top-level ruleset entries for `tahrir_square` and `woman_life_freedom`.

## Tone Corrections

- Setup copy now frames the table as a coalition of distinct movements rather than a neutral configuration shell.
- Guide copy now describes extraction, mandates, and consequence with political and dramatic clarity.
- Terminal copy preserves bittersweet outcomes: victory is incomplete, defeat is not nihilistic.

## Dehumanizing Terminology Check

Active user-facing copy no longer presents people as `Bodies`. Internal engine field names remain unchanged for code stability, but presentation layers now consistently render the canonical people-facing term `Comrades` / `الرفاق`.

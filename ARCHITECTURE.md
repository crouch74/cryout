# Architecture

## Structure

```text
src/
  app/                  app bootstrap, router, providers, shell
  devtools/             development-only diagnostics and panels
  engine/               scenario-agnostic runtime, rules, state, persistence
  features/             product workflows and session orchestration
  game/                 runtime board, HUD, overlays, presentation helpers
  i18n/                 locale catalogs and localization utilities
  scenarios/            shipped scenario modules plus testing-only scenarios
  styles/               global tokens and game/shell styles
  ui/                   shared reusable UI primitives

room-service/           local multiplayer HTTP service
tests/                  node:test verification suite
docs/                   audits and refactor reports
```

## Boundaries

- `src/engine/*` is the canonical shared runtime. It must not import from `src/app`, `src/features`, `src/game`, `src/ui`, or shipped scenario modules.
- `src/engine/adapters/compat/*` is the only compatibility layer allowed to translate between the canonical engine and older runtime/state surfaces.
- `src/scenarios/*` owns scenario content, boards, localization glue, and compatibility-backed scenario adapters.
- `src/scenarios/testing/*` is test-only scenario space. It is not part of the shipped scenario registry.
- `src/game/*` renders runtime state and can consume `engine`, `scenarios`, `ui`, and `i18n`, but not feature state directly.
- `src/features/*` owns setup, room session, guides, and other product workflows. Features consume the engine through public exports and adapters.
- `src/devtools/*` is isolated from product code. Product modules must not import it.

## Adding A Feature

1. Create a new folder under `src/features/<feature-name>/`.
2. Keep view components under `ui/`, pure data or helpers under `model/` or `lib/`.
3. Consume runtime state through `src/engine/index.ts` or scenario/testing public entrypoints, not deep internals.
4. Put all user-facing copy behind localization keys in `src/i18n/*.json`.
5. If the feature adds diagnostics or operator tooling, place that code in `src/devtools/*` instead of product routes.
6. Add or update tests in `tests/*.test.ts`.

## Notes

- Public application routes are `/`, `/guidelines`, `/player-guide`, `/offline`, and `/rooms/:roomId`.
- Offline Pages builds use hash routing through the same route helpers.
- Room session payloads and local room credentials are validated with Zod at the app and room-service boundaries.

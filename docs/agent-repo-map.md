# Agent Repo Map

Use this guide to route work to the correct surface quickly and avoid accidental cross-layer edits.

## High-Level Ownership Boundaries

- `src/engine/`: canonical runtime, rules, events, reducer, persistence, validation.
- `src/features/`: product workflows (setup, guides, room session, board tour).
- `src/game/`: runtime board/HUD/panels/overlays/presentation.
- `src/scenarios/`: scenario modules, boards, content, localization glue, scenario hooks.
- `src/ui/`: shared reusable UI primitives and tokens.
- `src/styles/`: shared foundation styles and shell/game CSS layers.
- `docs/`: policy, references, audits, and contributor documentation.
- `tests/`: unit and integration suite (plus end-to-end style integration tests).
- `room-service/`: multiplayer room backend and lobby/session API surface.

## Task Routing: If Task Is X, Go To Y

| Task Type | Primary Locations | Notes |
| --- | --- | --- |
| Engine rule tweak | `src/engine/rules/*`, `src/engine/reducer.ts`, `src/engine/commands/*` | Keep engine isolated from app/feature imports. |
| Shell UI alignment (Home-consistent) | `src/features/*/ui/*`, `src/styles/shell/*`, `src/ui/*` | Audit adjacent shell screens for visual drift. |
| Scenario content/mechanics change | `src/scenarios/<scenario_id>/*` | Update scenario-local rules/content/decks/setup together. |
| Localization update | `src/i18n/*.json`, `src/scenarios/*/locales/*.json` | Keep term parity with localization glossary and AGENTS canon. |
| Test addition or fix | `tests/unit/*.test.ts`, `tests/integration/*.test.ts` | Add focused tests for changed behavior and avoid unrelated churn. |
| Room flow or lobby change | `room-service/server.ts`, `src/features/room-session/*` | Keep schemas and server/client contract aligned. |

## Common Command Matrix

| Intent | Command |
| --- | --- |
| Frontend dev server | `npm run dev` |
| Room service dev server | `npm run dev:rooms` |
| Lint | `npm run lint` |
| Full tests | `npm test` |
| Engine-focused tests | `npm run test:engine` |
| UI-focused tests | `npm run test:ui` |
| Build | `npm run build` |
| Simulation | `npm run simulate -- --runs 100000 --parallel 8` |
| A/B experiment | `npm run experiment -- --id <experimentId> --runs 50000 --seed 42` |
| Optimizer | `npm run optimize -- --scenario <scenarioId>` |

## Safe-Edit Guidance

- Policy and framing source of truth:
  - `AGENTS.md` for pillars, mechanics guardrails, terminology, and representation rules.
  - `docs/localization-glossary.md` for language-level canonical term usage.
- Mechanics source of truth:
  - `src/engine/*` and scenario modules under `src/scenarios/*`.
  - `src/engine/version.ts` + `CHANGELOG.md` for version-aware interpretation.
- UI consistency source of truth:
  - Home screen shell language and shared tokens/components.
- Avoid:
  - introducing one-off visual patterns in shell screens,
  - changing mechanics without validating canonical rule constraints,
  - mixing policy/docs changes with unrelated runtime refactors in one patch.

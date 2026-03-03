# Dependency Replacement Report

## Implemented

| Area | Replacement | Why | Risk / Impact | Migration Steps | Files Touched |
| --- | --- | --- | --- | --- | --- |
| Routing | Custom route parsing shell -> `react-router-dom` app router with explicit public routes | Keeps browser and offline hash routing inside a maintained router and removes ad hoc route wiring from the product shell | Medium: route helpers and room hydration had to remain URL-compatible | Added app router/provider shell, kept path helper coverage, verified `/`, `/guidelines`, `/player-guide`, `/offline`, `/rooms/:roomId` | `src/app/router/*`, `src/app/AppRoot.tsx`, `src/main.tsx`, `vite.config.ts`, tests |
| Validation | Ad hoc `JSON.parse` for room payloads and stored credentials -> `zod` schemas | Tightens room-service correctness and local storage parsing with explicit contract checks | Medium: payload parsing now fails fast on malformed data | Added shared room-session schemas, updated app restore/create flows, updated room-service request handlers | `src/features/room-session/api/schemas.ts`, `src/features/room-session/storage/browserRoomCredentials.ts`, `src/app/AppRoot.tsx`, `room-service/server.ts`, `package.json` |

## Intentionally Deferred

| Area | Recommendation | Why Deferred | Risk / Impact | Next Migration Step |
| --- | --- | --- | --- | --- |
| Testing stack | `node:test` -> `vitest` + Testing Library + `jsdom` | The current suite was already green after the architecture move and there was no installed Vitest stack in the workspace during this pass | Low immediate risk because coverage remains green, but UI tests still rely on source inspection in a few places | Add the Vitest toolchain, move tests under `tests/unit`, `tests/integration`, and `tests/e2e`, then replace source-grep assertions with rendered-behavior tests |
| Accessibility primitives | Keep existing custom tabletop primitives for now | No current correctness or accessibility failure required a package migration in this pass | Low | Revisit if modal, tabs, or complex focus management expands |
| State management | Keep React state/context | The session shell did not yet justify Zustand, Redux Toolkit, or XState | Low | Reassess if room orchestration or scenario state grows materially more complex |

# Playwright E2E Testing

This repository now uses Playwright for browser-level end-to-end coverage.

## Scope

Current suite location:

- `tests/e2e/helpers.ts`
- `tests/e2e/shell-navigation.spec.ts`
- `tests/e2e/routes.spec.ts`
- `tests/e2e/game-session.spec.ts`
- `tests/e2e/home-setup.spec.ts`
- `tests/e2e/board-tour.spec.ts`
- `tests/e2e/session-phase.spec.ts`
- `tests/e2e/room-lobby.spec.ts`

The suite currently covers:

- Home shell utilities (`Open Rules Brief`, `Player Guide`, `Board Tour`)
- Home setup controls (scenario, mode, player count, seat-card regrouping)
- Board Tour guided-step navigation and offline table entry
- Direct route entry points (`/guidelines`, `/player-guide`, `/offline`)
- Safe fallback for unknown routes and missing room permalinks
- Local table startup overlays and system-to-coalition phase progression
- Room lobby multiplayer lifecycle (host create, seat claim, host launch)

## Local Run

Install project dependencies first:

```bash
npm install
```

Install the Chromium browser once:

```bash
npx playwright install chromium
```

Run e2e tests:

```bash
npm run test:e2e
```

Useful variants:

```bash
npm run test:e2e:headed
npm run test:e2e:debug
```

## Configuration

Playwright config is at:

- `playwright.config.ts`

Defaults:

- Local web server: `npm run dev -- --host 127.0.0.1 --port 4173 --strictPort`
- Base URL: `http://127.0.0.1:4173`
- Projects: desktop Chromium + mobile Chromium profile (Pixel 7)
- Retry policy: CI retries enabled

Artifacts are written to:

- `output/playwright/test-results`
- `output/playwright/report`

## CI/CD Integration

Playwright e2e now runs in both deployment workflows before publishing:

- `.github/workflows/pages.yml`
- `.github/workflows/netlify-deploy.yml`

Both pipelines run, in order:

1. `npm ci`
2. existing Node test suite (`npm test` for Pages, build for Netlify)
3. `npx playwright install chromium`
4. `npm run test:e2e`
5. deployment step

# Where the Stones Cry Out

A digital adaptation of a movement-centered cooperative strategy game about resisting extraction, militarism, hunger, censorship, and cultural erasure.

## Current Product

This repo now ships with four major rulebooks/scenarios:

- **Where the Stones Cry Out (Base)**: 6 canonical regions (Congo, Levant, Amazon, Sahel, Mekong, Andes), 7 canonical domains (War Machine through Stolen Voice).
- **2011 — TAHRIR SQUARE**: 6 Egypt-specific regions (Cairo, Alexandria, Nile Delta, Upper Egypt, Suez, Sinai), featuring **Revolutionary Wave** and **Unfinished Justice** domains, and the **The Square** / **Martyrdom** mechanics.
- **2022 — WOMAN, LIFE, FREEDOM**: 6 Iran-specific regions (Tehran, Kurdistan, Isfahan, Mashhad, Khuzestan, Balochistan), featuring **Patriarchal Grip** domain and **Hijab Enforcement** / **Gender Dynamics** mechanics.
- **1954 — ALGERIAN WAR OF INDEPENDENCE**: 6 Algeria-focused regions (Algiers, Kabylie Mountains, Oran, Sahara South, Tunisian Border, French Metropole Influence), featuring **Repression Cycle** and anti-colonial pressure mechanics.

- **Total Scope**: 24 regions, 10 domains, 17 custom factions.
- **2 resources**: Comrades and Evidence.
- **2 victory modes**: Liberation and Symbolic.
- **1 central threat system**: Extraction Tokens (expanded pool for specialized scenarios).
- **3 live decks**: System, Resistance, and Crisis.
- **2 global meters**: Global Gaze and Northern War Machine.
- **Asymmetric factions**: Each with unique passives, weaknesses, and room-play Secret Mandates.

## Game Loop

Each round follows three phases:

1. `SYSTEM`
   The game resolves one or more Crisis draws, checks for a System escalation, then resolves military intervention.
2. `COALITION`
   Each seat queues two actions from the universal action set, then marks ready.
3. `RESOLUTION`
   Queued actions resolve in priority order, then the game checks Liberation or Symbolic victory and, in room play, all Secret Mandates.

`Launch Campaign` always resolves with `2d6` and a target of `8+` before modifiers and outcome effects are applied.

## Core Defeat / Victory

- Any region reaching `6` Extraction Tokens is an immediate loss.
- Any seat reduced to `0` Comrades is an immediate loss.
- `Liberation`: win if all six regions are at `1` or fewer Extraction Tokens at the end of Resolution.
- `Symbolic`: win if all three active Beacons are complete at the end of Resolution.
- In online room play, every Secret Mandate must also be satisfied or the coalition still fails.
- In local play, Secret Mandates are removed so the coalition coordinates entirely in the open.

## Tech Stack

- Frontend: React + TypeScript + Vite
- Rules engine: TypeScript deterministic reducer with seeded replay
- Room play: Node HTTP room service with lobby creation, seat claiming, host start, and seat-scoped private-state redaction
- Styling: existing tabletop shell and CSS system

## Quick Start

### Frontend

```bash
npm install
npm run dev
```

The frontend now talks to the room backend through same-origin `/api` routes. Players never need to enter a separate room-service URL.

From setup, players can open three onboarding surfaces: `Rules Brief`, `Player Guide`, and `Board Tour`.

### Room Service

```bash
npm run dev:rooms
```

Room play uses a lightweight lobby flow:

1. Create a room from the setup screen.
2. Each browser opens the room URL and claims one player slot.
3. The host starts the match once every slot is claimed.

Rooms are intentionally ephemeral and disappear when the room-service process stops.

### Full Test Suite

```bash
npm test
```

### Autoplay Simulation

Run deterministic headless balance simulations with NDJSON output:

```bash
npm run simulate -- --runs 100000 --parallel 8
```

Common options:

- `--runs <n>`: runs per scenario
- `--scenario <id[,id...]>`: one or more scenarios (repeat flag or comma-separate)
- `--mode liberation|symbolic|both`
- `--seed <n>`: deterministic seed
- `--parallel <n>`: worker thread count

Outputs:

- `simulation_output/simulations.ndjson`
- `simulation_output/simulation_summary.json`

### Production Build

```bash
npm run build
```

## Notes

- Local autosaves are intentionally versioned to the current ruleset and old saves are not forward-compatible.
- The Node room service is the active multiplayer path and keeps Secret Mandates private per claimed owner.
- The shipped repo now contains only the active TypeScript engine, scenario content, and Node room service surfaces.

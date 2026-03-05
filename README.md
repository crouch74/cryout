# Where the Stones Cry Out

A digital adaptation of a movement-centered cooperative strategy game about resisting extraction, militarism, hunger, censorship, and cultural erasure.

## Current Product

This repo now ships with four major rulebooks/scenarios:

- **Where the Stones Cry Out**: 6 canonical regions (Congo, Levant, Amazon, Sahel, Mekong, Andes), 7 canonical domains (War Machine through Stolen Voice).
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
- Some scenarios may define optional victory gates (minimum round, required action, required progress) that must be satisfied before public victory can trigger.
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
- `--trajectory-recording`: store compact trajectories for public victories/full wins only

Outputs:

- `simulation_output/simulations.ndjson`
- `simulation_output/simulation_summary.json`
- `simulation_output/trajectories/*.json` (only when `--trajectory-recording`)

### A/B Experiment Engine

Run deterministic scientific-method A/B tests where:

- `A` = shipped baseline scenario rules
- `B` = scenario-local treatment patch (baseline is not mutated)

Single experiment:

```bash
npm run experiment -- --id base_design_trim_setup_pressure --runs 100000 --seed 42
```

Run whole hypothesis backlog:

```bash
npm run experiment:all -- --runs 50000 --seed 42
```

Common options:

- `--id <experimentId>`: run one experiment from `src/simulation/experiments/hypotheses/backlog.ts`
- `--runs <n>`: override `runsPerArm`
- `--seed <n>`: deterministic seed (same seed => same report outputs)
- `--out <path>`: output root (default `simulation_output/experiments`)
- `--modes liberation,symbolic`: override victory modes
- `--players 2,3,4`: override player-count distribution
- `--record-trajectories`: capture and reservoir-sample victory trajectories (max 200)

Per-experiment outputs:

- `simulation_output/experiments/<experimentId>/experiment_definition.json`
- `simulation_output/experiments/<experimentId>/arm_A_summary.json`
- `simulation_output/experiments/<experimentId>/arm_B_summary.json`
- `simulation_output/experiments/<experimentId>/comparison.json`
- `simulation_output/experiments/<experimentId>/recommendation.json`
- `simulation_output/experiments/<experimentId>/report.md`
- `simulation_output/experiments/<experimentId>/report.html`
- `simulation_output/experiments/<experimentId>/trajectories/*.json` (only when `--record-trajectories`)

Backlog run output:

- `simulation_output/experiments/index.json`

Trajectory analysis command:

```bash
npm run trajectories -- --experiment base_design_reference_state
```

Analysis output:

- `simulation_output/experiments/<experimentId>/trajectory_summary.json`

Where experiments are defined:

- `src/simulation/experiments/hypotheses/backlog.ts`
- Add or edit items in `EXPERIMENT_BACKLOG`.

Example:

```ts
export const EXPERIMENT_BACKLOG: ExperimentDefinition[] = [
  {
    id: 'base_design_trim_setup_pressure',
    title: 'Where the Stones Cry Out: trim opening pressure to test early survivability and pacing.',
    scenarioId: 'base_design',
    victoryModes: ['liberation', 'symbolic'],
    runsPerArm: 50000,
    playerCounts: [2, 3, 4],
    seed: 42,
    patch: {
      note: 'WarMachine -1, GlobalGaze +1, seeded extraction -2',
      setup: {
        globalGazeDelta: 1,
        northernWarMachineDelta: -1,
        seededExtractionTotalDelta: -2,
      },
    },
    expectedEffects: {
      winRate: 'Should rise with less opening pressure.',
    },
    decisionRule: {
      primary: 'winRate',
      minLift: 0.01,
      confidence: 0.95,
    },
  },
];
```

### Autonomous Scenario Optimizer

Run iterative autonomous scenario balancing that combines:

- baseline simulation
- diagnostics
- trajectory analysis
- candidate patch generation
- A/B testing
- statistical gate checks
- baseline updates

Run with explicit scenario:

```bash
npm run optimize -- --scenario tahrir_square
```

Run without a scenario (interactive selector):

```bash
npm run optimize
```

Interactive mode prompts for the main optimizer controls (runtime, strategy, mode, significance, iterations, run budgets, candidate count, patience, seed, and output path) with short impact descriptions showing the accuracy/runtime tradeoff for each setting.

Common options:

- `--scenario <id>`
- `--iterations <n>`
- `--baseline-runs <n>`
- `--candidate-runs <n>`
- `--candidates <n>`
- `--patience <n>`
- `--seed <n>`
- `--parallel-workers <n>`
- `--out <path>`
- `--mode liberation|symbolic|both`
- `--runtime fast|balanced|thorough`
- `--significance strict|balanced|lenient`
- `--strategy numeric_balancing|victory_gating_exploration|trajectory_discovery|full_optimizer`

`--parallel-workers` controls both optimizer-level candidate experiment concurrency and per-experiment simulation worker batching.

Outputs are written to:

- `simulation_output/optimizer/<scenarioId>/<timestamp_seed>/`

Artifacts include:

- `optimizer_config.json`
- `optimization_history.json`
- `accepted_patch_history.json`
- `recommended_patch.json`
- `final_metrics.json`
- `final_report.md`
- `iteration_<NN>/baseline_summary.json`
- `iteration_<NN>/analysis.json`
- `iteration_<NN>/trajectory_summary.json`
- `iteration_<NN>/victory_trajectory_analysis.json`
- `iteration_<NN>/candidate_patches.json`
- `iteration_<NN>/candidate_rankings.json`
- `iteration_<NN>/selected_candidate.json`
- `iteration_<NN>/experiments/<experimentId>/*`

### Production Build

```bash
npm run build
```

## Notes

- Local autosaves are intentionally versioned to the current ruleset and old saves are not forward-compatible.
- The Node room service is the active multiplayer path and keeps Secret Mandates private per claimed owner.
- The shipped repo now contains only the active TypeScript engine, scenario content, and Node room service surfaces.

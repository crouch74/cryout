# Where the Stones Cry Out

A digital adaptation of the design-faithful six-region cooperative game about resisting extraction, militarism, hunger, censorship, and cultural erasure.

## Current Product

This repo now ships the hard-cutover ruleset:

- 6 canonical regions: Congo, Levant, Amazon, Sahel, Mekong, Andes
- 7 canonical domains: War Machine, Dying Planet, Gilded Cage, Silenced Truth, Empty Stomach, Fossil Grip, Stolen Voice
- 2 resources: Bodies and Evidence
- 2 victory modes: Liberation and Symbolic
- 1 central threat system: Extraction Tokens
- 2 global meters: Global Gaze and Northern War Machine
- 4 asymmetric factions with secret mandates

The previous `witness_dignity` / `green_resistance` scenario line is no longer the shipped game.

## Game Loop

Each round follows three phases:

1. `SYSTEM`
   The game resolves system cards, public-attention backlash, and military intervention.
2. `COALITION`
   Each seat queues two actions from the universal action set, then marks ready.
3. `RESOLUTION`
   Queued actions resolve in priority order, then the game checks Liberation or Symbolic victory and all secret mandates.

## Core Defeat / Victory

- Any region reaching `6` Extraction Tokens is an immediate loss.
- `Liberation`: win if all six regions are at `1` or fewer Extraction Tokens at the end of Resolution.
- `Symbolic`: win if all three active Beacons are complete at the end of Resolution.
- In both modes, every secret mandate must also be satisfied or the coalition still fails.

## Tech Stack

- Frontend: React + TypeScript + Vite
- Rules engine: TypeScript deterministic reducer with seeded replay
- Room play: Node HTTP room service with seat-scoped mandate redaction
- Styling: existing tabletop shell and CSS system

## Quick Start

### Frontend

```bash
npm install
npm run dev
```

### Room Service

```bash
npm run dev:rooms
```

### Full Test Suite

```bash
npm test
```

### Production Build

```bash
npm run build
```

## Notes

- Local autosaves are intentionally versioned to the cutover ruleset and old saves are not forward-compatible.
- The Node room service is the active multiplayer path.
- Legacy prototypes remain in the repo for reference but are not the active product.

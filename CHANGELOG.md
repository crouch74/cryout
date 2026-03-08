# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
### Balanced
- 🧬 **Scenario Engine Rebalance** — applied optimized winning genomes from GA evolutionary search across all major scenarios.
  - **1919 — EGYPT RISES**: Adjusted starting Gaze (3) and War Machine (7). Relaxed mandate and beacon thresholds by 3. Improved liberation probability by raising extraction removal cap to 4.
  - **WOMAN, LIFE, FREEDOM**: Hardened state security (War Machine 4) and lowered liberation threshold to 2. Mandate thresholds tightened by 1 to reflect the high-stakes political pressure of the 2022 uprising.
  - **ALGERIAN WAR OF INDEPENDENCE**: Balanced colonial army surge (War Machine 7). Set crisis extraction floor to 0 to reflect the sustainablity of the maquis. Relaxed mandate thresholds by 3.
  - **TAHRIR SQUARE**: Optimized for 18-day pacing. Cairo/Alexandria start with lower extraction overhead. Total liberation extraction cap raised to 4. Thresholds tightened by 1 to maintain revolutionary tension. Lowered catastrophic state score cap to 69.
  - **WHERE THE STONES CRY OUT**: Base world scenario stabilized. Global Gaze (8) and War Machine (4) adjusted for early survivability. Improved liberation threshold to 3.

### Improved
- 🧬 **GA Mutation Space Safety** — improved the evolutionary search space by implementing dynamic bounds for `seededExtractionTotalDelta`. Constraints are now automatically calculated based on the scenario's initial seeded extraction values, preventing the optimizer from generating invalid negative seeds while maintaining exploration range.
- 🧪 **Experiment Metric Intelligence** — upgraded the A/B experiment reporter to correctly handle "lower-is better" metrics (such as defeat rates and extraction breach frequency). The engine now accurately calculates lifts and regressions for these metrics, ensuring guardrail evaluations and decision rules remain statistically sound across all performance axes.
- 🌐 **Dashboard Access Reliability** — added support for Cloudflare tunnel hosts in the dashboard proxy configuration, enabling seamless remote access and shared development environments via `trycloudflare.com` alongside existing Ngrok support.
- 📊 **Dashboard Recommendation Fallback** — implemented a smart fallback in the Recommendations tab. If no strong production-ready patch is identified by the optimizer, the dashboard now surface the "Top Genome" (highest fitness individual) as a draft recommendation.
  - Added **Inconclusive Analysis** status for draft recommendations.
  - Detailed explanation of verification gaps (noise, sample size, convergence).
  - Visual highlighting of draft status with gold-dashed borders and warning banners.

- 🌍 **Dashboard Localization & Insights** — localized the entire analytical dashboard and added data-driven intelligence features.
  - **Egyptian Arabic Support** — complete, formal Egyptian Arabic (ar-EG) localization with RTL layout support.
  - **Dynamic Insights & Warnings** — every graph now features an Info (insight) and Warning icon that surfaces specific observations based on the current data instance.
  - **Premium Tooltip System** — refined the glassmorphism tooltips to support mixed content (guide, insight, and warning) in a unified UI pattern.
  - **Language Toggle** — added a seamless English/Arabic switcher in the sidebar.

## [0.11.0] - To Be Released
### Added
- 🇪🇬 **Scenario Expansion: 1919 — EGYPT RISES** — added the full historical uprising scenario, featuring:
  - Six historical fronts: Cairo, Alexandria, Delta Rail Corridor, Canal Zone, Upper Egypt, Rural Villages.
  - New Factions: Student Committees, Railway Workers, Women’s Action Circles, Provincial Organizers.
  - Six historical Beacons representing the timeline of the March 1919 uprising.
  - Specialized mechanics: **Railway Sabotage** (escalation reduction) and **Funerary Mobilization** (martyr-driven surge).
  - **Full Localization (multi-lingual)**: Comprehensive localization in Egyptian Arabic (ar-EG), Standard Arabic (ar), and French (fr).
  - **Contextual i18n Overrides**: Enhanced the localization engine to support scenario-specific names and descriptions for shared domains and regions (e.g., "Revolutionary Wave" becoming "National Uprising" specifically in 1919).

- 📜 **New Theme: Papyrus Insurgency** — a high-contrast, premium historical theme inspired by early 20th-century movements.
  - Full semantic token coverage in `themeRegistry.ts`.
  - Localized labels in English, French, and Arabic.

## [Unreleased] — GA Hybrid Evolutionary Optimizer

### Added

- 🧬 **GA Hybrid Evolutionary Optimizer** — upgraded the scenario optimizer to a 3-stage pipeline:
  1. **Evolutionary Search** — a configurable Genetic Algorithm explores the parameter space across generations.
  2. **Simulation Scoring** — each GA individual is scored using lightweight reduced-run simulations.
  3. **A/B Statistical Validation** — top GA candidates are promoted to the existing experiment engine for rigorous validation before acceptance.

- 📊 **Per-Player-Count Reporting** — the optimizer now tracks and displays balance metrics broken down by player count (2, 3, 4 players) in the final Markdown report and data artifacts.

- 👥 **Multi-Select Player Counts** — added the `--players` flag and interactive checkbox selectors to choose specific player distributions for optimization.

- 📁 **New `src/simulation/optimizer/ga/` module** with five files:
  - `types.ts` — `GaConfig`, `GaIndividual`, `GaGenerationReport`, `GaSearchResult`, `GaSearchInput`
  - `population.ts` — `initPopulation`, `randomGenome`, `crossover` (uniform with weight coupling), `mutateGenome` (per-gene probability gate), `tournamentSelect` (k=3 tournament), `evolveGeneration` (elitism + crossover + mutation), `computePopulationStats`
  - `genome.ts` — `genomeToCandidate` (PatchGenome → ScenarioPatch, zero-delta normalisation)
  - `engine.ts` — `runGaSearch`: multi-generation loop with concurrent individual scoring and per-generation JSON/Markdown reports
  - `reporter.ts` — `renderGenerationMarkdown`, `renderGaSummaryMarkdown`, `writeGenerationReport`, `writeGaReport`

- 🎛️ **Three optimizer search modes** controlled by `--search-mode`:
  - `local` — existing hill-climbing only (default, no regression risk)
  - `evolutionary` — pure GA; all A/B candidates come from the evolutionary search
  - `hybrid` — GA candidates merged with regular hill-climb candidates into the A/B pool

- 🖥️ **New CLI flags** for full GA control:
  - `--search-mode <local|evolutionary|hybrid>`
  - `--population <n>` (default 30)
  - `--generations <n>` (default 10)
  - `--ga-runs <n>` runs per individual (default 1000)
  - `--top-candidates <n>` GA promotions to A/B (default 5)
  - `--mutation-rate <f>` (default 0.15)
  - `--crossover-rate <f>` (default 0.6)
  - `--elitism <n>` (default 3)
  - `--players <n,n,...>` multi-select specific player counts (default 2,3,4)

- 🧪 **New unit tests** — `tests/unit/optimizer-ga-population.test.ts` covering genome bounds, crossover invariants, mutation gate, tournament selection, elitism preservation, and population statistics. CLI tests extended with GA flag parsing and `buildConfig` GA config assembly coverage.

### Changed

- `src/simulation/optimizer/types.ts` — added `OptimizerSearchMode`, `'evolutionary'` to `OptimizerCandidateStrategy`, and optional `searchMode`/`gaConfig` to `OptimizerConfig`.
- `src/simulation/optimizer/engine.ts` — integrated GA search phase and added player performance breakdown table to the final report.
- `src/simulation/optimizer/cli.ts` — extended `parseArgs`, `buildConfig`, `buildManual`, and the interactive prompt with all GA parameters and player count multi-select.
- `src/simulation/experiments/report.ts` — added `PlayerCountAccumulator` to bucket metrics by `playerCount` into the `ExperimentArmSummary`.
- `src/simulation/experiments/types.ts` — added `PlayerCountSummary` interface and `byPlayerCount` mapping to `ExperimentArmSummary`.

## [0.10.1] - 2026-03-03

### Changed
- 🧹 **Legacy Surface Purge** — removed the abandoned React application tree, the obsolete Python backend, dormant content packs, duplicate board assets, and other disconnected repo paths so the checked-in code reflects only the active TypeScript product.
- 🗺️ **Board Manifest Consolidation** — unified map manifest coverage across the shipped base, Tahrir Square, and Woman, Life, Freedom boards while keeping the base-world anchor tests pinned to the canonical base asset path.
- 🧪 **Active Surface Stabilization** — repaired build and test coverage around scenario pack typing, icon registries, history presentation, and world-map layout helpers so the surviving product surface builds and tests cleanly.

## [0.10.0] - 2026-03-02

### Added
- 🏛️ **Scenario Expansion: 2011 — TAHRIR SQUARE** — added the full Egyptian revolution scenario set, including Cairo (The Square), Alexandria, and Suez regions.
- ✊ **Scenario Expansion: 2022 — WOMAN, LIFE, FREEDOM** — added the Iranian uprising scenario, featuring Tehran, Kurdistan, and specialized Hijab Enforcement mechanics.
- 🌍 **Expanded Geography** — added 12 new regions across Egypt and Iran for specialized play.
- 🧬 **Specialized Mechanics** — implemented `The Square` (location-based momentum), `Martyrdom` (sacrifice-to-surge), and `Hijab Enforcement` (regional movement penalty).
- 📡 **Action Expansion** — 5 new ActionIds (`go_viral`, `burn_veil`, `schoolgirl_network`, `compose_chant`, `coordinate_digital`) to support asymmetric scenario play.
- 🇸🇦 **Full Arabic Localization (Egyptian)** — completed localization for all new scenarios, factions, and actions in `ar-EG`.

### Changed
- ⚙️ **Engine Core Advancement** — upgraded `EngineState` and `runtime.ts` to support multi-booklet scenario sets and a shared 18-region pool.

## [0.9.0] - 2026-03-02

### Added
- 🃏 **Dual-Threat Deck Model** — split the old single threat flow into a recurring `Crisis Deck` plus persistent `System Deck` escalations, while keeping Beacons as Symbolic objectives instead of a playable deck.
- 🎞️ **Center-Stage Card Reveal** — replaced the small under-deck reveal with a gated cinematic reveal overlay that lifts cards from the physical deck rail into the center of the table.
- 🔊 **Procedural Deck Audio** — added lightweight Web Audio cues for deck press, lift, flip, resolve, and settle interactions without bundling sound assets.
- 🧪 **Deck and Escalation Regression Coverage** — expanded engine and UI tests around Crisis draws, System trigger gating, replay serialization, and the rebuilt deck rail.

### Changed
- 🎴 **Premium Physical Deck Rendering** — rebuilt the deck rail around layered physical stacks, engraved wooden counters, deck-specific backs, and stacked discard or escalation presentation.
- 🚩 **Persistent System Escalations** — System cards now enter an active escalation tray and apply ongoing campaign, draw, and pressure modifiers instead of discarding immediately.
- 🕯️ **Beacon Separation** — active Beacons are now surfaced as objective cards in Symbolic mode instead of occupying a slot in the deck rail.

## [0.8.0] - 2026-03-02

### Added
- 🗺️ **Dynamic Token Layout Engine** — introduced a sophisticated coordinate-snapping and avoidance system for placing extraction, defense, and troop tokens within region nodes.
- 🔍 **Adaptive Viewport Management** — implemented a focal-point centering system that automatically pans and zooms the world map to maintain optimal focus on active regions.
- 📐 **Token Clustering & Overflow** — added logic for organized token groupings with automatic badge-based overflow handling for high-density regions.
- 🧪 **Board Layout Test Suite** — added regression tests for viewport blending, token anchor calculations, and coordinate normalization.

## [0.7.1] - 2026-03-01

### Fixed
- 🌍 **i18n Text Replacement** — fixed a race condition where the UI would update direction (RTL/LTR) but not replace translated text strings by synchronizing the i18n singleton during the React render pass.

## [0.7.0] - 2026-03-01

### Added
- 📖 **Localized Player Guide** — implemented a comprehensive, in-game rulebook structured as a multi-chapter professional guide.
- 🌍 **Full Arabic Support (ar-EG)** — added complete Egyptian Arabic localization for the entire Player Guide, including navigation, glossary, and complex game mechanics.
- 📜 **Rulebook Sections** — added dedicated chapters for Overview, Setup, Round Structure, Roles, Fronts, Regions, Resources, Cards, Charter, and Winning/Losing.
- 📖 **Interactive Glossary** — included a searchableized reference for key game terms (Burnout, Capture Engine, Civic Space, etc.) in both languages.

## [0.6.0] - 2026-03-01

### Changed
- 🗺️ **World Map Redesign** — transformed the map from a standard grid into an immersive "Physical Board Game" layout.
- 🎨 **Premium Board Aesthetic** — implemented a charcoal-textured "Board Frame" with tactile linen effects, coordinates, and a decorative compass rose.
- 📍 **Tactical Node Visualization** — replaced rectangular region cards with circular command nodes, featuring enhanced "Heat" glows and pulsing pressure animations.
- 🔗 **Topological Connections** — added visual SVG link paths between regions to illustrate the interconnected nature of the operational theatre.
- 🃏 **Physical Action Components** — updated action cards and queue tokens with deeper shadows, linen textures, and refined elevation for a more tangible feel.
- 🛡️ **Phase Tracker Integration** — the main phase control now rests at the bottom of the map as a physical board component, improving spatial coherence.

## [0.5.0] - 2026-03-01

### Changed
- 🎲 **Tabletop UI Refactor** — transformed the game into a fixed-viewport experience to emulate a physical board game and eliminate page scrolling.
- 📟 **Persistent Game Console** — introduced a blurry glassmorphism footer console as a persistent hub for player resources, identity, and the "Ready" action.
- 🃏 **Action Toolkit (Card Hand)** — reimagined player actions as a horizontal deck of interactable cards, replacing vertical accordions.
- 🔍 **Reading View Animation** — added a "zoom-to-read" overlay with smooth backdrop-blur transitions when selecting an action card.
- 🧱 **Unified Layout Strategy** — sidebar panels now use internal scrolling, ensuring the world map remains the centerpiece without jumping.
- 🧹 **Code Hygiene** — removed over 500 lines of legacy UI code to ensure the new tabletop logic is clean and maintainable.

## [0.4.0] - 2026-03-01

### Changed
- 🎨 **Complete UI/UX Overhaul** — shifted from "SaaS dashboard" to "tactical command center" aesthetic
- 🎨 Darkened base palette to near-black charcoal (`#07090c`) with higher-contrast accents
- 🔤 Mixed typography: **Crimson Pro** serif for headings (political authority), **JetBrains Mono** for data/logs (intelligence briefing)
- 📊 KPI chips now include severity-driven gauge bars (teal→orange→red thresholds)
- 🗺️ World Theatre map: tactical grid overlay, dot-grid silhouette, pressure-dependent region glows
- 🔴 Region cards pulse with heat-map coloring based on pressure level (low/medium/high/critical)
- ⚡ Phase progress token now pulses with a breathing animation on the active phase
- 🎯 Color-coded stat pills: displacement (amber), disinfo (violet), locks (red), institutions (blue)
- 💀 Collapsed front cards glow with danger-red inner shadow
- 📐 Resource values, action costs, and eyebrow labels use monospace font
- 🌀 Enhanced metric-pulse animation with stronger scale and color flash
- 🖥️ CRT scanline overlay and tighter 24px tactical grid on the body background
- 🎖️ Primary buttons: uppercase, display font, tactical glow shadow
- 📋 Now Bar: scanline texture background, uppercase phase name

## [0.3.1] - 2026-03-01

### Changed
- 🌍 Made the Landing Page generic, focusing on the broader game mechanics rather than a specific scenario.

### Added
- 📖 Created a Booklet-style 'ScenariosBooklet' UI for navigating scenarios, complete with gameplay and mechanics details.

## [0.3.0] - 2026-03-01

### Added
- ✨ Premium **Home Screen** with scenario selection and dramatized narrative introductions.
- 📖 **Story & Dramatization** system for scenarios to set thematic context and "vibe" before gameplay.
- 🌍 New **Green Resistance** mock scenario to demonstrate scenario selection variety.
- 🔄 Navigation flow between Home and Game states with "Reset to Home" capability.
- 🎨 Vibrant, high-fidelity CSS design system for the landing experience with glassmorphism and animations.

### Fixed
- 🛡️ Graceful handling of `null` game state during the scenario selection phase.
- 🛠️ Type-safe `ScenarioMetadata` and `Scenario` interface definitions.

## [0.2.1] - 2026-03-01


### Fixed
- 🛠 Fix `NameError: name 'string' is not defined` in the removed Python engine service (CharterClause model).

## [0.2.0] - 2026-03-01

### Added
- Dual-Engine Architecture (Frontend TypeScript Engine + Backend Python Engine)
- YAML/JSON data-driven configuration for scenarios, roles, and fronts
- Luxury Glassmorphism UI React Dashboard
- Deterministic Pytest suite for Backend rules
- Declarative Effect DSL evaluator supporting token tracking and modifiers

## [0.1.0] - 2026-02-28

### Added
- Initial project scaffolding with Vite + React + TypeScript
- Docker configuration (Dockerfile + docker-compose.yml)
- Complete game engine with all rules from the Player's Guide
- Scenario 1: "2024—The Current Moment" setup
- All 8 player actions implemented
- Full round structure (System Extracts → Resistance Acts → World Watches)
- Card decks: Resistance (20), Evidence (20), Crisis (20)
- Mode A Liberation victory conditions
- Three defeat conditions
- Secret Mandates for all 4 factions
- Setup screen with faction selection (2-4 players)
- Game board with 6 regions and extraction token display
- Global tracks: Global Gaze (0-20), Northern War Machine (0-12)
- 7 Domain tracks (War Machine through Stolen Voice)
- Player mats with faction abilities and cultural styling
- Card hand display with hover-to-expand
- Campaign resolution modal with modifier breakdown
- Event log with emoji-prefixed messages
- Dice rolling animations
- Victory/Defeat end screens with debrief prompts
- Design system matching the artistic style guide (color palette, typography)

### Added
- Early rules engine backend (run_world_phase, run_coalition_phase_resolution, run_end_phase).
- Content loader to load scenarios and base game data from YAML declarative configurations.
- Data structures for: Cards, Decks, Fronts, Roles with Burnout, Capture Engine decks.
- UI backend integration: GameDashboard now fetches initial state and sends intents to the FastAPI backend.
- Seeded deterministic test run capability for testing the full scenario loop.

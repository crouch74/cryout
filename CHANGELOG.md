# Changelog

All notable changes to this project will be documented in this file.

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
- 🛠 Fix `NameError: name 'string' is not defined` in `backend/engine/state.py` (CharterClause model).

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
- MVP rules engine backend (run_world_phase, run_coalition_phase_resolution, run_end_phase).
- Content loader to load scenarios and base game data from YAML declarative configurations.
- Data structures for: Cards, Decks, Fronts, Roles with Burnout, Capture Engine decks.
- UI backend integration: GameDashboard now fetches initial state and sends intents to the FastAPI backend.
- Seeded deterministic test run capability for testing entire MVP scenario loop.

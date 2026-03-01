# Changelog

All notable changes to this project will be documented in this file.

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

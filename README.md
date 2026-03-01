# Where the Stones Cry Out 🪨

A digital adaptation of the cooperative board game about Global South resistance movements fighting neocolonial extraction, militarism, and ecological destruction.

## 🎮 Game Overview

2–4 players control resistance movements across 6 regions of the Global South. Together, you fight to expel extractors, break the war machine, and seize the world's gaze — before the System overwhelms you.

### The Four Movements
- 🌿 **Forest Defenders** (Congo Basin) — Forest Knowledge
- 🫒 **The Sumud** (Levant) — Steadfastness under siege
- 🌊 **Riverkeepers** (Mekong Delta) — Water Memory
- 🌳 **The Guardians** (Amazon) — Earth Allies

### 🎮 Features
- **Cinematic Landing Page**: High-vibe entry point with dramatic narrative context for each scenario.
- **Scenario Selector**: Choose your struggle, ranging from MENA solidarity to Global South environmental resistance.
- **Real-time Tactical Map**: Coordinate between 6 vulnerable regions and monitor 7 global fronts.
- **Coalition Planning**: Role-specific actions for Community Organizers and Investigative Journalists.

## 🚀 Quick Start


### With Docker (Recommended)
```bash
# Starts both the FastAPI Backend and Vite Frontend mapped via volume
docker compose --profile all up --build
```

### Without Docker
**Backend API (Python 3.11+)**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

**Frontend React Engine**
```bash
npm install
npm run dev
```

Open `http://localhost:5174` (dev) to play offline/locally or sync to the API backend at `:8001`.

## GitHub Pages Offline Build
```bash
npm run build:pages
```

The Pages build is offline-only:
- it uses hash routing so GitHub Pages can serve the app without backend rewrites
- it disables room play in the UI
- it falls back to a local table whenever the room service is unreachable in other builds

## 🛠 Tech Stack
- **Frontend Engine**: TypeScript + React + Vite
- **Multiplayer Backend API**: Python + FastAPI + Pydantic
- **Styling**: Vanilla Custom CSS with Dark Mode Glassmorphism
- **Configuration Engine**: YAML Data-Driven Content Pack loader (No-Code Rulesets)

## 📁 System Architecture
```
.
├── backend/            # Python FastAPI Multiplayer Engine
│   ├── engine/         # State definitions & Python DSL Evaluator
│   ├── tests/          # Pytest Deterministic rules engine tests
│   ├── server.py       # API routing and memory-bank validation
│   └── Dockerfile
├── content/            # Data-Driven Configurations
│   ├── base_game/      # Shared YAML rules logic for Fronts, Decks, Roles
│   └── scenarios/      # Setup data for scenarios
├── src/                # React / Frontend Application
│   ├── engine/         # TS rules engine & state logic syncing backend
│   ├── App.tsx         # Dashboard views
│   └── index.css       # Luxury Glassmorphism CSS system
└── docker-compose.yml
```

## 🎨 Design
Visual style inspired by Palestinian Tatreez, Congolese popular painting, Amazonian body painting, and resistance poster art. Typography: Bebas Neue, Crimson Text, Caveat, Courier Prime.

## 📝 License
This game is dedicated to the journalists, medics, and organizers documenting resistance in real time.

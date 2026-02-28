# Where the Stones Cry Out 🪨

A digital adaptation of the cooperative board game about Global South resistance movements fighting neocolonial extraction, militarism, and ecological destruction.

## 🎮 Game Overview

2–4 players control resistance movements across 6 regions of the Global South. Together, you fight to expel extractors, break the war machine, and seize the world's gaze — before the System overwhelms you.

### The Four Movements
- 🌿 **Forest Defenders** (Congo Basin) — Forest Knowledge
- 🫒 **The Sumud** (Levant) — Steadfastness under siege
- 🌊 **Riverkeepers** (Mekong Delta) — Water Memory
- 🌳 **The Guardians** (Amazon) — Earth Allies

### Victory Conditions (Mode A: Liberation)
1. **Expel the Extractors**: 4+ regions have ≤2 Extraction Tokens
2. **Break the War Machine**: Northern War Machine ≤4
3. **Seize the Gaze**: Global Gaze ≥12

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

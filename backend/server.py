from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from engine.state import GameState, CivicSpace, Resources, Front, Region, PlayerState, LogEntry, Effect, PlayerIntent
from engine.content_loader import initialize_game
from engine.round_loop import run_world_phase, run_coalition_phase_resolution, run_end_phase
import time

app = FastAPI(title="The Stones Are Crying Out API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger = logging.getLogger("game_engine")
logging.basicConfig(level=logging.INFO)

# In-memory storage for MVP rooms
active_rooms = {}

@app.get("/")
def health_check():
    """✅ Health check endpoint"""
    logger.info("✅ Health check requested")
    return {"status": "ok", "game": "The Stones Are Crying Out"}

@app.post("/rooms")
def create_room(scenario_id: str = "mvp_witness_dignity"):
    """🌍 Create a new game room"""
    room_id = f"room-{int(time.time()*1000)}"
    try:
        initial_state = initialize_game(scenario_id)
        # Add players for MVP since UI doesn't have lobby
        initial_state.players = [
            PlayerState(roleId="organizer", actionsRemaining=2),
            PlayerState(roleId="investigative_journalist", actionsRemaining=2),
            PlayerState(roleId="human_rights_lawyer", actionsRemaining=2),
            PlayerState(roleId="climate_energy_planner", actionsRemaining=2)
        ]
        initial_state.logs.append(LogEntry(emoji="🌍", message=f"Room created for scenario: {scenario_id}", timestamp=time.time()*1000))
        active_rooms[room_id] = initial_state
        logger.info(f"🌍 Room created: {room_id}")
    except Exception as e:
        logger.error(f"Failed to load scenario setup: {e}")
        # Return simple empty state as fallback
        active_rooms[room_id] = GameState()
        
    return {"room_id": room_id, "state": active_rooms[room_id].model_dump()}

@app.get("/rooms/{room_id}")
def get_room(room_id: str):
    if room_id not in active_rooms:
        return {"error": "Room not found"}
    return {"state": active_rooms[room_id].model_dump()}

@app.post("/rooms/{room_id}/action")
def submit_action(room_id: str, payload: dict):
    if room_id not in active_rooms:
        return {"error": "Room not found"}
    
    state = active_rooms[room_id]
    
    player_idx = payload.get('playerId', 0)
    try:
        player_idx = int(player_idx)
    except ValueError:
        player_idx = 0
        
    role_id = state.players[player_idx].roleId if 0 <= player_idx < len(state.players) else str(player_idx)
    
    # Store pending intent
    intent = PlayerIntent(
        playerId=role_id,
        actionId=payload.get('actionId', ''),
        targetId=payload.get('targetId')
    )
    state.pendingIntents.append(intent)
    
    # In a full game UI, the player would just set "Ready". Here we log it playfully.
    state.logs.append(LogEntry(emoji="✅", message=f"Action queued: {payload.get('actionId')}", timestamp=time.time()*1000))
    
    return {"status": "ok", "state": state.model_dump()}

@app.post("/rooms/{room_id}/phase")
def advance_phase(room_id: str):
    if room_id not in active_rooms:
        return {"error": "Room not found"}
    
    state = active_rooms[room_id]
    if state.phase == "WORLD":
        state = run_world_phase(state)
    elif state.phase == "COALITION":
        state = run_coalition_phase_resolution(state)
    elif state.phase == "END":
        state = run_end_phase(state)
        
    return {"status": "ok", "state": state.model_dump()}

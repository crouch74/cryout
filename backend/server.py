from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from engine.state import GameState, CivicSpace, Resources, Front, Region, PlayerState, LogEntry, Effect
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
def create_room():
    """🌍 Create a new game room"""
    room_id = f"room-{int(time.time()*1000)}"
    # Initialize a mock state mimicking the frontend
    initial_state = GameState(
        temperature=2,
        civic_space=CivicSpace.NARROWED,
        resources=Resources(solidarity=2, evidence=2, capacity=1),
        fronts={
            "WAR": Front(id="WAR", name="War & Conflict", pressure=6, protection=2, impact=4),
            "CLIMATE": Front(id="CLIMATE", name="Climate Crisis", pressure=3, protection=3, impact=2),
            "POVERTY": Front(id="POVERTY", name="Economic Poverty", pressure=5, protection=2, impact=4),
        },
        regions={
            "MENA": Region(id="MENA", vulnerability={"CLIMATE": 1, "WAR": 3}, tokens={"displacement": 2}),
        },
        players=[
            PlayerState(roleId="organizer", actionsRemaining=2),
            PlayerState(roleId="investigative_journalist", actionsRemaining=2)
        ],
        logs=[LogEntry(emoji="🌍", message="Room created.", timestamp=time.time()*1000)]
    )
    active_rooms[room_id] = initial_state
    
    logger.info(f"🌍 Room created: {room_id}")
    return {"room_id": room_id, "state": initial_state.model_dump()}

@app.get("/rooms/{room_id}")
def get_room(room_id: str):
    if room_id not in active_rooms:
        return {"error": "Room not found"}
    return {"state": active_rooms[room_id].model_dump()}

@app.post("/rooms/{room_id}/action")
def submit_action(room_id: str, payload: dict):
    if room_id not in active_rooms:
        return {"error": "Room not found"}
    
    # Normally validate action via Engine Hooks and call dsl evaluate_effects
    # For MVP, we just echo back state as successful sync
    state = active_rooms[room_id]
    state.logs.append(LogEntry(emoji="✅", message=f"Action validated: {payload.get('actionId')}", timestamp=time.time()*1000))
    
    return {"status": "ok", "state": state.model_dump()}

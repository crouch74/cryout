from pydantic import BaseModel
from typing import Dict, List, Optional
from enum import Enum

class CivicSpace(str, Enum):
    OPEN = "OPEN"
    NARROWED = "NARROWED"
    OBSTRUCTED = "OBSTRUCTED"
    REPRESSED = "REPRESSED"
    CLOSED = "CLOSED"

class Effect(BaseModel):
    modify_track: Optional[Dict] = None
    add_token: Optional[Dict] = None
    remove_token: Optional[Dict] = None
    add_lock: Optional[Dict] = None
    remove_lock: Optional[Dict] = None
    draw_card: Optional[Dict] = None
    choice: Optional[Dict] = None
    log: Optional[Dict] = None

class Front(BaseModel):
    id: str
    name: str
    pressure: int = 0
    protection: int = 0
    impact: int = 0

class Region(BaseModel):
    id: str
    vulnerability: Dict[str, int] = {}
    tokens: Dict[str, int] = {}
    locks: List[str] = []

class Resources(BaseModel):
    solidarity: int = 0
    evidence: int = 0
    capacity: int = 0
    relief: int = 0

class PlayerState(BaseModel):
    roleId: str
    burnout: int = 0
    actionsRemaining: int = 0

class LogEntry(BaseModel):
    emoji: str
    message: str
    timestamp: float

class GameState(BaseModel):
    temperature: int = 0
    civic_space: CivicSpace = CivicSpace.NARROWED
    resources: Resources = Resources()
    globalTokens: Dict[str, int] = {}
    
    fronts: Dict[str, Front] = {}
    regions: Dict[str, Region] = {}
    players: List[PlayerState] = []
    
    currentRound: int = 1
    phase: str = "WORLD"
    logs: List[LogEntry] = []

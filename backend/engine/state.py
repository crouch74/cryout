from pydantic import BaseModel
from typing import Dict, List, Optional, Any
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
    conditional: Optional[Dict] = None
    delayed_effect: Optional[Dict] = None
    id: Optional[str] = None
    caused_by: Optional[str] = None

class EffectTrace(BaseModel):
    effect: Effect
    status: str # 'executed', 'failed', 'skipped'
    reason: Optional[str] = None

class Card(BaseModel):
    id: str
    deck: str
    tags: List[str] = []
    text: str
    satire_level: int = 0
    triggers: List[str] = []
    effects: List[Effect] = []
    choice_offer: Optional[Dict[str, Any]] = None

class DeckState(BaseModel):
    id: str
    draw_pile: List[Card] = []
    discard_pile: List[Card] = []

class Front(BaseModel):
    id: str
    name: str
    pressure: int = 0
    protection: int = 0
    impact: int = 0
    collapse_thresholds: Optional[List[Dict]] = None
    coupling_rules: Optional[List[Dict]] = None


class Institution(BaseModel):
    id: str
    name: str
    type: str
    bonus_description: str
    status: str

class Region(BaseModel):
    id: str
    vulnerability: Dict[str, int] = {}
    tokens: Dict[str, int] = {}
    locks: List[str] = []
    institutions: List[Institution] = []

class Resources(BaseModel):
    solidarity: int = 0
    evidence: int = 0
    capacity: int = 0
    relief: int = 0

class RoleBreakthrough(BaseModel):
    id: str
    name: str
    cost: int
    effects: List[Effect]

class RoleVariant(BaseModel):
    id: str
    name: str
    base_actions_per_turn: int = 2
    unique_actions: List[Dict] = []
    passive: str = ""
    burnout_max: int = 10
    burnout_strained: int = 7
    breakthroughs: List[RoleBreakthrough] = []

class PlayerState(BaseModel):
    roleId: str
    burnout: int = 0
    actionsRemaining: int = 0
    isReady: bool = False
    hand: List[Card] = []

class PlayerIntent(BaseModel):
    playerId: str
    actionId: str
    targetId: Optional[str] = None

class CharterClause(BaseModel):
    id: str
    title: str
    description: str
    status: str
    prerequisites: List[str]

class LogEntry(BaseModel):
    emoji: str
    message: str
    timestamp: float
    traces: Optional[List[EffectTrace]] = None

class CompromiseOffer(BaseModel):
    id: str
    title: str
    description: str
    relief_effects: List[Effect]
    hidden_cost_effects: List[Effect]
    votes: Dict[int, bool] = {} # playerId -> true/false

class GameState(BaseModel):
    temperature: int = 0
    civic_space: CivicSpace = CivicSpace.NARROWED
    resources: Resources = Resources()
    globalTokens: Dict[str, int] = {}
    
    fronts: Dict[str, Front] = {}
    regions: Dict[str, Region] = {}
    players: List[PlayerState] = []
    roles: Dict[str, RoleVariant] = {}
    pendingIntents: List[PlayerIntent] = []
    
    decks: Dict[str, DeckState] = {}
    charter: List[CharterClause] = []
    
    currentRound: int = 1
    phase: str = "WORLD"
    logs: List[LogEntry] = []
    
    active_compromise: Optional[CompromiseOffer] = None
    delayed_effects: List[Dict] = [] # list of {after_rounds: N, effects: [Effect]}

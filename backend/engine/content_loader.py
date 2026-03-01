import yaml
import os
import random
from typing import Dict, Any

from .state import GameState, Front, Region, Card, DeckState, RoleVariant, RoleBreakthrough, Effect, CivicSpace, Resources

CONTENT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "content"))

def load_yaml(path: str) -> Dict[str, Any]:
    with open(path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f) or {}

def initialize_game(scenario_id: str = "mvp_witness_dignity") -> GameState:
    base_dir = os.path.join(CONTENT_DIR, "base_game")
    scenarios_dir = os.path.join(CONTENT_DIR, "scenarios")
    
    fronts_data = load_yaml(os.path.join(base_dir, "fronts.yaml"))
    roles_data = load_yaml(os.path.join(base_dir, "roles.yaml"))
    decks_data = load_yaml(os.path.join(base_dir, "decks.yaml"))
    scenario_data = load_yaml(os.path.join(scenarios_dir, f"{scenario_id}.yaml")).get('scenario', {})
    
    state = GameState()
    
    # Load Fronts
    for f_data in fronts_data.get('fronts', []):
        state.fronts[f_data['id']] = Front(
            id=f_data['id'],
            name=f_data['name'],
            collapse_thresholds=f_data.get('collapse_thresholds', []),
            coupling_rules=f_data.get('coupling_rules', [])
        )
        
    # Load Roles
    for r_data in roles_data.get('roles', []):
        breakthrough_data = r_data.get('breakthrough_action', {})
        breakthrough = None
        if breakthrough_data:
            breakthrough = RoleBreakthrough(
                id=breakthrough_data.get('id', ''),
                name=breakthrough_data.get('name', ''),
                cost=breakthrough_data.get('burnout_cost', 0),
                effects=[Effect(**e) for e in breakthrough_data.get('effects', [])]
            )
            
        role = RoleVariant(
            id=r_data['id'],
            name=r_data['name'],
            base_actions_per_turn=r_data.get('base_actions_per_turn', 2),
            unique_actions=r_data.get('unique_actions', []),
            passive=r_data.get('passive', ''),
            burnout_max=r_data.get('burnout_max', 10),
            burnout_strained=r_data.get('burnout_strained_threshold', 7),
            breakthroughs=[breakthrough] if breakthrough else []
        )
        state.roles[role.id] = role

    # Load Decks
    for deck_name, cards_data in decks_data.get('decks', {}).items():
        deck = DeckState(id=deck_name)
        for c_data in cards_data:
            # We don't have python-level choices for Capture deals implemented deeply, just store them
            card = Card(
                id=c_data['id'],
                deck=deck_name,
                tags=c_data.get('tags', []),
                text=c_data.get('text', ''),
                satire_level=c_data.get('satire_level', 0),
                triggers=c_data.get('triggers', []),
                effects=[Effect(**e) for e in c_data.get('effects', [])],
                choice_offer=c_data.get('choice_offer')
            )
            deck.draw_pile.append(card)
        random.shuffle(deck.draw_pile)
        state.decks[deck_name] = deck

    # Apply Scenario Data
    state.temperature = scenario_data.get('initial_temperature', 0)
    civic_str = scenario_data.get('initial_civic_space', 'NARROWED')
    try:
        state.civic_space = CivicSpace(civic_str)
    except Exception:
        pass
        
    res_data = scenario_data.get('initial_resources', {})
    state.resources = Resources(
        solidarity=res_data.get('solidarity', 0),
        evidence=res_data.get('evidence', 0),
        capacity=res_data.get('capacity', 0)
    )
    
    # Load Regions
    for reg in scenario_data.get('regions', []):
        r = Region(
            id=reg['id'],
            vulnerability=reg.get('vulnerability', {}),
            tokens=reg.get('tokens', {}),
            locks=reg.get('locks', [])
        )
        state.regions[r.id] = r
        
    # Apply initial front overrides
    for f_id, f_override in scenario_data.get('front_overrides', {}).items():
        if f_id in state.fronts:
            state.fronts[f_id].pressure = f_override.get('pressure', 0)
            state.fronts[f_id].protection = f_override.get('protection', 0)
            state.fronts[f_id].impact = f_override.get('impact', 0)

    return state

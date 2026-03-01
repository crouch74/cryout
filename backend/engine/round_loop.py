import time
import random
from typing import List, Dict

from .state import GameState, Effect, PlayerIntent, LogEntry, CompromiseOffer
from .dsl import evaluate_effects, check_condition

def run_world_phase(state: GameState, seed: int = None) -> GameState:
    if seed is not None:
        random.seed(seed)
        
    state.logs.append(LogEntry(emoji="🌍", message=f"Starting World Phase for Round {state.currentRound}", timestamp=time.time()*1000))
    
    # 1. Capture Engine (Antagonist plays)
    evaluate_effects(state, [Effect(draw_card={"deck": "capture_engine", "count": 1})])
    
    # 2. Climate bump
    # Temperature increases by 1 inherently
    evaluate_effects(state, [Effect(modify_track={"target": "temperature", "delta": 1, "clamp": {"min":0, "max":10}})])
    
    # 3. Crisis roll depending on band
    band = state.temperature // 3
    if band > 0:
        state.logs.append(LogEntry(emoji="🔥", message=f"Temperature Band {band} reached. Drawing {band} Crisis.", timestamp=time.time()*1000))
        evaluate_effects(state, [Effect(draw_card={"deck": "crisis", "count": band})])

    # 4. Resolve Delayed effects
    remaining_delayed = []
    for delayed in state.delayed_effects:
        delayed['after_rounds'] -= 1
        if delayed['after_rounds'] <= 0:
            evaluate_effects(state, [Effect(**e) for e in delayed['effects']])
        else:
            remaining_delayed.append(delayed)
    state.delayed_effects = remaining_delayed

    state.phase = "COALITION"
    return state

def run_coalition_phase_resolution(state: GameState) -> GameState:
    # Resolve pending valid intents simultaneously
    state.logs.append(LogEntry(emoji="🤝", message="Resolving Coalition Phase Intents", timestamp=time.time()*1000))
    
    for intent in state.pendingIntents:
        player = next((p for p in state.players if p.roleId == intent.playerId), None)
        if not player: continue
        
        role = state.roles.get(player.roleId)
        if not role: continue
        
        # Check standard actions
        matched_action = next((a for a in role.unique_actions if a['id'] == intent.actionId), None)
        is_breakthrough = False
        
        if not matched_action and role.breakthroughs:
            b = next((br for br in role.breakthroughs if br.id == intent.actionId), None)
            if b:
                matched_action = {"effects": [e.model_dump() for e in b.effects], "name": b.name}
                is_breakthrough = True
                
        if matched_action:
            state.logs.append(LogEntry(emoji="🗣️", message=f"{role.name} executed {matched_action['name']}", timestamp=time.time()*1000))
            if is_breakthrough:
                # Add burnout
                # Assume cost is defined, hardcode to 2 for MVP
                cost = next((br.cost for br in role.breakthroughs if br.id == intent.actionId), 2)
                player.burnout = min(role.burnout_max, player.burnout + cost)
                state.logs.append(LogEntry(emoji="🧠", message=f"{role.name} pushed for a breakthrough! Burnout increased.", timestamp=time.time()*1000))
                
            effs = [Effect(**e) if isinstance(e, dict) else Effect(**e.model_dump()) for e in matched_action.get('effects', [])]
            evaluate_effects(state, effs)
            player.actionsRemaining = max(0, player.actionsRemaining - 1)
            
    state.pendingIntents = []
    
    # Progress to end phase
    state.phase = "END"
    return state

def run_end_phase(state: GameState) -> GameState:
    state.logs.append(LogEntry(emoji="🔄", message="End Phase: Running Coupling Rules", timestamp=time.time()*1000))
    # 1. Apply Coupling rules
    for f_id, front in state.fronts.items():
        if front.coupling_rules:
            for rule in front.coupling_rules:
                # Basic python eval for MVP check rule
                condition = rule.get('trigger', '')
                condition = condition.replace('front.', f'fronts.{f_id}.')
                if check_condition(state, condition):
                    evaluate_effects(state, [Effect(**e) for e in rule.get('effects', [])])
                    
    # 2. Check Collapse
    collapse = False
    for f_id, front in state.fronts.items():
        if front.collapse_thresholds:
            for thresh in front.collapse_thresholds:
                cond = thresh.get('condition', '')
                cond = cond.replace('front.', f'fronts.{f_id}.')
                if check_condition(state, cond):
                    collapse = True
                    state.logs.append(LogEntry(emoji="❌", message=f"SYSTEM COLLAPSE ON FRONT: {f_id}", timestamp=time.time()*1000))

    if collapse:
        state.phase = "LOSS"
    elif state.currentRound >= 10:
        state.phase = "WIN"
    else:
        # Reset for next round
        state.currentRound += 1
        for p in state.players:
            p.isReady = False
            role = state.roles.get(p.roleId)
            p.actionsRemaining = role.base_actions_per_turn if role else 2
        state.phase = "WORLD"
        
    return state

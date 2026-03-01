import time
from typing import List
from .state import GameState, Effect, LogEntry

def get_nested_attr(obj, path: str):
    keys = path.split('.')
    current = obj
    for key in keys:
        if isinstance(current, dict):
            current = current.get(key)
        else:
            current = getattr(current, key, None)
    return current

def set_nested_attr(obj, path: str, value):
    keys = path.split('.')
    current = obj
    for key in keys[:-1]:
        if isinstance(current, dict):
            current = current.get(key)
        else:
            current = getattr(current, key)
            
    final_key = keys[-1]
    if isinstance(current, dict):
        current[final_key] = value
    else:
        setattr(current, final_key, value)

def check_condition(state: GameState, condition_str: str) -> bool:
    if not isinstance(condition_str, str): return False
    parts = condition_str.split()
    if len(parts) == 3:
        left, op, right = parts
        val = get_nested_attr(state, left)
        if val is None: val = 0
        try:
            rval = int(right)
        except ValueError:
            rval = get_nested_attr(state, right)
            if rval is None: rval = 0
            
        if op == '>=': return val >= rval
        if op == '<=': return val <= rval
        if op == '==': return val == rval
        if op == '>': return val > rval
        if op == '<': return val < rval
    elif len(parts) == 5 and parts[1] == 'and':
        return check_condition(state, f"{parts[0]} {parts[2]} {parts[3]}") and check_condition(state, f"{parts[4]} {parts[2]} {parts[3]}")
    return False

def evaluate_effects(state: GameState, effects: List[Effect]) -> GameState:
    # Mutates state in place for simplicity in Python (since we'll just serialize it back)
    # A robust engine would return a new copy.
    
    for effect in effects:
        if effect.log:
            state.logs.append(LogEntry(
                emoji=effect.log.get("emoji", ""),
                message=effect.log.get("message", ""),
                timestamp=time.time() * 1000
            ))

        if effect.conditional:
            cond_str = effect.conditional.get("if", "")
            if check_condition(state, cond_str):
                then_effects = [Effect(**e) for e in effect.conditional.get("then", [])]
                evaluate_effects(state, then_effects)
            else:
                else_effects = [Effect(**e) for e in effect.conditional.get("else", [])]
                evaluate_effects(state, else_effects)

        if effect.draw_card:
            deck_name = effect.draw_card.get("deck")
            count = effect.draw_card.get("count", 1)
            deck = state.decks.get(deck_name)
            if deck and deck.draw_pile:
                for _ in range(count):
                    if deck.draw_pile:
                        card = deck.draw_pile.pop()
                        # Immediately evaluate card effects
                        evaluate_effects(state, card.effects)
                        deck.discard_pile.append(card)

        if effect.delayed_effect:
            state.delayed_effects.append({
                "after_rounds": effect.delayed_effect.get("after_rounds", 1),
                "effects": effect.delayed_effect.get("effects", [])
            })

        if effect.choice:
            # MVP: Just log choices for now if they are auto-resolved, or skip if UI handles it.
            # In a full headless test, choice would be fed by a player intent. 
            # We'll treat UI choices as just passing the chosen effect lists back to evaluate_effects
            # For now, just log that a choice was presented.
            state.logs.append(LogEntry(
                emoji="❓",
                message=f"Choice pending: {effect.choice.get('prompt')}",
                timestamp=time.time() * 1000
            ))

        if effect.modify_track:
            target = effect.modify_track.get("target")
            delta = effect.modify_track.get("delta", 0)
            clamp = effect.modify_track.get("clamp")
            
            val = get_nested_attr(state, target)
            if val is not None:
                new_val = val + delta
                if clamp:
                    new_val = max(clamp.get("min", new_val), min(clamp.get("max", new_val), new_val))
                set_nested_attr(state, target, new_val)

        if effect.add_token:
            region_id = effect.add_token.get("region")
            target = effect.add_token.get("target")
            token_type = effect.add_token.get("token_type")
            count = effect.add_token.get("count", 0)
            
            if region_id and region_id != "ANY" and region_id in state.regions:
                reg = state.regions[region_id]
                reg.tokens[token_type] = reg.tokens.get(token_type, 0) + count
            elif target == "global" or region_id == "ANY":
                # For MVP if ANY we default to global sum or a specific region if logic requires (simplify to global)
                state.globalTokens[token_type] = state.globalTokens.get(token_type, 0) + count

        if effect.remove_token:
            region_id = effect.remove_token.get("region")
            target = effect.remove_token.get("target")
            token_type = effect.remove_token.get("token_type")
            count = effect.remove_token.get("count", 0)
            
            if region_id and region_id != "ANY" and region_id in state.regions:
                reg = state.regions[region_id]
                reg.tokens[token_type] = max(0, reg.tokens.get(token_type, 0) - count)
            elif target == "global" or region_id == "ANY":
                state.globalTokens[token_type] = max(0, state.globalTokens.get(token_type, 0) - count)

        if effect.add_lock:
            region_id = effect.add_lock.get("region")
            lock_type = effect.add_lock.get("lock_type")
            
            if region_id and region_id != "ANY" and region_id in state.regions:
                reg = state.regions[region_id]
                if lock_type not in reg.locks:
                    reg.locks.append(lock_type)

        if effect.remove_lock:
            region_id = effect.remove_lock.get("region")
            lock_type = effect.remove_lock.get("lock_type")
            
            if region_id:
                if region_id == "ANY":
                    for r in state.regions.values():
                        if lock_type in r.locks:
                            r.locks.remove(lock_type)
                elif region_id in state.regions:
                    if lock_type in state.regions[region_id].locks:
                        state.regions[region_id].locks.remove(lock_type)
                        
    return state

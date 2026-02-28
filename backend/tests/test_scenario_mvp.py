import pytest
from engine.state import GameState, CivicSpace, Front, Region, Resources, PlayerState, Effect
from engine.dsl import evaluate_effects

def create_mock_state():
    return GameState(
        temperature=2,
        civic_space=CivicSpace.NARROWED,
        resources=Resources(solidarity=2, evidence=2, capacity=1),
        fronts={
            "WAR": Front(id="WAR", name="War & Conflict", pressure=6, protection=2, impact=4),
            "CLIMATE": Front(id="CLIMATE", name="Climate Crisis", pressure=3, protection=3, impact=2),
            "POVERTY": Front(id="POVERTY", name="Economic Poverty", pressure=5, protection=2, impact=4),
        },
        regions={
            "MENA": Region(id="MENA", vulnerability={"CLIMATE": 1, "WAR": 3}, tokens={"displacement": 2}, locks=[]),
        },
        players=[
            PlayerState(roleId="organizer", actionsRemaining=2),
        ],
    )

def test_deterministic_organizer_action():
    state = create_mock_state()
    
    # Simulate Mutual Aid Network Action
    # Organizer spends 2 solidarity to reduce 1 pressure on POVERTY
    
    effects = [
        Effect(modify_track={"target": "resources.solidarity", "delta": -2}),
        Effect(modify_track={"target": "fronts.POVERTY.pressure", "delta": -1, "clamp": {"min": 0, "max": 10}}),
        Effect(log={"emoji": "🤝", "message": "Mutual Aid Network Deployed"})
    ]
    
    new_state = evaluate_effects(state, effects)
    
    assert new_state.resources.solidarity == 0
    assert new_state.fronts["POVERTY"].pressure == 4
    assert len(new_state.logs) == 1
    assert new_state.logs[0].emoji == "🤝"

def test_token_and_lock_effects():
    state = create_mock_state()
    
    effects = [
        Effect(add_token={"region": "MENA", "token_type": "disinformation", "count": 1}),
        Effect(add_lock={"region": "MENA", "lock_type": "aid_access"}),
        Effect(add_token={"target": "global", "token_type": "charter_progress", "count": 1}),
    ]
    
    new_state = evaluate_effects(state, effects)
    
    assert new_state.regions["MENA"].tokens.get("disinformation", 0) == 1
    assert "aid_access" in new_state.regions["MENA"].locks
    assert new_state.globalTokens.get("charter_progress", 0) == 1

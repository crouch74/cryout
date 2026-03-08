# Domains and Custom Tracks Audit

This pass keeps canonical engine IDs stable while renaming scenario-facing tracks so they read in the direction players want them to move. Only `when_the_corridors_burn` reduces count, collapsing four thin Gulf micro-tracks into one aggregated posture track.

## Baseline Guardrails

| Scenario | Baseline win rate | Baseline average rounds | Evidence |
| --- | --- | --- | --- |
| `stones_cry_out` | `35.00%` | `8.97` | [summary.json](/Users/aeid/git_tree/boardgames/The stones are crying outt/simulation_output/optimizer_skill_runs/20260308T134422Z_stones-cry-out_simulation/summary.json) |
| `when_the_corridors_burn` | `56.67%` | `6.65` | [summary.json](/Users/aeid/git_tree/boardgames/The stones are crying outt/simulation_output/optimizer_skill_runs/20260308T134422Z_when-the-corridors-burn_simulation/summary.json) |
| `algerian_war_of_independence` | `40.00%` | `8.95` | [summary.json](/Users/aeid/git_tree/boardgames/The stones are crying outt/simulation_output/optimizer_skill_runs/20260308T134447Z_algerian-war-of-independence_simulation/summary.json) |

Acceptance rule for the corridors prune: keep it only if the post-change sim stays within roughly `+/-5` win-rate points and `+/-0.75` rounds while materially improving readability.

## stones_cry_out

| Track | Polarity | Mechanical dependencies | Keep / prune | Narrative fit |
| --- | --- | --- | --- | --- |
| Anti-War Fracture | higher is better | campaign target, score pressure, regional vulnerabilities | Keep | Names coalition leverage against militarism instead of sounding like escalation. |
| Earth Defense | higher is better | campaign target, score pressure, regional vulnerabilities | Keep | Works across Congo, Amazon, Mekong, and Sahel without narrowing ecology to climate jargon. |
| Carceral Breach | higher is better | campaign target, score pressure, regional vulnerabilities | Keep | Reads as breaking prison and siege systems rather than filling a cage meter. |
| Open Signal | higher is better | campaign target, score pressure, regional vulnerabilities | Keep | Keeps witness and communications politically central. |
| Food Sovereignty | higher is better | campaign target, score pressure, regional vulnerabilities | Keep | Better reflects organized provision than a hunger-only label. |
| Extraction Rupture | higher is better | campaign target, score pressure, regional vulnerabilities | Keep | Makes anti-extractive strategy legible in motion. |
| Living Memory | higher is better | campaign target, score pressure, regional vulnerabilities | Keep | Works across language, culture, and anti-erasure struggles. |

## tahrir_square

| Track | Polarity | Mechanical dependencies | Keep / prune | Narrative fit |
| --- | --- | --- | --- | --- |
| Security Rupture | higher is better | campaign target, score pressure, regional vulnerabilities | Keep | Makes progress read as breaking regime coercion. |
| Open Signal | higher is better | campaign target, score pressure, regional vulnerabilities | Keep | Fits social media, satellite TV, and citizen journalism. |
| Bread & Dignity | higher is better | campaign target, score pressure, regional vulnerabilities | Keep | Keeps labor and subsistence politics fused. |
| Popular Momentum | higher is better | campaign target, score pressure, regional vulnerabilities | Keep | Clearer than a generic revolutionary wave meter. |
| Patriarchal Rupture | higher is better | campaign target, score pressure, regional vulnerabilities | Keep | States directly what players are trying to break. |
| Justice Reckoning | higher is better | campaign target, score pressure, regional vulnerabilities | Keep | Carries transitional justice pressure without promising closure. |

## woman_life_freedom

| Track | Polarity | Mechanical dependencies | Keep / prune | Narrative fit |
| --- | --- | --- | --- | --- |
| Security Rupture | higher is better | campaign target, score pressure, regional vulnerabilities | Keep | Reads as pressure against the IRGC and Basij apparatus. |
| Land-Water Defense | higher is better | campaign target, score pressure, regional vulnerabilities | Keep | Better fits drought, rivers, and ecological struggle. |
| Carceral Breach | higher is better | campaign target, score pressure, regional vulnerabilities | Keep | Keeps prison and managed-rights violence visible. |
| Open Signal | higher is better | campaign target, score pressure, regional vulnerabilities | Keep | Matches firewall evasion and witness circulation. |
| Bread & Dignity | higher is better | campaign target, score pressure, regional vulnerabilities | Keep | Holds daily survival and strike politics together. |
| Energy Justice | higher is better | campaign target, score pressure, regional vulnerabilities | Keep | Better names anti-extractive leverage in an oil state. |
| Living Memory | higher is better | campaign target, score pressure, regional vulnerabilities | Keep | Holds memory and anti-erasure work together. |
| Patriarchal Rupture | higher is better | campaign target, score pressure, regional vulnerabilities | Keep | Central to the scenario and mechanically irreducible. |

## algerian_war_of_independence

| Track | Polarity | Mechanical dependencies | Keep / prune | Narrative fit |
| --- | --- | --- | --- | --- |
| Colonial Army Fracture | higher is better | campaign target, score pressure, regional vulnerabilities | Keep | Makes progress read as breaking colonial force projection. |
| Detention Network Broken | higher is better | campaign target, score pressure, regional vulnerabilities | Keep | Frames detention struggle in the direction players want. |
| International Witness | higher is better | campaign target, score pressure, regional vulnerabilities | Keep | Keeps testimony distinct from justice and military pressure. |
| Justice Reckoning | higher is better | campaign target, score pressure, regional vulnerabilities | Keep | Fits tribunal and acknowledgement beats without overstating them. |
| Liberation Cohesion | higher is better | campaign target, score pressure, regional vulnerabilities | Keep | Captures movement alignment under repression. |
| Settler Veto Fracture | higher is better | campaign target, score pressure, regional vulnerabilities | Keep | Explains why reactionary colonial veto power matters here. |
| Repression Cycle | higher is worse | evidence gain raises it; thresholds at `5/7/9`; liberation gate checks `<= 6` | Keep | This is real negative pressure, not clutter, and should stay visibly dangerous. |

## egypt_1919_revolution

| Track | Polarity | Mechanical dependencies | Keep / prune | Narrative fit |
| --- | --- | --- | --- | --- |
| National Uprising | higher is better | campaign target, score pressure, regional vulnerabilities | Keep | Reads more clearly than an abstract revolutionary meter. |
| Public Testimony | higher is better | campaign target, score pressure, regional vulnerabilities | Keep | Keeps speaking colonial crimes and coordination linked. |
| Strike Capacity | higher is better | campaign target, score pressure, regional vulnerabilities | Keep | Directly names labor disruption as leverage. |
| Detention Breach | higher is better | campaign target, score pressure, regional vulnerabilities | Keep | Fits detainee struggle and forced return. |
| Mass Voice | higher is better | campaign target, score pressure, regional vulnerabilities | Keep | Better captures broad representation than a theft metaphor. |
| Justice for the Fallen | higher is better | campaign target, score pressure, regional vulnerabilities | Keep | Holds grief, memory, and accountability together. |

## when_the_corridors_burn

| Track | Polarity | Mechanical dependencies | Keep / prune | Narrative fit |
| --- | --- | --- | --- | --- |
| Anti-War Fracture | higher is better | campaign target; `turkey_corridor >= 4` grants `+1` | Keep | Names anti-war gains instead of sounding like a war meter. |
| Witness Networks | higher is better | campaign target; mandates; public victory at `>= 3` | Keep | Better matches medics, archive streams, and testimony chains. |
| Communal Provision | higher is better | campaign target; mandates; `gulf_posture >= 1` grants `+1` | Keep | Replaces abstract hunger language with organized survival practice. |
| Sanctions Breach | higher is better | campaign target; `jordan_corridor >= 4` grants `+1` | Keep | Keeps Cuba and Venezuela structurally central. |
| Chokepoint Breakage | higher is better | campaign target; `gulf_posture >= 2` grants `+1` | Keep | Fits corridor labor and anti-logistics play directly. |
| Rafah Corridor Opening | higher is better | threshold at `4` gives `+1 Global Gaze`, `-1` Gaza extraction, `rafahGateOpened` | Keep | Distinct, legible, and materially tied to Gaza survival. |
| Northern Corridor Fracture | higher is better | threshold at `4` gives `Anti-War Fracture +1` and `-1` Lebanon extraction | Keep | Captures Turkey's contradictory but usable fracture role. |
| Jordan Relief Opening | higher is better | threshold at `4` gives `+1 Global Gaze` and `Sanctions Breach +1` | Keep | Pairs medical and witness pressure with a concrete opening effect. |
| Mediation Window | higher is better | threshold at `4` gives every seat `+1 Evidence` and `qatarChannelActive` | Keep | Clearer than a generic posture meter because it states what opens. |
| Gulf War Exposure | higher is worse | threshold at `4` gives `+1 Global Gaze`, `+1 War Machine`, `gulfTargetsExposed` | Keep | Shared danger remains meaningful and should stay visibly negative. |
| Gulf Distance From War | higher is better | thresholds at `1/2` give `-1` Gulf-Hormuz extraction, `Communal Provision +1`, `+1 Global Gaze`, `Chokepoint Breakage +1` | Keep | Aggregates four thin state flags into one story players can actually read and act on. |
| Saudi / UAE / Bahrain / Kuwait micro-tracks | thin positive flags | previously each fired one narrow threshold payload | Prune | They added lookup cost without sustaining distinct enough play decisions. |

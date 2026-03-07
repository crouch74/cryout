import json
import logging
import math
import os
from collections import defaultdict
from statistics import mean
from typing import Any, Dict, Iterable, List, Optional, Tuple

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware


logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def log_info(message: str) -> None:
    logger.info(f"ℹ️ {message}")


def log_success(message: str) -> None:
    logger.info(f"✅ {message}")


def log_error(message: str) -> None:
    logger.info(f"🚨 {message}")


app = FastAPI(title="Simulation Analysis API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SIM_DIR = os.getenv("SIMULATION_OUTPUT_DIR", "../../simulation_output")
SCOPE_VALUES = {
    "latest_single",
    "latest_parallel",
    "all_single",
    "all_parallel",
    "all_runs",
    "specific_run",
}
CORE_ACTIONS = [
    "organize",
    "investigate",
    "launchCampaign",
    "buildSolidarity",
    "smuggleEvidence",
    "internationalOutreach",
    "defend",
]
TARGETED_ACTIONS = {
    "buildSolidarity",
    "internationalOutreach",
    "smuggleEvidence",
    "defend",
}
ACTION_LABELS = {
    "organize": "Organize",
    "investigate": "Investigate",
    "launchCampaign": "Launch Campaign",
    "buildSolidarity": "Build Solidarity",
    "smuggleEvidence": "Smuggle Evidence",
    "internationalOutreach": "International Outreach",
    "defend": "Defend",
}


@app.on_event("startup")
async def startup_event() -> None:
    log_info(f"Dashboard API starting. Reading simulation output from: {SIM_DIR}")


def load_json(path: str, default: Any = None) -> Any:
    if not os.path.exists(path):
        return default
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def safe_mean(values: Iterable[float]) -> float:
    values_list = list(values)
    return mean(values_list) if values_list else 0.0


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def safe_ratio(numerator: float, denominator: float) -> float:
    return (numerator / denominator) if denominator else 0.0


def action_template() -> Dict[str, float]:
    return {action: 0.0 for action in CORE_ACTIONS}


def entropy_from_counts(counts: Dict[str, float]) -> float:
    total = sum(max(0.0, value) for value in counts.values())
    positive = [value for value in counts.values() if value > 0]
    if total <= 0 or len(positive) <= 1:
        return 0.0
    entropy = 0.0
    for value in positive:
        probability = value / total
        entropy -= probability * math.log2(probability)
    return clamp(entropy / math.log2(len(positive)), 0.0, 1.0)


def share_map(counts: Dict[str, float]) -> Dict[str, float]:
    total = sum(max(0.0, counts.get(action, 0.0)) for action in CORE_ACTIONS)
    return {
        action: safe_ratio(max(0.0, counts.get(action, 0.0)), total)
        for action in CORE_ACTIONS
    }


def targeted_share(counts: Dict[str, float]) -> float:
    shares = share_map(counts)
    return sum(shares[action] for action in TARGETED_ACTIONS)


def compact_run_label(label: Optional[str]) -> str:
    if not label:
        return "Run"
    compact = label.replace("Parallel ", "P ").replace("Single ", "S ")
    if len(compact) <= 24:
        return compact
    return f"{compact[:14]}...{compact[-7:]}"


def list_subdirs(path: str) -> List[str]:
    if not os.path.exists(path):
        return []
    return sorted(
        entry for entry in os.listdir(path) if os.path.isdir(os.path.join(path, entry))
    )


def latest_subdir(path: str) -> Optional[str]:
    dirs = list_subdirs(path)
    return dirs[-1] if dirs else None


def flatten_patch(patch: Dict[str, Any], prefix: str = "") -> Dict[str, Any]:
    flat: Dict[str, Any] = {}
    for key, value in patch.items():
        if key == "note":
            continue
        path = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict):
            flat.update(flatten_patch(value, path))
        else:
            flat[path] = value
    return flat


def summarize_optimizer_result(result: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not result:
        return None
    metrics = (result.get("finalMetrics") or {}).get("metrics") or {}
    return {
        "scenarioId": result.get("scenarioId"),
        "stopReason": result.get("stopReason"),
        "iterationsCompleted": result.get("iterationsCompleted", 0),
        "acceptedPatches": len(result.get("acceptedPatches") or []),
        "successRate": metrics.get("successRate", 0),
        "publicVictoryRate": metrics.get("publicVictoryRate", 0),
        "earlyTerminationRate": metrics.get("earlyTerminationRate", 0),
        "averageTurns": ((metrics.get("turns") or {}).get("average", 0)),
        "sampleSize": metrics.get("n", 0),
    }


def build_single_run_descriptor(scenario_id: str, run_id: str) -> Optional[Dict[str, Any]]:
    run_dir = os.path.join(SIM_DIR, "optimizer", scenario_id, run_id)
    result = load_json(os.path.join(run_dir, "optimizer_result.json"))
    if not result:
        return None
    config = load_json(os.path.join(run_dir, "optimizer_config.json"), default={}) or {}
    generated_at = config.get("generatedAt")
    summary = summarize_optimizer_result(result) or {}
    return {
        "runKey": f"single:{run_id}",
        "runType": "single",
        "runId": run_id,
        "parentRunId": None,
        "runDir": run_dir,
        "generatedAt": generated_at,
        "label": f"Single {run_id}",
        "result": result,
        "summary": summary,
    }


def list_single_optimizer_runs(scenario_id: str) -> List[Dict[str, Any]]:
    scenario_dir = os.path.join(SIM_DIR, "optimizer", scenario_id)
    runs: List[Dict[str, Any]] = []
    for run_id in list_subdirs(scenario_dir):
        descriptor = build_single_run_descriptor(scenario_id, run_id)
        if descriptor:
            runs.append(descriptor)
    return runs


def build_parallel_run_descriptor(
    scenario_id: str, parent_run_id: str, child_run_id: str
) -> Optional[Dict[str, Any]]:
    run_dir = os.path.join(
        SIM_DIR,
        "optimizer",
        "all_scenarios_parallel",
        parent_run_id,
        "scenarios",
        scenario_id,
        child_run_id,
    )
    result = load_json(os.path.join(run_dir, "optimizer_result.json"))
    if not result:
        return None
    config = load_json(
        os.path.join(
            SIM_DIR, "optimizer", "all_scenarios_parallel", parent_run_id, "optimizer_config.json"
        ),
        default={},
    ) or {}
    generated_at = config.get("generatedAt")
    summary = summarize_optimizer_result(result) or {}
    return {
        "runKey": f"parallel:{parent_run_id}:{child_run_id}",
        "runType": "parallel",
        "runId": child_run_id,
        "parentRunId": parent_run_id,
        "runDir": run_dir,
        "generatedAt": generated_at,
        "label": f"Parallel {parent_run_id}",
        "result": result,
        "summary": summary,
    }


def list_parallel_optimizer_runs(scenario_id: str) -> List[Dict[str, Any]]:
    base_dir = os.path.join(SIM_DIR, "optimizer", "all_scenarios_parallel")
    runs: List[Dict[str, Any]] = []
    for parent_run_id in list_subdirs(base_dir):
        scenario_dir = os.path.join(base_dir, parent_run_id, "scenarios", scenario_id)
        child_run_id = latest_subdir(scenario_dir)
        if not child_run_id:
            continue
        descriptor = build_parallel_run_descriptor(scenario_id, parent_run_id, child_run_id)
        if descriptor:
            runs.append(descriptor)
    return runs


def list_optimizer_runs_for_scenario(scenario_id: str) -> List[Dict[str, Any]]:
    runs = list_single_optimizer_runs(scenario_id) + list_parallel_optimizer_runs(scenario_id)
    runs.sort(key=lambda item: item["generatedAt"] or item["runId"] or "", reverse=True)
    return runs


def get_latest_run_of_type(scenario_id: str, run_type: str) -> Optional[Dict[str, Any]]:
    runs = [run for run in list_optimizer_runs_for_scenario(scenario_id) if run["runType"] == run_type]
    return runs[0] if runs else None


def list_all_known_scenarios(summary: Dict[str, Any]) -> List[str]:
    summary_scenarios = set((summary.get("scenarioStats") or {}).keys())
    single_optimizer_scenarios = set(
        name
        for name in list_subdirs(os.path.join(SIM_DIR, "optimizer"))
        if name != "all_scenarios_parallel"
    )
    parallel_scenarios: set[str] = set()
    parallel_root = os.path.join(SIM_DIR, "optimizer", "all_scenarios_parallel")
    for parent_run_id in list_subdirs(parallel_root):
        parallel_scenarios.update(
            list_subdirs(os.path.join(parallel_root, parent_run_id, "scenarios"))
        )

    all_scenarios = summary_scenarios | single_optimizer_scenarios | parallel_scenarios
    return sorted(all_scenarios)


def build_overview() -> Dict[str, Any]:
    summary = load_json(os.path.join(SIM_DIR, "simulation_summary.json"), default={}) or {}
    scenario_stats = summary.get("scenarioStats") or {}
    strategy_performance = summary.get("strategyPerformance") or {}
    known_scenarios = list_all_known_scenarios(summary)

    scenarios: List[Dict[str, Any]] = []
    optimizer_status: List[Dict[str, Any]] = []

    for scenario_id in known_scenarios:
        stats = scenario_stats.get(scenario_id) or {}
        runs = list_optimizer_runs_for_scenario(scenario_id)
        latest_single = next((run for run in runs if run["runType"] == "single"), None)
        latest_parallel = next((run for run in runs if run["runType"] == "parallel"), None)
        fallback_summary = (latest_single or latest_parallel or {}).get("summary") or {}

        scenarios.append(
            {
                "scenarioId": scenario_id,
                "runs": stats.get("runs", fallback_summary.get("sampleSize", 0)),
                "successRate": stats.get("successRate", fallback_summary.get("successRate", 0)),
                "averageTurns": stats.get("averageTurns", fallback_summary.get("averageTurns", 0)),
                "campaignSuccessRate": stats.get("campaignSuccessRate", 0),
                "defeatReasons": stats.get("defeatReasons", {}),
                "optimizer": {
                    "singleLatest": latest_single["summary"] if latest_single else None,
                    "parallelLatest": latest_parallel["summary"] if latest_parallel else None,
                    "singleRunCount": len([run for run in runs if run["runType"] == "single"]),
                    "parallelRunCount": len([run for run in runs if run["runType"] == "parallel"]),
                },
            }
        )

        for run in runs[:2]:
            optimizer_status.append(
                {
                    "scenarioId": scenario_id,
                    "mode": run["runType"],
                    "runId": run["runId"],
                    "parentRunId": run["parentRunId"],
                    **(run["summary"] or {}),
                }
            )

    strategies = [
        {
            "strategyId": strategy_id,
            "runs": stats.get("runs", 0),
            "successRate": stats.get("successRate", 0),
            "averageTurns": stats.get("averageTurns", 0),
            "mandateFailureRate": stats.get("mandateFailureRate", 0),
        }
        for strategy_id, stats in sorted(strategy_performance.items())
    ]

    return {
        "summary": summary,
        "scenarios": scenarios,
        "strategies": strategies,
        "optimizerStatus": optimizer_status,
    }


def metric_delta(metric_name: str, candidate: Dict[str, Any]) -> float:
    comparison = candidate.get("comparison") or {}
    metrics = comparison.get("metrics") or {}
    return ((metrics.get(metric_name) or {}).get("absoluteLift", 0))


def summarize_candidate(candidate: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not candidate:
        return None
    metrics = candidate.get("metrics") or {}
    flattened_patch = flatten_patch(candidate.get("patch") or {})
    return {
        "candidateId": candidate.get("candidateId"),
        "strategy": candidate.get("strategy"),
        "score": ((candidate.get("scoreBreakdown") or {}).get("score", 0)),
        "scoreDeltaFromBaseline": candidate.get("scoreDeltaFromBaseline", 0),
        "successLift": metric_delta("successRate", candidate),
        "publicVictoryLift": metric_delta("publicVictoryRate", candidate),
        "avgTurnsDelta": metric_delta("avgTurns", candidate),
        "earlyTerminationDelta": metric_delta("defeat_sudden_death", candidate),
        "successRate": metrics.get("successRate", 0),
        "publicVictoryRate": metrics.get("publicVictoryRate", 0),
        "averageTurns": ((metrics.get("turns") or {}).get("average", 0)),
        "earlyTerminationRate": metrics.get("earlyTerminationRate", 0),
        "defeatRates": metrics.get("defeatRates", {}),
        "patch": candidate.get("patch") or {},
        "flattenedPatch": flattened_patch,
        "parameters": [
            {"parameter": key, "value": value}
            for key, value in sorted(flattened_patch.items())
        ],
        "gate": candidate.get("gate") or {},
        "comparison": candidate.get("comparison") or {},
    }


def build_target_distances(iterations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for item in iterations:
        targets = ((item.get("baselineScore") or {}).get("targets") or {})
        label = item.get("iterationLabel") or f"I{item.get('iteration')}"
        rows.append(
            {
                "iteration": item.get("iteration"),
                "label": label,
                "runLabel": item.get("runLabel"),
                "winRateDistance": ((targets.get("winRate") or {}).get("distanceFromRange", 0)),
                "avgRoundsDistance": ((targets.get("avgRounds") or {}).get("distanceFromRange", 0)),
                "earlyLossDistance": ((targets.get("earlyLossRate") or {}).get("distanceFromRange", 0)),
                "lateGameDistance": ((targets.get("lateGameRate") or {}).get("distanceFromRange", 0)),
            }
        )
    return rows


def build_parameter_impact(iterations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    aggregates: Dict[str, Dict[str, Any]] = {}

    for iteration in iterations:
        selected_candidate_id = ((iteration.get("selectedCandidate") or {}).get("candidateId"))
        accepted_candidate_id = ((iteration.get("acceptedCandidate") or {}).get("candidateId"))
        for ranking in iteration.get("rankings") or []:
            patch = flatten_patch(ranking.get("patch") or {})
            for key, value in patch.items():
                bucket = aggregates.setdefault(
                    key,
                    {
                        "parameter": key,
                        "count": 0,
                        "selectedCount": 0,
                        "acceptedCount": 0,
                        "avgSuccessLift": 0.0,
                        "avgPublicVictoryLift": 0.0,
                        "avgTurnsDelta": 0.0,
                        "avgFitnessDelta": 0.0,
                        "bestFitnessDelta": float("-inf"),
                        "values": defaultdict(int),
                    },
                )
                bucket["count"] += 1
                bucket["avgSuccessLift"] += metric_delta("successRate", ranking)
                bucket["avgPublicVictoryLift"] += metric_delta("publicVictoryRate", ranking)
                bucket["avgTurnsDelta"] += metric_delta("avgTurns", ranking)
                bucket["avgFitnessDelta"] += ranking.get("scoreDeltaFromBaseline", 0)
                bucket["bestFitnessDelta"] = max(
                    bucket["bestFitnessDelta"], ranking.get("scoreDeltaFromBaseline", 0)
                )
                bucket["values"][str(value)] += 1
                if ranking.get("candidateId") == selected_candidate_id:
                    bucket["selectedCount"] += 1
                if ranking.get("candidateId") == accepted_candidate_id:
                    bucket["acceptedCount"] += 1

    rows: List[Dict[str, Any]] = []
    for item in aggregates.values():
        count = item["count"] or 1
        rows.append(
            {
                "parameter": item["parameter"],
                "count": item["count"],
                "selectedCount": item["selectedCount"],
                "acceptedCount": item["acceptedCount"],
                "avgSuccessLift": item["avgSuccessLift"] / count,
                "avgPublicVictoryLift": item["avgPublicVictoryLift"] / count,
                "avgTurnsDelta": item["avgTurnsDelta"] / count,
                "avgFitnessDelta": item["avgFitnessDelta"] / count,
                "bestFitnessDelta": item["bestFitnessDelta"] if item["bestFitnessDelta"] != float("-inf") else 0,
                "topValues": [
                    {"value": value, "count": freq}
                    for value, freq in sorted(
                        item["values"].items(), key=lambda pair: (-pair[1], pair[0])
                    )[:4]
                ],
            }
        )
    rows.sort(key=lambda row: abs(row["avgFitnessDelta"]), reverse=True)
    return rows


def build_candidate_cloud(iterations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    points: List[Dict[str, Any]] = []
    for iteration in iterations:
        for ranking in (iteration.get("rankings") or [])[:20]:
            patch = flatten_patch(ranking.get("patch") or {})
            points.append(
                {
                    "iteration": iteration.get("iteration"),
                    "label": iteration.get("iterationLabel"),
                    "runLabel": iteration.get("runLabel"),
                    "candidateId": ranking.get("candidateId"),
                    "strategy": ranking.get("strategy"),
                    "fitness": ((ranking.get("scoreBreakdown") or {}).get("score", 0)),
                    "fitnessDelta": ranking.get("scoreDeltaFromBaseline", 0),
                    "successLift": metric_delta("successRate", ranking),
                    "publicVictoryLift": metric_delta("publicVictoryRate", ranking),
                    "avgTurnsDelta": metric_delta("avgTurns", ranking),
                    "parameterCount": len(patch),
                }
            )
    return points


def build_generation_progress(run: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    progress: List[Dict[str, Any]] = []
    genome_rows: List[Dict[str, Any]] = []
    run_dir = run["runDir"]
    run_label = run["label"]
    short_label = run["parentRunId"] or run["runId"]
    for iteration_dir in list_subdirs(run_dir):
        if not iteration_dir.startswith("iteration_"):
            continue
        iteration_number = int(iteration_dir.split("_")[-1])
        report = load_json(os.path.join(run_dir, iteration_dir, "ga_search_report.json"), default={}) or {}
        for generation in report.get("generationReports") or []:
            generation_label = f"{short_label} · G{generation.get('generation')}"
            stats = generation.get("stats") or {}
            progress.append(
                {
                    "iteration": iteration_number,
                    "generation": generation.get("generation"),
                    "label": generation_label,
                    "runLabel": run_label,
                    "bestFitness": stats.get("bestFitness", 0),
                    "meanFitness": stats.get("meanFitness", 0),
                    "medianFitness": stats.get("medianFitness", 0),
                    "worstFitness": stats.get("worstFitness", 0),
                }
            )
            genome_rows.append(
                {
                    "iteration": iteration_number,
                    "generation": generation.get("generation"),
                    "label": generation_label,
                    "runLabel": run_label,
                    **(generation.get("bestGenome") or {}),
                }
            )
    return progress, genome_rows


def action_deltas_for_snapshots(round_snapshots: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    previous = action_template()
    deltas: List[Dict[str, Any]] = []
    for snapshot in sorted(round_snapshots, key=lambda item: int(item.get("round") or 0)):
        current = snapshot.get("actions") or {}
        row = {"round": int(snapshot.get("round") or 0)}
        for action in CORE_ACTIONS:
            delta = max(0.0, float(current.get(action, 0) or 0) - previous[action])
            row[action] = delta
            previous[action] = float(current.get(action, 0) or 0)
        deltas.append(row)
    return deltas


def infer_action_opportunities(snapshot: Dict[str, Any], player_count: int) -> Dict[str, bool]:
    fronts = snapshot.get("fronts") or {}
    resources = snapshot.get("resources") or {}
    tracks = snapshot.get("globalTracks") or {}
    domains = snapshot.get("domains") or {}
    highest_extraction = max(
        ((front or {}).get("extraction", 0) or 0)
        for front in fronts.values()
    ) if fronts else 0
    total_comrades = resources.get("totalComrades", 0) or 0
    total_evidence = resources.get("totalEvidence", 0) or 0
    global_gaze = tracks.get("globalGaze", 0) or 0
    war_machine = tracks.get("warMachine", 0) or 0
    silenced_truth = domains.get("SilencedTruth", 0) or 0

    return {
        "organize": total_comrades <= max(6, player_count * 3) or highest_extraction >= 4,
        "investigate": silenced_truth >= 4 or total_evidence <= max(2, player_count),
        "launchCampaign": global_gaze >= 8 and total_comrades >= max(4, player_count * 2),
        "buildSolidarity": total_comrades <= max(7, player_count * 3) or war_machine >= 7,
        "smuggleEvidence": total_evidence >= max(2, player_count - 1) and silenced_truth >= 3,
        "internationalOutreach": global_gaze <= 8 or war_machine >= 8,
        "defend": highest_extraction >= 4 or war_machine >= 7,
    }


def build_action_recommendations(
    scenario_id: str,
    trajectory: Dict[str, Any],
    scenario_summary: Optional[Dict[str, Any]],
    selected_runs: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    action_share = (trajectory.get("actionDiversity") or {}).get("actionShare") or {}
    defeat_rows = trajectory.get("defeatReasons") or []
    dominant_defeat = defeat_rows[0]["reason"] if defeat_rows else "unknown"
    early_collapse = any(
        "early" in (item.get("pattern") or "").lower() for item in (trajectory.get("trajectoryToTuning") or [])
    ) or ((scenario_summary or {}).get("averageTurns", 0) or 0) < 6
    global_gaze_tail = (trajectory.get("trackPressure") or [{}])[-1].get("globalGaze", 0)
    underused = sorted(
        (
            {
                "action": action,
                "share": action_share.get(action, 0),
            }
            for action in TARGETED_ACTIONS
        ),
        key=lambda item: item["share"],
    )
    recommendations: List[Dict[str, Any]] = []

    def append(action: str, lever: str, rationale: str, patch_hypothesis: str, risk: str) -> None:
        current_share = action_share.get(action, 0)
        recommendations.append(
            {
                "action": action,
                "label": ACTION_LABELS.get(action, action),
                "currentShare": current_share,
                "targetShare": current_share * 1.25 if current_share > 0 else 0.05,
                "lever": lever,
                "rationale": rationale,
                "patchHypothesis": patch_hypothesis,
                "risk": risk,
            }
        )

    if (underused and underused[0]["action"] == "buildSolidarity") or early_collapse:
        append(
            "buildSolidarity",
            "Opening resilience",
            "Early collapse and comrades pressure indicate solidarity setup is not carrying enough survival value.",
            "Raise the payoff of early solidarity by tying low-solidarity openings to higher collapse risk or by improving later campaign readiness when solidarity is built.",
            "Over-buffing solidarity can slow pacing and reduce tension if it becomes a mandatory opener.",
        )
    if dominant_defeat in {"extraction_breach", "sudden_death", "comrades_exhausted"} or action_share.get("defend", 0) < 0.08:
        append(
            "defend",
            "Pressure spikes",
            "Failure paths show pressure resolving faster than defensive responses, so defend is rarely the stabilizing best move.",
            "Increase extraction or war-machine consequences when defense is ignored, and add scenario states where defend prevents terminal cascades.",
            "Too much defensive value can create stall loops and flatten offensive decision pressure.",
        )
    if global_gaze_tail <= 8 or action_share.get("internationalOutreach", 0) < 0.08:
        append(
            "internationalOutreach",
            "Gaze dependency",
            "International attention is not exerting enough structural force, so outreach is optional rather than enabling.",
            "Tie low Global Gaze to harsher campaign thresholds, extraction acceleration, or mandate fragility so outreach becomes a setup action.",
            "If gaze pressure becomes too central, campaigns can feel scripted around a single preparatory loop.",
        )
    if dominant_defeat == "mandate_failure" or action_share.get("smuggleEvidence", 0) < 0.08:
        append(
            "smuggleEvidence",
            "Evidence bottlenecks",
            "Mandate and proof-related outcomes imply evidence handling is not converting into enough board-level leverage.",
            "Increase mandate progress, pressure relief, or scoring value unlocked by smuggled evidence so it matters before the endgame.",
            "Evidence-heavy wins can become too deterministic if proof conversion is overtuned.",
        )
    if action_share.get("launchCampaign", 0) > 0.28:
        append(
            "launchCampaign",
            "Setup gating",
            "Campaign is absorbing too much of the action economy, which suggests it is too universally correct without prior preparation.",
            "Gate strong campaign outcomes behind prior solidarity, gaze, or evidence conditions so campaign becomes a payoff action rather than the default loop.",
            "Over-gating campaign can make victories unreachable if supporting actions are not strengthened in the same patch set.",
        )
    if action_share.get("investigate", 0) > 0.22:
        append(
            "investigate",
            "Narrow generic utility",
            "Investigate appears to be a safe filler action across too many states instead of a context-specific tool.",
            "Shift some investigative payoff into scenarios with high Silenced Truth or evidence scarcity, and reduce generic baseline value outside those states.",
            "If investigate becomes too weak, evidence-starved scenarios may lose strategic recovery options.",
        )

    if not recommendations:
        append(
            "buildSolidarity",
            "Baseline resilience",
            "No single action is severely suppressed, but targeted actions still need more visibility in successful paths.",
            "Create small scenario hooks that reward solidarity, outreach, defense, or evidence play before campaign payoffs resolve.",
            "Too many small incentives can muddy scenario identity if they are not tied to existing structural pressures.",
        )

    return recommendations[:5]


def build_trajectory_analytics(scenario_id: str) -> Dict[str, Any]:
    ndjson_path = os.path.join(SIM_DIR, "simulations.ndjson")
    if not os.path.exists(ndjson_path):
        return {
            "totalRuns": 0,
            "outcomeMix": [],
            "turnHistogram": [],
            "defeatReasons": [],
            "playerCounts": [],
            "actionMix": [],
            "actionShareByRound": [],
            "actionTimingByOutcome": [],
            "actionMixByPlayerCount": [],
            "actionOpportunity": [],
            "actionDiversity": {},
            "trajectoryToTuning": [],
            "domainPressure": [],
            "trackPressure": [],
            "frontPressure": [],
        }

    total_runs = 0
    outcome_counts = defaultdict(int)
    turn_histogram = defaultdict(int)
    defeat_reasons = defaultdict(int)
    player_counts: Dict[int, Dict[str, Any]] = {}
    action_sums: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))
    action_denominators = defaultdict(int)
    overall_action_totals = action_template()
    action_share_by_round_counts: Dict[Tuple[int, str, int], Dict[str, float]] = defaultdict(action_template)
    action_share_by_round_totals = defaultdict(float)
    action_share_by_round_samples = defaultdict(int)
    timing_totals = {
        "victory": action_template(),
        "defeat": action_template(),
    }
    timing_denominators = {"victory": 0, "defeat": 0}
    action_mix_by_player_count: Dict[int, Dict[str, float]] = defaultdict(action_template)
    action_mix_by_player_count_totals = defaultdict(float)
    opportunity_counts = action_template()
    selection_counts = action_template()
    opportunity_samples = 0
    round_domain_sums: Dict[int, Dict[str, float]] = defaultdict(lambda: defaultdict(float))
    round_track_sums: Dict[int, Dict[str, float]] = defaultdict(lambda: defaultdict(float))
    round_counts = defaultdict(int)
    front_sums: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))
    tuning_rows: List[Dict[str, Any]] = []

    with open(ndjson_path, "r", encoding="utf-8") as handle:
        for line in handle:
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue

            if record.get("scenario") != scenario_id:
                continue

            total_runs += 1
            result_type = ((record.get("result") or {}).get("type") or "unknown")
            turns_played = int(record.get("turnsPlayed") or 0)
            outcome_counts[result_type] += 1
            turn_histogram[(turns_played, result_type)] += 1

            if result_type == "defeat":
                defeat_reasons[((record.get("result") or {}).get("reason") or "unknown")] += 1

            player_count = int(record.get("playerCount") or 0)
            player_bucket = player_counts.setdefault(
                player_count,
                {
                    "playerCount": player_count,
                    "runs": 0,
                    "successes": 0,
                    "turns": [],
                    "defeatReasons": defaultdict(int),
                },
            )
            player_bucket["runs"] += 1
            player_bucket["successes"] += 1 if result_type == "victory" else 0
            player_bucket["turns"].append(turns_played)
            if result_type == "defeat":
                player_bucket["defeatReasons"][((record.get("result") or {}).get("reason") or "unknown")] += 1

            action_counts = record.get("actionCounts") or {}
            action_denominators[result_type] += 1
            for action, count in action_counts.items():
                action_sums[result_type][action] += count
                if action in overall_action_totals:
                    overall_action_totals[action] += count

            per_player_bucket = action_mix_by_player_count[player_count]
            player_action_total = 0.0
            for action in CORE_ACTIONS:
                count = float(action_counts.get(action, 0) or 0)
                per_player_bucket[action] += count
                player_action_total += count
            action_mix_by_player_count_totals[player_count] += player_action_total

            action_deltas = action_deltas_for_snapshots(record.get("roundSnapshots") or [])
            if action_deltas:
                terminal_window = action_deltas[-3:]
                timing_denominators[result_type] += 1
                for item in terminal_window:
                    for action in CORE_ACTIONS:
                        timing_totals[result_type][action] += item.get(action, 0) or 0

            for snapshot, delta_row in zip(record.get("roundSnapshots") or [], action_deltas):
                round_number = int(delta_row.get("round") or 0)
                round_key = (round_number, result_type, player_count)
                round_total = 0.0
                for action in CORE_ACTIONS:
                    amount = float(delta_row.get(action, 0) or 0)
                    action_share_by_round_counts[round_key][action] += amount
                    round_total += amount
                    selection_counts[action] += amount
                action_share_by_round_totals[round_key] += round_total
                action_share_by_round_samples[round_key] += 1

                opportunities = infer_action_opportunities(snapshot, player_count)
                opportunity_samples += 1
                for action, available in opportunities.items():
                    if available:
                        opportunity_counts[action] += 1

            for snapshot in record.get("roundSnapshots") or []:
                round_number = int(snapshot.get("round") or 0)
                round_counts[round_number] += 1
                for domain, value in (snapshot.get("domains") or {}).items():
                    round_domain_sums[round_number][domain] += value or 0
                tracks = snapshot.get("globalTracks") or {}
                round_track_sums[round_number]["globalGaze"] += tracks.get("globalGaze", 0)
                round_track_sums[round_number]["warMachine"] += tracks.get("warMachine", 0)
                for front, values in (snapshot.get("fronts") or {}).items():
                    front_sums[front]["extraction"] += (values or {}).get("extraction", 0)
                    front_sums[front]["comrades"] += (values or {}).get("comradesTotal", 0)
                    front_sums[front]["samples"] += 1

    player_rows = []
    for player_count, bucket in sorted(player_counts.items()):
        defeat_items = sorted(bucket["defeatReasons"].items(), key=lambda pair: (-pair[1], pair[0]))
        player_rows.append(
            {
                "playerCount": player_count,
                "runs": bucket["runs"],
                "successRate": bucket["successes"] / bucket["runs"] if bucket["runs"] else 0,
                "averageTurns": safe_mean(bucket["turns"]),
                "dominantDefeatReason": defeat_items[0][0] if defeat_items else None,
            }
        )

    action_rows = []
    action_names = sorted(set(action for result in action_sums.values() for action in result.keys()))
    for action in action_names:
        victory_avg = action_sums["victory"].get(action, 0) / action_denominators["victory"] if action_denominators["victory"] else 0
        defeat_avg = action_sums["defeat"].get(action, 0) / action_denominators["defeat"] if action_denominators["defeat"] else 0
        total_action_usage = (action_sums["victory"].get(action, 0) + action_sums["defeat"].get(action, 0))
        total_action_pool = (
            sum(action_sums["victory"].values()) + sum(action_sums["defeat"].values())
        )
        action_rows.append(
            {
                "action": action,
                "label": ACTION_LABELS.get(action, action),
                "victory": victory_avg,
                "defeat": defeat_avg,
                "share": safe_ratio(total_action_usage, total_action_pool),
            }
        )
    action_rows.sort(key=lambda row: row["share"], reverse=True)

    action_round_rows = []
    for (round_number, outcome, player_count), counts in sorted(
        action_share_by_round_counts.items(),
        key=lambda item: (item[0][0], item[0][1], item[0][2]),
    ):
        total = action_share_by_round_totals[(round_number, outcome, player_count)] or 1
        row: Dict[str, Any] = {
            "round": round_number,
            "outcome": outcome,
            "playerCount": player_count,
            "sampleCount": action_share_by_round_samples[(round_number, outcome, player_count)],
        }
        for action in CORE_ACTIONS:
            row[action] = counts[action] / total
        action_round_rows.append(row)

    timing_rows = []
    for action in CORE_ACTIONS:
        victory_total = sum(timing_totals["victory"].values()) or 1
        defeat_total = sum(timing_totals["defeat"].values()) or 1
        timing_rows.append(
            {
                "action": action,
                "label": ACTION_LABELS.get(action, action),
                "victory": timing_totals["victory"][action] / victory_total,
                "defeat": timing_totals["defeat"][action] / defeat_total,
            }
        )
    timing_rows.sort(key=lambda row: max(row["victory"], row["defeat"]), reverse=True)

    player_action_rows = []
    for player_count, counts in sorted(action_mix_by_player_count.items()):
        total = action_mix_by_player_count_totals[player_count] or 1
        row: Dict[str, Any] = {
            "playerCount": player_count,
            "label": f"{player_count}P",
        }
        for action in CORE_ACTIONS:
            row[action] = counts[action] / total
        player_action_rows.append(row)

    overall_shares = share_map(overall_action_totals)
    overall_entropy = entropy_from_counts(overall_action_totals)
    dominant_action = max(CORE_ACTIONS, key=lambda action: overall_shares[action], default=None)
    opportunity_rows = []
    selection_total = sum(selection_counts.values()) or 1
    for action in CORE_ACTIONS:
        opportunity_rows.append(
            {
                "action": action,
                "label": ACTION_LABELS.get(action, action),
                "opportunityRate": safe_ratio(opportunity_counts[action], opportunity_samples),
                "selectionRate": safe_ratio(selection_counts[action], selection_total),
            }
        )

    if defeat_reasons:
        reason = sorted(defeat_reasons.items(), key=lambda pair: (-pair[1], pair[0]))[0][0]
        missing_action = min(
            TARGETED_ACTIONS,
            key=lambda action: overall_shares.get(action, 0),
        )
        tuning_rows.append(
            {
                "pattern": f"{reason.replace('_', ' ').title()} collapse path",
                "missingAction": ACTION_LABELS.get(missing_action, missing_action),
                "likelyLever": (
                    "Raise defensive value before pressure spikes"
                    if reason in {"extraction_breach", "sudden_death"}
                    else "Increase evidence or mandate support"
                ),
                "candidatePatch": (
                    "Increase defend urgency around high-extraction fronts"
                    if reason in {"extraction_breach", "sudden_death"}
                    else "Bind evidence handling more tightly to mandate progress"
                ),
            }
        )
    if action_rows:
        dominant = action_rows[0]
        if dominant["action"] in {"launchCampaign", "investigate"}:
            tuning_rows.append(
                {
                    "pattern": f"{dominant['label']} dominates both wins and losses",
                    "missingAction": "Preparation actions",
                    "likelyLever": "Gate payoff behind setup",
                    "candidatePatch": f"Reduce generic {dominant['label'].lower()} value unless solidarity, gaze, or evidence are already established",
                }
            )
    if (player_rows and any(row["successRate"] < 0.25 for row in player_rows)):
        weakest = sorted(player_rows, key=lambda row: row["successRate"])[0]
        tuning_rows.append(
            {
                "pattern": f"{weakest['playerCount']}P stress pocket",
                "missingAction": "Resilience actions",
                "likelyLever": "Player-count-sensitive setup support",
                "candidatePatch": "Increase defend/build solidarity payoff in low-success player-count buckets",
            }
        )

    domain_rows = []
    track_rows = []
    for round_number in sorted(round_counts):
        samples = round_counts[round_number] or 1
        domain_row = {"round": round_number}
        for domain, value in round_domain_sums[round_number].items():
            domain_row[domain] = value / samples
        domain_rows.append(domain_row)
        track_rows.append(
            {
                "round": round_number,
                "globalGaze": round_track_sums[round_number]["globalGaze"] / samples,
                "warMachine": round_track_sums[round_number]["warMachine"] / samples,
            }
        )

    front_rows = []
    for front, values in front_sums.items():
        samples = values["samples"] or 1
        front_rows.append(
            {
                "front": front,
                "averageExtraction": values["extraction"] / samples,
                "averageComrades": values["comrades"] / samples,
            }
        )
    front_rows.sort(key=lambda row: row["averageExtraction"], reverse=True)

    return {
        "totalRuns": total_runs,
        "outcomeMix": [{"result": result, "count": count} for result, count in sorted(outcome_counts.items(), key=lambda pair: pair[0])],
        "turnHistogram": [{"turns": turns, "result": result, "count": count} for (turns, result), count in sorted(turn_histogram.items(), key=lambda pair: (pair[0][0], pair[0][1]))],
        "defeatReasons": [{"reason": reason, "count": count} for reason, count in sorted(defeat_reasons.items(), key=lambda pair: (-pair[1], pair[0]))],
        "playerCounts": player_rows,
        "actionMix": action_rows,
        "actionShareByRound": action_round_rows,
        "actionTimingByOutcome": timing_rows,
        "actionMixByPlayerCount": player_action_rows,
        "actionOpportunity": opportunity_rows,
        "actionDiversity": {
            "entropy": overall_entropy,
            "concentration": max(overall_shares.values(), default=0),
            "dominantAction": dominant_action,
            "targetedShare": sum(overall_shares[action] for action in TARGETED_ACTIONS),
            "actionShare": overall_shares,
        },
        "trajectoryToTuning": tuning_rows,
        "domainPressure": domain_rows,
        "trackPressure": track_rows,
        "frontPressure": front_rows[:8],
    }


def aggregate_final_metrics(runs: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not runs:
        return {"metrics": {"byPlayerCount": {}, "actionBalance": None}, "score": None}

    total_weight = 0
    success_sum = public_sum = early_term_sum = turns_sum = 0.0
    accepted_patches = 0
    by_player_count: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))
    action_totals = action_template()
    action_counts = action_template()
    action_outcome_totals = {
        "victory": action_template(),
        "defeat": action_template(),
    }
    action_outcome_weights = {"victory": 0.0, "defeat": 0.0}

    for run in runs:
        final_metrics = (run["result"].get("finalMetrics") or {}).get("metrics") or {}
        weight = final_metrics.get("n", 0) or 1
        total_weight += weight
        success_sum += final_metrics.get("successRate", 0) * weight
        public_sum += final_metrics.get("publicVictoryRate", 0) * weight
        early_term_sum += final_metrics.get("earlyTerminationRate", 0) * weight
        turns_sum += ((final_metrics.get("turns") or {}).get("average", 0)) * weight
        accepted_patches += len(run["result"].get("acceptedPatches") or [])
        action_balance = final_metrics.get("actionBalance") or {}
        for action, share in (action_balance.get("actionShare") or {}).items():
            if action in action_totals:
                action_totals[action] += (share or 0) * weight
        for action, avg_count in (action_balance.get("actionAverageCounts") or {}).items():
            if action in action_counts:
                action_counts[action] += (avg_count or 0) * weight
        for outcome in ("victory", "defeat"):
            action_outcome_weights[outcome] += weight
            for action, share in ((action_balance.get("actionShareByOutcome") or {}).get(outcome) or {}).items():
                if action in action_outcome_totals[outcome]:
                    action_outcome_totals[outcome][action] += (share or 0) * weight

        for key, bucket in (final_metrics.get("byPlayerCount") or {}).items():
            bucket_weight = bucket.get("n", 0) or 1
            row = by_player_count[key]
            row["playerCount"] = bucket.get("playerCount", int(key))
            row["n"] += bucket_weight
            row["successRate"] += bucket.get("successRate", 0) * bucket_weight
            row["publicVictoryRate"] += bucket.get("publicVictoryRate", 0) * bucket_weight
            row["earlyTerminationRate"] += bucket.get("earlyTerminationRate", 0) * bucket_weight
            row["averageTurns"] += ((bucket.get("turns") or {}).get("average", 0)) * bucket_weight
            defeat_rates = bucket.get("defeatRates") or {}
            for defeat_key, defeat_value in defeat_rates.items():
                row[f"defeat_{defeat_key}"] += defeat_value * bucket_weight

    normalized_player_counts = {}
    for key, row in by_player_count.items():
        n = row["n"] or 1
        normalized_player_counts[key] = {
            "playerCount": int(row["playerCount"]),
            "n": int(row["n"]),
            "successRate": row["successRate"] / n,
            "publicVictoryRate": row["publicVictoryRate"] / n,
            "earlyTerminationRate": row["earlyTerminationRate"] / n,
            "turns": {"average": row["averageTurns"] / n},
            "defeatRates": {
                defeat_key.replace("defeat_", ""): value / n
                for defeat_key, value in row.items()
                if defeat_key.startswith("defeat_")
            },
        }

    total_weight = total_weight or 1
    normalized_action_share = {
        action: action_totals[action] / total_weight for action in CORE_ACTIONS
    }
    normalized_action_counts = {
        action: action_counts[action] / total_weight for action in CORE_ACTIONS
    }
    normalized_action_outcomes = {
        outcome: {
            action: safe_ratio(action_outcome_totals[outcome][action], action_outcome_weights[outcome] or total_weight)
            for action in CORE_ACTIONS
        }
        for outcome in ("victory", "defeat")
    }
    dominant_action = max(
        CORE_ACTIONS,
        key=lambda action: normalized_action_share[action],
        default=None,
    )
    return {
        "metrics": {
            "n": total_weight,
            "successRate": success_sum / total_weight,
            "publicVictoryRate": public_sum / total_weight,
            "earlyTerminationRate": early_term_sum / total_weight,
            "turns": {"average": turns_sum / total_weight},
            "actionBalance": {
                "entropy": entropy_from_counts(normalized_action_share),
                "concentration": max(normalized_action_share.values(), default=0),
                "dominantAction": dominant_action,
                "targetedShare": sum(normalized_action_share[action] for action in TARGETED_ACTIONS),
                "winningTargetedShare": sum(normalized_action_outcomes["victory"][action] for action in TARGETED_ACTIONS),
                "actionShare": normalized_action_share,
                "actionAverageCounts": normalized_action_counts,
                "actionShareByOutcome": normalized_action_outcomes,
                "actionShareByPlayerCount": {},
            },
            "byPlayerCount": normalized_player_counts,
        },
        "acceptedPatches": accepted_patches,
    }


def normalize_history_for_run(run: Dict[str, Any]) -> List[Dict[str, Any]]:
    result = run["result"]
    history = result.get("history") or load_json(os.path.join(run["runDir"], "optimization_history.json"), default=[]) or []
    short_label = run["parentRunId"] or run["runId"]
    run_label = run["label"]

    normalized = []
    for item in history:
        normalized.append(
            {
                **item,
                "runKey": run["runKey"],
                "runId": run["runId"],
                "runType": run["runType"],
                "runLabel": run_label,
                "iterationLabel": f"{short_label} · I{item.get('iteration')}",
            }
        )
    return normalized


def select_runs_for_scope(
    scenario_id: str, scope: str, run_key: Optional[str]
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    all_runs = list_optimizer_runs_for_scenario(scenario_id)
    if scope not in SCOPE_VALUES:
        raise HTTPException(status_code=400, detail="Invalid scope")

    if scope == "specific_run":
        if not run_key:
            raise HTTPException(status_code=400, detail="runKey is required for specific_run scope")
        selected = [run for run in all_runs if run["runKey"] == run_key]
        if not selected:
            raise HTTPException(status_code=404, detail="Requested run not found")
        return selected, {"scope": scope, "label": selected[0]["label"], "runKey": run_key}

    if scope == "latest_single":
        run = next((item for item in all_runs if item["runType"] == "single"), None)
        return ([run] if run else []), {"scope": scope, "label": run["label"] if run else "No single runs"}

    if scope == "latest_parallel":
        run = next((item for item in all_runs if item["runType"] == "parallel"), None)
        return ([run] if run else []), {"scope": scope, "label": run["label"] if run else "No parallel runs"}

    if scope == "all_single":
        selected = [item for item in all_runs if item["runType"] == "single"]
        return selected, {"scope": scope, "label": f"{len(selected)} single runs"}

    if scope == "all_parallel":
        selected = [item for item in all_runs if item["runType"] == "parallel"]
        return selected, {"scope": scope, "label": f"{len(selected)} parallel runs"}

    return all_runs, {"scope": scope, "label": f"{len(all_runs)} total runs"}


def build_run_catalog(scenario_id: str) -> List[Dict[str, Any]]:
    catalog = []
    for run in list_optimizer_runs_for_scenario(scenario_id):
        catalog.append(
            {
                "runKey": run["runKey"],
                "runType": run["runType"],
                "runId": run["runId"],
                "parentRunId": run["parentRunId"],
                "generatedAt": run["generatedAt"],
                "label": run["label"],
                "summary": run["summary"],
            }
        )
    return catalog


def build_recommended_config(run: Dict[str, Any]) -> Dict[str, Any]:
    result = run["result"]
    optimizer_config = load_json(os.path.join(run["runDir"], "optimizer_config.json"), default={}) or {}
    recommended_patch = result.get("recommendedPatch") or {}
    final_metrics = (result.get("finalMetrics") or {}).get("metrics") or {}
    flattened_patch = flatten_patch(recommended_patch)
    return {
        "runKey": run["runKey"],
        "label": run["label"],
        "compactLabel": compact_run_label(run["label"]),
        "runType": run["runType"],
        "generatedAt": run["generatedAt"],
        "stopReason": result.get("stopReason"),
        "iterationsCompleted": result.get("iterationsCompleted", 0),
        "recommendedPatch": recommended_patch,
        "flattenedPatch": flattened_patch,
        "acceptedPatches": result.get("acceptedPatches") or [],
        "optimizerConfig": {
            "runtime": optimizer_config.get("runtime"),
            "searchMode": optimizer_config.get("searchMode"),
            "strategy": optimizer_config.get("strategy"),
            "significance": optimizer_config.get("significance"),
            "baselineRuns": optimizer_config.get("baselineRuns"),
            "candidateRuns": optimizer_config.get("candidateRuns"),
            "candidates": optimizer_config.get("candidates"),
            "playerCounts": optimizer_config.get("playerCounts"),
            "victoryModes": optimizer_config.get("victoryModes"),
        },
        "finalMetrics": {
            "successRate": final_metrics.get("successRate", 0),
            "publicVictoryRate": final_metrics.get("publicVictoryRate", 0),
            "earlyTerminationRate": final_metrics.get("earlyTerminationRate", 0),
            "averageTurns": ((final_metrics.get("turns") or {}).get("average", 0)),
            "defeatRates": final_metrics.get("defeatRates", {}),
            "actionBalance": final_metrics.get("actionBalance"),
        },
    }


def action_balance_for_run(run: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    final_metrics = (run["result"].get("finalMetrics") or {}).get("metrics") or {}
    return final_metrics.get("actionBalance")


def build_action_run_diagnostics(
    selected_runs: List[Dict[str, Any]],
    all_runs: List[Dict[str, Any]],
    fallback_trajectory: Dict[str, Any],
) -> List[Dict[str, Any]]:
    baseline_run = next((run for run in reversed(all_runs) if action_balance_for_run(run)), None)
    baseline_share = (
        ((action_balance_for_run(baseline_run) or {}).get("actionShare"))
        if baseline_run
        else ((fallback_trajectory.get("actionDiversity") or {}).get("actionShare") or {})
    )
    rows = []
    for run in selected_runs:
        action_balance = action_balance_for_run(run)
        if not action_balance:
            continue
        action_share = action_balance.get("actionShare") or {}
        underused_lift = safe_mean(
            [
                safe_ratio(
                    action_share.get(action, 0) - baseline_share.get(action, 0),
                    baseline_share.get(action, 0) or 1,
                )
                for action in TARGETED_ACTIONS
            ]
        )
        rows.append(
            {
                "runKey": run["runKey"],
                "label": run["label"],
                "compactLabel": compact_run_label(run["label"]),
                "actionEntropy": action_balance.get("entropy", 0),
                "actionConcentration": action_balance.get("concentration", 0),
                "targetedShare": action_balance.get("targetedShare", 0),
                "winningTargetedShare": action_balance.get("winningTargetedShare", 0),
                "dominantAction": action_balance.get("dominantAction"),
                "dominantLabel": ACTION_LABELS.get(action_balance.get("dominantAction"), "n/a"),
                "underusedActionLift": underused_lift,
            }
        )
    return rows


def build_action_mix_delta(
    selected_runs: List[Dict[str, Any]],
    all_runs: List[Dict[str, Any]],
    trajectory: Dict[str, Any],
) -> List[Dict[str, Any]]:
    selected_balance = None
    if len(selected_runs) == 1:
        selected_balance = action_balance_for_run(selected_runs[0])
    elif selected_runs:
        selected_balance = (aggregate_final_metrics(selected_runs).get("metrics") or {}).get("actionBalance")

    if not selected_balance:
        return []

    baseline_run = next((run for run in reversed(all_runs) if action_balance_for_run(run)), None)
    baseline_balance = (
        action_balance_for_run(baseline_run)
        if baseline_run
        else {
            "actionShare": ((trajectory.get("actionDiversity") or {}).get("actionShare") or {}),
        }
    )

    selected_share = selected_balance.get("actionShare") or {}
    baseline_share = baseline_balance.get("actionShare") or {}

    rows = []
    for action in CORE_ACTIONS:
        rows.append(
            {
                "action": action,
                "label": ACTION_LABELS.get(action, action),
                "selectedShare": selected_share.get(action, 0),
                "baselineShare": baseline_share.get(action, 0),
                "delta": selected_share.get(action, 0) - baseline_share.get(action, 0),
                "targetShare": (
                    selected_share.get(action, 0)
                    if action not in TARGETED_ACTIONS
                    else baseline_share.get(action, 0) * 1.25
                ),
            }
        )
    rows.sort(key=lambda item: abs(item["delta"]), reverse=True)
    return rows


def diff_flat_maps(left: Dict[str, Any], right: Dict[str, Any]) -> List[Dict[str, Any]]:
    keys = sorted(set(left.keys()) | set(right.keys()))
    diffs = []
    for key in keys:
        left_value = left.get(key)
        right_value = right.get(key)
        if left_value == right_value:
            continue
        diffs.append(
            {
                "parameter": key,
                "left": left_value,
                "right": right_value,
            }
        )
    return diffs


def build_run_comparison(scenario_id: str, left_run_key: str, right_run_key: str) -> Dict[str, Any]:
    all_runs = list_optimizer_runs_for_scenario(scenario_id)
    left_run = next((run for run in all_runs if run["runKey"] == left_run_key), None)
    right_run = next((run for run in all_runs if run["runKey"] == right_run_key), None)
    if not left_run or not right_run:
        raise HTTPException(status_code=404, detail="One or both runs were not found")

    left_config = build_recommended_config(left_run)
    right_config = build_recommended_config(right_run)

    left_metrics = left_config["finalMetrics"]
    right_metrics = right_config["finalMetrics"]
    metric_diff = {
        "successRate": right_metrics["successRate"] - left_metrics["successRate"],
        "publicVictoryRate": right_metrics["publicVictoryRate"] - left_metrics["publicVictoryRate"],
        "earlyTerminationRate": right_metrics["earlyTerminationRate"] - left_metrics["earlyTerminationRate"],
        "averageTurns": right_metrics["averageTurns"] - left_metrics["averageTurns"],
        "acceptedPatchCount": len(right_config["acceptedPatches"]) - len(left_config["acceptedPatches"]),
    }

    defeat_diff = []
    defeat_keys = sorted(set(left_metrics["defeatRates"].keys()) | set(right_metrics["defeatRates"].keys()))
    for key in defeat_keys:
        defeat_diff.append(
            {
                "reason": key,
                "left": left_metrics["defeatRates"].get(key, 0),
                "right": right_metrics["defeatRates"].get(key, 0),
                "delta": right_metrics["defeatRates"].get(key, 0) - left_metrics["defeatRates"].get(key, 0),
            }
        )

    return {
        "scenarioId": scenario_id,
        "leftRun": left_config,
        "rightRun": right_config,
        "metricDiff": metric_diff,
        "defeatDiff": defeat_diff,
        "actionDiff": [
            {
                "action": action,
                "label": ACTION_LABELS.get(action, action),
                "left": ((left_metrics.get("actionBalance") or {}).get("actionShare") or {}).get(action, 0),
                "right": ((right_metrics.get("actionBalance") or {}).get("actionShare") or {}).get(action, 0),
            }
            for action in CORE_ACTIONS
        ],
        "recommendedPatchDiff": diff_flat_maps(
            left_config["flattenedPatch"],
            right_config["flattenedPatch"],
        ),
    }


def build_scenario_analysis(scenario_id: str, scope: str, run_key: Optional[str]) -> Dict[str, Any]:
    overview = build_overview()
    scenario_summary = next((item for item in overview["scenarios"] if item["scenarioId"] == scenario_id), None)
    if not scenario_summary:
        raise HTTPException(status_code=404, detail="Scenario not found")

    all_runs = list_optimizer_runs_for_scenario(scenario_id)
    selected_runs, selection = select_runs_for_scope(scenario_id, scope, run_key)
    trajectory = build_trajectory_analytics(scenario_id)
    histories = [item for run in selected_runs for item in normalize_history_for_run(run)]
    generation_progress = [row for run in selected_runs for row in build_generation_progress(run)[0]]
    genome_drift = [row for run in selected_runs for row in build_generation_progress(run)[1]]
    final_metrics_aggregate = aggregate_final_metrics(selected_runs)
    action_run_diagnostics = build_action_run_diagnostics(selected_runs, all_runs, trajectory)
    action_mix_delta = build_action_mix_delta(selected_runs, all_runs, trajectory)
    scenario_recommendations = build_action_recommendations(
        scenario_id,
        trajectory,
        scenario_summary,
        selected_runs,
    )

    optimizer_payload: Dict[str, Any] = {
        "selection": {
            **selection,
            "runCount": len(selected_runs),
            "runCatalog": build_run_catalog(scenario_id),
        },
        "latestRunId": selected_runs[0]["runId"] if selected_runs else None,
        "stopReason": selected_runs[0]["result"].get("stopReason") if len(selected_runs) == 1 else "multi_run",
        "iterationsCompleted": safe_mean(run["result"].get("iterationsCompleted", 0) for run in selected_runs),
        "finalMetrics": selected_runs[0]["result"].get("finalMetrics") if len(selected_runs) == 1 else final_metrics_aggregate,
        "runSummaries": [
            {
                "runKey": run["runKey"],
                "label": run["label"],
                "runType": run["runType"],
                "generatedAt": run["generatedAt"],
                **(run["summary"] or {}),
            }
            for run in selected_runs
        ],
        "recommendedConfig": build_recommended_config(selected_runs[0]) if len(selected_runs) == 1 else None,
        "recommendedConfigs": [build_recommended_config(run) for run in selected_runs],
        "allRunRecommendations": [
            build_recommended_config(run)
            for run in all_runs
            if flatten_patch((run["result"].get("recommendedPatch") or {}))
        ],
        "targetDistances": build_target_distances(histories),
        "acceptedPatches": [patch for run in selected_runs for patch in (run["result"].get("acceptedPatches") or [])],
        "iterations": [
            {
                "iteration": item.get("iteration"),
                "iterationLabel": item.get("iterationLabel"),
                "runLabel": item.get("runLabel"),
                "runKey": item.get("runKey"),
                "baselineMetrics": item.get("baselineMetrics"),
                "baselineScore": item.get("baselineScore"),
                "analysis": item.get("analysis"),
                "trajectorySummary": item.get("trajectorySummary"),
                "selectedCandidate": summarize_candidate(item.get("selectedCandidate")),
                "acceptedCandidate": summarize_candidate(item.get("acceptedCandidate")),
                "topCandidates": [summarize_candidate(candidate) for candidate in (item.get("rankings") or [])[:8]],
                "noImprovementStreak": item.get("noImprovementStreak", 0),
            }
            for item in histories
        ],
        "parameterImpact": build_parameter_impact(histories),
        "candidateCloud": build_candidate_cloud(histories),
        "generationProgress": generation_progress,
        "genomeDrift": genome_drift,
        "actionRunDiagnostics": action_run_diagnostics,
        "actionMixDelta": action_mix_delta,
        "scenarioRecommendations": scenario_recommendations,
    }

    return {
        "scenarioId": scenario_id,
        "summary": scenario_summary,
        "optimizer": optimizer_payload,
        "trajectory": trajectory,
    }


@app.get("/health")
async def health_check() -> Dict[str, str]:
    return {"status": "healthy"}


@app.get("/api/summary")
async def get_summary() -> Dict[str, Any]:
    summary = load_json(os.path.join(SIM_DIR, "simulation_summary.json"))
    if summary is None:
        log_error("Summary file not found")
        raise HTTPException(status_code=404, detail="Summary not found")
    log_success("Summary data retrieved")
    return summary


@app.get("/api/overview")
async def get_overview() -> Dict[str, Any]:
    overview = build_overview()
    log_success("Overview analytics prepared")
    return overview


@app.get("/api/scenarios")
async def list_scenarios() -> List[str]:
    overview = build_overview()
    return [scenario["scenarioId"] for scenario in overview["scenarios"]]


@app.get("/api/scenarios/{scenario_id}/runs")
async def get_scenario_runs(scenario_id: str) -> Dict[str, Any]:
    catalog = build_run_catalog(scenario_id)
    if not catalog:
        raise HTTPException(status_code=404, detail="Scenario not found or no optimizer runs available")
    return {"scenarioId": scenario_id, "runs": catalog}


@app.get("/api/scenarios/{scenario_id}/compare")
async def get_scenario_run_comparison(
    scenario_id: str,
    leftRunKey: str = Query(...),
    rightRunKey: str = Query(...),
) -> Dict[str, Any]:
    payload = build_run_comparison(scenario_id, leftRunKey, rightRunKey)
    log_success(f"Run comparison prepared for {scenario_id}")
    return payload


@app.get("/api/scenarios/{scenario_id}/analysis")
async def get_scenario_analysis(
    scenario_id: str,
    scope: str = Query("latest_single"),
    runKey: Optional[str] = Query(default=None),
) -> Dict[str, Any]:
    payload = build_scenario_analysis(scenario_id, scope, runKey)
    log_success(f"Scenario analysis prepared for {scenario_id} ({scope})")
    return payload


@app.get("/api/scenarios/{scenario_id}/history")
async def get_scenario_history(
    scenario_id: str,
    scope: str = Query("latest_single"),
    runKey: Optional[str] = Query(default=None),
) -> List[Dict[str, Any]]:
    analysis = build_scenario_analysis(scenario_id, scope, runKey)
    return analysis["optimizer"]["iterations"]


@app.get("/api/trajectories/{scenario_id}")
async def get_trajectories(scenario_id: str) -> Dict[str, Any]:
    return build_trajectory_analytics(scenario_id)

import json
import logging
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
    round_domain_sums: Dict[int, Dict[str, float]] = defaultdict(lambda: defaultdict(float))
    round_track_sums: Dict[int, Dict[str, float]] = defaultdict(lambda: defaultdict(float))
    round_counts = defaultdict(int)
    front_sums: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))

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
        action_rows.append(
            {
                "action": action,
                "victory": action_sums["victory"].get(action, 0) / action_denominators["victory"] if action_denominators["victory"] else 0,
                "defeat": action_sums["defeat"].get(action, 0) / action_denominators["defeat"] if action_denominators["defeat"] else 0,
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
        "domainPressure": domain_rows,
        "trackPressure": track_rows,
        "frontPressure": front_rows[:8],
    }


def aggregate_final_metrics(runs: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not runs:
        return {"metrics": {"byPlayerCount": {}}, "score": None}

    total_weight = 0
    success_sum = public_sum = early_term_sum = turns_sum = 0.0
    accepted_patches = 0
    by_player_count: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))

    for run in runs:
        final_metrics = (run["result"].get("finalMetrics") or {}).get("metrics") or {}
        weight = final_metrics.get("n", 0) or 1
        total_weight += weight
        success_sum += final_metrics.get("successRate", 0) * weight
        public_sum += final_metrics.get("publicVictoryRate", 0) * weight
        early_term_sum += final_metrics.get("earlyTerminationRate", 0) * weight
        turns_sum += ((final_metrics.get("turns") or {}).get("average", 0)) * weight
        accepted_patches += len(run["result"].get("acceptedPatches") or [])

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
    return {
        "metrics": {
            "n": total_weight,
            "successRate": success_sum / total_weight,
            "publicVictoryRate": public_sum / total_weight,
            "earlyTerminationRate": early_term_sum / total_weight,
            "turns": {"average": turns_sum / total_weight},
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
        },
    }


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

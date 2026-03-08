---
name: wtsco-optimizer-experiment-runner
description: Run scenario balancing experiments specifically for the Where the Stones Cry Out repository and its shipped scenarios. Use when Codex needs to balance this game's scenarios, validate gameplay pacing, test a hypothesis about parameter changes, compare baseline vs patch behavior, run GA or hill-climb searches, or verify whether a gameplay bug changes simulation outcomes in this repo.
---

# WTSCO Optimizer Experiment Runner

Use the repository's own simulation, experiment, balance-search, and optimizer modules as a research instrument. Discover the available entry points from the repo first, then run the smallest experiment that answers the question.

## Entry Point

Run [`scripts/runOptimizerExperiment`](/Users/aeid/.codex/skills/wtsco-optimizer-experiment-runner/scripts/runOptimizerExperiment).

Example:

```bash
/Users/aeid/.codex/skills/wtsco-optimizer-experiment-runner/scripts/runOptimizerExperiment \
  --repo-root /Users/aeid/git_tree/boardgames/The\ stones\ are\ crying\ outt \
  --scenario algerian_war_of_independence \
  --method genetic \
  --simulation-count 300 \
  --parameters '{"setup":{"seededExtractionTotalDelta":-2},"pressure":{"crisisSpikeExtractionDelta":-1}}'
```

Treat the CLI as the single `runOptimizerExperiment` entry point. It accepts:

- `--scenario`
- `--method genetic|hillclimb|abtest|simulation`
- `--parameters <json>`
- `--simulation-count <n>`
- `--notes <text>`

Useful optional controls:

- `--seed <n>`
- `--players 2,3,4`
- `--modes liberation,symbolic`
- `--parallel-workers <n>`
- `--runtime fast|balanced|thorough`
- `--iterations <n>`
- `--population <n>`
- `--generations <n>`

## Workflow

1. Discover the repo wiring before running anything.
   Read [`references/repo-integration.md`](/Users/aeid/.codex/skills/wtsco-optimizer-experiment-runner/references/repo-integration.md) and let the entrypoint inspect `package.json`, CLI source files, and optimizer modules. Do not assume commands from memory.

2. Pick the narrowest method that answers the question.
   - `abtest`: validate a concrete patch against baseline.
   - `simulation`: estimate stability and pacing for a concrete patch without a full A/B confirmation.
   - `genetic`: explore parameter space with the GA and then confirm the top genome with the A/B engine.
   - `hillclimb`: run the repo's local balance-search workflow to refine numeric settings; if the user also provides a patch, evaluate it separately and report that the built-in balance search is baseline-oriented rather than seed-patch-aware.

3. Keep experiments isolated.
   Always use a timestamped output folder under `simulation_output/optimizer_skill_runs/`. Never overwrite scenario source files or backlog definitions.

4. Summarize the evidence, not just the command outcome.
   Report scenario, method, simulation count, best patch or genome, win rate, average rounds, early defeat pressure, entropy, fitness, and a short recommendation tied to observed metrics.

## Method Map

### `abtest`

Use for direct hypothesis tests like "Does reducing setup extraction by 2 improve survivability?"

- Runs the repo's `runExperiment` engine with the provided patch.
- Produces baseline vs treatment summaries and the repo's own recommendation decision.

### `simulation`

Use for quicker stability checks or pacing checks when statistical confirmation is unnecessary.

- Runs the repo's `runSingleArmExperiment` path.
- Best when you already have a concrete patch and want win rate, rounds, entropy, and fitness quickly.

### `genetic`

Use for open-ended balance exploration or when you want the optimizer to search the parameter space for you.

- Runs `runGaSearch` from the repo.
- Uses the provided patch as an optional baseline patch stack.
- Confirms the top promoted candidate with the A/B engine.

### `hillclimb`

Use for local numeric refinement with the repo's existing balance-search module.

- Runs `runBalanceSearch`.
- If the user provided a patch hypothesis, evaluate that patch separately and clearly state that the current balance-search module does not ingest an arbitrary seed patch through its public API.

## Output Contract

Each run should leave a bundle containing:

- `request.json`
- `discovery.json`
- `commands.log`
- `raw_process.log`
- `summary.json`
- `report.md`

When present, also preserve repo-generated artifacts such as:

- optimizer GA generation reports
- A/B comparison reports
- single-arm summaries
- balance-search candidate output

## Interpretation Rules

- Prefer `successRate` as the primary success metric because the repo's optimizer and reports already treat it as canonical.
- Include `publicVictoryRate`, `avgRounds`, `earlyTerminationRate` or `earlyLossRate`, `outcomeEntropy`, and optimizer `fitness` when available.
- Call out structural warnings from the experiment engine.
- If the evidence is weak, say so directly and recommend a larger `simulationCount` instead of overstating the result.
- Keep terminology aligned with the game: Extraction Tokens, Global Gaze, War Machine, Comrades, Evidence, Domains, Secret Mandates.

## Safety

- Never edit shipped scenario files as part of an experiment run.
- Never mutate `src/simulation/experiments/hypotheses/backlog.ts` just to test a patch.
- Prefer repo APIs over ad hoc reimplementation.
- Log every executed command.
- Use unique timestamped directories so multiple runs can execute in parallel.

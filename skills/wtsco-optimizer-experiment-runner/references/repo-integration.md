# Repo Integration

## Discovery Checklist

Inspect these files before running an experiment:

- `package.json`
- `README.md`
- `docs/agent-optimizer-architecture.md`
- `src/simulation/runSimulation.ts`
- `src/simulation/experiments/cli.ts`
- `src/simulation/experiments/runner.ts`
- `src/simulation/balance/cli.ts`
- `src/simulation/balance/SearchEngine.ts`
- `src/simulation/optimizer/cli.ts`
- `src/simulation/optimizer/engine.ts`
- `src/simulation/optimizer/ga/engine.ts`
- `src/simulation/optimizer/fitness.ts`
- `src/simulation/experiments/patchDsl.ts`

## Commands Discovered In This Repo

From `package.json`:

- `npm run simulate`
- `npm run experiment`
- `npm run experiment:all`
- `npm run balance-search`
- `npm run optimize`
- `npm run optimize-scenario`
- `npm run trajectories`

## Public Method Mapping

- `genetic`
  Use `src/simulation/optimizer/ga/engine.ts` via `runGaSearch` when you need a GA search with a custom baseline patch stack.

- `hillclimb`
  Use `src/simulation/balance/SearchEngine.ts` via `runBalanceSearch` for the repo's public hill-climb style numeric search.

- `abtest`
  Use `src/simulation/experiments/runner.ts` via `runExperiment`.

- `simulation`
  Use `src/simulation/experiments/runner.ts` via `runSingleArmExperiment` when you need patched single-arm metrics.

## Output Locations

- Base simulation:
  `simulation_output/simulations.ndjson`
  `simulation_output/simulation_summary.json`

- A/B experiments:
  `simulation_output/experiments/<experimentId>/`

- Balance search:
  `simulation_output/balance_search/best_candidates.json`

- Optimizer:
  `simulation_output/optimizer/<scenarioId>/<timestamp_seed>/`

- Skill runs:
  `simulation_output/optimizer_skill_runs/<timestamp>_<scenario>_<method>/`

## Useful Metrics

- `successRate`
- `publicVictoryRate`
- `turns.average`
- `earlyTerminationRate`
- `earlyLossRate`
- `outcomeEntropy`
- `actionBalance.entropy`
- optimizer `scoreArmSummary(...).score`

## Patch Schema Shortlist

Common tunable paths from `src/simulation/experiments/patchDsl.ts`:

- `setup.globalGazeDelta`
- `setup.northernWarMachineDelta`
- `setup.seededExtractionTotalDelta`
- `pressure.crisisSpikeExtractionDelta`
- `pressure.maxExtractionAddedPerRound`
- `victory.liberationThresholdDelta`
- `mandates.relaxAllThresholdsBy`
- `victoryGate.minRoundBeforeVictory`
- `victoryGate.requiredAction.actionId`
- `victoryGate.requiredProgress.extractionRemoved`
- `victoryScoring.threshold`
- `victoryScoring.publicVictoryWeight`
- `victoryScoring.mandatesWeight`

## Important Limitation

The built-in balance-search module is a fixed local numeric search. Its public API does not currently accept an arbitrary seed patch from the caller. When a user provides a concrete patch and asks for `hillclimb`, evaluate that patch separately, then run the local balance search and explain the distinction.

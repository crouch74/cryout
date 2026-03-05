import { join } from 'node:path';
import { getRulesetDefinition } from '../../engine/index.ts';
import type { ScenarioPatch } from '../experiments/patchDsl.ts';
import { runExperiment } from '../experiments/runner.ts';
import type { ExperimentArmSummary, ExperimentDefinition, MetricComparison } from '../experiments/types.ts';
import { summarizeTrajectories } from '../trajectory/analyzeTrajectories.ts';
import type { TrajectorySummary } from '../trajectory/types.ts';
import { generateCandidatePatches, normalizeScenarioPatch } from './candidates.ts';
import {
  choosePrimaryMetricForGate,
  directionTowardRange,
  getTargetRange,
  movedTowardRange,
  scoreArmSummary,
} from './fitness.ts';
import {
  buildRunStamp,
  ensureDir,
  loadTrajectoryFiles,
  resolveOptimizerOutputRoot,
  writeJson,
  writeMarkdown,
} from './io.ts';
import type {
  OptimizerAnalysis,
  OptimizerCandidateEvaluation,
  OptimizerConfig,
  OptimizerFinalMetrics,
  OptimizerFinalReport,
  OptimizerGateDecision,
  OptimizerIterationResult,
  OptimizerScoreBreakdown,
  OptimizerSignificanceMode,
  OptimizerSignificanceThresholds,
  OptimizerStopReason,
} from './types.ts';

function roundTo(value: number, digits = 6) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function percent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function formatProgressPercent(completed: number, total: number) {
  if (total <= 0) {
    return '100.0';
  }
  return ((completed / total) * 100).toFixed(1);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const limit = Math.max(1, Math.min(concurrency, items.length || 1));
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= items.length) {
        return;
      }
      results[current] = await mapper(items[current], current);
    }
  };

  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

function stableHash(value: string) {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function mixSeed(seed: number, salt: number) {
  let mixed = (seed ^ salt ^ 0x9e3779b9) >>> 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x85ebca6b) >>> 0;
  mixed ^= mixed >>> 13;
  mixed = Math.imul(mixed, 0xc2b2ae35) >>> 0;
  mixed ^= mixed >>> 16;
  return mixed >>> 0;
}

function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function addNumeric(current: number | undefined, delta: number | undefined) {
  if (delta === undefined) {
    return current;
  }
  const next = (current ?? 0) + delta;
  return next === 0 ? undefined : next;
}

export function mergeScenarioPatches(base: ScenarioPatch, incoming: ScenarioPatch): ScenarioPatch {
  const merged = deepClone(base);

  if (incoming.note) {
    merged.note = incoming.note;
  }

  if (incoming.setup) {
    merged.setup = { ...(merged.setup ?? {}) };
    merged.setup.globalGazeDelta = addNumeric(merged.setup.globalGazeDelta, incoming.setup.globalGazeDelta);
    merged.setup.northernWarMachineDelta = addNumeric(
      merged.setup.northernWarMachineDelta,
      incoming.setup.northernWarMachineDelta,
    );
    merged.setup.seededExtractionTotalDelta = addNumeric(
      merged.setup.seededExtractionTotalDelta,
      incoming.setup.seededExtractionTotalDelta,
    );

    if (incoming.setup.frontSeedDeltas) {
      const next = { ...(merged.setup.frontSeedDeltas ?? {}) };
      for (const [front, delta] of Object.entries(incoming.setup.frontSeedDeltas)) {
        const value = (next[front] ?? 0) + delta;
        if (value === 0) {
          delete next[front];
          continue;
        }
        next[front] = value;
      }
      merged.setup.frontSeedDeltas = Object.keys(next).length > 0 ? next : undefined;
    }
  }

  if (incoming.victory) {
    merged.victory = { ...(merged.victory ?? {}) };
    merged.victory.liberationThresholdDelta = addNumeric(
      merged.victory.liberationThresholdDelta,
      incoming.victory.liberationThresholdDelta,
    );
    if (incoming.victory.overrideLiberationExtractionCap !== undefined) {
      merged.victory.overrideLiberationExtractionCap = incoming.victory.overrideLiberationExtractionCap;
    }
    if (incoming.victory.beaconThresholdTweaks && incoming.victory.beaconThresholdTweaks.length > 0) {
      merged.victory.beaconThresholdTweaks = [
        ...(merged.victory.beaconThresholdTweaks ?? []),
        ...incoming.victory.beaconThresholdTweaks.map((entry) => ({ ...entry })),
      ];
    }
  }

  if (incoming.pressure) {
    merged.pressure = { ...(merged.pressure ?? {}) };
    merged.pressure.crisisSpikeExtractionDelta = addNumeric(
      merged.pressure.crisisSpikeExtractionDelta,
      incoming.pressure.crisisSpikeExtractionDelta,
    );
    if (incoming.pressure.maxExtractionAddedPerRound !== undefined) {
      merged.pressure.maxExtractionAddedPerRound = incoming.pressure.maxExtractionAddedPerRound;
    }
  }

  if (incoming.mandates) {
    merged.mandates = { ...(merged.mandates ?? {}) };
    merged.mandates.relaxAllThresholdsBy = addNumeric(
      merged.mandates.relaxAllThresholdsBy,
      incoming.mandates.relaxAllThresholdsBy,
    );
    if (incoming.mandates.classifyMandateFailureAs !== undefined) {
      merged.mandates.classifyMandateFailureAs = incoming.mandates.classifyMandateFailureAs;
    }
  }

  if (incoming.actions?.removeActionIds && incoming.actions.removeActionIds.length > 0) {
    const ids = new Set([...(merged.actions?.removeActionIds ?? []), ...incoming.actions.removeActionIds]);
    merged.actions = {
      ...(merged.actions ?? {}),
      removeActionIds: Array.from(ids).sort((left, right) => left.localeCompare(right)),
    };
  }

  if (incoming.victoryGate) {
    merged.victoryGate = { ...(merged.victoryGate ?? {}) };
    if (incoming.victoryGate.minRoundBeforeVictory !== undefined) {
      merged.victoryGate.minRoundBeforeVictory = incoming.victoryGate.minRoundBeforeVictory;
    }
    if (incoming.victoryGate.requiredAction?.actionId !== undefined) {
      merged.victoryGate.requiredAction = {
        actionId: incoming.victoryGate.requiredAction.actionId,
      };
    }
    if (incoming.victoryGate.requiredProgress?.extractionRemoved !== undefined) {
      merged.victoryGate.requiredProgress = {
        ...(merged.victoryGate.requiredProgress ?? {}),
        extractionRemoved: incoming.victoryGate.requiredProgress.extractionRemoved,
      };
    }
  }

  return normalizeScenarioPatch(merged);
}

function createExperimentDefinition(input: {
  id: string;
  title: string;
  scenarioId: string;
  patch: ScenarioPatch;
  runsPerArm: number;
  seed: number;
  confidence: 0.9 | 0.95 | 0.99;
  primary: 'winRate' | 'publicVictoryRate';
  victoryModes: ExperimentDefinition['victoryModes'];
  playerCounts: number[];
}): ExperimentDefinition {
  return {
    id: input.id,
    title: input.title,
    scenarioId: input.scenarioId,
    victoryModes: input.victoryModes,
    runsPerArm: input.runsPerArm,
    playerCounts: input.playerCounts,
    seed: input.seed >>> 0,
    patch: input.patch,
    expectedEffects: {},
    decisionRule: {
      primary: input.primary,
      minLift: 0,
      confidence: input.confidence,
    },
  };
}

function getSignificanceThresholds(mode: OptimizerSignificanceMode): OptimizerSignificanceThresholds {
  if (mode === 'strict') {
    return {
      minFitnessLift: 0.03,
      maxGuardrailRegression: 0.02,
      confidence: 0.99,
      alpha: 0.01,
    };
  }
  if (mode === 'lenient') {
    return {
      minFitnessLift: 0.005,
      maxGuardrailRegression: 0.05,
      confidence: 0.9,
      alpha: 0.1,
    };
  }
  return {
    minFitnessLift: 0.015,
    maxGuardrailRegression: 0.03,
    confidence: 0.95,
    alpha: 0.05,
  };
}

function analyzeBaselineMetrics(arm: ExperimentArmSummary, score: OptimizerScoreBreakdown): OptimizerAnalysis {
  const outOfRange = {
    publicVictoryRate: !score.targets.publicVictoryRate.inRange,
    winRate: !score.targets.winRate.inRange,
    mandateFailRateGivenPublic: !score.targets.mandateFailRateGivenPublic.inRange,
    averageTurns: !score.targets.averageTurns.inRange,
  };

  const defeatPressure = {
    extractionBreachRate: arm.defeatRates.extraction_breach,
    comradesExhaustedRate: arm.defeatRates.comrades_exhausted,
    suddenDeathRate: arm.defeatRates.sudden_death,
    pressureDetected: arm.defeatRates.extraction_breach >= 0.35
      || arm.defeatRates.comrades_exhausted >= 0.2
      || arm.defeatRates.sudden_death >= 0.12,
  };

  const insights: string[] = [];
  if (arm.publicVictoryRate < score.targets.publicVictoryRate.min) {
    insights.push('Public victory rate is below target range.');
  } else if (arm.publicVictoryRate > score.targets.publicVictoryRate.max) {
    insights.push('Public victory rate is above target range.');
  }

  if (arm.winRate < score.targets.winRate.min) {
    insights.push('True win rate is below target range.');
  } else if (arm.winRate > score.targets.winRate.max) {
    insights.push('True win rate is above target range.');
  }

  if (arm.mandateFailRateGivenPublic > score.targets.mandateFailRateGivenPublic.max) {
    insights.push('Mandate failures among public victories are high.');
  } else if (arm.mandateFailRateGivenPublic < score.targets.mandateFailRateGivenPublic.min) {
    insights.push('Mandate failure conversion is below target risk band.');
  }

  if (arm.turns.average < score.targets.averageTurns.min) {
    insights.push('Average turns are short and may indicate early collapse.');
  } else if (arm.turns.average > score.targets.averageTurns.max) {
    insights.push('Average turns are long and pacing is slow.');
  }

  if (arm.turnOnePublicVictoryRate > 0.05) {
    insights.push('Turn-1 public victories are structurally high; victory gating should be explored.');
  }
  if (arm.victoryBeforeAllowedRoundRate > 0) {
    insights.push('Victory predicate triggered before allowed round; round gating remains structurally active.');
  }
  if (arm.earlyTerminationRate > 0.05) {
    insights.push('Early terminations are structurally high (games ending before round 3).');
  }

  if (defeatPressure.pressureDetected) {
    insights.push('System pressure defeats are elevated.');
  }

  if (arm.mandateFailureDistribution[0]?.failureRate && arm.mandateFailureDistribution[0].failureRate >= 0.55) {
    insights.push('Top mandate appears difficult to satisfy consistently.');
  }

  return {
    outOfRange,
    defeatPressure,
    topMandateFailures: arm.mandateFailureDistribution
      .slice(0, 5)
      .map((entry) => ({
        mandateId: entry.mandateId,
        failureRate: entry.failureRate,
        attempts: entry.attempts,
      })),
    structural: {
      turnOnePublicVictoryRate: arm.turnOnePublicVictoryRate,
      victoryBeforeAllowedRoundRate: arm.victoryBeforeAllowedRoundRate,
      earlyTerminationRate: arm.earlyTerminationRate,
      noGameplayDetected: arm.turns.average < 2,
      impossibleMandates: arm.mandateFailureDistribution
        .filter((entry) => entry.failureRate > 0.95 && entry.attempts > 0)
        .map((entry) => entry.mandateId),
    },
    insights,
  };
}

async function summarizeBaselineTrajectories(
  baselineExperimentOutputDir: string,
  baselineScenarioId: string,
): Promise<TrajectorySummary | null> {
  const trajectoryDir = join(baselineExperimentOutputDir, 'trajectories');
  try {
    const trajectories = await loadTrajectoryFiles(trajectoryDir);
    const baselineOnly = trajectories.filter((entry) => entry.scenarioId === baselineScenarioId);
    const input = baselineOnly.length > 0 ? baselineOnly : trajectories;
    if (input.length === 0) {
      return null;
    }
    return summarizeTrajectories(input);
  } catch {
    return null;
  }
}

function evaluateGate(input: {
  baselineMetrics: ExperimentArmSummary;
  candidateMetrics: ExperimentArmSummary;
  baselineScore: OptimizerScoreBreakdown;
  candidateScore: OptimizerScoreBreakdown;
  comparison: MetricComparison;
  significance: OptimizerSignificanceMode;
}): OptimizerGateDecision {
  const thresholds = getSignificanceThresholds(input.significance);
  const primaryMetric = choosePrimaryMetricForGate(input.baselineScore);
  const range = getTargetRange(primaryMetric);
  const baselineValue = primaryMetric === 'winRate'
    ? input.baselineMetrics.winRate
    : input.baselineMetrics.publicVictoryRate;
  const candidateValue = primaryMetric === 'winRate'
    ? input.candidateMetrics.winRate
    : input.candidateMetrics.publicVictoryRate;
  const direction = directionTowardRange(baselineValue, range);
  const metricDelta = input.comparison.metrics[primaryMetric];
  const stats = metricDelta.proportionStats;
  const lift = input.candidateScore.score - input.baselineScore.score;
  const fitnessLiftPassed = lift >= thresholds.minFitnessLift;
  const movedTowardTarget = movedTowardRange(baselineValue, candidateValue, range);

  const extractionRegression = input.candidateMetrics.defeatRates.extraction_breach - input.baselineMetrics.defeatRates.extraction_breach;
  const comradesRegression = input.candidateMetrics.defeatRates.comrades_exhausted - input.baselineMetrics.defeatRates.comrades_exhausted;
  const suddenRegression = input.candidateMetrics.defeatRates.sudden_death - input.baselineMetrics.defeatRates.sudden_death;
  const guardrailsPassed = extractionRegression <= thresholds.maxGuardrailRegression
    && comradesRegression <= thresholds.maxGuardrailRegression
    && suddenRegression <= thresholds.maxGuardrailRegression;
  const minimumGameplayPassed = input.candidateMetrics.turns.average >= 3;

  let statisticallyMeaningful = false;
  if (stats) {
    if (direction === 'increase') {
      statisticallyMeaningful = metricDelta.absoluteLift > 0
        && stats.pValue <= thresholds.alpha
        && stats.confidenceInterval.lower > 0;
    } else if (direction === 'decrease') {
      statisticallyMeaningful = metricDelta.absoluteLift < 0
        && stats.pValue <= thresholds.alpha
        && stats.confidenceInterval.upper < 0;
    } else {
      const midpoint = (range.min + range.max) / 2;
      const towardMidpoint = Math.abs(candidateValue - midpoint) < Math.abs(baselineValue - midpoint);
      if (towardMidpoint && metricDelta.absoluteLift > 0) {
        statisticallyMeaningful = stats.pValue <= thresholds.alpha && stats.confidenceInterval.lower > 0;
      } else if (towardMidpoint && metricDelta.absoluteLift < 0) {
        statisticallyMeaningful = stats.pValue <= thresholds.alpha && stats.confidenceInterval.upper < 0;
      }
    }
  }

  const reasons: string[] = [];
  if (fitnessLiftPassed) {
    reasons.push(`fitness lift ${roundTo(lift)} passed threshold ${thresholds.minFitnessLift}`);
  } else {
    reasons.push(`fitness lift ${roundTo(lift)} below threshold ${thresholds.minFitnessLift}`);
  }

  if (guardrailsPassed) {
    reasons.push('guardrails passed for extraction/comrades/sudden-death defeat regressions');
  } else {
    reasons.push(
      `guardrail regression exceeded limits (extraction=${roundTo(extractionRegression)}, comrades=${roundTo(comradesRegression)}, sudden_death=${roundTo(suddenRegression)})`,
    );
  }

  if (minimumGameplayPassed) {
    reasons.push('minimum gameplay gate passed (average turns >= 3)');
  } else {
    reasons.push(`minimum gameplay gate failed (average turns=${roundTo(input.candidateMetrics.turns.average)} < 3)`);
  }

  if (movedTowardTarget) {
    reasons.push(`primary metric ${primaryMetric} moved toward target range`);
  } else {
    reasons.push(`primary metric ${primaryMetric} did not move toward target range`);
  }

  if (statisticallyMeaningful) {
    reasons.push(`statistical gate passed (p<=${thresholds.alpha})`);
  } else {
    reasons.push(`statistical gate failed (primary metric change not significant at alpha ${thresholds.alpha})`);
  }

  return {
    accepted: fitnessLiftPassed
      && guardrailsPassed
      && statisticallyMeaningful
      && movedTowardTarget
      && minimumGameplayPassed,
    primaryMetric,
    statisticallyMeaningful,
    fitnessLiftPassed,
    guardrailsPassed,
    movedTowardTarget,
    reasons,
  };
}

function renderFinalReportMarkdown(report: OptimizerFinalReport) {
  const final = report.finalMetrics;
  return `# Scenario Optimization Report

- Scenario: ${report.scenarioId}
- Stop reason: ${report.stopReason}
- Iterations completed: ${report.iterationsCompleted}
- Accepted patches: ${report.acceptedPatches.length}

## Final Metrics
- Win Rate: ${percent(final.metrics.winRate)}
- Public Victory Rate: ${percent(final.metrics.publicVictoryRate)}
- Mandate Failure Given Public: ${percent(final.metrics.mandateFailRateGivenPublic)}
- Average Turns: ${final.metrics.turns.average.toFixed(2)}
- Balance Score: ${final.score.score.toFixed(6)}

## Recommended Patch
\`\`\`json
${JSON.stringify(report.recommendedPatch, null, 2)}
\`\`\`
`;
}

export async function runScenarioOptimizer(config: OptimizerConfig): Promise<OptimizerFinalReport> {
  const scenario = getRulesetDefinition(config.scenarioId);
  if (!scenario) {
    throw new Error(`Unknown scenario: ${config.scenarioId}`);
  }

  const runStamp = buildRunStamp();
  const outputDir = resolveOptimizerOutputRoot(config.outDir, config.scenarioId, config.seed, runStamp);
  await ensureDir(outputDir);
  await writeJson(join(outputDir, 'optimizer_config.json'), {
    ...config,
    generatedAt: new Date().toISOString(),
    scenarioName: scenario.name,
  });

  const history: OptimizerIterationResult[] = [];
  const acceptedPatches: OptimizerFinalReport['acceptedPatches'] = [];
  let accumulatedPatch: ScenarioPatch = {};
  let noImprovementStreak = 0;
  let stopReason: OptimizerStopReason = 'max_iterations_reached';
  let hillClimbSourcePatch: ScenarioPatch | null = null;
  let iterationsCompleted = 0;
  const estimatedTotalExperiments = (config.iterations * (1 + config.candidates)) + 1;
  let completedExperiments = 0;

  console.log(`🧠 Run start scenario=${config.scenarioId} strategy=${config.strategy} runtime=${config.runtime}`);
  console.log(`🧠 Parallel workers configured=${config.parallelWorkers}`);
  console.log(`🧠 Estimated experiment workload=${estimatedTotalExperiments} (baselines + candidates + final confirmation)`);

  for (let iteration = 1; iteration <= config.iterations; iteration += 1) {
    iterationsCompleted = iteration;
    const iterationPercent = formatProgressPercent(iteration - 1, config.iterations);
    console.log(`🧠 Optimization iteration=${iteration}/${config.iterations} scenario=${config.scenarioId} overall=${iterationPercent}%`);

    const iterationDir = join(outputDir, `iteration_${pad2(iteration)}`);
    const experimentsDir = join(iterationDir, 'experiments');
    await ensureDir(experimentsDir);

      const baselineExperimentId = `optimizer_${config.scenarioId}_iter_${pad2(iteration)}_baseline`;
      const baselineDefinition = createExperimentDefinition({
        id: baselineExperimentId,
        title: `Optimizer baseline iteration ${iteration}`,
        scenarioId: config.scenarioId,
        patch: { note: '📊 Baseline control patch (no-op)' },
        runsPerArm: config.baselineRuns,
        seed: mixSeed(config.seed, stableHash(`baseline:${iteration}`)),
        confidence: getSignificanceThresholds(config.significance).confidence,
        primary: 'winRate',
        victoryModes: config.victoryModes,
        playerCounts: config.playerCounts,
      });

      console.log('📊 Running baseline simulation');
      const baselineResult = await runExperiment(baselineDefinition, {
        outDir: experimentsDir,
        recordTrajectories: true,
        parallelWorkers: config.parallelWorkers,
        logMode: 'aggregated',
        baselinePatch: accumulatedPatch,
      });
      completedExperiments += 1;
      console.log(`🔁 Overall run progress ${completedExperiments}/${estimatedTotalExperiments} (${formatProgressPercent(completedExperiments, estimatedTotalExperiments)}%) after baseline`);
      console.log('📊 Baseline metrics computed');

      const baselineMetrics = baselineResult.armA;
      const baselineScore = scoreArmSummary(baselineMetrics);
      await writeJson(join(iterationDir, 'baseline_summary.json'), {
        metrics: baselineMetrics,
        score: baselineScore,
      });

      const analysis = analyzeBaselineMetrics(baselineMetrics, baselineScore);
      await writeJson(join(iterationDir, 'analysis.json'), analysis);
      console.log(`📊 Analysis summary: ${analysis.insights.join(' | ') || 'No major imbalances detected'}`);

      console.log('🧭 Exploring victory trajectories');
      const trajectorySummary = await summarizeBaselineTrajectories(baselineResult.outputDir, config.scenarioId);
      await writeJson(join(iterationDir, 'trajectory_summary.json'), trajectorySummary);
      await writeJson(join(iterationDir, 'victory_trajectory_analysis.json'), trajectorySummary
        ? {
          averageRoundVictory: trajectorySummary.averageRoundVictory,
          distributionOfVictoryRounds: trajectorySummary.distributionOfVictoryRounds,
          progressBeforeVictory: trajectorySummary.progressBeforeVictory,
          actionsLeadingToVictory: trajectorySummary.topActionSequences,
        }
        : null);
      if (trajectorySummary?.mostCommonActionSequence) {
        console.log(`🧭 Most common sequence: ${trajectorySummary.mostCommonActionSequence.sequence}`);
      } else {
        console.log('🧭 No baseline trajectories captured in this iteration');
      }

      if (baselineScore.allTargetsInRange) {
        stopReason = 'targets_reached';
        history.push({
          iteration,
          baselineScenarioId: config.scenarioId,
          baselineExperimentId,
          baselineMetrics,
          baselineScore,
          analysis,
          trajectorySummary,
          candidateCount: 0,
          rankings: [],
          selectedCandidate: null,
          acceptedCandidate: null,
          noImprovementStreak,
        });
        console.log('🏆 Baseline already satisfies all target ranges');
        break;
      }

      console.log('🧠 Generating candidate rule patches');
      const candidates = await generateCandidatePatches({
        scenarioId: config.scenarioId,
        iteration,
        seed: config.seed,
        targetCount: config.candidates,
        candidateRuns: config.candidateRuns,
        runtime: config.runtime,
        strategyMode: config.strategy,
        analysis,
        trajectorySummary,
        hillClimbSourcePatch,
        balanceSeedOutputDir: join(iterationDir, 'balance_seed'),
        useBalanceSearchSeeding: config.useBalanceSearchSeeding ?? true,
      });
      await writeJson(join(iterationDir, 'candidate_patches.json'), candidates);
      console.log(`🧠 ${candidates.length} candidates created`);

      const candidateConcurrency = Math.max(1, Math.min(config.parallelWorkers, candidates.length));
      const workersPerCandidateExperiment = Math.max(1, Math.floor(config.parallelWorkers / candidateConcurrency));
      console.log(`🧪 Candidate pool concurrency=${candidateConcurrency} workers/experiment=${workersPerCandidateExperiment}`);
      let completedCandidateExperiments = 0;
      const candidateProgressInterval = Math.max(1, Math.floor(candidates.length / 5));
      const candidateEvaluationResults = await mapWithConcurrency(
        candidates,
        candidateConcurrency,
        async (candidate, candidateIndex): Promise<OptimizerCandidateEvaluation | null> => {
        const candidateExperimentId = `optimizer_${config.scenarioId}_iter_${pad2(iteration)}_${candidate.candidateId}`;
        if (candidateIndex === 0) {
          console.log(`🧪 Running candidate experiments (${candidates.length} total)`);
        }
        try {
          const definition = createExperimentDefinition({
            id: candidateExperimentId,
            title: `Optimizer candidate ${candidate.candidateId}`,
            scenarioId: config.scenarioId,
            patch: candidate.patch,
            runsPerArm: config.candidateRuns,
            seed: mixSeed(config.seed, stableHash(`candidate:${iteration}:${candidate.candidateId}`)),
            confidence: getSignificanceThresholds(config.significance).confidence,
            primary: choosePrimaryMetricForGate(baselineScore),
            victoryModes: config.victoryModes,
            playerCounts: config.playerCounts,
          });
          const result = await runExperiment(definition, {
            outDir: experimentsDir,
            recordTrajectories: false,
            parallelWorkers: workersPerCandidateExperiment,
            logMode: 'aggregated',
            baselinePatch: accumulatedPatch,
          });
          completedExperiments += 1;
          console.log(`🔁 Overall run progress ${completedExperiments}/${estimatedTotalExperiments} (${formatProgressPercent(completedExperiments, estimatedTotalExperiments)}%)`);
          const scoreBreakdown = scoreArmSummary(result.armB);
          const gate = evaluateGate({
            baselineMetrics,
            candidateMetrics: result.armB,
            baselineScore,
            candidateScore: scoreBreakdown,
            comparison: result.comparison,
            significance: config.significance,
          });
          const scoreDeltaFromBaseline = roundTo(scoreBreakdown.score - baselineScore.score);
          completedCandidateExperiments += 1;
          if (completedCandidateExperiments % candidateProgressInterval === 0 || completedCandidateExperiments === candidates.length) {
            console.log(`📊 Candidate batch progress ${completedCandidateExperiments}/${candidates.length}`);
          }

          return {
            candidateId: candidate.candidateId,
            strategy: candidate.strategy,
            experimentId: candidateExperimentId,
            outputDir: result.outputDir,
            patch: candidate.patch,
            metrics: result.armB,
            comparison: result.comparison,
            scoreBreakdown,
            scoreDeltaFromBaseline,
            gate,
          };
        } catch (error) {
          const err = error as Error;
          console.log(`⚠️ Candidate ${candidate.candidateId} skipped: ${err.message}`);
          completedCandidateExperiments += 1;
          if (completedCandidateExperiments % candidateProgressInterval === 0 || completedCandidateExperiments === candidates.length) {
            console.log(`📊 Candidate batch progress ${completedCandidateExperiments}/${candidates.length}`);
          }
          return null;
        }
      },
      );

      const evaluations = candidateEvaluationResults
        .filter((entry): entry is OptimizerCandidateEvaluation => entry !== null);

      const rankings = evaluations
        .slice()
        .sort((left, right) => {
          if (right.scoreBreakdown.score !== left.scoreBreakdown.score) {
            return right.scoreBreakdown.score - left.scoreBreakdown.score;
          }
          if (right.scoreDeltaFromBaseline !== left.scoreDeltaFromBaseline) {
            return right.scoreDeltaFromBaseline - left.scoreDeltaFromBaseline;
          }
          return left.candidateId.localeCompare(right.candidateId);
        });
      await writeJson(join(iterationDir, 'candidate_rankings.json'), rankings);

      const selectedCandidate = rankings[0] ?? null;
      let acceptedCandidate: OptimizerCandidateEvaluation | null = null;
      if (selectedCandidate?.gate.accepted) {
        acceptedCandidate = selectedCandidate;
        accumulatedPatch = mergeScenarioPatches(accumulatedPatch, selectedCandidate.patch);
        hillClimbSourcePatch = selectedCandidate.patch;
        noImprovementStreak = 0;
        acceptedPatches.push({
          iteration,
          candidateId: selectedCandidate.candidateId,
          strategy: selectedCandidate.strategy,
          score: selectedCandidate.scoreBreakdown.score,
          scoreDeltaFromBaseline: selectedCandidate.scoreDeltaFromBaseline,
          patch: selectedCandidate.patch,
        });
        console.log(`🏆 New best configuration discovered candidate=${selectedCandidate.candidateId}`);
      } else {
        noImprovementStreak += 1;
        console.log(`🔁 No significant improvement accepted (streak=${noImprovementStreak})`);
      }

      await writeJson(join(iterationDir, 'selected_candidate.json'), {
        selectedCandidate,
        acceptedCandidate,
        noImprovementStreak,
        accumulatedPatch,
      });

      history.push({
        iteration,
        baselineScenarioId: config.scenarioId,
        baselineExperimentId,
        baselineMetrics,
        baselineScore,
        analysis,
        trajectorySummary,
        candidateCount: candidates.length,
        rankings,
        selectedCandidate,
        acceptedCandidate,
        noImprovementStreak,
      });

      if (acceptedCandidate?.scoreBreakdown.allTargetsInRange) {
        stopReason = 'targets_reached';
        console.log('🏆 Target metric ranges reached by accepted candidate');
        break;
      }

      if (noImprovementStreak >= config.patience) {
        stopReason = 'no_significant_improvement';
        console.log('🔁 Patience limit reached without meaningful improvement');
        break;
      }
  }

  if (history.length > 0 && stopReason === 'max_iterations_reached') {
    console.log('🔁 Maximum iterations reached');
  }

  let finalMetrics: OptimizerFinalMetrics;
    const finalExperimentId = `optimizer_${config.scenarioId}_final_confirmation`;
    console.log('📊 Running final baseline confirmation');
    const result = await runExperiment(
      createExperimentDefinition({
        id: finalExperimentId,
        title: 'Optimizer final confirmation',
        scenarioId: config.scenarioId,
        patch: { note: '📊 Final confirmation control patch (no-op)' },
        runsPerArm: config.baselineRuns,
        seed: mixSeed(config.seed, stableHash('final-confirmation')),
        confidence: getSignificanceThresholds(config.significance).confidence,
        primary: 'winRate',
        victoryModes: config.victoryModes,
        playerCounts: config.playerCounts,
      }),
      {
        outDir: join(outputDir, 'final_confirmation'),
        recordTrajectories: false,
        parallelWorkers: config.parallelWorkers,
        logMode: 'aggregated',
        baselinePatch: accumulatedPatch,
      },
    );
    completedExperiments += 1;
    console.log(`🔁 Overall run progress ${completedExperiments}/${estimatedTotalExperiments} (${formatProgressPercent(completedExperiments, estimatedTotalExperiments)}%) after final confirmation`);
    finalMetrics = {
      scenarioId: config.scenarioId,
      baselineScenarioId: config.scenarioId,
      experimentId: finalExperimentId,
      metrics: result.armA,
      score: scoreArmSummary(result.armA),
    };

  const report: OptimizerFinalReport = {
    scenarioId: config.scenarioId,
    outputDir,
    stopReason,
    iterationsCompleted,
    acceptedPatches,
    recommendedPatch: normalizeScenarioPatch(accumulatedPatch),
    finalMetrics,
    history,
  };

  await writeJson(join(outputDir, 'optimization_history.json'), history);
  await writeJson(join(outputDir, 'accepted_patch_history.json'), acceptedPatches);
  await writeJson(join(outputDir, 'recommended_patch.json'), report.recommendedPatch);
  await writeJson(join(outputDir, 'final_metrics.json'), finalMetrics);
  await writeJson(join(outputDir, 'optimizer_result.json'), report);
  await writeMarkdown(join(outputDir, 'final_report.md'), renderFinalReportMarkdown(report));

  console.log('🏆 Optimization complete');
  console.log(`🏆 Run progress completed ${completedExperiments}/${estimatedTotalExperiments} (${formatProgressPercent(completedExperiments, estimatedTotalExperiments)}%)`);
  console.log(`🏆 Best configuration discovered for scenario=${config.scenarioId}`);
  console.log(`📊 Win Rate: ${percent(finalMetrics.metrics.winRate)}`);
  console.log(`📊 Public Victory Rate: ${percent(finalMetrics.metrics.publicVictoryRate)}`);
  console.log(`📊 Mandate Failure Given Public: ${percent(finalMetrics.metrics.mandateFailRateGivenPublic)}`);
  console.log(`📊 Average Turns: ${finalMetrics.metrics.turns.average.toFixed(2)}`);

  return report;
}

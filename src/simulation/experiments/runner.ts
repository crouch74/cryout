import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import process from 'node:process';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import {
  buildBalancedSeatOwners,
  getRulesetDefinition,
  type FactionId,
  type VictoryMode as CompatVictoryMode,
} from '../../engine/index.ts';
import { executePlannedRunsWithWorkers, runSingleSimulation } from '../autoplayEngine.ts';
import { listStrategyProfiles } from '../strategies.ts';
import { buildTrajectoryFileStem } from '../trajectory/TrajectoryRecorder.ts';
import type { VictoryTrajectory } from '../trajectory/types.ts';
import type { PlannedSimulationRun, StrategyId } from '../types.ts';
import { applyScenarioPatch } from './applyScenarioPatch.ts';
import {
  buildRecommendation,
  compareArms,
  createArmAccumulator,
  finalizeArmSummary,
  ingestArmRecord,
  renderHtmlReport,
  renderMarkdownReport,
} from './report.ts';
import type { ScenarioPatch } from './patchDsl.ts';
import type { ExperimentDefinition, ExperimentResult, StructuralDiagnostics, VictoryMode } from './types.ts';

const DEFAULT_OUT_DIR = resolve(process.cwd(), 'simulation_output/experiments');
const MAX_TRAJECTORIES_PER_EXPERIMENT = 200;

interface SampleProfile {
  mode: VictoryMode;
  playerCount: 2 | 3 | 4;
  seatFactionIds: FactionId[];
  seatOwnerIds: number[];
  strategyIds: StrategyId[];
}

export interface RunExperimentOptions {
  outDir?: string;
  recordTrajectories?: boolean;
  parallelWorkers?: number;
  logMode?: 'verbose' | 'aggregated';
  baselinePatch?: ScenarioPatch;
}

class TrajectoryReservoir {
  private readonly trajectories: VictoryTrajectory[] = [];
  private readonly nextRng: () => number;
  private readonly capacity: number;
  private seen = 0;

  constructor(capacity: number, seed: number) {
    this.capacity = capacity;
    this.nextRng = createRng(seed);
  }

  consider(trajectory: VictoryTrajectory) {
    this.seen += 1;
    // Keep a bounded, unbiased sample so large experiments stay analyzable.
    if (this.trajectories.length < this.capacity) {
      this.trajectories.push(trajectory);
      return;
    }

    const replacementIndex = this.nextRng() % this.seen;
    if (replacementIndex < this.capacity) {
      this.trajectories[replacementIndex] = trajectory;
    }
  }

  totalSeen() {
    return this.seen;
  }

  values() {
    return this.trajectories.slice();
  }
}

function assertPlayerCounts(playerCounts: number[]) {
  if (playerCounts.length === 0) {
    throw new Error('Experiment requires at least one player count option.');
  }

  for (const count of playerCounts) {
    if (count !== 2 && count !== 3 && count !== 4) {
      throw new Error(`Unsupported player count in experiment definition: ${count}`);
    }
  }
}

function assertVictoryModes(victoryModes: VictoryMode[]) {
  if (victoryModes.length === 0) {
    throw new Error('Experiment requires at least one victory mode.');
  }

  for (const mode of victoryModes) {
    if (mode !== 'liberation' && mode !== 'symbolic') {
      throw new Error(`Unsupported victory mode in experiment definition: ${mode}`);
    }
  }
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

function createRng(seed: number) {
  let state = seed === 0 ? 0x6d2b79f5 : seed >>> 0;
  return () => {
    state = Math.imul(state ^ (state >>> 15), state | 1) >>> 0;
    state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
    return (state ^ (state >>> 14)) >>> 0;
  };
}

function deterministicShuffle<T>(input: readonly T[], seed: number): T[] {
  const values = [...input];
  const next = createRng(seed);

  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = next() % (index + 1);
    const current = values[index];
    values[index] = values[swapIndex];
    values[swapIndex] = current;
  }

  return values;
}

function toCompatMode(mode: VictoryMode): CompatVictoryMode {
  return mode === 'liberation' ? 'LIBERATION' : 'SYMBOLIC';
}

function buildSampleProfile(
  runIndex: number,
  definition: ExperimentDefinition,
  factionIds: FactionId[],
  strategyIds: StrategyId[],
): SampleProfile {
  const sampleSeed = mixSeed(definition.seed, runIndex + 1);

  const mode = definition.victoryModes[
    mixSeed(sampleSeed, stableHash('mode')) % definition.victoryModes.length
  ];

  const playerCount = definition.playerCounts[
    mixSeed(sampleSeed, stableHash('players')) % definition.playerCounts.length
  ] as 2 | 3 | 4;

  const seatFactionIds = deterministicShuffle(factionIds, mixSeed(sampleSeed, stableHash('factions')));
  const seatOwnerIds = buildBalancedSeatOwners(playerCount, seatFactionIds);

  const perSeatStrategies = seatFactionIds.map((_, seat) => {
    const strategyIndex = mixSeed(sampleSeed, stableHash(`strategy:${seat}`)) % strategyIds.length;
    return strategyIds[strategyIndex];
  });

  return {
    mode,
    playerCount,
    seatFactionIds,
    seatOwnerIds,
    strategyIds: perSeatStrategies,
  };
}

function buildRun(
  runIndex: number,
  arm: 'A' | 'B',
  scenarioId: string,
  seed: number,
  profile: SampleProfile,
  experimentId: string,
): PlannedSimulationRun {
  const armOffset = arm === 'A' ? 0 : 1;
  const runSeed = mixSeed((seed + armOffset) >>> 0, runIndex + 1);

  return {
    index: runIndex,
    simulationId: `${experimentId}:${arm}:${String(runIndex + 1).padStart(9, '0')}:${runSeed}`,
    scenario: scenarioId,
    mode: toCompatMode(profile.mode),
    seed: runSeed,
    humanPlayerCount: profile.playerCount,
    seatFactionIds: [...profile.seatFactionIds],
    seatOwnerIds: [...profile.seatOwnerIds],
    strategyIds: [...profile.strategyIds],
  };
}

function formatMetric(value: number) {
  return value.toFixed(6);
}

async function writeJson(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function ingestShardRecordsIntoAccumulator(shardPaths: string[], accumulator: ReturnType<typeof createArmAccumulator>) {
  for (const shardPath of shardPaths) {
    const reader = createInterface({
      input: createReadStream(shardPath, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });
    for await (const line of reader) {
      if (!line.trim()) {
        continue;
      }
      ingestArmRecord(accumulator, JSON.parse(line));
    }
  }
}

async function sampleTrajectoriesFromDir(
  dirPath: string,
  reservoir: TrajectoryReservoir,
) {
  let entries: Awaited<ReturnType<typeof readdir>>;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    return;
  }
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => join(dirPath, entry.name))
    .sort((left, right) => left.localeCompare(right));

  for (const filePath of files) {
    const payload = await readFile(filePath, 'utf8');
    reservoir.consider(JSON.parse(payload) as VictoryTrajectory);
  }
}

function buildComparisonOutput(
  comparison: ExperimentResult['comparison'],
  armA: ExperimentResult['armA'],
  armB: ExperimentResult['armB'],
) {
  return {
    ...comparison,
    armA: {
      mandateFailureDistribution: armA.mandateFailureDistribution,
    },
    armB: {
      mandateFailureDistribution: armB.mandateFailureDistribution,
    },
  };
}

function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function mergeScenarioPatchForExperiment(basePatch: ScenarioPatch | undefined, treatmentPatch: ScenarioPatch): ScenarioPatch {
  if (!basePatch) {
    return deepClone(treatmentPatch);
  }

  const merged = deepClone(basePatch);
  const incoming = deepClone(treatmentPatch);

  if (incoming.note) {
    merged.note = incoming.note;
  }

  if (incoming.setup) {
    merged.setup = { ...(merged.setup ?? {}) };
    if (incoming.setup.globalGazeDelta !== undefined) {
      merged.setup.globalGazeDelta = (merged.setup.globalGazeDelta ?? 0) + incoming.setup.globalGazeDelta;
    }
    if (incoming.setup.northernWarMachineDelta !== undefined) {
      merged.setup.northernWarMachineDelta = (merged.setup.northernWarMachineDelta ?? 0) + incoming.setup.northernWarMachineDelta;
    }
    if (incoming.setup.seededExtractionTotalDelta !== undefined) {
      merged.setup.seededExtractionTotalDelta = (merged.setup.seededExtractionTotalDelta ?? 0) + incoming.setup.seededExtractionTotalDelta;
    }
    if (incoming.setup.frontSeedDeltas) {
      const next = { ...(merged.setup.frontSeedDeltas ?? {}) };
      for (const [front, delta] of Object.entries(incoming.setup.frontSeedDeltas)) {
        next[front] = (next[front] ?? 0) + delta;
      }
      merged.setup.frontSeedDeltas = next;
    }
  }

  if (incoming.victory) {
    merged.victory = { ...(merged.victory ?? {}) };
    if (incoming.victory.liberationThresholdDelta !== undefined) {
      merged.victory.liberationThresholdDelta = (merged.victory.liberationThresholdDelta ?? 0) + incoming.victory.liberationThresholdDelta;
    }
    if (incoming.victory.overrideLiberationExtractionCap !== undefined) {
      merged.victory.overrideLiberationExtractionCap = incoming.victory.overrideLiberationExtractionCap;
    }
    if (incoming.victory.beaconThresholdTweaks) {
      merged.victory.beaconThresholdTweaks = [
        ...(merged.victory.beaconThresholdTweaks ?? []),
        ...incoming.victory.beaconThresholdTweaks,
      ];
    }
  }

  if (incoming.pressure) {
    merged.pressure = { ...(merged.pressure ?? {}) };
    if (incoming.pressure.crisisSpikeExtractionDelta !== undefined) {
      merged.pressure.crisisSpikeExtractionDelta = (merged.pressure.crisisSpikeExtractionDelta ?? 0) + incoming.pressure.crisisSpikeExtractionDelta;
    }
    if (incoming.pressure.maxExtractionAddedPerRound !== undefined) {
      merged.pressure.maxExtractionAddedPerRound = incoming.pressure.maxExtractionAddedPerRound;
    }
  }

  if (incoming.mandates) {
    merged.mandates = { ...(merged.mandates ?? {}) };
    if (incoming.mandates.relaxAllThresholdsBy !== undefined) {
      merged.mandates.relaxAllThresholdsBy = (merged.mandates.relaxAllThresholdsBy ?? 0) + incoming.mandates.relaxAllThresholdsBy;
    }
    if (incoming.mandates.classifyMandateFailureAs !== undefined) {
      merged.mandates.classifyMandateFailureAs = incoming.mandates.classifyMandateFailureAs;
    }
  }

  if (incoming.actions?.removeActionIds) {
    merged.actions = {
      ...(merged.actions ?? {}),
      removeActionIds: Array.from(new Set([...(merged.actions?.removeActionIds ?? []), ...incoming.actions.removeActionIds])),
    };
  }

  if (incoming.victoryGate) {
    merged.victoryGate = { ...(merged.victoryGate ?? {}) };
    if (incoming.victoryGate.minRoundBeforeVictory !== undefined) {
      merged.victoryGate.minRoundBeforeVictory = incoming.victoryGate.minRoundBeforeVictory;
    }
    if (incoming.victoryGate.requiredAction?.actionId !== undefined) {
      merged.victoryGate.requiredAction = { actionId: incoming.victoryGate.requiredAction.actionId };
    }
    if (incoming.victoryGate.requiredProgress?.extractionRemoved !== undefined) {
      merged.victoryGate.requiredProgress = {
        ...(merged.victoryGate.requiredProgress ?? {}),
        extractionRemoved: incoming.victoryGate.requiredProgress.extractionRemoved,
      };
    }
  }

  if (incoming.victoryScoring) {
    merged.victoryScoring = { ...(merged.victoryScoring ?? {}) };
    if (incoming.victoryScoring.mode !== undefined) {
      merged.victoryScoring.mode = incoming.victoryScoring.mode;
    }
    if (incoming.victoryScoring.threshold !== undefined) {
      merged.victoryScoring.threshold = incoming.victoryScoring.threshold;
    }
    if (incoming.victoryScoring.publicVictoryWeight !== undefined) {
      merged.victoryScoring.publicVictoryWeight = incoming.victoryScoring.publicVictoryWeight;
    }
    if (incoming.victoryScoring.mandatesWeight !== undefined) {
      merged.victoryScoring.mandatesWeight = incoming.victoryScoring.mandatesWeight;
    }
    if (incoming.victoryScoring.mandateProgressMode !== undefined) {
      merged.victoryScoring.mandateProgressMode = incoming.victoryScoring.mandateProgressMode;
    }
    if (incoming.victoryScoring.catastrophicCapEnabled !== undefined) {
      merged.victoryScoring.catastrophicCapEnabled = incoming.victoryScoring.catastrophicCapEnabled;
    }
    if (incoming.victoryScoring.catastrophicCapValue !== undefined) {
      merged.victoryScoring.catastrophicCapValue = incoming.victoryScoring.catastrophicCapValue;
    }
  }

  return merged;
}

function detectStructuralDiagnostics(armA: ExperimentResult['armA'], armB: ExperimentResult['armB']): StructuralDiagnostics {
  const impossibleMandates = [
    ...armA.mandateFailureDistribution
      .filter((entry) => entry.attempts > 0 && entry.failureRate > 0.95)
      .map((entry) => ({
        arm: 'A' as const,
        mandateId: entry.mandateId,
        failureRate: entry.failureRate,
        attempts: entry.attempts,
      })),
    ...armB.mandateFailureDistribution
      .filter((entry) => entry.attempts > 0 && entry.failureRate > 0.95)
      .map((entry) => ({
        arm: 'B' as const,
        mandateId: entry.mandateId,
        failureRate: entry.failureRate,
        attempts: entry.attempts,
      })),
  ];

  const turnOneVictoryWarning = armA.turnOnePublicVictoryRate > 0.05 || armB.turnOnePublicVictoryRate > 0.05;
  const victoryPredicateSatisfiedBeforeAllowedRoundWarning = armA.victoryBeforeAllowedRoundRate > 0
    || armB.victoryBeforeAllowedRoundRate > 0;
  const earlyTerminationWarning = armA.earlyTerminationRate > 0.05 || armB.earlyTerminationRate > 0.05;
  const noGameplayWarning = armA.turns.average < 2 || armB.turns.average < 2;
  const publicVictoryHighButSuccessLowWarning = (armA.publicVictoryRate >= 0.5 && armA.successRate <= 0.05)
    || (armB.publicVictoryRate >= 0.5 && armB.successRate <= 0.05);
  const hasScoreSignals = armA.victoryScoreMean > 0 || armB.victoryScoreMean > 0;
  const unreachableThresholdWarning = hasScoreSignals && ((armA.victoryScoreP90 + 5) < 70
    || (armB.victoryScoreP90 + 5) < 70);
  const summary: string[] = [];

  if (turnOneVictoryWarning) {
    summary.push('Victory condition satisfied during setup or turn 1. This indicates victory predicate is reachable before gameplay.');
  }
  if (victoryPredicateSatisfiedBeforeAllowedRoundWarning) {
    summary.push('victoryPredicateSatisfiedBeforeAllowedRound detected. Public victory predicate can trigger before minRoundBeforeVictory.');
  }
  if (earlyTerminationWarning) {
    summary.push('Early terminations are elevated (games ending before round 3). Structural defeat pressure may be too high.');
  }
  if (noGameplayWarning) {
    summary.push('Simulation ends before meaningful gameplay occurs. Victory gating likely required.');
  }
  if (publicVictoryHighButSuccessLowWarning) {
    summary.push('Public victory is frequently reached, but score success remains near zero. Revisit victory score composition and mandate weighting.');
  }
  if (unreachableThresholdWarning) {
    summary.push('Observed victory score distribution suggests the threshold is structurally unreachable in practice.');
  }
  if (impossibleMandates.length > 0) {
    summary.push('One or more mandates appear structurally impossible under current rules.');
  }

  return {
    turnOneVictoryWarning,
    victoryPredicateSatisfiedBeforeAllowedRoundWarning,
    earlyTerminationWarning,
    noGameplayWarning,
    publicVictoryHighButSuccessLowWarning,
    unreachableThresholdWarning,
    impossibleMandates,
    summary,
  };
}

export async function runExperiment(definition: ExperimentDefinition, options?: RunExperimentOptions): Promise<ExperimentResult> {
  assertPlayerCounts(definition.playerCounts);
  assertVictoryModes(definition.victoryModes);

  const scenario = getRulesetDefinition(definition.scenarioId);
  if (!scenario) {
    throw new Error(`Unknown scenario in experiment definition: ${definition.scenarioId}`);
  }

  const outputRoot = resolve(options?.outDir ?? DEFAULT_OUT_DIR);
  const outputDir = join(outputRoot, definition.id);
  const recordTrajectories = Boolean(options?.recordTrajectories);
  const parallelWorkers = Math.max(1, Math.floor(options?.parallelWorkers ?? 1));
  const aggregatedLogs = options?.logMode === 'aggregated';
  const logInfo = (line: string) => {
    console.log(line);
  };
  const logVerbose = (line: string) => {
    if (!aggregatedLogs) {
      console.log(line);
    }
  };
  const trajectoryReservoir = new TrajectoryReservoir(
    MAX_TRAJECTORIES_PER_EXPERIMENT,
    mixSeed(definition.seed, stableHash(`${definition.id}:trajectory-reservoir`)),
  );

  logInfo(`🔬 Experiment start id=${definition.id}`);

  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();

  const baselinePatch = options?.baselinePatch;
  const baselineMounted = baselinePatch
    ? applyScenarioPatch({
      experimentId: `${definition.id}_baseline_A`,
      scenarioId: definition.scenarioId,
      patch: baselinePatch,
    })
    : null;
  const treatmentPatch = mergeScenarioPatchForExperiment(baselinePatch, definition.patch);
  const patchedScenario = applyScenarioPatch({
    experimentId: definition.id,
    scenarioId: definition.scenarioId,
    patch: treatmentPatch,
  });
  const previousSimulationQuiet = process.env.SIMULATION_QUIET;
  if (aggregatedLogs) {
    process.env.SIMULATION_QUIET = '1';
  }

  try {
    const strategyIds = listStrategyProfiles().map((profile) => profile.id) as StrategyId[];
    const factionIds = scenario.factions.map((faction) => faction.id as FactionId);

    const armAAccumulator = createArmAccumulator('A', mixSeed(definition.seed, stableHash('arm-A')));
    const armBAccumulator = createArmAccumulator(
      'B',
      mixSeed(definition.seed, stableHash('arm-B')),
      {
        mandateFailureAsCostlyWin: definition.patch.mandates?.classifyMandateFailureAs === 'COSTLY_WIN',
      },
    );

    logVerbose(`🅰️ Arm A baseline runs=${definition.runsPerArm}`);
    logVerbose(`🅱️ Arm B treatment patch=${definition.patch.note ?? 'scenario-local patch applied'}`);

    const progressInterval = Math.max(1, Math.floor(definition.runsPerArm / 20));
    const plannedRunsA: PlannedSimulationRun[] = [];
    const plannedRunsB: PlannedSimulationRun[] = [];
    const baselineScenarioId = baselineMounted?.treatmentScenarioId ?? patchedScenario.baselineScenarioId;
    for (let runIndex = 0; runIndex < definition.runsPerArm; runIndex += 1) {
      const sampleProfile = buildSampleProfile(runIndex, definition, factionIds, strategyIds);
      plannedRunsA.push(buildRun(
        runIndex,
        'A',
        baselineScenarioId,
        definition.seed,
        sampleProfile,
        definition.id,
      ));
      plannedRunsB.push(buildRun(
        runIndex,
        'B',
        patchedScenario.treatmentScenarioId,
        definition.seed,
        sampleProfile,
        definition.id,
      ));
    }

    const workerBatchCompatible = true;
    if (parallelWorkers > 1 && workerBatchCompatible) {
      logInfo(`⚙️ Experiment worker batching enabled parallelWorkers=${parallelWorkers}`);
      const tempRoot = join(outputRoot, `.tmp_${definition.id}_${Date.now()}`);
      const shardRootA = join(tempRoot, 'arm_A_shards');
      const shardRootB = join(tempRoot, 'arm_B_shards');
      const trajectorySpool = join(tempRoot, 'trajectories');
      try {
        const armAResult = await executePlannedRunsWithWorkers({
          runs: plannedRunsA,
          parallelWorkers,
          shardDir: shardRootA,
          progressInterval,
          trajectoryRecording: recordTrajectories,
          trajectoryDir: trajectorySpool,
          progressLabel: `Experiment ${definition.id} arm A progress`,
          progressThrottleMs: aggregatedLogs ? 5000 : 0,
          suppressSanityWarnings: aggregatedLogs,
          scenarioPatches: baselinePatch
            ? [
              {
                experimentId: `${definition.id}_baseline_A`,
                scenarioId: definition.scenarioId,
                patch: baselinePatch,
              },
            ]
            : undefined,
        });
        const armBResult = await executePlannedRunsWithWorkers({
          runs: plannedRunsB,
          parallelWorkers,
          shardDir: shardRootB,
          progressInterval,
          trajectoryRecording: recordTrajectories,
          trajectoryDir: trajectorySpool,
          progressLabel: `Experiment ${definition.id} arm B progress`,
          progressThrottleMs: aggregatedLogs ? 5000 : 0,
          suppressSanityWarnings: aggregatedLogs,
          scenarioPatches: [
            ...(baselinePatch
              ? [
                {
                  experimentId: `${definition.id}_baseline_A`,
                  scenarioId: definition.scenarioId,
                  patch: baselinePatch,
                },
              ]
              : []),
            {
              experimentId: definition.id,
              scenarioId: definition.scenarioId,
              patch: treatmentPatch,
            },
          ],
        });

        await ingestShardRecordsIntoAccumulator(armAResult.shardPaths, armAAccumulator);
        await ingestShardRecordsIntoAccumulator(armBResult.shardPaths, armBAccumulator);

        if (recordTrajectories) {
          await sampleTrajectoriesFromDir(trajectorySpool, trajectoryReservoir);
          logVerbose(`📊 Trajectory spool sampled ${trajectoryReservoir.totalSeen()} captures before reservoir cap.`);
        }
      } finally {
        await rm(tempRoot, { recursive: true, force: true });
      }
    } else {
      const sequentialProgressInterval = aggregatedLogs
        ? Math.max(1, Math.floor(definition.runsPerArm / 10))
        : progressInterval;
      for (let runIndex = 0; runIndex < definition.runsPerArm; runIndex += 1) {
        const runA = plannedRunsA[runIndex];
        const runB = plannedRunsB[runIndex];
        if (!runA || !runB) {
          continue;
        }
        const outcomeA = runSingleSimulation(runA, { trajectoryRecording: recordTrajectories });
        const outcomeB = runSingleSimulation(runB, { trajectoryRecording: recordTrajectories });

        if (recordTrajectories && outcomeA.trajectory) {
          trajectoryReservoir.consider(outcomeA.trajectory);
          const capturedCount = trajectoryReservoir.totalSeen();
          if (capturedCount <= 5 || capturedCount % 50 === 0) {
            logVerbose(`🏁 Public victory trajectory captured arm=A sim=${runA.simulationId} count=${capturedCount}`);
          }
        }
        if (recordTrajectories && outcomeB.trajectory) {
          trajectoryReservoir.consider(outcomeB.trajectory);
          const capturedCount = trajectoryReservoir.totalSeen();
          if (capturedCount <= 5 || capturedCount % 50 === 0) {
            logVerbose(`🏁 Public victory trajectory captured arm=B sim=${runB.simulationId} count=${capturedCount}`);
          }
        }

        ingestArmRecord(armAAccumulator, outcomeA.record);
        ingestArmRecord(armBAccumulator, outcomeB.record);

        if ((runIndex + 1) % sequentialProgressInterval === 0 || runIndex + 1 === definition.runsPerArm) {
          logInfo(`🧮 Progress ${runIndex + 1}/${definition.runsPerArm} pairs complete`);
        }
      }
    }

    logInfo('📈 Aggregating metrics...');

    const armA = finalizeArmSummary(armAAccumulator);
    const armB = finalizeArmSummary(armBAccumulator);

    const confidence = definition.decisionRule.confidence ?? 0.95;
    const comparison = compareArms(armA, armB, confidence);
    const recommendation = buildRecommendation(definition, comparison);
    const structuralDiagnostics = detectStructuralDiagnostics(armA, armB);

    const successRate = comparison.metrics.successRate;
    logInfo(
      `📊 successRate A=${formatMetric(successRate.armA)} B=${formatMetric(successRate.armB)} lift=${successRate.absoluteLift >= 0 ? '+' : ''}${formatMetric(successRate.absoluteLift)} p=${successRate.proportionStats?.pValue ?? 'n/a'}`,
    );
    logInfo(`🧠 Decision=${recommendation.decision} reason=${recommendation.rationale.join(' | ')}`);
    if (structuralDiagnostics.turnOneVictoryWarning) {
      console.log('🚨 Structural Warning: Victory condition satisfied during setup or turn 1. This indicates victory predicate is reachable before gameplay.');
    }
    if (structuralDiagnostics.victoryPredicateSatisfiedBeforeAllowedRoundWarning) {
      console.log('🚨 Structural Warning: victoryPredicateSatisfiedBeforeAllowedRound detected during experiments.');
    }
    if (structuralDiagnostics.earlyTerminationWarning) {
      console.log('🚨 Structural Warning: earlyTerminationRate exceeded 5% (games ending before round 3).');
    }
    if (structuralDiagnostics.noGameplayWarning) {
      console.log('🚨 Structural Warning: Simulation ends before meaningful gameplay occurs. Victory gating likely required.');
    }
    if (structuralDiagnostics.publicVictoryHighButSuccessLowWarning) {
      console.log('🚨 Structural Warning: publicVictoryRate is high while successRate remains near zero. Score composition likely over-constrained.');
    }
    if (structuralDiagnostics.unreachableThresholdWarning) {
      console.log('🚨 Structural Warning: observed victory scores indicate threshold may be unreachable under current configuration.');
    }
    for (const mandate of structuralDiagnostics.impossibleMandates) {
      if (!aggregatedLogs) {
        console.log(`⚠️ Mandate appears structurally impossible under current rules. arm=${mandate.arm} mandate=${mandate.mandateId} failureRate=${mandate.failureRate.toFixed(6)} attempts=${mandate.attempts}`);
      }
    }
    if (aggregatedLogs && structuralDiagnostics.impossibleMandates.length > 0) {
      logInfo(`⚠️ Mandates structurally impossible count=${structuralDiagnostics.impossibleMandates.length}`);
    }

    const finishedAtMs = Date.now();
    const result: ExperimentResult = {
      definition,
      outputDir,
      startedAt,
      finishedAt: new Date(finishedAtMs).toISOString(),
      durationMs: finishedAtMs - startedAtMs,
      armA,
      armB,
      comparison,
      recommendation,
      structuralDiagnostics,
    };

    logVerbose('🧾 Writing report...');

    await rm(outputDir, { recursive: true, force: true });
    await mkdir(outputDir, { recursive: true });

    await writeJson(join(outputDir, 'experiment_definition.json'), definition);
    await writeJson(join(outputDir, 'arm_A_summary.json'), armA);
    await writeJson(join(outputDir, 'arm_B_summary.json'), armB);
    await writeJson(join(outputDir, 'comparison.json'), buildComparisonOutput(comparison, armA, armB));
    await writeJson(join(outputDir, 'recommendation.json'), recommendation);
    await writeJson(join(outputDir, 'structural_diagnostics.json'), structuralDiagnostics);

    const reportMarkdown = renderMarkdownReport({
      definition,
      armA,
      armB,
      comparison,
      recommendation,
    });
    const reportHtml = renderHtmlReport({
      definition,
      armA,
      armB,
      comparison,
      recommendation,
    });

    await writeFile(join(outputDir, 'report.md'), reportMarkdown, 'utf8');
    await writeFile(join(outputDir, 'report.html'), reportHtml, 'utf8');

    if (recordTrajectories) {
      const trajectoryDir = join(outputDir, 'trajectories');
      await mkdir(trajectoryDir, { recursive: true });

      const stemCount = new Map<string, number>();
      const trajectories = trajectoryReservoir.values();
      for (const trajectory of trajectories) {
        const stem = buildTrajectoryFileStem(trajectory);
        const count = stemCount.get(stem) ?? 0;
        stemCount.set(stem, count + 1);

        const suffix = count === 0 ? '' : `_${count}`;
        const filePath = join(trajectoryDir, `${stem}${suffix}.json`);
        await writeJson(filePath, trajectory);
        logVerbose(`💾 Trajectory written to disk ${filePath}`);
      }

      logInfo(`📊 Trajectory sampling kept ${trajectories.length}/${trajectoryReservoir.totalSeen()} captures (max ${MAX_TRAJECTORIES_PER_EXPERIMENT}).`);
    }

    logInfo(`💾 Wrote report to ${outputDir}`);
    logInfo(`✅ Experiment complete: ${definition.id}`);

    return result;
  } finally {
    if (aggregatedLogs) {
      if (previousSimulationQuiet === undefined) {
        delete process.env.SIMULATION_QUIET;
      } else {
        process.env.SIMULATION_QUIET = previousSimulationQuiet;
      }
    }
    baselineMounted?.unregister();
    patchedScenario.unregister();
  }
}

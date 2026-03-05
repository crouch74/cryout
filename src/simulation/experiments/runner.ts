import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  buildBalancedSeatOwners,
  getRulesetDefinition,
  type FactionId,
  type VictoryMode as CompatVictoryMode,
} from '../../engine/index.ts';
import { runSingleSimulation } from '../autoplayEngine.ts';
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
  const noGameplayWarning = armA.turns.average < 2 || armB.turns.average < 2;
  const summary: string[] = [];

  if (turnOneVictoryWarning) {
    summary.push('Victory condition satisfied during setup or turn 1. This indicates victory predicate is reachable before gameplay.');
  }
  if (noGameplayWarning) {
    summary.push('Simulation ends before meaningful gameplay occurs. Victory gating likely required.');
  }
  if (impossibleMandates.length > 0) {
    summary.push('One or more mandates appear structurally impossible under current rules.');
  }

  return {
    turnOneVictoryWarning,
    noGameplayWarning,
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
  const trajectoryReservoir = new TrajectoryReservoir(
    MAX_TRAJECTORIES_PER_EXPERIMENT,
    mixSeed(definition.seed, stableHash(`${definition.id}:trajectory-reservoir`)),
  );

  console.log(`🔬 Experiment start id=${definition.id}`);

  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();

  const patchedScenario = applyScenarioPatch({
    experimentId: definition.id,
    scenarioId: definition.scenarioId,
    patch: definition.patch,
  });

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

    console.log(`🅰️ Arm A baseline runs=${definition.runsPerArm}`);
    console.log(`🅱️ Arm B treatment patch=${definition.patch.note ?? 'scenario-local patch applied'}`);

    const progressInterval = Math.max(1, Math.floor(definition.runsPerArm / 20));

    for (let runIndex = 0; runIndex < definition.runsPerArm; runIndex += 1) {
      const sampleProfile = buildSampleProfile(runIndex, definition, factionIds, strategyIds);

      const runA = buildRun(
        runIndex,
        'A',
        patchedScenario.baselineScenarioId,
        definition.seed,
        sampleProfile,
        definition.id,
      );
      const runB = buildRun(
        runIndex,
        'B',
        patchedScenario.treatmentScenarioId,
        definition.seed,
        sampleProfile,
        definition.id,
      );

      const outcomeA = runSingleSimulation(runA, { trajectoryRecording: recordTrajectories });
      const outcomeB = runSingleSimulation(runB, { trajectoryRecording: recordTrajectories });

      const recordA = outcomeA.record;
      const recordB = outcomeB.record;

      if (recordTrajectories && outcomeA.trajectory) {
        trajectoryReservoir.consider(outcomeA.trajectory);
        const capturedCount = trajectoryReservoir.totalSeen();
        if (capturedCount <= 5 || capturedCount % 50 === 0) {
          console.log(`🏁 Public victory trajectory captured arm=A sim=${runA.simulationId} count=${capturedCount}`);
        }
      }
      if (recordTrajectories && outcomeB.trajectory) {
        trajectoryReservoir.consider(outcomeB.trajectory);
        const capturedCount = trajectoryReservoir.totalSeen();
        if (capturedCount <= 5 || capturedCount % 50 === 0) {
          console.log(`🏁 Public victory trajectory captured arm=B sim=${runB.simulationId} count=${capturedCount}`);
        }
      }

      ingestArmRecord(armAAccumulator, recordA);
      ingestArmRecord(armBAccumulator, recordB);

      if ((runIndex + 1) % progressInterval === 0 || runIndex + 1 === definition.runsPerArm) {
        console.log(`🧮 Progress ${runIndex + 1}/${definition.runsPerArm} pairs complete`);
      }
    }

    console.log('📈 Aggregating metrics...');

    const armA = finalizeArmSummary(armAAccumulator);
    const armB = finalizeArmSummary(armBAccumulator);

    const confidence = definition.decisionRule.confidence ?? 0.95;
    const comparison = compareArms(armA, armB, confidence);
    const recommendation = buildRecommendation(definition, comparison);
    const structuralDiagnostics = detectStructuralDiagnostics(armA, armB);

    const winRate = comparison.metrics.winRate;
    console.log(
      `📊 winRate A=${formatMetric(winRate.armA)} B=${formatMetric(winRate.armB)} lift=${winRate.absoluteLift >= 0 ? '+' : ''}${formatMetric(winRate.absoluteLift)} p=${winRate.proportionStats?.pValue ?? 'n/a'}`,
    );
    console.log(`🧠 Decision=${recommendation.decision} reason=${recommendation.rationale.join(' | ')}`);
    if (structuralDiagnostics.turnOneVictoryWarning) {
      console.log('🚨 Structural Warning: Victory condition satisfied during setup or turn 1. This indicates victory predicate is reachable before gameplay.');
    }
    if (structuralDiagnostics.noGameplayWarning) {
      console.log('🚨 Structural Warning: Simulation ends before meaningful gameplay occurs. Victory gating likely required.');
    }
    for (const mandate of structuralDiagnostics.impossibleMandates) {
      console.log(`⚠️ Mandate appears structurally impossible under current rules. arm=${mandate.arm} mandate=${mandate.mandateId} failureRate=${mandate.failureRate.toFixed(6)} attempts=${mandate.attempts}`);
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

    console.log('🧾 Writing report...');

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
        console.log(`💾 Trajectory written to disk ${filePath}`);
      }

      console.log(`📊 Trajectory sampling kept ${trajectories.length}/${trajectoryReservoir.totalSeen()} captures (max ${MAX_TRAJECTORIES_PER_EXPERIMENT}).`);
    }

    console.log(`💾 Wrote report to ${outputDir}`);
    console.log(`✅ Experiment complete: ${definition.id}`);

    return result;
  } finally {
    patchedScenario.unregister();
  }
}

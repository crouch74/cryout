import process from 'node:process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { TrajectorySummary, VictoryTrajectory } from './types.ts';

interface AnalyzeOptions {
  experimentId?: string;
  inputDir?: string;
  outputPath?: string;
}

function toRate(count: number, total: number) {
  if (total <= 0) {
    return 0;
  }
  return Number((count / total).toFixed(6));
}

function toAvg(total: number, count: number) {
  if (count <= 0) {
    return 0;
  }
  return Number((total / count).toFixed(6));
}

function normalizeActionId(actionId: string) {
  return actionId
    .split('_')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
}

function formatPercent(rate: number) {
  return `${(rate * 100).toFixed(1)}%`;
}

function mapTopCounts(map: Map<string, number>, total: number, limit: number, keyLabel: 'action' | 'sequence') {
  return Array.from(map.entries())
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })
    .slice(0, limit)
    .map(([key, count]) => ({
      [keyLabel]: key,
      count,
      rate: toRate(count, total),
    })) as Array<{ action?: string; sequence?: string; count: number; rate: number }>;
}

export function summarizeTrajectories(trajectories: VictoryTrajectory[]): TrajectorySummary {
  const total = trajectories.length;

  const firstActionCounts = new Map<string, number>();
  const sequenceCounts = new Map<string, number>();
  const roundVictoryCounts = new Map<number, number>();

  let turnsTotal = 0;
  let extractionRemovedTotal = 0;
  let roundVictoryTotal = 0;
  let progressExtractionRemovedTotal = 0;

  for (const trajectory of trajectories) {
    turnsTotal += trajectory.turnsPlayed;
    extractionRemovedTotal += trajectory.steps.reduce((sum, step) => sum + (step.result.extractionRemoved ?? 0), 0);
    roundVictoryTotal += trajectory.roundVictoryTriggered ?? trajectory.turnsPlayed;
    progressExtractionRemovedTotal += trajectory.progressAtVictory?.extractionRemoved
      ?? trajectory.steps.reduce((sum, step) => sum + (step.result.extractionRemoved ?? 0), 0);
    roundVictoryCounts.set(
      trajectory.roundVictoryTriggered ?? trajectory.turnsPlayed,
      (roundVictoryCounts.get(trajectory.roundVictoryTriggered ?? trajectory.turnsPlayed) ?? 0) + 1,
    );

    const first = trajectory.steps[0]?.action;
    if (first) {
      firstActionCounts.set(first, (firstActionCounts.get(first) ?? 0) + 1);
    }

    const sequence = trajectory.steps.map((step) => step.action).join(' > ');
    if (sequence.length > 0) {
      sequenceCounts.set(sequence, (sequenceCounts.get(sequence) ?? 0) + 1);
    }
  }

  const topFirstActions = mapTopCounts(firstActionCounts, total, 5, 'action')
    .map((entry) => ({
      action: normalizeActionId(String(entry.action)),
      count: entry.count,
      rate: entry.rate,
    }));

  const topActionSequences = mapTopCounts(sequenceCounts, total, 5, 'sequence')
    .map((entry) => ({
      sequence: String(entry.sequence),
      count: entry.count,
      rate: entry.rate,
    }));

  const distributionOfVictoryRounds = Array.from(roundVictoryCounts.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([round, count]) => ({
      round,
      count,
      rate: toRate(count, total),
    }));

  return {
    totalTrajectories: total,
    averageTurnsToVictory: toAvg(turnsTotal, total),
    averageExtractionRemovedBeforeVictory: toAvg(extractionRemovedTotal, total),
    mostCommonFirstAction: topFirstActions[0] ?? null,
    mostCommonActionSequence: topActionSequences[0] ?? null,
    topFirstActions,
    topActionSequences,
    averageRoundVictory: toAvg(roundVictoryTotal, total),
    distributionOfVictoryRounds,
    progressBeforeVictory: {
      averageExtractionRemoved: toAvg(progressExtractionRemovedTotal, total),
    },
  };
}

async function loadTrajectories(inputDir: string) {
  const entries = await readdir(inputDir, { withFileTypes: true });
  const jsonFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => join(inputDir, entry.name));

  const trajectories: VictoryTrajectory[] = [];
  for (const filePath of jsonFiles) {
    const payload = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(payload) as VictoryTrajectory;
    trajectories.push(parsed);
  }

  return trajectories;
}

function parseArgs(argv: string[]): AnalyzeOptions {
  const options: AnalyzeOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith('--')) {
      continue;
    }

    const readValue = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for ${arg}`);
      }
      index += 1;
      return value;
    };

    if (arg === '--experiment') {
      options.experimentId = readValue();
      continue;
    }

    if (arg === '--input') {
      options.inputDir = resolve(readValue());
      continue;
    }

    if (arg === '--out') {
      options.outputPath = resolve(readValue());
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function resolvePaths(options: AnalyzeOptions) {
  if (options.experimentId) {
    const experimentRoot = resolve(process.cwd(), 'simulation_output/experiments', options.experimentId);
    return {
      inputDir: options.inputDir ?? join(experimentRoot, 'trajectories'),
      outputPath: options.outputPath ?? join(experimentRoot, 'trajectory_summary.json'),
    };
  }

  return {
    inputDir: options.inputDir ?? resolve(process.cwd(), 'simulation_output/trajectories'),
    outputPath: options.outputPath ?? resolve(process.cwd(), 'simulation_output/trajectory_summary.json'),
  };
}

export async function analyzeTrajectoriesCli(argv: string[]) {
  const options = parseArgs(argv);
  const { inputDir, outputPath } = resolvePaths(options);

  console.log('🧭 Analysing victory trajectories...');

  const trajectories = await loadTrajectories(inputDir);
  const summary = summarizeTrajectories(trajectories);
  const victoryTrajectoryAnalysis = {
    averageRoundVictory: summary.averageRoundVictory,
    distributionOfVictoryRounds: summary.distributionOfVictoryRounds,
    progressBeforeVictory: summary.progressBeforeVictory,
    actionsLeadingToVictory: summary.topActionSequences,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  const victoryAnalysisPath = join(dirname(outputPath), 'victory_trajectory_analysis.json');
  await writeFile(victoryAnalysisPath, `${JSON.stringify(victoryTrajectoryAnalysis, null, 2)}\n`, 'utf8');

  console.log(`📊 Found ${summary.totalTrajectories} trajectories`);
  console.log(`📊 Average turns to public victory: ${summary.averageTurnsToVictory.toFixed(2)}`);
  if (summary.mostCommonFirstAction) {
    console.log(`📊 Most common opening action: ${summary.mostCommonFirstAction.action} (${formatPercent(summary.mostCommonFirstAction.rate)})`);
  } else {
    console.log('📊 Most common opening action: n/a');
  }
  console.log(`📊 Average extraction removed before victory: ${summary.averageExtractionRemovedBeforeVictory.toFixed(2)}`);
  console.log(`📊 Average round victory triggered: ${summary.averageRoundVictory.toFixed(2)}`);
  console.log(`📊 Trajectory analysis complete: ${outputPath}`);
  console.log(`📊 Victory trajectory analysis complete: ${victoryAnalysisPath}`);
}

const isMainModule = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isMainModule) {
  try {
    await analyzeTrajectoriesCli(process.argv.slice(2));
  } catch (error) {
    const err = error as Error;
    console.error('❌ Trajectory analysis failed');
    console.error(err.message);
    process.exitCode = 1;
  }
}

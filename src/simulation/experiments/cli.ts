import process from 'node:process';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { EXPERIMENT_BACKLOG, getExperimentById } from './hypotheses/backlog.ts';
import { runExperiment } from './runner.ts';
import type { ExperimentDefinition, VictoryMode } from './types.ts';

export interface CliArgs {
  all: boolean;
  id?: string;
  runs?: number;
  seed?: number;
  outDir?: string;
  modes?: VictoryMode[];
  players?: number[];
  recordTrajectories: boolean;
}

function toPositiveInteger(value: string, label: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
}

function parseModes(raw: string): VictoryMode[] {
  const parsed = raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);

  if (parsed.length === 0) {
    throw new Error('--modes must include at least one mode.');
  }

  const unique = Array.from(new Set(parsed));
  for (const mode of unique) {
    if (mode !== 'liberation' && mode !== 'symbolic') {
      throw new Error(`Unsupported mode ${mode}. Use liberation or symbolic.`);
    }
  }

  return unique as VictoryMode[];
}

function parsePlayers(raw: string): number[] {
  const parsed = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => toPositiveInteger(entry, '--players'));

  if (parsed.length === 0) {
    throw new Error('--players must include at least one count.');
  }

  const unique = Array.from(new Set(parsed));
  for (const playerCount of unique) {
    if (playerCount !== 2 && playerCount !== 3 && playerCount !== 4) {
      throw new Error(`Unsupported player count ${playerCount}. Allowed values are 2, 3, 4.`);
    }
  }

  return unique;
}

export function parseArgs(argv: string[]): CliArgs {
  const result: CliArgs = { all: false, recordTrajectories: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--all') {
      result.all = true;
      continue;
    }

    if (arg === '--record-trajectories') {
      result.recordTrajectories = true;
      continue;
    }

    if (!arg.startsWith('--')) {
      continue;
    }

    const readValue = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for ${arg}.`);
      }
      index += 1;
      return value;
    };

    if (arg === '--id') {
      result.id = readValue();
      continue;
    }

    if (arg === '--runs') {
      result.runs = toPositiveInteger(readValue(), '--runs');
      continue;
    }

    if (arg === '--seed') {
      result.seed = toPositiveInteger(readValue(), '--seed') >>> 0;
      continue;
    }

    if (arg === '--out') {
      result.outDir = resolve(readValue());
      continue;
    }

    if (arg === '--modes') {
      result.modes = parseModes(readValue());
      continue;
    }

    if (arg === '--players') {
      result.players = parsePlayers(readValue());
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return result;
}

export function applyOverrides(definition: ExperimentDefinition, args: CliArgs): ExperimentDefinition {
  return {
    ...definition,
    runsPerArm: args.runs ?? definition.runsPerArm,
    seed: args.seed ?? definition.seed,
    victoryModes: args.modes ?? definition.victoryModes,
    playerCounts: args.players ?? definition.playerCounts,
  };
}

export async function runSingle(args: CliArgs) {
  if (!args.id) {
    throw new Error('Single experiment mode requires --id <experiment-id>.');
  }

  const found = getExperimentById(args.id);
  if (!found) {
    const known = EXPERIMENT_BACKLOG.map((experiment) => experiment.id).join(', ');
    throw new Error(`Unknown experiment id: ${args.id}. Known ids: ${known}`);
  }

  const resolved = applyOverrides(found, args);
  const outputRoot = resolve(args.outDir ?? 'simulation_output/experiments');

  const result = await runExperiment(resolved, {
    outDir: outputRoot,
    recordTrajectories: args.recordTrajectories,
  });
  console.log(JSON.stringify({
    id: result.definition.id,
    decision: result.recommendation.decision,
    outputDir: result.outputDir,
    runsPerArm: result.definition.runsPerArm,
    seed: result.definition.seed,
  }, null, 2));
}

export async function runAll(args: CliArgs) {
  const outputRoot = resolve(args.outDir ?? 'simulation_output/experiments');
  await mkdir(outputRoot, { recursive: true });

  const indexEntries: Array<{
    id: string;
    title: string;
    decision: string;
    outputDir: string;
    successRateA: number;
    successRateB: number;
    publicVictoryRateA: number;
    publicVictoryRateB: number;
    durationMs: number;
  }> = [];

  for (const experiment of EXPERIMENT_BACKLOG) {
    const resolved = applyOverrides(experiment, args);
    const result = await runExperiment(resolved, {
      outDir: outputRoot,
      recordTrajectories: args.recordTrajectories,
    });
    indexEntries.push({
      id: result.definition.id,
      title: result.definition.title,
      decision: result.recommendation.decision,
      outputDir: result.outputDir,
      successRateA: result.armA.successRate,
      successRateB: result.armB.successRate,
      publicVictoryRateA: result.armA.publicVictoryRate,
      publicVictoryRateB: result.armB.publicVictoryRate,
      durationMs: result.durationMs,
    });
  }

  const indexPath = join(outputRoot, 'index.json');
  await writeFile(indexPath, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    totalExperiments: indexEntries.length,
    experiments: indexEntries,
  }, null, 2)}\n`, 'utf8');

  console.log(`📚 Backlog complete. Index written to ${indexPath}`);
}

export async function runCli(argv: string[]) {
  const args = parseArgs(argv);
  if (args.all) {
    await runAll(args);
    return;
  }
  await runSingle(args);
}

const isMainModule = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isMainModule) {
  try {
    await runCli(process.argv.slice(2));
  } catch (error) {
    const err = error as Error;
    console.error('❌ Experiment CLI failed');
    console.error(err.message);
    process.exitCode = 1;
  }
}

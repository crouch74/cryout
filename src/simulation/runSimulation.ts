import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { cpus } from 'node:os';
import { runSimulationBatch } from './autoplayEngine.ts';
import type { SimulationBatchConfig, SimulationVictoryMode } from './types.ts';

export interface SimulationCliOptions {
  runs: number;
  scenarios: string[];
  victoryModes: SimulationVictoryMode[];
  seed?: number;
  parallelWorkers: number;
  debugSingle: boolean;
  splitShards: boolean;
}

function toPositiveInteger(value: string, label: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
}

function normalizeMode(value: string): SimulationVictoryMode[] {
  const lowered = value.toLowerCase();
  if (lowered === 'both') {
    return ['liberation', 'symbolic'];
  }
  if (lowered === 'liberation') {
    return ['liberation'];
  }
  if (lowered === 'symbolic') {
    return ['symbolic'];
  }
  throw new Error(`Unsupported mode "${value}". Use liberation, symbolic, or both.`);
}

function defaultParallelWorkers() {
  const cpuCount = Math.max(1, cpus().length);
  return Math.max(1, cpuCount - 1);
}

export function parseCliArgs(argv: string[]): SimulationCliOptions {
  const scenarios: string[] = [];
  let runs = 100000;
  let victoryModes: SimulationVictoryMode[] = ['liberation', 'symbolic'];
  let seed: number | undefined;
  let parallelWorkers = defaultParallelWorkers();
  let debugSingle = false;
  let splitShards = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
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

    if (arg === '--runs') {
      runs = toPositiveInteger(readValue(), '--runs');
      continue;
    }

    if (arg === '--scenario') {
      const value = readValue();
      const nextScenarios = value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
      scenarios.push(...nextScenarios);
      continue;
    }

    if (arg === '--mode') {
      victoryModes = normalizeMode(readValue());
      continue;
    }

    if (arg === '--seed') {
      seed = toPositiveInteger(readValue(), '--seed') >>> 0;
      continue;
    }

    if (arg === '--parallel') {
      parallelWorkers = toPositiveInteger(readValue(), '--parallel');
      continue;
    }

    if (arg === '--debug-single') {
      debugSingle = true;
      continue;
    }

    if (arg === '--split-shards') {
      splitShards = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    runs,
    scenarios,
    victoryModes,
    seed,
    parallelWorkers,
    debugSingle,
    splitShards,
  };
}

export async function runCli(argv: string[]) {
  const parsed = parseCliArgs(argv);
  const debugScenario = parsed.scenarios[0] ?? 'base_design';
  const config: SimulationBatchConfig = {
    runsPerScenario: parsed.debugSingle ? 1 : parsed.runs,
    scenarios: parsed.debugSingle
      ? [debugScenario]
      : (parsed.scenarios.length > 0 ? parsed.scenarios : undefined),
    victoryModes: parsed.victoryModes,
    randomSeed: parsed.seed,
    parallelWorkers: parsed.debugSingle ? 1 : parsed.parallelWorkers,
    debugSingle: parsed.debugSingle,
    splitOutputShards: parsed.splitShards,
  };

  console.log('🎛️ Simulation CLI options resolved');
  console.log(JSON.stringify({
    runsPerScenario: config.runsPerScenario,
    scenarios: config.scenarios ?? 'all',
    victoryModes: config.victoryModes,
    randomSeed: config.randomSeed ?? 'auto',
    parallelWorkers: config.parallelWorkers,
    debugSingle: config.debugSingle ?? false,
    splitShards: config.splitOutputShards ?? false,
  }, null, 2));
  console.log('📸 Round snapshots are enabled (max 25 per simulation run).');

  const result = await runSimulationBatch(config);

  console.log('📦 Simulation outputs ready');
  console.log(JSON.stringify({
    runs: result.runs,
    seed: result.seed,
    parallelWorkers: result.parallelWorkers,
    outputPath: result.outputPath,
    summaryPath: result.summaryPath,
    durationMs: result.durationMs,
  }, null, 2));
}

const isMainModule = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isMainModule) {
  try {
    await runCli(process.argv.slice(2));
  } catch (error) {
    const err = error as Error;
    console.error('❌ Simulation CLI failed');
    console.error(err.message);
    process.exitCode = 1;
  }
}

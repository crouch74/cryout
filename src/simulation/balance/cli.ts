import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { runBalanceSearch } from './SearchEngine.ts';

interface BalanceSearchCliArgs {
  scenarioId: string;
  iterations: number;
  runsPerCandidate: number;
  seed: number;
}

function toPositiveInteger(value: string, label: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
}

function parseArgs(argv: string[]): BalanceSearchCliArgs {
  const result: BalanceSearchCliArgs = {
    scenarioId: 'base_design',
    iterations: 200,
    runsPerCandidate: 25000,
    seed: 42,
  };

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

    if (arg === '--scenario') {
      result.scenarioId = readValue();
      continue;
    }

    if (arg === '--iterations') {
      result.iterations = toPositiveInteger(readValue(), '--iterations');
      continue;
    }

    if (arg === '--runs') {
      result.runsPerCandidate = toPositiveInteger(readValue(), '--runs');
      continue;
    }

    if (arg === '--seed') {
      result.seed = toPositiveInteger(readValue(), '--seed') >>> 0;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return result;
}

export async function runCli(argv: string[]) {
  const args = parseArgs(argv);
  const result = await runBalanceSearch({
    scenarioId: args.scenarioId,
    iterations: args.iterations,
    runsPerCandidate: args.runsPerCandidate,
    seed: args.seed,
    topN: 10,
  });

  console.log('📊 Balance search complete');
  console.log(JSON.stringify({
    scenarioId: result.scenarioId,
    iterations: result.iterations,
    runsPerCandidate: result.runsPerCandidate,
    seed: result.seed,
    bestScore: result.bestCandidates[0]?.score ?? null,
    outputPath: 'simulation_output/balance_search/best_candidates.json',
  }, null, 2));
}

const isMainModule = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isMainModule) {
  try {
    await runCli(process.argv.slice(2));
  } catch (error) {
    const err = error as Error;
    console.error('❌ Balance search failed');
    console.error(err.message);
    process.exitCode = 1;
  }
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConfig, parseArgs, renderHelpManual } from '../../src/simulation/optimizer/cli.ts';

test('optimizer CLI parser reads all explicit flags', () => {
  const parsed = parseArgs([
    '--scenario', 'stones_cry_out',
    '--iterations', '12',
    '--baseline-runs', '9000',
    '--candidate-runs', '4000',
    '--candidates', '17',
    '--patience', '4',
    '--seed', '777',
    '--parallel-workers', '6',
    '--out', 'simulation_output/custom_optimizer',
    '--optimizer-mode', 'all_scenarios_parallel',
    '--mode', 'both',
    '--runtime', 'thorough',
    '--significance', 'strict',
    '--strategy', 'trajectory_discovery',
  ]);

  assert.equal(parsed.scenarioId, 'stones_cry_out');
  assert.equal(parsed.iterations, 12);
  assert.equal(parsed.baselineRuns, 9000);
  assert.equal(parsed.candidateRuns, 4000);
  assert.equal(parsed.candidates, 17);
  assert.equal(parsed.patience, 4);
  assert.equal(parsed.seed, 777);
  assert.equal(parsed.parallelWorkers, 6);
  assert.equal(parsed.executionMode, 'all_scenarios_parallel');
  assert.equal(parsed.mode, 'both');
  assert.equal(parsed.runtime, 'thorough');
  assert.equal(parsed.significance, 'strict');
  assert.equal(parsed.strategy, 'trajectory_discovery');
});

test('optimizer config applies balanced defaults when optional flags are omitted', async () => {
  const config = await buildConfig([
    '--scenario', 'stones_cry_out',
  ]);

  assert.equal(config.runtime, 'balanced');
  assert.equal(config.executionMode, 'single_scenario');
  assert.equal(config.baselineRuns, 10000);
  assert.equal(config.candidateRuns, 5000);
  assert.equal(config.candidates, 15);
  assert.equal(config.mode, 'liberation');
  assert.deepEqual(config.victoryModes, ['liberation']);
  assert.equal(config.significance, 'balanced');
  assert.equal(config.strategy, 'full_optimizer');
  assert.equal(config.patience, 3);
  assert.equal(config.seed, 42);
  assert.equal(config.parallelWorkers >= 1, true);
});

test('optimizer config maps mode=both to liberation and symbolic', async () => {
  const config = await buildConfig([
    '--scenario', 'stones_cry_out',
    '--mode', 'both',
  ]);

  assert.equal(config.mode, 'both');
  assert.deepEqual(config.victoryModes, ['liberation', 'symbolic']);
});

test('optimizer CLI parser accepts --help and -h', () => {
  const long = parseArgs(['--help']);
  const short = parseArgs(['-h']);

  assert.equal(long.help, true);
  assert.equal(short.help, true);
});

test('optimizer config builds all_scenarios_parallel mode without requiring a concrete scenario id', async () => {
  const config = await buildConfig([
    '--optimizer-mode', 'all_scenarios_parallel',
  ]);

  assert.equal(config.executionMode, 'all_scenarios_parallel');
  assert.equal(config.scenarioId.length > 0, true);
});

test('optimizer help manual documents all primary input flags and impacts', () => {
  const manual = renderHelpManual();

  assert.match(manual, /--scenario <id>/);
  assert.match(manual, /--iterations <n>/);
  assert.match(manual, /--baseline-runs <n>/);
  assert.match(manual, /--candidate-runs <n>/);
  assert.match(manual, /--candidates <n>/);
  assert.match(manual, /--patience <n>/);
  assert.match(manual, /--seed <n>/);
  assert.match(manual, /--parallel-workers <n>/);
  assert.match(manual, /--out <path>/);
  assert.match(manual, /--optimizer-mode <single_scenario\|all_scenarios_parallel>/);
  assert.match(manual, /--mode <liberation\|symbolic\|both>/);
  assert.match(manual, /liberation:\s+Optimize only Liberation mode metrics/i);
  assert.match(manual, /symbolic:\s+Optimize only Symbolic mode metrics/i);
  assert.match(manual, /both:\s+Optimize across both modes/i);
  assert.match(manual, /--runtime <fast\|balanced\|thorough>/);
  assert.match(manual, /--significance <strict\|balanced\|lenient>/);
  assert.match(manual, /--strategy <numeric_balancing\|victory_gating_exploration\|trajectory_discovery\|full_optimizer>/);
  assert.match(manual, /Implementation:/);
  assert.match(manual, /Impact:/);
  assert.match(manual, /Options:/);
});

test('optimizer CLI parser reads all GA flags', () => {
  const parsed = parseArgs([
    '--scenario', 'stones_cry_out',
    '--search-mode', 'hybrid',
    '--population', '20',
    '--generations', '8',
    '--ga-runs', '500',
    '--top-candidates', '4',
    '--mutation-rate', '0.2',
    '--crossover-rate', '0.7',
    '--elitism', '2',
  ]);

  assert.equal(parsed.searchMode, 'hybrid');
  assert.equal(parsed.gaPopulation, 20);
  assert.equal(parsed.gaGenerations, 8);
  assert.equal(parsed.gaRuns, 500);
  assert.equal(parsed.gaTopCandidates, 4);
  assert.ok(Math.abs((parsed.gaMutationRate ?? 0) - 0.2) < 1e-9);
  assert.ok(Math.abs((parsed.gaCrossoverRate ?? 0) - 0.7) < 1e-9);
  assert.equal(parsed.gaElitism, 2);
});

test('optimizer buildConfig defaults to local search mode with GA defaults when no GA flags given', async () => {
  const config = await buildConfig(['--scenario', 'stones_cry_out']);

  assert.equal(config.searchMode, 'local');
  assert.ok(config.gaConfig !== undefined);
  assert.equal(config.gaConfig?.populationSize, 30);
  assert.equal(config.gaConfig?.generations, 10);
  assert.equal(config.gaConfig?.runsPerIndividual, 1000);
  assert.equal(config.gaConfig?.topCandidates, 5);
  assert.ok(Math.abs((config.gaConfig?.mutationRate ?? 0) - 0.15) < 1e-9);
  assert.ok(Math.abs((config.gaConfig?.crossoverRate ?? 0) - 0.6) < 1e-9);
  assert.equal(config.gaConfig?.elitism, 3);
});

test('optimizer buildConfig applies GA overrides from CLI flags', async () => {
  const config = await buildConfig([
    '--scenario', 'stones_cry_out',
    '--search-mode', 'evolutionary',
    '--population', '15',
    '--generations', '5',
    '--ga-runs', '200',
  ]);

  assert.equal(config.searchMode, 'evolutionary');
  assert.equal(config.gaConfig?.populationSize, 15);
  assert.equal(config.gaConfig?.generations, 5);
  assert.equal(config.gaConfig?.runsPerIndividual, 200);
});

test('optimizer help manual documents all GA flags and section header', () => {
  const manual = renderHelpManual();

  assert.match(manual, /GA Evolutionary Search Parameters/);
  assert.match(manual, /--search-mode <local\|evolutionary\|hybrid>/);
  assert.match(manual, /--population <n>/);
  assert.match(manual, /--generations <n>/);
  assert.match(manual, /--ga-runs <n>/);
  assert.match(manual, /--top-candidates <n>/);
  assert.match(manual, /--mutation-rate <f>/);
  assert.match(manual, /--crossover-rate <f>/);
  assert.match(manual, /--elitism <n>/);
});


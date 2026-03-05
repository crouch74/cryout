import process from 'node:process';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import inquirer from 'inquirer';
import { EXPERIMENT_BACKLOG } from '../experiments/hypotheses/backlog.ts';
import { runExperiment } from '../experiments/runner.ts';
import type { ExperimentDefinition, ExperimentArmSummary } from '../experiments/types.ts';
import { runAll, type CliArgs } from '../experiments/cli.ts';
import { runBalanceSearch } from '../balance/SearchEngine.ts';
import type { VictoryTrajectory } from '../trajectory/types.ts';

const EXPERIMENT_OUTPUT_ROOT = resolve(process.cwd(), 'simulation_output/experiments');
const GLOBAL_TRAJECTORY_ROOT = resolve(process.cwd(), 'simulation_output/trajectories');

type MainMenuAction =
  | 'backlog'
  | 'single'
  | 'explore'
  | 'balance'
  | 'mandates'
  | 'trajectories'
  | 'exit';

function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function parseNumberInput(value: unknown, fallback: number) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function summarizeArm(arm: ExperimentArmSummary) {
  return [
    `📊 arm=${arm.arm}`,
    `📊 publicVictoryRate=${formatPercent(arm.publicVictoryRate)}`,
    `📊 winRate=${formatPercent(arm.winRate)}`,
    `📊 mandateFailRateGivenPublic=${formatPercent(arm.mandateFailRateGivenPublic)}`,
    `📊 defeat_extraction_breach=${arm.defeatReasons.extraction_breach}`,
    `📊 defeat_comrades_exhausted=${arm.defeatReasons.comrades_exhausted}`,
    `📊 defeat_mandate_failure=${arm.defeatReasons.mandate_failure}`,
    `📊 defeat_sudden_death=${arm.defeatReasons.sudden_death}`,
  ].join('\n');
}

function summarizeMandates(arm: ExperimentArmSummary) {
  if (arm.mandateFailureDistribution.length === 0) {
    return '📊 n/a';
  }

  return arm.mandateFailureDistribution
    .map((entry, index) => `${index + 1}. ${entry.mandateId} - ${formatPercent(entry.failureRate)} (${entry.attempts} attempts)`)
    .join('\n');
}

async function readJson<T>(filePath: string): Promise<T> {
  const payload = await readFile(filePath, 'utf8');
  return JSON.parse(payload) as T;
}

async function listExperimentResultDirs() {
  try {
    const entries = await readdir(EXPERIMENT_OUTPUT_ROOT, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

async function runExperimentBacklogFlow() {
  console.log('🧪 Running experiment backlog');
  const args: CliArgs = {
    all: true,
    recordTrajectories: false,
  };
  await runAll(args);
}

async function runSingleExperimentFlow() {
  const scenarioChoices = ['base_design', 'algerian_war_of_independence', 'tahrir_square', 'woman_life_freedom'];
  const { scenarioId } = await inquirer.prompt<{ scenarioId: string }>([
    {
      type: 'list',
      name: 'scenarioId',
      message: 'Select Scenario',
      choices: scenarioChoices,
    },
  ]);

  const experiments = EXPERIMENT_BACKLOG.filter((entry) => entry.scenarioId === scenarioId);
  if (experiments.length === 0) {
    console.log(`❌ No experiments found for scenario=${scenarioId}`);
    return;
  }

  const { experimentId, runsPerArm, seed, recordTrajectories } = await inquirer.prompt<{
    experimentId: string;
    runsPerArm: number;
    seed: number;
    recordTrajectories: boolean;
  }>([
    {
      type: 'list',
      name: 'experimentId',
      message: 'Select Experiment',
      choices: experiments.map((entry) => ({ name: `${entry.id} - ${entry.title}`, value: entry.id })),
    },
    {
      type: 'input',
      name: 'runsPerArm',
      message: 'Runs per arm',
      default: experiments[0]?.runsPerArm ?? 75000,
      filter: (value: unknown) => parseNumberInput(value, experiments[0]?.runsPerArm ?? 75000),
    },
    {
      type: 'input',
      name: 'seed',
      message: 'Seed',
      default: experiments[0]?.seed ?? 42,
      filter: (value: unknown) => parseNumberInput(value, experiments[0]?.seed ?? 42),
    },
    {
      type: 'confirm',
      name: 'recordTrajectories',
      message: 'Record trajectories?',
      default: false,
    },
  ]);

  const found = experiments.find((entry) => entry.id === experimentId);
  if (!found) {
    console.log(`❌ Unknown experiment id=${experimentId}`);
    return;
  }

  const definition: ExperimentDefinition = {
    ...found,
    runsPerArm: Math.max(1, Math.floor(runsPerArm)),
    seed: Math.max(1, Math.floor(seed)) >>> 0,
  };

  console.log(`🧪 Running experiment id=${definition.id}`);
  const result = await runExperiment(definition, {
    outDir: EXPERIMENT_OUTPUT_ROOT,
    recordTrajectories,
  });
  console.log(`✅ Experiment finished output=${result.outputDir}`);
}

async function chooseExperimentResultDir() {
  const dirs = await listExperimentResultDirs();
  if (dirs.length === 0) {
    console.log('❌ No experiment output directories found.');
    return null;
  }

  const { experimentId } = await inquirer.prompt<{ experimentId: string }>([
    {
      type: 'list',
      name: 'experimentId',
      message: 'Select experiment result',
      choices: dirs,
    },
  ]);

  return join(EXPERIMENT_OUTPUT_ROOT, experimentId);
}

async function exploreExperimentResultsFlow() {
  const experimentDir = await chooseExperimentResultDir();
  if (!experimentDir) {
    return;
  }

  const { view } = await inquirer.prompt<{ view: 'armA' | 'armB' | 'comparison' }>([
    {
      type: 'list',
      name: 'view',
      message: '📊 Experiment Results',
      choices: [
        { name: 'arm A', value: 'armA' },
        { name: 'arm B', value: 'armB' },
        { name: 'comparison', value: 'comparison' },
      ],
    },
  ]);

  if (view === 'comparison') {
    const comparison = await readJson<Record<string, unknown>>(join(experimentDir, 'comparison.json'));
    console.log('📊 Comparison view');
    console.log(JSON.stringify(comparison, null, 2));
    return;
  }

  const armPath = view === 'armA'
    ? join(experimentDir, 'arm_A_summary.json')
    : join(experimentDir, 'arm_B_summary.json');
  const armSummary = await readJson<ExperimentArmSummary>(armPath);
  console.log(summarizeArm(armSummary));
  console.log('📊 mandate failure distribution');
  console.log(summarizeMandates(armSummary));
}

async function viewMandateDiagnosticsFlow() {
  const experimentDir = await chooseExperimentResultDir();
  if (!experimentDir) {
    return;
  }

  const armA = await readJson<ExperimentArmSummary>(join(experimentDir, 'arm_A_summary.json'));
  const armB = await readJson<ExperimentArmSummary>(join(experimentDir, 'arm_B_summary.json'));

  console.log('📊 Mandate Failure Diagnostics (Arm A)');
  console.log(summarizeMandates(armA));
  console.log('📊 Mandate Failure Diagnostics (Arm B)');
  console.log(summarizeMandates(armB));
}

async function runBalanceSearchFlow() {
  const { scenarioId, iterations, runsPerCandidate, seed } = await inquirer.prompt<{
    scenarioId: string;
    iterations: number;
    runsPerCandidate: number;
    seed: number;
  }>([
    {
      type: 'list',
      name: 'scenarioId',
      message: 'Balance Search Scenario',
      choices: ['base_design', 'algerian_war_of_independence', 'tahrir_square', 'woman_life_freedom'],
      default: 'base_design',
    },
    {
      type: 'input',
      name: 'iterations',
      message: 'Iterations',
      default: 200,
      filter: (value: unknown) => parseNumberInput(value, 200),
    },
    {
      type: 'input',
      name: 'runsPerCandidate',
      message: 'Runs per test',
      default: 25000,
      filter: (value: unknown) => parseNumberInput(value, 25000),
    },
    {
      type: 'input',
      name: 'seed',
      message: 'Seed',
      default: 42,
      filter: (value: unknown) => parseNumberInput(value, 42),
    },
  ]);

  const result = await runBalanceSearch({
    scenarioId,
    iterations: Math.max(1, Math.floor(iterations)),
    runsPerCandidate: Math.max(1, Math.floor(runsPerCandidate)),
    seed: Math.max(1, Math.floor(seed)) >>> 0,
    topN: 10,
  });
  console.log(`🏆 Best so far: ${result.bestCandidates[0]?.score.toFixed(6) ?? 'n/a'}`);
}

function renderTrajectorySequence(trajectory: VictoryTrajectory) {
  const lines = trajectory.steps.map((step) => `Round ${step.round} -> ${step.action}`);
  const terminal = trajectory.fullVictory
    ? 'Victory achieved'
    : (trajectory.publicVictory ? 'Public victory but mandate failure' : 'Simulation ended');
  return [...lines, terminal].join('\n');
}

async function listTrajectoryFiles(baseDir: string) {
  try {
    const entries = await readdir(baseDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => join(baseDir, entry.name))
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

async function inspectVictoryTrajectoriesFlow() {
  const experimentDir = await chooseExperimentResultDir();
  const experimentTrajectoryDir = experimentDir ? join(experimentDir, 'trajectories') : null;
  const experimentFiles = experimentTrajectoryDir ? await listTrajectoryFiles(experimentTrajectoryDir) : [];
  const globalFiles = await listTrajectoryFiles(GLOBAL_TRAJECTORY_ROOT);
  const trajectoryFiles = [...experimentFiles, ...globalFiles];

  if (trajectoryFiles.length === 0) {
    console.log('❌ No trajectory files found.');
    return;
  }

  const { filePath } = await inquirer.prompt<{ filePath: string }>([
    {
      type: 'list',
      name: 'filePath',
      message: '🧭 Select trajectory file',
      pageSize: 20,
      choices: trajectoryFiles,
    },
  ]);

  const trajectory = await readJson<VictoryTrajectory>(filePath);
  console.log('🧭 Recording trajectory');
  console.log(renderTrajectorySequence(trajectory));
}

export async function runCli() {
  let running = true;

  while (running) {
    const { action } = await inquirer.prompt<{ action: MainMenuAction }>([
      {
        type: 'list',
        name: 'action',
        message: '🧪 Simulator Control Panel',
        choices: [
          { name: '1. Run experiment backlog', value: 'backlog' },
          { name: '2. Run single experiment', value: 'single' },
          { name: '3. Explore experiment results', value: 'explore' },
          { name: '4. Run balance search', value: 'balance' },
          { name: '5. View mandate diagnostics', value: 'mandates' },
          { name: '6. Inspect victory trajectories', value: 'trajectories' },
          { name: '7. Exit', value: 'exit' },
        ],
      },
    ]);

    if (action === 'exit') {
      running = false;
      continue;
    }
    if (action === 'backlog') {
      await runExperimentBacklogFlow();
      continue;
    }
    if (action === 'single') {
      await runSingleExperimentFlow();
      continue;
    }
    if (action === 'explore') {
      await exploreExperimentResultsFlow();
      continue;
    }
    if (action === 'balance') {
      await runBalanceSearchFlow();
      continue;
    }
    if (action === 'mandates') {
      await viewMandateDiagnosticsFlow();
      continue;
    }
    if (action === 'trajectories') {
      await inspectVictoryTrajectoriesFlow();
      continue;
    }
  }

  console.log('✅ Simulator panel closed');
}

const isMainModule = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isMainModule) {
  try {
    await runCli();
  } catch (error) {
    const err = error as Error;
    console.error('❌ Simulator CLI failed');
    console.error(err.message);
    process.exitCode = 1;
  }
}

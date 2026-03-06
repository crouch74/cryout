import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { promisify } from 'node:util';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import * as pprof from '@datadog/pprof';
import { runSimulationBatch } from './autoplayEngine.ts';
import type { SimulationBatchConfig, SimulationBatchResult, SimulationVictoryMode } from './types.ts';

const execFile = promisify(execFileCallback);

const DEFAULT_RUNS = 1000;
const DEFAULT_SCENARIO = 'stones_cry_out';
const DEFAULT_SEED = 424242;
const DEFAULT_SMOKE_RUNS = 25;
const DEFAULT_PROGRESS_INTERVAL = 250;
const DEFAULT_PARALLEL_WORKERS = 1;
const TOP_FUNCTION_COUNT = 10;

type FindingCategory = 'simulation-core' | 'strategy-logic' | 'worker-orchestration' | 'output-io' | 'engine-bootstrap' | 'localization-overhead' | 'other';

export interface SimulationProfileCliOptions {
  runs: number;
  scenario: string;
  mode: SimulationVictoryMode;
  seed: number;
  parallelWorkers: number;
  smokeRuns: number;
  outputDir: string;
  label: string;
  compareParallelWorkers?: number;
}

export interface ProfileEntry {
  flatMs: number;
  flatPercent: number;
  cumulativeMs: number;
  cumulativePercent: number;
  name: string;
}

interface PprofTopTable {
  totalMs: number;
  entries: ProfileEntry[];
  rawOutput: string;
}

interface GroupedFinding {
  category: FindingCategory;
  cumulativeMs: number;
  flatMs: number;
  entries: ProfileEntry[];
}

interface QuickWin {
  title: string;
  impact: 'high' | 'medium';
  risk: 'low' | 'medium';
  rationale: string;
}

interface ProfileReport {
  generatedAt: string;
  configuration: {
    scenario: string;
    mode: SimulationVictoryMode;
    runs: number;
    smokeRuns: number;
    seed: number;
    parallelWorkers: number;
    compareParallelWorkers: number | null;
  };
  artifacts: {
    profilePath: string;
    flamegraphSvgPath: string | null;
    benchmarkDir: string;
    smokeDir: string | null;
    summaryPath: string;
    markdownPath: string;
    rawSelfTopPath: string;
    rawCumTopPath: string;
  };
  smoke: null | {
    runs: number;
    durationMs: number;
    runsPerSecond: number;
    outputPath: string;
    summaryPath: string;
  };
  benchmark: {
    durationMs: number;
    runsPerSecond: number;
    outputPath: string;
    summaryPath: string;
  };
  comparison: null | {
    parallelWorkers: number;
    durationMs: number;
    runsPerSecond: number;
  };
  topSelf: ProfileEntry[];
  topCumulative: ProfileEntry[];
  groupedFindings: GroupedFinding[];
  quickWins: QuickWin[];
  followUp: string[];
}

function toPositiveInteger(value: string, label: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
}

function normalizeMode(value: string): SimulationVictoryMode {
  const lowered = value.toLowerCase();
  if (lowered === 'liberation' || lowered === 'symbolic') {
    return lowered;
  }
  throw new Error(`Unsupported mode "${value}". Use liberation or symbolic.`);
}

function sanitizeLabel(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '') || 'simulation-profile';
}

export function parseProfileCliArgs(argv: string[]): SimulationProfileCliOptions {
  let runs = DEFAULT_RUNS;
  let scenario = DEFAULT_SCENARIO;
  let mode: SimulationVictoryMode = 'liberation';
  let seed = DEFAULT_SEED;
  let parallelWorkers = DEFAULT_PARALLEL_WORKERS;
  let smokeRuns = DEFAULT_SMOKE_RUNS;
  let outputDir = resolve(process.cwd(), 'simulation_output', 'profiles');
  let label = 'simulation-profile';
  let compareParallelWorkers: number | undefined;

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
      scenario = readValue().trim();
      continue;
    }
    if (arg === '--mode') {
      mode = normalizeMode(readValue());
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
    if (arg === '--smoke-runs') {
      smokeRuns = toPositiveInteger(readValue(), '--smoke-runs');
      continue;
    }
    if (arg === '--output-dir') {
      outputDir = resolve(readValue());
      continue;
    }
    if (arg === '--label') {
      label = sanitizeLabel(readValue());
      continue;
    }
    if (arg === '--compare-parallel') {
      compareParallelWorkers = toPositiveInteger(readValue(), '--compare-parallel');
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  const effectiveLabel = label === 'simulation-profile'
    ? sanitizeLabel(`${label}-${scenario}-${mode}-${runs}`)
    : label;

  return {
    runs,
    scenario,
    mode,
    seed,
    parallelWorkers,
    smokeRuns,
    outputDir,
    label: effectiveLabel,
    compareParallelWorkers,
  };
}

function durationTokenToMs(token: string) {
  const normalized = token.trim();
  if (normalized === '0') {
    return 0;
  }
  const match = normalized.match(/^([0-9]*\.?[0-9]+)(ns|us|µs|ms|s)$/);
  if (!match) {
    return 0;
  }

  const value = Number.parseFloat(match[1] ?? '0');
  const unit = match[2];
  switch (unit) {
    case 'ns':
      return value / 1_000_000;
    case 'us':
    case 'µs':
      return value / 1_000;
    case 'ms':
      return value;
    case 's':
      return value * 1_000;
    default:
      return 0;
  }
}

function parsePercent(token: string) {
  return Number.parseFloat(token.replace('%', ''));
}

export function parsePprofTopOutput(output: string): PprofTopTable {
  const lines = output.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
  const totalLine = lines.find((line) => line.includes(' total'));
  const totalMatch = totalLine?.match(/of\s+([0-9]*\.?[0-9]+(?:ns|us|µs|ms|s))\s+total/);
  const totalMs = totalMatch ? durationTokenToMs(totalMatch[1] ?? '0ms') : 0;

  const entries: ProfileEntry[] = [];
  const entryPattern = /^((?:[0-9]*\.?[0-9]+(?:ns|us|µs|ms|s))|0)\s+([0-9]*\.?[0-9]+)%\s+[0-9]*\.?[0-9]+%\s+((?:[0-9]*\.?[0-9]+(?:ns|us|µs|ms|s))|0)\s+([0-9]*\.?[0-9]+)%\s+(.+)$/;

  for (const line of lines) {
    const match = line.match(entryPattern);
    if (!match) {
      continue;
    }
    entries.push({
      flatMs: durationTokenToMs(match[1] ?? '0ms'),
      flatPercent: parsePercent(match[2] ?? '0%'),
      cumulativeMs: durationTokenToMs(match[3] ?? '0ms'),
      cumulativePercent: parsePercent(match[4] ?? '0%'),
      name: match[5] ?? 'unknown',
    });
  }

  return {
    totalMs,
    entries,
    rawOutput: output,
  };
}

function formatMs(value: number) {
  return Number(value.toFixed(value >= 100 ? 1 : 2));
}

function categorizeFunction(name: string): FindingCategory {
  if (
    name === 't'
    || name === 'translate'
    || name === 'extendTranslation'
    || name === 'getOrResetRegExp'
    || name === 'looksLikeObjectPath'
    || name === 'toLegacyDisabledReason'
    || name === 'getSeatDisabledReason'
    || name === 'getDisabledActionReason'
  ) {
    return 'localization-overhead';
  }
  if (
    name.includes('runSingleSimulation')
    || name.includes('selectSimulationCommand')
    || name.includes('dispatchCommand')
    || name.includes('buildRunRecord')
    || name.includes('capturePreDefeatSnapshot')
    || name.includes('appendRoundSnapshot')
    || name.includes('validateResourceInvariants')
  ) {
    return 'simulation-core';
  }
  if (
    name.includes('buildStrategyCandidatesForSeat')
    || name.includes('chooseByProfile')
    || name.includes('topBandSelection')
    || name.includes('applyExtractionDefender')
    || name.includes('applyDomainBuilder')
    || name.includes('applyEvidenceHoarder')
    || name.includes('applyGlobalAttention')
    || name.includes('applyMandateHunter')
    || name.includes('applyRiskTaker')
    || name.includes('applyRiskAvoider')
  ) {
    return 'strategy-logic';
  }
  if (
    name.includes('executeRunChunk')
    || name.includes('runWorkerChunk')
    || name.includes('executePlannedRunsWithWorkers')
    || name.includes('createChunks')
    || name.includes('Worker')
    || name.includes('createPlannedRuns')
  ) {
    return 'worker-orchestration';
  }
  if (
    name.includes('mergeShardFiles')
    || name.includes('writeOutputAsShards')
    || name.includes('writeTrajectoryToDirectory')
    || name.includes('JSON.stringify')
    || name.includes('writeFile')
    || name.includes('createWriteStream')
    || name.includes('readFile')
  ) {
    return 'output-io';
  }
  if (
    name.includes('initializeGame')
    || name.includes('compileContent')
    || name.includes('createGameState')
    || name.includes('normalizeBatchConfig')
  ) {
    return 'engine-bootstrap';
  }
  return 'other';
}

function dedupeEntries(entries: ProfileEntry[]) {
  const deduped = new Map<string, ProfileEntry>();
  for (const entry of entries) {
    const existing = deduped.get(entry.name);
    if (!existing || existing.cumulativeMs < entry.cumulativeMs) {
      deduped.set(entry.name, entry);
    }
  }
  return [...deduped.values()];
}

export function buildGroupedFindings(topSelf: ProfileEntry[], topCumulative: ProfileEntry[]): GroupedFinding[] {
  const grouped = new Map<FindingCategory, GroupedFinding>();

  for (const entry of dedupeEntries([...topSelf, ...topCumulative])) {
    const category = categorizeFunction(entry.name);
    const current = grouped.get(category) ?? {
      category,
      cumulativeMs: 0,
      flatMs: 0,
      entries: [],
    };
    current.cumulativeMs += entry.cumulativeMs;
    current.flatMs += entry.flatMs;
    current.entries.push(entry);
    grouped.set(category, current);
  }

  return [...grouped.values()]
    .map((group) => ({
      ...group,
      cumulativeMs: formatMs(group.cumulativeMs),
      flatMs: formatMs(group.flatMs),
      entries: group.entries
        .slice()
        .sort((left, right) => right.cumulativeMs - left.cumulativeMs)
        .slice(0, 5),
    }))
    .sort((left, right) => right.cumulativeMs - left.cumulativeMs);
}

export function buildQuickWins(topSelf: ProfileEntry[], topCumulative: ProfileEntry[]): QuickWin[] {
  const names = new Set([...topSelf, ...topCumulative].map((entry) => entry.name));
  const quickWins: QuickWin[] = [];

  if ([...names].some((name) => name.includes('runSingleSimulation') || name.includes('dispatchCommand'))) {
    quickWins.push({
      title: 'Trim per-step allocations in the main simulation loop',
      impact: 'high',
      risk: 'low',
      rationale: 'Hot time is landing in the round-by-round execution path, so hoisting derived arrays and reducing repeated event-log slicing should pay back across every simulated turn.',
    });
  }

  if ([...names].some((name) => name.includes('cloneState') || name.includes('structuredClone'))) {
    quickWins.push({
      title: 'Reduce full-state cloning on simulation-only paths',
      impact: 'high',
      risk: 'medium',
      rationale: 'Clone-heavy frames near the top of self time usually mean command dispatch or snapshot helpers are copying more state than the simulation needs for read-only decision making.',
    });
  }

  if ([...names].some((name) => name === 't' || name === 'translate' || name.includes('DisabledReason'))) {
    quickWins.push({
      title: 'Bypass localized disabled-reason copy in simulation command selection',
      impact: 'high',
      risk: 'low',
      rationale: 'Localization and disabled-reason formatting showing up in the hot path suggests autoplay is paying UI-facing string costs on every decision, which can be avoided in simulation mode.',
    });
  }

  if ([...names].some((name) => name.includes('buildStrategyCandidatesForSeat') || name.includes('chooseByProfile'))) {
    quickWins.push({
      title: 'Precompute seat and region invariants for strategy scoring',
      impact: 'high',
      risk: 'low',
      rationale: 'Strategy selection is showing up as a hotspot, which usually means repeated scans and recomputation inside candidate scoring are dominating seat turns.',
    });
  }

  if ([...names].some((name) => name.includes('createPlannedRuns') || name.includes('normalizeBatchConfig'))) {
    quickWins.push({
      title: 'Cache batch-planning metadata across deterministic runs',
      impact: 'medium',
      risk: 'low',
      rationale: 'Profile time in planning/bootstrap code suggests avoidable repeated shuffles, content lookups, and validation work before the actual simulations start.',
    });
  }

  if ([...names].some((name) => name.includes('mergeShardFiles') || name.includes('writeOutputAsShards') || name.includes('JSON.stringify'))) {
    quickWins.push({
      title: 'Reduce NDJSON serialization and merge overhead in benchmark mode',
      impact: 'medium',
      risk: 'medium',
      rationale: 'Output functions appearing near the top means benchmark throughput is paying a meaningful tax for serialization and shard merging, separate from game logic.',
    });
  }

  if ([...names].some((name) => name.includes('runWorkerChunk') || name.includes('executePlannedRunsWithWorkers') || name.includes('Worker'))) {
    quickWins.push({
      title: 'Reuse worker pools for repeated optimization batches',
      impact: 'medium',
      risk: 'medium',
      rationale: 'Worker orchestration in the hotspot list indicates startup and coordination overhead is material enough to justify pool reuse in long-running optimizer workflows.',
    });
  }

  if (quickWins.length === 0) {
    quickWins.push({
      title: 'Inspect top cumulative frames before code changes',
      impact: 'medium',
      risk: 'low',
      rationale: 'The profile did not clearly map to the expected simulation helper names, so the first safe move is to validate symbol resolution and confirm the hottest call paths.',
    });
  }

  return quickWins;
}

async function runPprofTop(profilePath: string, args: string[]) {
  const { stdout } = await execFile('go', ['tool', 'pprof', ...args, profilePath], {
    cwd: process.cwd(),
    maxBuffer: 8 * 1024 * 1024,
  });
  return stdout;
}

async function writePprofSvg(profilePath: string, outputPath: string) {
  const { stdout } = await execFile('go', ['tool', 'pprof', '-svg', profilePath], {
    cwd: process.cwd(),
    maxBuffer: 16 * 1024 * 1024,
  });
  await writeFile(outputPath, stdout, 'utf8');
}

function createBatchConfig(options: {
  scenario: string;
  mode: SimulationVictoryMode;
  runs: number;
  seed: number;
  parallelWorkers: number;
  outputDir: string;
}): SimulationBatchConfig {
  return {
    runsPerScenario: options.runs,
    scenarios: [options.scenario],
    victoryModes: [options.mode],
    randomSeed: options.seed,
    parallelWorkers: options.parallelWorkers,
    outputDir: options.outputDir,
    progressInterval: DEFAULT_PROGRESS_INTERVAL,
    splitOutputShards: false,
    trajectoryRecording: false,
  };
}

async function runBatchWithTiming(config: SimulationBatchConfig) {
  const startedAt = performance.now();
  const result = await runSimulationBatch(config);
  const durationMs = performance.now() - startedAt;
  return {
    result,
    durationMs,
    runsPerSecond: (config.runsPerScenario ?? 0) / (durationMs / 1000),
  };
}

async function runProfiledBatch(config: SimulationBatchConfig, profilePath: string) {
  pprof.time.start({
    lineNumbers: false,
    collectCpuTime: false,
  });

  let result: SimulationBatchResult | null = null;
  const startedAt = performance.now();

  try {
    result = await runSimulationBatch(config);
  } finally {
    const profile = pprof.time.stop();
    const encoded = await pprof.encode(profile);
    await mkdir(dirname(profilePath), { recursive: true });
    await writeFile(profilePath, encoded);
  }

  const durationMs = performance.now() - startedAt;
  return {
    result,
    durationMs,
    runsPerSecond: (config.runsPerScenario ?? 0) / (durationMs / 1000),
  };
}

function buildMarkdownReport(report: ProfileReport) {
  const lines: string[] = [];

  lines.push('# Simulation Profiling Report');
  lines.push('');
  lines.push('## Benchmark Configuration');
  lines.push(`- Scenario: \`${report.configuration.scenario}\``);
  lines.push(`- Victory mode: \`${report.configuration.mode}\``);
  lines.push(`- Simulations: \`${report.configuration.runs}\``);
  lines.push(`- Seed: \`${report.configuration.seed}\``);
  lines.push(`- Profiled workers: \`${report.configuration.parallelWorkers}\``);
  lines.push(`- Compare workers: \`${report.configuration.compareParallelWorkers ?? 'not run'}\``);
  if (report.smoke) {
    lines.push(`- Smoke validation: \`${report.smoke.runs}\` runs in \`${formatMs(report.smoke.durationMs)}ms\``);
  }
  lines.push('');
  lines.push('## Summary');
  lines.push(`- Profiled batch duration: \`${formatMs(report.benchmark.durationMs)}ms\``);
  lines.push(`- Profiled throughput: \`${formatMs(report.benchmark.runsPerSecond)} runs/s\``);
  if (report.comparison) {
    lines.push(`- Comparison throughput (${report.comparison.parallelWorkers} workers): \`${formatMs(report.comparison.runsPerSecond)} runs/s\``);
  }
  lines.push('');
  lines.push('## Top Self Time');
  for (const entry of report.topSelf) {
    lines.push(`- \`${entry.name}\` — flat \`${formatMs(entry.flatMs)}ms\`, cumulative \`${formatMs(entry.cumulativeMs)}ms\``);
  }
  lines.push('');
  lines.push('## Top Cumulative Time');
  for (const entry of report.topCumulative) {
    lines.push(`- \`${entry.name}\` — cumulative \`${formatMs(entry.cumulativeMs)}ms\`, flat \`${formatMs(entry.flatMs)}ms\``);
  }
  lines.push('');
  lines.push('## Grouped Findings');
  for (const finding of report.groupedFindings) {
    lines.push(`- \`${finding.category}\` — cumulative \`${formatMs(finding.cumulativeMs)}ms\`, flat \`${formatMs(finding.flatMs)}ms\`, lead symbols: ${finding.entries.map((entry) => `\`${entry.name}\``).join(', ')}`);
  }
  lines.push('');
  lines.push('## Quick Wins');
  for (const quickWin of report.quickWins) {
    lines.push(`- ${quickWin.title} — impact: \`${quickWin.impact}\`, risk: \`${quickWin.risk}\`. ${quickWin.rationale}`);
  }
  lines.push('');
  lines.push('## Follow-up');
  for (const item of report.followUp) {
    lines.push(`- ${item}`);
  }

  return `${lines.join('\n')}\n`;
}

async function writeReportArtifacts(report: ProfileReport) {
  await writeFile(report.artifacts.summaryPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(report.artifacts.markdownPath, buildMarkdownReport(report), 'utf8');
}

export async function runProfileCli(argv: string[]) {
  const options = parseProfileCliArgs(argv);
  const profileRoot = resolve(options.outputDir, options.label);
  const smokeDir = join(profileRoot, 'smoke');
  const benchmarkDir = join(profileRoot, 'benchmark');
  const profilePath = join(profileRoot, 'artifacts', 'simulation-wall.pb.gz');
  const rawSelfTopPath = join(profileRoot, 'artifacts', 'top-self.txt');
  const rawCumTopPath = join(profileRoot, 'artifacts', 'top-cumulative.txt');
  const flamegraphSvgPath = join(profileRoot, 'artifacts', 'profile-callgraph.svg');
  const summaryPath = join(profileRoot, 'artifacts', 'profile-report.json');
  const markdownPath = join(profileRoot, 'artifacts', 'profile-report.md');

  await rm(profileRoot, { recursive: true, force: true });
  await mkdir(join(profileRoot, 'artifacts'), { recursive: true });

  console.log('🔬 Simulation profiler configuration resolved');
  console.log(JSON.stringify(options, null, 2));

  let smoke: ProfileReport['smoke'] = null;
  if (options.smokeRuns > 0) {
    console.log(`🧪 Running smoke benchmark (${options.smokeRuns} simulations)`);
    const smokeRun = await runBatchWithTiming(createBatchConfig({
      scenario: options.scenario,
      mode: options.mode,
      runs: options.smokeRuns,
      seed: options.seed,
      parallelWorkers: 1,
      outputDir: smokeDir,
    }));
    smoke = {
      runs: options.smokeRuns,
      durationMs: formatMs(smokeRun.durationMs),
      runsPerSecond: formatMs(smokeRun.runsPerSecond),
      outputPath: smokeRun.result.outputPath,
      summaryPath: smokeRun.result.summaryPath,
    };
  }

  console.log(`🎯 Running profiled benchmark (${options.runs} simulations)`);
  const benchmarkRun = await runProfiledBatch(createBatchConfig({
    scenario: options.scenario,
    mode: options.mode,
    runs: options.runs,
    seed: options.seed,
    parallelWorkers: options.parallelWorkers,
    outputDir: benchmarkDir,
  }), profilePath);

  console.log('📊 Collecting pprof summaries');
  const [rawSelfTop, rawCumTop] = await Promise.all([
    runPprofTop(profilePath, ['-top', `-nodecount=${TOP_FUNCTION_COUNT}`, '-unit=ms']),
    runPprofTop(profilePath, ['-top', '-cum', `-nodecount=${TOP_FUNCTION_COUNT}`, '-unit=ms']),
  ]);
  let generatedSvgPath: string | null = null;
  try {
    await writePprofSvg(profilePath, flamegraphSvgPath);
    generatedSvgPath = flamegraphSvgPath;
  } catch {
    generatedSvgPath = null;
  }
  await writeFile(rawSelfTopPath, rawSelfTop, 'utf8');
  await writeFile(rawCumTopPath, rawCumTop, 'utf8');

  const topSelf = parsePprofTopOutput(rawSelfTop).entries.slice(0, TOP_FUNCTION_COUNT);
  const topCumulative = parsePprofTopOutput(rawCumTop).entries.slice(0, TOP_FUNCTION_COUNT);
  const groupedFindings = buildGroupedFindings(topSelf, topCumulative);
  const quickWins = buildQuickWins(topSelf, topCumulative);

  let comparison: ProfileReport['comparison'] = null;
  if (options.compareParallelWorkers && options.compareParallelWorkers > 1) {
    console.log(`⚖️ Running comparison benchmark (${options.compareParallelWorkers} workers)`);
    const compareDir = join(profileRoot, `compare-${options.compareParallelWorkers}-workers`);
    const compareRun = await runBatchWithTiming(createBatchConfig({
      scenario: options.scenario,
      mode: options.mode,
      runs: options.runs,
      seed: options.seed,
      parallelWorkers: options.compareParallelWorkers,
      outputDir: compareDir,
    }));
    comparison = {
      parallelWorkers: options.compareParallelWorkers,
      durationMs: formatMs(compareRun.durationMs),
      runsPerSecond: formatMs(compareRun.runsPerSecond),
    };
  }

  const report: ProfileReport = {
    generatedAt: new Date().toISOString(),
    configuration: {
      scenario: options.scenario,
      mode: options.mode,
      runs: options.runs,
      smokeRuns: options.smokeRuns,
      seed: options.seed,
      parallelWorkers: options.parallelWorkers,
      compareParallelWorkers: options.compareParallelWorkers ?? null,
    },
    artifacts: {
      profilePath,
      flamegraphSvgPath: generatedSvgPath,
      benchmarkDir,
      smokeDir: smoke ? smokeDir : null,
      summaryPath,
      markdownPath,
      rawSelfTopPath,
      rawCumTopPath,
    },
    smoke,
    benchmark: {
      durationMs: formatMs(benchmarkRun.durationMs),
      runsPerSecond: formatMs(benchmarkRun.runsPerSecond),
      outputPath: benchmarkRun.result.outputPath,
      summaryPath: benchmarkRun.result.summaryPath,
    },
    comparison,
    topSelf,
    topCumulative,
    groupedFindings,
    quickWins,
    followUp: [
      'Validate the top symbols against the simulation loop before optimizing helper utilities that are not present in the cumulative top list.',
      'After the first quick wins land, rerun the same seeded 1000-simulation benchmark and compare both throughput and top cumulative frames.',
      'Only profile multi-worker runs for attribution after the single-worker hotspot list is stable; parent-process profiles alone will undercount worker CPU.',
    ],
  };

  await writeReportArtifacts(report);

  console.log('📝 Profiling report written');
  console.log(JSON.stringify({
    profilePath,
    flamegraphSvgPath: generatedSvgPath,
    reportJson: summaryPath,
    reportMarkdown: markdownPath,
    benchmarkDurationMs: report.benchmark.durationMs,
    benchmarkRunsPerSecond: report.benchmark.runsPerSecond,
  }, null, 2));

  return report;
}

const isMainModule = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isMainModule) {
  try {
    await runProfileCli(process.argv.slice(2));
  } catch (error) {
    const err = error as Error;
    console.error('❌ Simulation profiling failed');
    console.error(err.message);
    process.exitCode = 1;
  }
}

import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { rm, mkdir, writeFile, readdir } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { Worker } from 'node:worker_threads';
import { createInterface } from 'node:readline';
import {
  buildBalancedSeatOwners,
  compileContent,
  dispatchCommand,
  initializeGame,
  listRulesets,
  CORE_VERSION,
  type CompiledContent,
  type DomainEvent,
  type EngineCommand,
  type EngineState,
  type FactionId,
  type StateDelta,
} from '../engine/index.ts';
import { buildStrategyCandidatesForSeat, getStrategyProfile, listStrategyProfiles } from './strategies.ts';
import { captureRoundSnapshot, convertRoundSnapshotsToTimeline } from './captureRoundSnapshot.ts';
import { capturePreDefeatSnapshot } from './capturePreDefeatSnapshot.ts';
import { seatComrades, totalComrades, validateResourceInvariants } from './invariants.ts';
import { TrajectoryRecorder, buildTrajectoryFileStem } from './trajectory/TrajectoryRecorder.ts';
import type { TrajectoryStep, VictoryTrajectory } from './trajectory/types.ts';
import type {
  NormalizedSimulationBatchConfig,
  PlannedSimulationRun,
  PreDefeatSnapshot,
  RoundSnapshot,
  RunExecutionResult,
  SimulationBatchConfig,
  SimulationBatchResult,
  SimulationCommand,
  SimulationRecord,
  SimulationSummary,
  SimulationVictoryMode,
  StrategyDecision,
  SummaryAccumulator,
  WorkerMessage,
  WorkerResultMessage,
  WorkerRunChunk,
} from './types.ts';

const REQUIRED_CORE_VERSION = '0.10.1-scenario-framework.1';

const DEFAULT_SCENARIOS = [
  'base_design',
  'tahrir_square',
  'woman_life_freedom',
  'algerian_war_of_independence',
] as const;

const DEFAULT_VICTORY_MODES: SimulationVictoryMode[] = ['liberation', 'symbolic'];

const BASE_ACTION_KEY_MAP = {
  organize: 'organize',
  investigate: 'investigate',
  launch_campaign: 'launchCampaign',
  build_solidarity: 'buildSolidarity',
  smuggle_evidence: 'smuggleEvidence',
  international_outreach: 'internationalOutreach',
  defend: 'defend',
} as const;

const MAX_SNAPSHOTS_PER_GAME = 25;

const CONTENT_CACHE = new Map<string, CompiledContent>();

function getCompiledContent(rulesetId: string) {
  const cached = CONTENT_CACHE.get(rulesetId);
  if (cached) {
    return cached;
  }

  const compiled = compileContent(rulesetId);
  CONTENT_CACHE.set(rulesetId, compiled);
  return compiled;
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

function getModeLabel(mode: SimulationVictoryMode) {
  return mode === 'liberation' ? 'LIBERATION' : 'SYMBOLIC';
}

function getDefaultParallelWorkers() {
  const available = typeof (globalThis as { navigator?: { hardwareConcurrency?: number } }).navigator?.hardwareConcurrency === 'number'
    ? (globalThis as { navigator?: { hardwareConcurrency?: number } }).navigator?.hardwareConcurrency ?? 0
    : 0;
  const cpuCount = Math.max(available, cpus().length, 1);
  return Math.max(1, cpuCount - 1);
}

function uniqueValues<T>(values: T[]) {
  return Array.from(new Set(values));
}

function assertScenarioIds(scenarios: string[]) {
  const validScenarioIds = new Set(listRulesets().map((ruleset) => ruleset.id));
  const unknown = scenarios.filter((scenario) => !validScenarioIds.has(scenario));
  if (unknown.length > 0) {
    throw new Error(`Unknown simulation scenarios: ${unknown.join(', ')}`);
  }
}

function normalizeBatchConfig(config: SimulationBatchConfig): NormalizedSimulationBatchConfig {
  const scenarios = uniqueValues(config.scenarios && config.scenarios.length > 0 ? config.scenarios : [...DEFAULT_SCENARIOS]);
  assertScenarioIds(scenarios);

  const victoryModes = uniqueValues(config.victoryModes && config.victoryModes.length > 0
    ? config.victoryModes
    : [...DEFAULT_VICTORY_MODES]);

  if (victoryModes.length === 0) {
    throw new Error('At least one victory mode is required for simulation.');
  }

  for (const mode of victoryModes) {
    if (mode !== 'liberation' && mode !== 'symbolic') {
      throw new Error(`Unsupported victory mode: ${mode}`);
    }
  }

  const requestedProfiles = config.strategies && config.strategies.length > 0
    ? config.strategies.map((profile) => profile.id)
    : listStrategyProfiles().map((profile) => profile.id);
  const strategyIds = uniqueValues(requestedProfiles);

  for (const strategyId of strategyIds) {
    if (!getStrategyProfile(strategyId)) {
      throw new Error(`Unknown strategy profile: ${strategyId}`);
    }
  }

  const runsPerScenario = Math.max(1, Math.floor(config.runsPerScenario ?? 100000));
  const randomSeed = Math.floor(config.randomSeed ?? (Date.now() >>> 0)) >>> 0;
  const parallelWorkers = Math.max(1, Math.floor(config.parallelWorkers ?? getDefaultParallelWorkers()));
  const outputDir = resolve(config.outputDir ?? resolve(process.cwd(), 'simulation_output'));
  const progressInterval = Math.max(1, Math.floor(config.progressInterval ?? 250));
  const debugSingle = Boolean(config.debugSingle);
  const splitOutputShards = Boolean(config.splitOutputShards);
  const trajectoryRecording = Boolean(config.trajectoryRecording);

  return {
    scenarios,
    victoryModes,
    runsPerScenario,
    strategyIds,
    randomSeed,
    parallelWorkers,
    outputDir,
    progressInterval,
    debugSingle,
    splitOutputShards,
    trajectoryRecording,
  };
}

function createSimulationId(index: number, scenario: string, seed: number) {
  return `${scenario}:${String(index + 1).padStart(9, '0')}:${seed}`;
}

function createPlannedRuns(config: NormalizedSimulationBatchConfig): PlannedSimulationRun[] {
  const scenarioQueue: string[] = [];
  for (const scenario of config.scenarios) {
    for (let runIndex = 0; runIndex < config.runsPerScenario; runIndex += 1) {
      scenarioQueue.push(scenario);
    }
  }

  const randomizedScenarios = deterministicShuffle(scenarioQueue, mixSeed(config.randomSeed, stableHash('scenario-order')));

  return randomizedScenarios.map((scenario, index) => {
    const runSeed = mixSeed(config.randomSeed, index + 1);
    const scenarioSalt = stableHash(scenario);
    const runLocalSeed = mixSeed(runSeed, scenarioSalt);

    const content = getCompiledContent(scenario);
    const factionIds = content.ruleset.factions.map((faction) => faction.id);
    const seatFactionIds = deterministicShuffle<FactionId>(factionIds, mixSeed(runLocalSeed, stableHash('factions')));

    const playerCountOptions: Array<2 | 3 | 4> = [2, 3, 4];
    const humanPlayerCount = playerCountOptions[mixSeed(runLocalSeed, stableHash('players')) % playerCountOptions.length];
    const seatOwnerIds = buildBalancedSeatOwners(humanPlayerCount, seatFactionIds);

    const modeIndex = mixSeed(runLocalSeed, stableHash('mode')) % config.victoryModes.length;
    const mode = getModeLabel(config.victoryModes[modeIndex]);

    const strategyIds = seatFactionIds.map((_, seat) => {
      const strategyIndex = mixSeed(runLocalSeed, stableHash(`strategy:${seat}`)) % config.strategyIds.length;
      return config.strategyIds[strategyIndex];
    });

    return {
      index,
      simulationId: createSimulationId(index, scenario, runSeed),
      scenario,
      mode,
      seed: runSeed,
      humanPlayerCount,
      seatFactionIds,
      seatOwnerIds,
      strategyIds,
    } satisfies PlannedSimulationRun;
  });
}

function buildIntentKey(command: EngineCommand) {
  if (command.type !== 'QueueIntent') {
    return command.type;
  }

  return JSON.stringify([
    command.action.actionId,
    command.action.regionId ?? null,
    command.action.domainId ?? null,
    command.action.targetSeat ?? null,
    command.action.comradesCommitted ?? null,
    command.action.evidenceCommitted ?? null,
    command.action.cardId ?? null,
  ]);
}

function chooseDecisionFromTopBand(state: EngineState, runSeed: number, decisions: StrategyDecision[]) {
  const ordered = decisions
    .slice()
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (left.seat !== right.seat) {
        return left.seat - right.seat;
      }
      return buildIntentKey({ type: 'QueueIntent', seat: left.seat, action: left.action })
        .localeCompare(buildIntentKey({ type: 'QueueIntent', seat: right.seat, action: right.action }));
    });

  const bestScore = ordered[0].score;
  const topBand = ordered.filter((candidate) => candidate.score >= bestScore - 5);
  const pickIndex = (state.rng.state ^ state.rng.calls ^ runSeed ^ (state.round * 193)) >>> 0;
  return topBand[pickIndex % topBand.length] ?? ordered[0];
}

function selectSimulationCommand(
  state: EngineState,
  content: CompiledContent,
  run: PlannedSimulationRun,
): SimulationCommand | null {
  if (state.phase === 'SYSTEM') {
    return { type: 'ResolveSystemPhase' };
  }

  if (state.phase === 'RESOLUTION') {
    return { type: 'ResolveResolutionPhase' };
  }

  if (state.phase === 'COALITION') {
    const activeSeats = state.players.filter((player) => player.actionsRemaining > 0).map((player) => player.seat);
    if (activeSeats.length > 0) {
      const decisions: StrategyDecision[] = [];

      for (const seat of activeSeats) {
        const strategyId = run.strategyIds[seat] ?? 'balanced';
        const profile = getStrategyProfile(strategyId);
        if (!profile) {
          continue;
        }

        const candidates = buildStrategyCandidatesForSeat(state, content, seat);
        const decision = profile.chooseAction({
          strategyId,
          state,
          content,
          seat,
          candidates,
        });
        if (decision) {
          decisions.push(decision);
        }
      }

      if (decisions.length === 0) {
        return null;
      }

      const selected = chooseDecisionFromTopBand(state, run.seed, decisions);
      return {
        type: 'QueueIntent',
        seat: selected.seat,
        action: selected.action,
      };
    }

    const pendingSeat = state.players.find((player) => !player.ready);
    if (pendingSeat) {
      return {
        type: 'SetReady',
        seat: pendingSeat.seat,
        ready: true,
      };
    }

    return {
      type: 'CommitCoalitionIntent',
    };
  }

  return null;
}

function buildFinalDomains(state: EngineState) {
  return {
    WarMachine: state.domains.WarMachine?.progress ?? 0,
    DyingPlanet: state.domains.DyingPlanet?.progress ?? 0,
    GildedCage: state.domains.GildedCage?.progress ?? 0,
    SilencedTruth: state.domains.SilencedTruth?.progress ?? 0,
    EmptyStomach: state.domains.EmptyStomach?.progress ?? 0,
    FossilGrip: state.domains.FossilGrip?.progress ?? 0,
    StolenVoice: state.domains.StolenVoice?.progress ?? 0,
    RevolutionaryWave: state.domains.RevolutionaryWave?.progress ?? 0,
    PatriarchalGrip: state.domains.PatriarchalGrip?.progress ?? 0,
    UnfinishedJustice: state.domains.UnfinishedJustice?.progress ?? 0,
  };
}

function buildFinalFronts(state: EngineState) {
  const fronts: Record<string, number> = {};
  for (const [regionId, regionState] of Object.entries(state.regions)) {
    fronts[regionId] = regionState.extractionTokens;
  }
  return fronts;
}

function initializeActionCounts() {
  return {
    organize: 0,
    investigate: 0,
    launchCampaign: 0,
    buildSolidarity: 0,
    smuggleEvidence: 0,
    internationalOutreach: 0,
    defend: 0,
  };
}

function buildRunRecord(
  run: PlannedSimulationRun,
  state: EngineState,
  stalled: boolean,
  preDefeatSnapshots: PreDefeatSnapshot[],
  roundSnapshots: RoundSnapshot[],
): SimulationRecord {
  const actionCounts = initializeActionCounts();
  const actionCountsExtra: Record<string, number> = {};

  const campaignStats = {
    campaignAttempts: 0,
    campaignSuccess: 0,
    attentionFailures: 0,
    backlashFailures: 0,
  };

  const resourceStats = {
    comradesSpent: 0,
    evidenceSpent: 0,
  };

  for (const event of state.eventLog) {
    if (event.sourceType !== 'action') {
      continue;
    }

    const actionId = event.sourceId;
    const actionKey = BASE_ACTION_KEY_MAP[actionId as keyof typeof BASE_ACTION_KEY_MAP];
    if (actionKey) {
      actionCounts[actionKey] += 1;
    } else {
      actionCountsExtra[actionId] = (actionCountsExtra[actionId] ?? 0) + 1;
    }

    if (actionId === 'launch_campaign' && event.context?.roll) {
      campaignStats.campaignAttempts += 1;
      if (event.context.roll.success) {
        campaignStats.campaignSuccess += 1;
      }
      if (event.context.roll.outcomeBand === 'attention') {
        campaignStats.attentionFailures += 1;
      }
      if (event.context.roll.outcomeBand === 'backlash') {
        campaignStats.backlashFailures += 1;
      }
    }

    for (const trace of event.trace) {
      for (const delta of trace.deltas) {
        if (delta.kind === 'comrades' && typeof delta.before === 'number' && typeof delta.after === 'number' && delta.after < delta.before) {
          resourceStats.comradesSpent += delta.before - delta.after;
        }
        if (delta.kind === 'evidence' && typeof delta.before === 'number' && typeof delta.after === 'number' && delta.after < delta.before) {
          resourceStats.evidenceSpent += delta.before - delta.after;
        }
      }
    }
  }

  const terminalReason = state.terminalOutcome?.cause ?? (stalled ? 'simulation_stalled' : 'simulation_stalled');
  const resultType = state.phase === 'WIN' ? 'victory' : 'defeat';
  const normalizedSnapshots = roundSnapshots.slice(0, MAX_SNAPSHOTS_PER_GAME);

  return {
    simulationId: run.simulationId,
    scenario: run.scenario,
    victoryMode: run.mode === 'LIBERATION' ? 'liberation' : 'symbolic',
    playerCount: run.humanPlayerCount,
    strategies: [...run.strategyIds],
    turnsPlayed: state.terminalOutcome?.round ?? state.round,
    result: {
      type: resultType,
      reason: terminalReason,
    },
    publicVictoryAchieved: resultType === 'victory' || terminalReason === 'mandate_failure',
    mandateFailure: terminalReason === 'mandate_failure',
    extractionBreach: terminalReason === 'extraction_breach',
    comradesExhausted: terminalReason === 'comrades_exhausted',
    suddenDeath: terminalReason === 'sudden_death',
    finalState: {
      globalGaze: state.globalGaze,
      warMachine: state.northernWarMachine,
      domains: buildFinalDomains(state),
      fronts: buildFinalFronts(state),
    },
    campaignStats,
    resourceStats,
    actionCounts,
    actionCountsExtra,
    preDefeatSnapshots,
    roundSnapshots: normalizedSnapshots,
    timeline: convertRoundSnapshotsToTimeline(normalizedSnapshots),
  };
}

function appendRoundSnapshot(
  run: PlannedSimulationRun,
  roundSnapshots: RoundSnapshot[],
  state: EngineState,
  snapshotLimitReached: { value: boolean },
  debug: boolean,
) {
  if (roundSnapshots.length >= MAX_SNAPSHOTS_PER_GAME) {
    if (!snapshotLimitReached.value && debug) {
      snapshotLimitReached.value = true;
      console.log('⚠️ Snapshot limit reached, truncating further rounds');
    }
    return;
  }

  if (debug) {
    console.log(`📸 Capturing round snapshot r=${state.round} sim=${run.simulationId}`);
  }
  roundSnapshots.push(captureRoundSnapshot(state));
}

function getPreDefeatPhase(command: SimulationCommand): string | null {
  switch (command.type) {
    case 'ResolveSystemPhase':
      return 'system_actions';
    case 'CommitCoalitionIntent':
      return 'campaign_resolution';
    case 'ResolveResolutionPhase':
      return 'round_resolution';
    default:
      return null;
  }
}

function appendPreDefeatSnapshot(
  preDefeatSnapshots: PreDefeatSnapshot[],
  state: EngineState,
  command: SimulationCommand,
  debug: boolean,
) {
  const phase = getPreDefeatPhase(command);
  if (!phase) {
    return;
  }

  const snapshot = capturePreDefeatSnapshot(state, phase);
  preDefeatSnapshots.push(snapshot);
  if (debug) {
    console.log(`🧠 Pre-defeat snapshot captured round=${snapshot.round} phase=${phase}`);
  }
}

function isPhaseCommand(command: SimulationCommand) {
  return command.type === 'ResolveSystemPhase'
    || command.type === 'CommitCoalitionIntent'
    || command.type === 'ResolveResolutionPhase';
}

function collectSeatBodyTotals(state: EngineState) {
  return new Map(state.players.map((player) => [player.seat, seatComrades(state, player.seat)]));
}

function logPhaseHeader(state: EngineState, command: SimulationCommand, debug: boolean) {
  if (!debug) {
    return;
  }

  switch (command.type) {
    case 'ResolveSystemPhase':
      console.log(`🎲 Round ${state.round} start`);
      console.log(`👥 Comrades total = ${totalComrades(state)}`);
      break;
    case 'CommitCoalitionIntent':
      console.log('⚙️ Player actions');
      break;
    case 'ResolveResolutionPhase':
      console.log('🔍 Round resolution');
      break;
    default:
      break;
  }
}

function logBodySpend(before: Map<number, number>, afterState: EngineState, debug: boolean) {
  if (!debug) {
    return;
  }

  for (const [seat, beforeComrades] of before.entries()) {
    const afterComrades = seatComrades(afterState, seat);
    if (afterComrades < beforeComrades) {
      const cost = beforeComrades - afterComrades;
      console.log('🔻 Comrades spent', `seat${seat + 1}`, cost);
    }
  }
}

function logPhaseEffects(
  state: EngineState,
  command: SimulationCommand,
  eventStartIndex: number,
  debug: boolean,
) {
  if (!debug) {
    return;
  }

  const newEvents = state.eventLog.slice(eventStartIndex);
  const hasCampaignAttempt = newEvents.some((event) => event.sourceType === 'action'
    && event.sourceId === 'launch_campaign'
    && Boolean(event.context?.roll));
  if (hasCampaignAttempt) {
    console.log('🎯 Campaign attempt');
  }

  const warMachineIncreased = newEvents.some((event) => event.deltas.some((delta) => {
    return delta.kind === 'track'
      && delta.label === 'northernWarMachine'
      && typeof delta.before === 'number'
      && typeof delta.after === 'number'
      && delta.after > delta.before;
  }));
  if (warMachineIncreased) {
    console.log('📉 War machine increased');
  }

  if (isPhaseCommand(command)) {
    console.log('🧠 Resource state', state.round, totalComrades(state));
  }

  if (command.type === 'ResolveResolutionPhase') {
    console.log('💀 Defeat check');
  }
}

function buildSeatKey(seat: number) {
  return `seat_${seat + 1}`;
}

function buildTrajectoryPlayerLabel(state: EngineState, seat: number | undefined) {
  if (seat === undefined || seat < 0 || seat >= state.players.length) {
    return 'system';
  }

  const player = state.players[seat];
  return `${buildSeatKey(seat)}:${player.factionId}`;
}

function cloneTrajectorySnapshot(snapshot: TrajectoryStep['snapshot']): TrajectoryStep['snapshot'] {
  return {
    extractionByRegion: { ...snapshot.extractionByRegion },
    bodiesByPlayer: { ...snapshot.bodiesByPlayer },
    evidenceByPlayer: { ...snapshot.evidenceByPlayer },
    globalGaze: snapshot.globalGaze,
    northernWarMachine: snapshot.northernWarMachine,
  };
}

function buildTrajectorySnapshot(state: EngineState): TrajectoryStep['snapshot'] {
  // Snapshot only compact strategic signals to keep trajectory files small.
  const extractionByRegion = Object.fromEntries(
    Object.entries(state.regions).map(([regionId, region]) => [regionId, region.extractionTokens]),
  );
  const bodiesByPlayer = Object.fromEntries(
    state.players.map((player) => [buildSeatKey(player.seat), seatComrades(state, player.seat)]),
  );
  const evidenceByPlayer = Object.fromEntries(
    state.players.map((player) => [buildSeatKey(player.seat), player.evidence]),
  );

  return {
    extractionByRegion,
    bodiesByPlayer,
    evidenceByPlayer,
    globalGaze: state.globalGaze,
    northernWarMachine: state.northernWarMachine,
  };
}

function buildTrajectoryTargets(event: DomainEvent) {
  const targets: string[] = [];
  if (event.context?.targetRegionId) {
    targets.push(event.context.targetRegionId);
  }
  if (event.context?.targetDomainId) {
    targets.push(event.context.targetDomainId);
  }
  if (typeof event.context?.targetSeat === 'number') {
    targets.push(buildSeatKey(event.context.targetSeat));
  }
  return targets.length > 0 ? targets : undefined;
}

function applyDeltaToTrajectorySnapshot(snapshot: TrajectoryStep['snapshot'], delta: StateDelta) {
  if (delta.kind === 'track' && typeof delta.after === 'number') {
    if (delta.label === 'globalGaze') {
      snapshot.globalGaze = delta.after;
    }
    if (delta.label === 'northernWarMachine') {
      snapshot.northernWarMachine = delta.after;
    }
    return;
  }

  if (delta.kind === 'extraction' && typeof delta.after === 'number') {
    const match = /^(.+)\.extraction$/.exec(delta.label);
    if (match?.[1]) {
      snapshot.extractionByRegion[match[1]] = delta.after;
    }
    return;
  }

  if (delta.kind === 'comrades' && typeof delta.before === 'number' && typeof delta.after === 'number') {
    const match = /\.seat:(\d+)$/.exec(delta.label);
    if (match?.[1]) {
      const seat = Number(match[1]);
      const seatKey = buildSeatKey(seat);
      const before = snapshot.bodiesByPlayer[seatKey] ?? 0;
      snapshot.bodiesByPlayer[seatKey] = before + (delta.after - delta.before);
    }
    return;
  }

  if (delta.kind === 'evidence' && typeof delta.after === 'number') {
    const match = /^seat:(\d+):evidence$/.exec(delta.label);
    if (match?.[1]) {
      const seat = Number(match[1]);
      snapshot.evidenceByPlayer[buildSeatKey(seat)] = delta.after;
    }
  }
}

function buildTrajectoryResult(deltas: StateDelta[]): TrajectoryStep['result'] {
  let bodiesDelta = 0;
  let evidenceDelta = 0;
  let extractionRemoved = 0;
  let extractionAdded = 0;
  let globalGazeDelta = 0;
  let warMachineDelta = 0;

  for (const delta of deltas) {
    if (typeof delta.before !== 'number' || typeof delta.after !== 'number') {
      continue;
    }
    const net = delta.after - delta.before;

    if (delta.kind === 'comrades') {
      bodiesDelta += net;
      continue;
    }
    if (delta.kind === 'evidence') {
      evidenceDelta += net;
      continue;
    }
    if (delta.kind === 'extraction') {
      if (net > 0) {
        extractionAdded += net;
      } else if (net < 0) {
        extractionRemoved += Math.abs(net);
      }
      continue;
    }
    if (delta.kind === 'track' && delta.label === 'globalGaze') {
      globalGazeDelta += net;
      continue;
    }
    if (delta.kind === 'track' && delta.label === 'northernWarMachine') {
      warMachineDelta += net;
    }
  }

  return {
    ...(bodiesDelta !== 0 ? { bodiesDelta } : {}),
    ...(evidenceDelta !== 0 ? { evidenceDelta } : {}),
    ...(extractionRemoved !== 0 ? { extractionRemoved } : {}),
    ...(extractionAdded !== 0 ? { extractionAdded } : {}),
    ...(globalGazeDelta !== 0 ? { globalGazeDelta } : {}),
    ...(warMachineDelta !== 0 ? { warMachineDelta } : {}),
  };
}

function appendTrajectorySteps(
  recorder: TrajectoryRecorder,
  stateBefore: EngineState,
  stateAfter: EngineState,
  events: DomainEvent[],
  debug: boolean,
) {
  const actionEvents = events.filter((event) => event.sourceType === 'action');
  if (actionEvents.length === 0) {
    return;
  }

  const rollingSnapshot = buildTrajectorySnapshot(stateBefore);

  for (const event of actionEvents) {
    for (const delta of event.deltas) {
      applyDeltaToTrajectorySnapshot(rollingSnapshot, delta);
    }
    const targets = buildTrajectoryTargets(event);

    const trajectoryStep: TrajectoryStep = {
      round: event.round,
      phase: event.phase,
      player: buildTrajectoryPlayerLabel(stateAfter, event.context?.actingSeat),
      action: event.sourceId,
      ...(targets ? { targets } : {}),
      result: buildTrajectoryResult(event.deltas),
      snapshot: cloneTrajectorySnapshot(rollingSnapshot),
    };
    recorder.record(trajectoryStep);

    if (debug) {
      console.log(`🧭 Recording trajectory step round=${trajectoryStep.round} phase=${trajectoryStep.phase} action=${trajectoryStep.action}`);
    }
  }
}

export function runSingleSimulation(
  run: PlannedSimulationRun,
  options?: { debug?: boolean; trajectoryRecording?: boolean },
): RunExecutionResult {
  const content = getCompiledContent(run.scenario);
  const debug = Boolean(options?.debug);
  const trajectoryRecording = Boolean(options?.trajectoryRecording);
  const trajectoryRecorder = trajectoryRecording ? new TrajectoryRecorder() : null;

  // Canonical simulation path: use compat runtime commands exactly as shipped.
  let state = initializeGame({
    type: 'StartGame',
    rulesetId: run.scenario,
    mode: run.mode,
    secretMandates: 'enabled',
    humanPlayerCount: run.humanPlayerCount,
    seatFactionIds: run.seatFactionIds,
    seatOwnerIds: run.seatOwnerIds,
    seed: run.seed,
  });

  const maxSteps = Math.max(180, content.ruleset.suddenDeathRound * 10);
  let stalled = false;
  const preDefeatSnapshots: PreDefeatSnapshot[] = [];
  const roundSnapshots: RoundSnapshot[] = [];
  const snapshotLimitReached = { value: false };

  for (let step = 0; step < maxSteps; step += 1) {
    if (state.terminalOutcome || state.phase === 'WIN' || state.phase === 'LOSS') {
      break;
    }

    const command = selectSimulationCommand(state, content, run);
    if (!command) {
      stalled = true;
      break;
    }

    const stateBeforeCommand = trajectoryRecorder ? state : null;
    const seatComradesBefore = collectSeatBodyTotals(state);
    const eventStartIndex = state.eventLog.length;
    logPhaseHeader(state, command, debug);
    // Capture immediately before dispatching commands that can evaluate defeat.
    appendPreDefeatSnapshot(preDefeatSnapshots, state, command, debug);
    state = dispatchCommand(state, command, content);
    if (trajectoryRecorder && stateBeforeCommand) {
      appendTrajectorySteps(
        trajectoryRecorder,
        stateBeforeCommand,
        state,
        state.eventLog.slice(eventStartIndex),
        debug,
      );
    }
    logBodySpend(seatComradesBefore, state, debug);
    logPhaseEffects(state, command, eventStartIndex, debug);

    if (isPhaseCommand(command)) {
      validateResourceInvariants(state);
    }

    if (command.type === 'ResolveResolutionPhase') {
      appendRoundSnapshot(run, roundSnapshots, state, snapshotLimitReached, debug);
    }
  }

  if (!state.terminalOutcome && state.phase !== 'WIN' && state.phase !== 'LOSS') {
    stalled = true;
  }

  if (preDefeatSnapshots.length === 0) {
    const fallback = capturePreDefeatSnapshot(state, 'simulation_end');
    preDefeatSnapshots.push(fallback);
    if (debug) {
      console.log(`🧠 Pre-defeat snapshot captured round=${fallback.round} phase=simulation_end`);
    }
  }

  const record = buildRunRecord(run, state, stalled, preDefeatSnapshots, roundSnapshots);
  const trajectory = trajectoryRecorder && (record.publicVictoryAchieved || record.result.type === 'victory')
    ? trajectoryRecorder.buildTrajectory({
      scenarioId: run.scenario,
      victoryMode: record.victoryMode,
      seed: run.seed,
      players: run.humanPlayerCount,
      publicVictory: record.publicVictoryAchieved,
      fullVictory: record.result.type === 'victory',
      mandateFailure: record.mandateFailure,
      turnsPlayed: record.turnsPlayed,
    })
    : undefined;

  return {
    record,
    terminalCommandLogLength: state.commandLog.length,
    trajectory,
  };
}

export function createSummaryAccumulator(): SummaryAccumulator {
  return {
    runs: 0,
    wins: 0,
    totalTurns: 0,
    sanity: {
      endedBeforeRound2: 0,
    },
    defeatReasons: {
      extraction_breach: 0,
      comrades_exhausted: 0,
      sudden_death: 0,
      mandate_failure: 0,
      simulation_stalled: 0,
    },
    campaignAttempts: 0,
    campaignSuccess: 0,
    scenarioStats: {},
    strategyPerformance: {},
  };
}

function incrementCount(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

export function updateSummaryAccumulator(accumulator: SummaryAccumulator, record: SimulationRecord) {
  accumulator.runs += 1;
  accumulator.totalTurns += record.turnsPlayed;
  if (record.turnsPlayed < 2) {
    accumulator.sanity.endedBeforeRound2 += 1;
  }

  if (record.result.type === 'victory') {
    accumulator.wins += 1;
  } else {
    if (record.result.reason in accumulator.defeatReasons) {
      const reason = record.result.reason as keyof SummaryAccumulator['defeatReasons'];
      accumulator.defeatReasons[reason] += 1;
    }
  }

  accumulator.campaignAttempts += record.campaignStats.campaignAttempts;
  accumulator.campaignSuccess += record.campaignStats.campaignSuccess;

  const scenarioBucket = accumulator.scenarioStats[record.scenario] ?? {
    runs: 0,
    wins: 0,
    totalTurns: 0,
    defeatReasons: {},
    campaignAttempts: 0,
    campaignSuccess: 0,
  };

  scenarioBucket.runs += 1;
  scenarioBucket.totalTurns += record.turnsPlayed;
  if (record.result.type === 'victory') {
    scenarioBucket.wins += 1;
  } else {
    incrementCount(scenarioBucket.defeatReasons, record.result.reason);
  }
  scenarioBucket.campaignAttempts += record.campaignStats.campaignAttempts;
  scenarioBucket.campaignSuccess += record.campaignStats.campaignSuccess;
  accumulator.scenarioStats[record.scenario] = scenarioBucket;

  for (const strategyId of record.strategies) {
    const strategyBucket = accumulator.strategyPerformance[strategyId] ?? {
      runs: 0,
      wins: 0,
      totalTurns: 0,
      mandateFailures: 0,
    };

    strategyBucket.runs += 1;
    strategyBucket.totalTurns += record.turnsPlayed;
    if (record.result.type === 'victory') {
      strategyBucket.wins += 1;
    }
    if (record.mandateFailure) {
      strategyBucket.mandateFailures += 1;
    }

    accumulator.strategyPerformance[strategyId] = strategyBucket;
  }
}

export function mergeSummaryAccumulators(target: SummaryAccumulator, source: SummaryAccumulator) {
  target.runs += source.runs;
  target.wins += source.wins;
  target.totalTurns += source.totalTurns;
  target.sanity.endedBeforeRound2 += source.sanity.endedBeforeRound2;

  target.defeatReasons.extraction_breach += source.defeatReasons.extraction_breach;
  target.defeatReasons.comrades_exhausted += source.defeatReasons.comrades_exhausted;
  target.defeatReasons.sudden_death += source.defeatReasons.sudden_death;
  target.defeatReasons.mandate_failure += source.defeatReasons.mandate_failure;
  target.defeatReasons.simulation_stalled += source.defeatReasons.simulation_stalled;

  target.campaignAttempts += source.campaignAttempts;
  target.campaignSuccess += source.campaignSuccess;

  for (const [scenario, sourceScenario] of Object.entries(source.scenarioStats)) {
    const targetScenario = target.scenarioStats[scenario] ?? {
      runs: 0,
      wins: 0,
      totalTurns: 0,
      defeatReasons: {},
      campaignAttempts: 0,
      campaignSuccess: 0,
    };

    targetScenario.runs += sourceScenario.runs;
    targetScenario.wins += sourceScenario.wins;
    targetScenario.totalTurns += sourceScenario.totalTurns;
    targetScenario.campaignAttempts += sourceScenario.campaignAttempts;
    targetScenario.campaignSuccess += sourceScenario.campaignSuccess;

    for (const [reason, count] of Object.entries(sourceScenario.defeatReasons)) {
      targetScenario.defeatReasons[reason] = (targetScenario.defeatReasons[reason] ?? 0) + count;
    }

    target.scenarioStats[scenario] = targetScenario;
  }

  for (const [strategyId, sourceStrategy] of Object.entries(source.strategyPerformance)) {
    const targetStrategy = target.strategyPerformance[strategyId] ?? {
      runs: 0,
      wins: 0,
      totalTurns: 0,
      mandateFailures: 0,
    };

    targetStrategy.runs += sourceStrategy.runs;
    targetStrategy.wins += sourceStrategy.wins;
    targetStrategy.totalTurns += sourceStrategy.totalTurns;
    targetStrategy.mandateFailures += sourceStrategy.mandateFailures;

    target.strategyPerformance[strategyId] = targetStrategy;
  }
}

function ratio(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }
  return Number((numerator / denominator).toFixed(6));
}

export function finalizeSummary(accumulator: SummaryAccumulator): SimulationSummary {
  const scenarioStats = Object.fromEntries(
    Object.entries(accumulator.scenarioStats)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([scenario, bucket]) => [
        scenario,
        {
          runs: bucket.runs,
          winRate: ratio(bucket.wins, bucket.runs),
          averageTurns: ratio(bucket.totalTurns, bucket.runs),
          defeatReasons: bucket.defeatReasons,
          campaignSuccessRate: ratio(bucket.campaignSuccess, bucket.campaignAttempts),
        },
      ]),
  );

  const strategyPerformance = Object.fromEntries(
    Object.entries(accumulator.strategyPerformance)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([strategyId, bucket]) => [
        strategyId,
        {
          runs: bucket.runs,
          winRate: ratio(bucket.wins, bucket.runs),
          averageTurns: ratio(bucket.totalTurns, bucket.runs),
          mandateFailureRate: ratio(bucket.mandateFailures, bucket.runs),
        },
      ]),
  );

  return {
    runs: accumulator.runs,
    winRate: ratio(accumulator.wins, accumulator.runs),
    averageTurns: ratio(accumulator.totalTurns, accumulator.runs),
    sanity: {
      endedBeforeRound2: accumulator.sanity.endedBeforeRound2,
      endedBeforeRound2Rate: ratio(accumulator.sanity.endedBeforeRound2, accumulator.runs),
    },
    defeatReasons: {
      extraction_breach: accumulator.defeatReasons.extraction_breach,
      comrades_exhausted: accumulator.defeatReasons.comrades_exhausted,
      sudden_death: accumulator.defeatReasons.sudden_death,
      mandate_failure: accumulator.defeatReasons.mandate_failure,
      simulation_stalled: accumulator.defeatReasons.simulation_stalled,
    },
    scenarioStats,
    strategyPerformance,
    campaignSuccessRate: ratio(accumulator.campaignSuccess, accumulator.campaignAttempts),
  };
}

async function closeStream(stream: ReturnType<typeof createWriteStream>) {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    stream.end(() => resolvePromise());
    stream.on('error', rejectPromise);
  });
}

async function writeTrajectoryToDirectory(trajectoryDir: string, trajectory: VictoryTrajectory) {
  await mkdir(trajectoryDir, { recursive: true });
  const stem = buildTrajectoryFileStem(trajectory);

  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const suffixLabel = suffix === 0 ? '' : `_${suffix}`;
    const filePath = join(trajectoryDir, `${stem}${suffixLabel}.json`);
    try {
      await writeFile(filePath, `${JSON.stringify(trajectory, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
      return filePath;
    } catch (error) {
      const err = error as { code?: string };
      if (err.code === 'EEXIST') {
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Unable to allocate trajectory file for ${stem}.`);
}

export async function executeRunChunk(
  chunk: WorkerRunChunk,
  onProgress?: (completed: number, total: number) => void,
): Promise<WorkerResultMessage> {
  await mkdir(dirname(chunk.shardPath), { recursive: true });
  const stream = createWriteStream(chunk.shardPath, { flags: 'w', encoding: 'utf8' });

  const summary = createSummaryAccumulator();
  let processed = 0;
  let capturedTrajectories = 0;
  let activeScenario: string | null = null;

  try {
    for (const run of chunk.runs) {
      if (run.scenario !== activeScenario) {
        activeScenario = run.scenario;
        if (chunk.debugSingle) {
          console.log(`🧪 Worker ${chunk.workerId} running scenario ${run.scenario}`);
        }
      }

      const { record, trajectory } = runSingleSimulation(run, {
        debug: chunk.debugSingle,
        trajectoryRecording: chunk.trajectoryRecording,
      });
      if (record.turnsPlayed < 2) {
        console.warn(`⚠️ Simulation ended before round 2 (${run.simulationId})`);
      }
      stream.write(`${JSON.stringify(record)}\n`);
      updateSummaryAccumulator(summary, record);

      if (chunk.trajectoryRecording && trajectory && chunk.trajectoryDir) {
        capturedTrajectories += 1;
        if (capturedTrajectories <= 5 || capturedTrajectories % 50 === 0) {
          console.log(`🏁 Public victory trajectory captured sim=${run.simulationId} count=${capturedTrajectories}`);
        }
        const writtenPath = await writeTrajectoryToDirectory(chunk.trajectoryDir, trajectory);
        if (capturedTrajectories <= 5 || capturedTrajectories % 50 === 0) {
          console.log(`💾 Trajectory written to disk ${writtenPath}`);
        }
      }

      processed += 1;
      if (processed % chunk.progressInterval === 0 || processed === chunk.runs.length) {
        onProgress?.(processed, chunk.runs.length);
      }
    }
  } finally {
    await closeStream(stream);
  }

  return {
    type: 'result',
    workerId: chunk.workerId,
    chunkIndex: chunk.chunkIndex,
    shardPath: chunk.shardPath,
    processed,
    summary,
  };
}

function createChunks(
  runs: PlannedSimulationRun[],
  parallelWorkers: number,
  shardDir: string,
  progressInterval: number,
  debugSingle: boolean,
  trajectoryRecording: boolean,
  trajectoryDir: string,
): WorkerRunChunk[] {
  const workerCount = Math.max(1, Math.min(parallelWorkers, runs.length));
  const chunkSize = Math.ceil(runs.length / workerCount);
  const chunks: WorkerRunChunk[] = [];

  for (let workerId = 0; workerId < workerCount; workerId += 1) {
    const start = workerId * chunkSize;
    const end = Math.min(start + chunkSize, runs.length);
    if (start >= end) {
      continue;
    }

    chunks.push({
      workerId,
      chunkIndex: workerId,
      runs: runs.slice(start, end),
      shardPath: join(shardDir, `worker-${workerId}.ndjson`),
      progressInterval,
      debugSingle,
      trajectoryRecording,
      trajectoryDir,
    });
  }

  return chunks;
}

async function mergeShardFiles(shardPaths: string[], outputPath: string) {
  await mkdir(dirname(outputPath), { recursive: true });
  const stream = createWriteStream(outputPath, { flags: 'w', encoding: 'utf8' });

  try {
    for (const shardPath of shardPaths) {
      await new Promise<void>((resolvePromise, rejectPromise) => {
        const input = createReadStream(shardPath, { encoding: 'utf8' });
        input.on('error', rejectPromise);
        input.on('end', resolvePromise);
        input.pipe(stream, { end: false });
      });
    }
  } finally {
    await closeStream(stream);
  }
}

function formatOutputShardName(index: number) {
  return `simulations_${String(index).padStart(3, '0')}.ndjson`;
}

async function removeLegacyOutputShards(outputDir: string) {
  const entries = await readdir(outputDir, { withFileTypes: true });
  const shardPattern = /^simulations_\d{3}\.ndjson$/;
  await Promise.all(entries
    .filter((entry) => entry.isFile() && shardPattern.test(entry.name))
    .map((entry) => rm(join(outputDir, entry.name), { force: true })));
}

async function writeOutputAsShards(shardPaths: string[], outputDir: string) {
  await removeLegacyOutputShards(outputDir);

  // Keep shard size modest to avoid very large files while preserving streaming writes.
  const maxLinesPerShard = 50_000;
  let shardIndex = 0;
  let linesInShard = 0;
  let writer = createWriteStream(join(outputDir, formatOutputShardName(shardIndex)), { flags: 'w', encoding: 'utf8' });

  const rotateShard = async () => {
    await closeStream(writer);
    shardIndex += 1;
    linesInShard = 0;
    writer = createWriteStream(join(outputDir, formatOutputShardName(shardIndex)), { flags: 'w', encoding: 'utf8' });
  };

  for (const shardPath of shardPaths) {
    const input = createReadStream(shardPath, { encoding: 'utf8' });
    const reader = createInterface({ input, crlfDelay: Infinity });

    for await (const line of reader) {
      if (line.length === 0) {
        continue;
      }
      if (linesInShard >= maxLinesPerShard) {
        await rotateShard();
      }
      writer.write(`${line}\n`);
      linesInShard += 1;
    }
  }

  await closeStream(writer);
}

async function runWorkerChunk(chunk: WorkerRunChunk, totalRuns: number, progressByWorker: Map<number, number>) {
  return await new Promise<WorkerResultMessage>((resolvePromise, rejectPromise) => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
      workerData: chunk,
    });

    let settled = false;

    worker.on('message', (message: WorkerMessage) => {
      if (message.type === 'progress') {
        progressByWorker.set(message.workerId, message.completed);
        const totalComplete = Array.from(progressByWorker.values()).reduce((sum, value) => sum + value, 0);
        console.log(`📊 Simulation progress: ${totalComplete} / ${totalRuns}`);
        return;
      }

      if (message.type === 'error') {
        settled = true;
        rejectPromise(new Error(message.stack ? `${message.message}\n${message.stack}` : message.message));
        return;
      }

      if (message.type === 'result') {
        settled = true;
        progressByWorker.set(message.workerId, message.processed);
        const totalComplete = Array.from(progressByWorker.values()).reduce((sum, value) => sum + value, 0);
        console.log(`📊 Simulation progress: ${totalComplete} / ${totalRuns}`);
        resolvePromise(message);
      }
    });

    worker.on('error', (error: unknown) => {
      if (!settled) {
        settled = true;
        rejectPromise(error instanceof Error ? error : new Error(String(error)));
      }
    });

    worker.on('exit', (code: number) => {
      if (!settled && code !== 0) {
        settled = true;
        rejectPromise(new Error(`Worker ${chunk.workerId} exited with code ${code}`));
      }
    });
  });
}

function ensureCoreVersion() {
  if (CORE_VERSION !== REQUIRED_CORE_VERSION) {
    throw new Error(`Simulation framework expects core version ${REQUIRED_CORE_VERSION}, but found ${CORE_VERSION}.`);
  }
}

export async function runSimulationBatch(config: SimulationBatchConfig): Promise<SimulationBatchResult> {
  ensureCoreVersion();
  const startedAt = Date.now();
  const normalized = normalizeBatchConfig(config);

  console.log('🎲 Starting simulation batch');
  console.log(`🧠 Strategy profiles loaded (${normalized.strategyIds.join(', ')})`);

  const outputPath = join(normalized.outputDir, 'simulations.ndjson');
  const outputShardGlob = join(normalized.outputDir, 'simulations_*.ndjson');
  const summaryPath = join(normalized.outputDir, 'simulation_summary.json');
  const trajectoryDir = join(normalized.outputDir, 'trajectories');
  const shardDir = join(normalized.outputDir, '.workers');

  await mkdir(normalized.outputDir, { recursive: true });
  await rm(outputPath, { force: true });
  await rm(summaryPath, { force: true });
  await rm(shardDir, { recursive: true, force: true });
  if (normalized.trajectoryRecording) {
    await rm(trajectoryDir, { recursive: true, force: true });
    await mkdir(trajectoryDir, { recursive: true });
  }
  await mkdir(shardDir, { recursive: true });

  const runs = createPlannedRuns(normalized);
  const totalRuns = runs.length;
  const chunks = createChunks(
    runs,
    normalized.parallelWorkers,
    shardDir,
    normalized.progressInterval,
    normalized.debugSingle,
    normalized.trajectoryRecording,
    trajectoryDir,
  );

  console.log('⚙️ Running workers');

  const progressByWorker = new Map<number, number>();
  const results: WorkerResultMessage[] = [];

  if (chunks.length <= 1) {
    const singleChunk = chunks[0] ?? {
      workerId: 0,
      chunkIndex: 0,
      runs: [],
      shardPath: join(shardDir, 'worker-0.ndjson'),
      progressInterval: normalized.progressInterval,
      trajectoryRecording: normalized.trajectoryRecording,
      trajectoryDir,
    };

    const result = await executeRunChunk(singleChunk, (completed) => {
      progressByWorker.set(singleChunk.workerId, completed);
      console.log(`📊 Simulation progress: ${completed} / ${totalRuns}`);
    });
    results.push(result);
  } else {
    const workerResults = await Promise.all(chunks.map((chunk) => runWorkerChunk(chunk, totalRuns, progressByWorker)));
    results.push(...workerResults);
  }

  console.log('📈 Aggregating results');

  const aggregate = createSummaryAccumulator();
  const orderedResults = results.slice().sort((left, right) => left.chunkIndex - right.chunkIndex);
  const shardPaths = orderedResults.map((result) => result.shardPath);

  for (const result of orderedResults) {
    mergeSummaryAccumulators(aggregate, result.summary);
  }

  console.log('💾 Writing NDJSON output');
  if (normalized.splitOutputShards) {
    await writeOutputAsShards(shardPaths, normalized.outputDir);
  } else {
    await mergeShardFiles(shardPaths, outputPath);
  }

  const summary = finalizeSummary(aggregate);
  if (summary.sanity.endedBeforeRound2 > 0) {
    console.warn(`⚠️ Simulation sanity check: ${summary.sanity.endedBeforeRound2} run(s) ended before round 2.`);
  }
  await writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

  await rm(shardDir, { recursive: true, force: true });

  console.log('✅ Simulation batch complete');

  return {
    runs: summary.runs,
    seed: normalized.randomSeed,
    parallelWorkers: Math.max(1, Math.min(normalized.parallelWorkers, totalRuns)),
    outputPath: normalized.splitOutputShards ? outputShardGlob : outputPath,
    summaryPath,
    summary,
    durationMs: Date.now() - startedAt,
  };
}

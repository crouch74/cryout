import {
  assertScenarioConformance,
  compileContent,
  dispatchCommand,
  getScenarioModule,
  getSeatDisabledReason,
  initializeGame,
  replayCommands,
  type CompiledContent,
  type DomainEvent,
  type EngineCommand,
  type EngineState,
  type FactionDefinition,
  type FactionId,
  type QueuedIntent,
  type RegionId,
  type StartGameCommand,
} from '../engine/index.ts';
import {
  localizeActionField,
  localizeCardField,
  localizeDomainField,
  localizeFactionField,
  localizeRegionField,
} from '../i18n/index.ts';
import { selectAutoPlayDecision } from './autoPlaySelector.ts';

const BASE_CAMPAIGN_TARGET = 8;
const EXTRACTION_DEFEAT_THRESHOLD = 6;

export interface ReplaySummaryEntry {
  label: string;
  before: string;
  after: string;
}

export interface ReplayTimelineEntry {
  commandIndex: number;
  command: EngineCommand;
  label: string;
  state: EngineState;
  changes: ReplaySummaryEntry[];
  events: DomainEvent[];
}

export interface ConformanceCheck {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export interface LegalityCostLine {
  label: string;
  amount: number;
  type: 'cost' | 'effect' | 'context';
}

export interface LegalityModifierLine {
  label: string;
  value: number;
}

export interface ActionLegalityReport {
  legal: boolean;
  reason: string;
  costs: LegalityCostLine[];
  modifiers: LegalityModifierLine[];
  notes: string[];
  projectedCampaignTotal?: number;
  projectedCampaignTarget?: number;
}

export interface TrackOption {
  id: string;
  label: string;
}

export interface TrackCausalityEntry {
  eventSeq: number;
  round: number;
  phase: EngineState['phase'];
  sourceLabel: string;
  emoji: string;
  before: string;
  after: string;
  message: string;
}

export interface NarrativeLintFinding {
  id: string;
  severity: 'warn' | 'error';
  area: string;
  detail: string;
  excerpt: string;
}

export interface ProbabilitySandboxReport {
  simulations: number;
  averageTerminalRound: number;
  wins: number;
  losses: number;
  winRate: number;
  topOutcomes: Array<{ label: string; count: number }>;
  extractionHotspots: Array<{ regionId: RegionId; averagePeakExtraction: number }>;
  trackAverages: Array<{ id: string; label: string; averageFinalValue: number }>;
}

function formatDeltaValue(value: number | string | boolean | null | undefined) {
  if (value === undefined) {
    return 'n/a';
  }
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value);
}

function getFaction(content: CompiledContent, state: EngineState, seat: number): FactionDefinition | null {
  const player = state.players[seat];
  return player ? (content.factions[player.factionId] ?? null) : null;
}

function getRulesetTrackOptions(content: CompiledContent): TrackOption[] {
  return [
    { id: 'global_gaze', label: 'Global Gaze' },
    { id: 'war_machine', label: 'War Machine' },
    ...content.ruleset.domains.map((domain) => ({
      id: `domain:${domain.id}`,
      label: localizeDomainField(domain.id, 'name', domain.name),
    })),
    ...Object.values(content.ruleset.customTracks ?? {}).map((track) => ({
      id: `custom:${track.id}`,
      label: track.name,
    })),
  ];
}

function countSeatComrades(state: EngineState, seat: number) {
  return Object.values(state.regions).reduce((sum, region) => sum + (region.comradesPresent[seat] ?? 0), 0);
}

function buildCommandLabel(command: EngineCommand, content: CompiledContent) {
  switch (command.type) {
    case 'StartGame':
      return `Start ${content.ruleset.name}`;
    case 'QueueIntent': {
      const action = content.actions[command.action.actionId];
      const actionLabel = localizeActionField(action.id, 'name', action.name);
      const regionLabel = command.action.regionId
        ? ` • ${localizeRegionField(command.action.regionId, 'name', content.regions[command.action.regionId]?.name ?? command.action.regionId)}`
        : '';
      return `Queue S${command.seat + 1} ${actionLabel}${regionLabel}`;
    }
    case 'SetReady':
      return `Seat ${command.seat + 1} ${command.ready ? 'ready' : 'not ready'}`;
    case 'RemoveQueuedIntent':
      return `Remove queued move S${command.seat + 1}`;
    case 'ReorderQueuedIntent':
      return `Reorder queued moves S${command.seat + 1}`;
    case 'ResolveSystemPhase':
      return 'Resolve System';
    case 'CommitCoalitionIntent':
      return 'Resolve Coalition';
    case 'ResolveResolutionPhase':
      return 'Advance Resolution';
    case 'SaveSnapshot':
      return 'Save snapshot';
    case 'LoadSnapshot':
      return 'Load snapshot';
  }
}

function buildReplaySummary(previous: EngineState, next: EngineState, content: CompiledContent): ReplaySummaryEntry[] {
  const entries: ReplaySummaryEntry[] = [];

  if (previous.phase !== next.phase) {
    entries.push({ label: 'Phase', before: previous.phase, after: next.phase });
  }
  if (previous.round !== next.round) {
    entries.push({ label: 'Round', before: String(previous.round), after: String(next.round) });
  }
  if (previous.globalGaze !== next.globalGaze) {
    entries.push({ label: 'Global Gaze', before: String(previous.globalGaze), after: String(next.globalGaze) });
  }
  if (previous.northernWarMachine !== next.northernWarMachine) {
    entries.push({ label: 'War Machine', before: String(previous.northernWarMachine), after: String(next.northernWarMachine) });
  }
  if (previous.extractionPool !== next.extractionPool) {
    entries.push({ label: 'Extraction Pool', before: String(previous.extractionPool), after: String(next.extractionPool) });
  }

  for (const region of content.ruleset.regions) {
    const previousExtraction = previous.regions[region.id]?.extractionTokens ?? 0;
    const nextExtraction = next.regions[region.id]?.extractionTokens ?? 0;
    if (previousExtraction !== nextExtraction) {
      entries.push({
        label: `${localizeRegionField(region.id, 'name', region.name)} Extraction`,
        before: String(previousExtraction),
        after: String(nextExtraction),
      });
    }
  }

  for (const player of next.players) {
    const previousComrades = countSeatComrades(previous, player.seat);
    const nextComrades = countSeatComrades(next, player.seat);
    if (previousComrades !== nextComrades) {
      const faction = content.factions[player.factionId];
      entries.push({
        label: `${localizeFactionField(faction.id, 'shortName', faction.shortName)} Comrades`,
        before: String(previousComrades),
        after: String(nextComrades),
      });
    }
  }

  return entries.slice(0, 16);
}

export function buildReplayTimeline(state: EngineState, content: CompiledContent): ReplayTimelineEntry[] {
  const commandLog = state.commandLog;
  const start = commandLog[0];
  if (!start || start.type !== 'StartGame') {
    return [];
  }

  const timeline: ReplayTimelineEntry[] = [];
  let replayState = initializeGame(start);

  timeline.push({
    commandIndex: 0,
    command: start,
    label: buildCommandLabel(start, content),
    state: replayState,
    changes: [],
    events: replayState.eventLog,
  });

  for (let index = 1; index < commandLog.length; index += 1) {
    const command = commandLog[index];
    const previousState = replayState;
    replayState = dispatchCommand(replayState, command, content);
    timeline.push({
      commandIndex: index,
      command,
      label: buildCommandLabel(command, content),
      state: replayState,
      changes: buildReplaySummary(previousState, replayState, content),
      events: replayState.eventLog.slice(previousState.eventLog.length),
    });
  }

  return timeline;
}

function getCampaignSupportBonus(
  state: EngineState,
  content: CompiledContent,
  seat: number,
  intent: Omit<QueuedIntent, 'slot'>,
) {
  if (!intent.cardId) {
    return { bonus: 0, label: null };
  }

  const card = content.cards[intent.cardId];
  const player = state.players[seat];
  if (!card || card.deck !== 'resistance' || card.type !== 'support' || !player?.resistanceHand.includes(intent.cardId)) {
    return { bonus: 0, label: null };
  }

  let bonus = card.campaignBonus ?? 0;
  if (card.domainBonus && card.domainBonus !== intent.domainId) {
    bonus = 0;
  }
  if (card.regionBonus && card.regionBonus !== 'ANY' && card.regionBonus !== intent.regionId) {
    bonus = 0;
  }

  return {
    bonus,
    label: localizeCardField(card.id, 'name', card.name),
  };
}

function getSystemPressure(state: EngineState, content: CompiledContent) {
  const totals = {
    campaignTargetDelta: 0,
    campaignModifierDelta: 0,
    outreachCostDelta: 0,
  };

  for (const cardId of state.activeSystemCardIds) {
    const card = content.cards[cardId];
    if (!card || card.deck !== 'system') {
      continue;
    }

    totals.campaignTargetDelta += card.persistentModifiers?.campaignTargetDelta ?? 0;
    totals.campaignModifierDelta += card.persistentModifiers?.campaignModifierDelta ?? 0;
    totals.outreachCostDelta += card.persistentModifiers?.outreachCostDelta ?? 0;
  }

  if (state.scenarioFlags.stateOfEmergencyNationwide) {
    totals.campaignTargetDelta += 1;
  }

  return totals;
}

function getOutreachCost(state: EngineState, content: CompiledContent, seat: number) {
  const faction = getFaction(content, state, seat);
  const pressure = getSystemPressure(state, content);
  return Math.max(0, 2 + (faction?.outreachPenalty ?? 0) + pressure.outreachCostDelta);
}

function inspectCampaignLegality(
  state: EngineState,
  content: CompiledContent,
  seat: number,
  action: Omit<QueuedIntent, 'slot'>,
) {
  const faction = getFaction(content, state, seat);
  const support = getCampaignSupportBonus(state, content, seat, action);
  const pressure = getSystemPressure(state, content);
  const committedComrades = action.comradesCommitted ?? 0;
  const committedEvidence = action.evidenceCommitted ?? 0;
  const modifiers: LegalityModifierLine[] = [];
  let totalModifier = 0;

  const pushModifier = (label: string, value: number) => {
    if (value === 0) {
      return;
    }
    totalModifier += value;
    modifiers.push({ label, value });
  };

  pushModifier('Committed Comrades', Math.floor(committedComrades / 2));
  pushModifier('Committed Evidence', committedEvidence);
  pushModifier('Global Gaze', Math.floor(state.globalGaze / 5));
  pushModifier('War Machine pressure', -Math.floor(state.northernWarMachine / 4));
  if (action.regionId && faction && action.regionId === faction.homeRegion) {
    pushModifier('Home region', faction.campaignBonus);
  }
  if (action.domainId && faction?.campaignDomainBonus === action.domainId) {
    pushModifier('Faction domain', 1);
  }
  if (support.bonus !== 0) {
    pushModifier(support.label ? `Support card: ${support.label}` : 'Support card', support.bonus);
  }
  pushModifier('System pressure', pressure.campaignModifierDelta);

  return {
    modifiers,
    projectedCampaignTotal: 7 + totalModifier,
    projectedCampaignTarget: BASE_CAMPAIGN_TARGET + pressure.campaignTargetDelta,
    notes: pressure.campaignTargetDelta !== 0
      ? [`System escalations changed the target to ${BASE_CAMPAIGN_TARGET + pressure.campaignTargetDelta}+.`]
      : ['Where the Stones Cry Out Launch Campaign target remains 8+.'],
  };
}

export function inspectActionLegality(
  state: EngineState,
  content: CompiledContent,
  seat: number,
  action: Omit<QueuedIntent, 'slot'>,
): ActionLegalityReport {
  const disabled = getSeatDisabledReason(state, content, seat, action);
  const costs: LegalityCostLine[] = [];
  const notes: string[] = [];

  switch (action.actionId) {
    case 'build_solidarity':
      costs.push({ label: 'Comrades spent', amount: 3, type: 'cost' });
      costs.push({ label: 'Domain progress on success', amount: 1, type: 'effect' });
      break;
    case 'smuggle_evidence': {
      const faction = getFaction(content, state, seat);
      costs.push({ label: 'Comrades spent', amount: 1, type: 'cost' });
      costs.push({
        label: 'Evidence transferred',
        amount: faction?.id === 'amazon_guardians' ? 1 : Math.min(2, state.players[seat]?.evidence ?? 0),
        type: 'effect',
      });
      break;
    }
    case 'international_outreach':
      costs.push({ label: 'Evidence spent', amount: getOutreachCost(state, content, seat), type: 'cost' });
      costs.push({ label: 'Global Gaze gained', amount: 1, type: 'effect' });
      break;
    case 'defend':
      costs.push({ label: 'Committed Comrades spent', amount: action.comradesCommitted ?? 0, type: 'cost' });
      notes.push('Defense is set to the larger of current defense or the computed defense total.');
      break;
    case 'go_viral':
      costs.push({ label: 'Evidence spent', amount: 1, type: 'cost' });
      costs.push({ label: 'Global Gaze gained', amount: 1, type: 'effect' });
      break;
    case 'burn_veil':
      costs.push({ label: 'Comrades spent', amount: 1, type: 'cost' });
      costs.push({ label: 'Global Gaze gained', amount: 2, type: 'effect' });
      break;
    case 'schoolgirl_network':
      costs.push({ label: 'Evidence gained', amount: 1, type: 'effect' });
      break;
    case 'compose_chant':
      costs.push({ label: 'Evidence spent', amount: 1, type: 'cost' });
      break;
    case 'coordinate_digital':
      costs.push({ label: 'Evidence spent', amount: 1, type: 'cost' });
      notes.push('Opens a replanning window if the action resolves.');
      break;
    case 'launch_campaign':
      costs.push({ label: 'Committed Comrades spent', amount: action.comradesCommitted ?? 0, type: 'cost' });
      costs.push({ label: 'Committed Evidence spent', amount: action.evidenceCommitted ?? 0, type: 'cost' });
      break;
    default:
      break;
  }

  const campaign = action.actionId === 'launch_campaign'
    ? inspectCampaignLegality(state, content, seat, action)
    : null;

  if (action.cardId) {
    const card = content.cards[action.cardId];
    notes.push(`Card selected: ${localizeCardField(action.cardId, 'name', card?.name ?? action.cardId)}.`);
  }

  return {
    legal: !disabled.disabled,
    reason: disabled.reason ?? 'Legal',
    costs,
    modifiers: campaign?.modifiers ?? [],
    notes: [...notes, ...(campaign?.notes ?? [])],
    projectedCampaignTotal: campaign?.projectedCampaignTotal,
    projectedCampaignTarget: campaign?.projectedCampaignTarget,
  };
}

export function getTrackOptions(content: CompiledContent) {
  return getRulesetTrackOptions(content);
}

function getDeltaForTrack(event: DomainEvent, trackId: string) {
  if (trackId === 'global_gaze') {
    return event.deltas.find((delta) => delta.kind === 'track' && delta.label === 'globalGaze');
  }
  if (trackId === 'war_machine') {
    return event.deltas.find((delta) => delta.kind === 'track' && delta.label === 'northernWarMachine');
  }
  if (trackId.startsWith('domain:')) {
    const domainId = trackId.slice('domain:'.length);
    return event.deltas.find((delta) => delta.kind === 'domain' && delta.label === domainId);
  }
  if (trackId.startsWith('custom:')) {
    const customTrackId = trackId.slice('custom:'.length);
    return event.deltas.find((delta) => delta.kind === 'track' && delta.label === customTrackId);
  }
  return undefined;
}

export function buildTrackCausality(state: EngineState, trackId: string): TrackCausalityEntry[] {
  return state.eventLog.flatMap((event) => {
    const delta = getDeltaForTrack(event, trackId);
    if (!delta) {
      return [];
    }

    return [{
      eventSeq: event.seq,
      round: event.round,
      phase: event.phase,
      sourceLabel: `${event.sourceType}:${event.sourceId}`,
      emoji: event.emoji,
      before: formatDeltaValue(delta.before),
      after: formatDeltaValue(delta.after),
      message: event.message,
    }];
  }).reverse();
}

function pushNarrativeFinding(
  findings: NarrativeLintFinding[],
  severity: NarrativeLintFinding['severity'],
  area: string,
  detail: string,
  excerpt: string,
) {
  findings.push({
    id: `${severity}:${area}:${findings.length}`,
    severity,
    area,
    detail,
    excerpt,
  });
}

export function lintNarrativeContent(content: CompiledContent): NarrativeLintFinding[] {
  const findings: NarrativeLintFinding[] = [];
  const forbiddenPatterns: Array<{ pattern: RegExp; detail: string }> = [
    { pattern: /\bhero(?:ic)?\b/i, detail: 'Avoid single-hero framing; movements should remain central.' },
    { pattern: /\bsave(?:r|s|d)?\b/i, detail: 'Avoid savior framing.' },
    { pattern: /\bciviliz/i, detail: 'Avoid colonial framing and civilizing language.' },
    { pattern: /\bthird world\b/i, detail: 'Avoid dated and colonial descriptors.' },
    { pattern: /\bprimitive\b/i, detail: 'Avoid demeaning colonial descriptors.' },
    { pattern: /\btribal\b/i, detail: 'Avoid flattening communities into colonial categories.' },
    { pattern: /\bwestern intervention\b/i, detail: 'Do not frame external intervention as the solution.' },
  ];

  const canonicalPatterns: Array<{ pattern: RegExp; detail: string }> = [
    { pattern: /\bNorthern War Machine\b/, detail: 'Prefer the canonical track name War Machine in dev-facing copy.' },
  ];

  const scan = (area: string, excerpt: string) => {
    for (const entry of forbiddenPatterns) {
      if (entry.pattern.test(excerpt)) {
        pushNarrativeFinding(findings, 'error', area, entry.detail, excerpt);
      }
    }
    for (const entry of canonicalPatterns) {
      if (entry.pattern.test(excerpt)) {
        pushNarrativeFinding(findings, 'warn', area, entry.detail, excerpt);
      }
    }
  };

  scan('ruleset.description', content.ruleset.description);
  scan('ruleset.introduction', content.ruleset.introduction);

  for (const action of content.ruleset.actions) {
    scan(`action:${action.id}`, action.name);
    scan(`action:${action.id}`, action.description);
  }
  for (const region of content.ruleset.regions) {
    scan(`region:${region.id}`, region.description);
    scan(`region:${region.id}`, region.strapline);
  }
  for (const faction of content.ruleset.factions) {
    scan(`faction:${faction.id}`, faction.passive);
    scan(`faction:${faction.id}`, faction.weakness);
    scan(`mandate:${faction.mandate.id}`, faction.mandate.description);
  }
  for (const beacon of content.ruleset.beacons) {
    scan(`beacon:${beacon.id}`, beacon.description);
  }
  for (const card of [...content.ruleset.resistanceCards, ...content.ruleset.crisisCards, ...content.ruleset.systemCards]) {
    scan(`card:${card.id}`, card.name);
    scan(`card:${card.id}`, card.text);
  }

  return findings;
}

export function buildConformanceChecks(state: EngineState, content: CompiledContent): ConformanceCheck[] {
  const checks: ConformanceCheck[] = [];
  const scenario = getScenarioModule(state.rulesetId);
  const scenarioErrors = scenario ? assertScenarioConformance(scenario) : [{ message: `Scenario module ${state.rulesetId} is not registered.` }];
  checks.push({
    id: 'scenario-shape',
    label: 'Scenario module conformance',
    status: scenarioErrors.length === 0 ? 'pass' : 'fail',
    detail: scenarioErrors.length === 0
      ? 'Scenario hooks, metadata version, and phase definitions are present.'
      : scenarioErrors.map((entry) => entry.message).join(' '),
  });

  const launchCampaign = content.actions.launch_campaign;
  const launchCampaignConfigured = Boolean(
    launchCampaign
    && launchCampaign.needsRegion
    && launchCampaign.needsDomain
    && launchCampaign.needsComrades,
  );
  checks.push({
    id: 'launch-campaign-shape',
    label: 'Launch Campaign remains the canonical pressure valve',
    status: launchCampaignConfigured ? 'pass' : 'fail',
    detail: launchCampaignConfigured
      ? 'Launch Campaign still requires a region, domain, and committed Comrades. Where the Stones Cry Out target is wired as 8+ in the compat runtime.'
      : 'Launch Campaign is missing or no longer carries the expected setup requirements.',
  });

  const breachedRegions = Object.values(state.regions).filter((region) => region.extractionTokens >= EXTRACTION_DEFEAT_THRESHOLD);
  checks.push({
    id: 'extraction-threshold',
    label: 'Regions breach at 6 Extraction Tokens',
    status: breachedRegions.length === 0 || state.phase === 'LOSS' ? 'pass' : 'fail',
    detail: breachedRegions.length === 0
      ? 'No region is currently at the defeat threshold.'
      : `Breached regions: ${breachedRegions.map((region) => region.id).join(', ')}.`,
  });

  const exhaustedSeats = state.players.filter((player) => countSeatComrades(state, player.seat) === 0);
  checks.push({
    id: 'comrades-exhausted',
    label: '0 Comrades produces defeat pressure',
    status: exhaustedSeats.length === 0 || state.terminalOutcome?.cause === 'comrades_exhausted' || state.phase === 'LOSS' ? 'pass' : 'fail',
    detail: exhaustedSeats.length === 0
      ? 'Every seat still has Comrades on the board.'
      : `Seats at 0 Comrades: ${exhaustedSeats.map((player) => player.seat + 1).join(', ')}.`,
  });

  const trackReactivity = state.eventLog.some((event) => event.deltas.some((delta) => delta.label === 'globalGaze' || delta.label === 'northernWarMachine'));
  checks.push({
    id: 'global-tracks-reactive',
    label: 'Global tracks respond to play',
    status: trackReactivity ? 'pass' : 'warn',
    detail: trackReactivity
      ? 'This session has already changed Global Gaze or War Machine through events.'
      : 'No Global Gaze or War Machine deltas are present yet in the current event log.',
  });

  const mandatesPresent = state.secretMandatesEnabled
    ? state.players.every((player) => Boolean(content.factions[player.factionId]?.mandate?.id))
    : true;
  checks.push({
    id: 'mandates-have-stakes',
    label: 'Secret Mandates carry mechanical stakes',
    status: mandatesPresent ? 'pass' : 'fail',
    detail: state.secretMandatesEnabled
      ? 'Each active faction still carries a Secret Mandate definition.'
      : 'Secret Mandates are disabled for this local table; room play still requires mandate checks.',
  });

  return checks;
}

function buildSeededStartCommand(state: EngineState, simulationIndex: number): StartGameCommand | null {
  const start = state.commandLog[0];
  if (!start || start.type !== 'StartGame') {
    return null;
  }

  return {
    ...start,
    seed: start.seed + simulationIndex * 7919,
  };
}

function runSimulation(command: StartGameCommand) {
  const content = compileContent(command.rulesetId);
  let simulationState = initializeGame(command);
  const peakExtraction: Record<RegionId, number> = Object.fromEntries(
    content.ruleset.regions.map((region) => [region.id, simulationState.regions[region.id]?.extractionTokens ?? 0]),
  ) as Record<RegionId, number>;

  const maxSteps = Math.max(120, content.ruleset.suddenDeathRound * 6);

  for (let step = 0; step < maxSteps; step += 1) {
    if (simulationState.terminalOutcome) {
      break;
    }
    const commandSelection = selectAutoPlayDecision(simulationState, content);
    if (!commandSelection) {
      break;
    }
    simulationState = dispatchCommand(simulationState, commandSelection.command, content);
    for (const region of content.ruleset.regions) {
      peakExtraction[region.id] = Math.max(peakExtraction[region.id], simulationState.regions[region.id]?.extractionTokens ?? 0);
    }
  }

  return { state: simulationState, peakExtraction };
}

function incrementCount(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export function runProbabilitySandbox(state: EngineState, simulations: number): ProbabilitySandboxReport {
  const safeSimulationCount = Math.max(1, Math.min(200, simulations));
  const start = state.commandLog[0];
  if (!start || start.type !== 'StartGame') {
    return {
      simulations: 0,
      averageTerminalRound: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      topOutcomes: [],
      extractionHotspots: [],
      trackAverages: [],
    };
  }

  const content = compileContent(start.rulesetId);
  const outcomeCounts = new Map<string, number>();
  const extractionTotals = new Map<RegionId, number>();
  const trackTotals = new Map<string, number>();
  let wins = 0;
  let losses = 0;
  let totalRounds = 0;

  for (let index = 0; index < safeSimulationCount; index += 1) {
    const seededStart = buildSeededStartCommand(state, index);
    if (!seededStart) {
      continue;
    }

    const result = runSimulation(seededStart);
    const outcome = result.state.terminalOutcome?.cause ?? 'incomplete';
    incrementCount(outcomeCounts, outcome);
    totalRounds += result.state.terminalOutcome?.round ?? result.state.round;
    if (result.state.phase === 'WIN') {
      wins += 1;
    } else {
      losses += 1;
    }

    for (const region of content.ruleset.regions) {
      extractionTotals.set(
        region.id,
        (extractionTotals.get(region.id) ?? 0) + result.peakExtraction[region.id],
      );
    }

    trackTotals.set('global_gaze', (trackTotals.get('global_gaze') ?? 0) + result.state.globalGaze);
    trackTotals.set('war_machine', (trackTotals.get('war_machine') ?? 0) + result.state.northernWarMachine);
    for (const domain of content.ruleset.domains) {
      trackTotals.set(
        domain.id,
        (trackTotals.get(domain.id) ?? 0) + (result.state.domains[domain.id]?.progress ?? 0),
      );
    }
  }

  return {
    simulations: safeSimulationCount,
    averageTerminalRound: Number((totalRounds / safeSimulationCount).toFixed(2)),
    wins,
    losses,
    winRate: Number(((wins / safeSimulationCount) * 100).toFixed(1)),
    topOutcomes: Array.from(outcomeCounts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 5),
    extractionHotspots: content.ruleset.regions
      .map((region) => ({
        regionId: region.id,
        averagePeakExtraction: Number(((extractionTotals.get(region.id) ?? 0) / safeSimulationCount).toFixed(2)),
      }))
      .sort((left, right) => right.averagePeakExtraction - left.averagePeakExtraction)
      .slice(0, 6),
    trackAverages: [
      { id: 'global_gaze', label: 'Global Gaze', averageFinalValue: Number(((trackTotals.get('global_gaze') ?? 0) / safeSimulationCount).toFixed(2)) },
      { id: 'war_machine', label: 'War Machine', averageFinalValue: Number(((trackTotals.get('war_machine') ?? 0) / safeSimulationCount).toFixed(2)) },
      ...content.ruleset.domains.map((domain) => ({
        id: domain.id,
        label: localizeDomainField(domain.id, 'name', domain.name),
        averageFinalValue: Number(((trackTotals.get(domain.id) ?? 0) / safeSimulationCount).toFixed(2)),
      })),
    ].sort((left, right) => right.averageFinalValue - left.averageFinalValue).slice(0, 6),
  };
}

export function createDefaultLegalityIntent(
  state: EngineState,
  content: CompiledContent,
  seat: number,
  actionId: keyof CompiledContent['actions'],
): Omit<QueuedIntent, 'slot'> {
  const action = content.actions[actionId];
  const regions = content.ruleset.regions.map((region) => region.id);
  const domains = content.ruleset.domains.map((domain) => domain.id);
  const otherSeat = state.players.find((player) => player.seat !== seat)?.seat;

  return {
    actionId: action.id,
    regionId: action.needsRegion ? regions[0] : undefined,
    domainId: action.needsDomain ? domains[0] : undefined,
    targetSeat: action.needsTargetSeat ? otherSeat : undefined,
    comradesCommitted: action.needsComrades ? 1 : undefined,
    evidenceCommitted: action.needsEvidence ? 0 : undefined,
    cardId: undefined,
  };
}

export function summarizeReplaySelection(entry: ReplayTimelineEntry | undefined) {
  if (!entry) {
    return null;
  }

  return {
    phase: entry.state.phase,
    round: entry.state.round,
    globalGaze: entry.state.globalGaze,
    warMachine: entry.state.northernWarMachine,
    extractionPool: entry.state.extractionPool,
  };
}

export function normalizeReplayIndex(index: number, commandLogLength: number) {
  if (commandLogLength <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(commandLogLength - 1, index));
}

export function buildSharedSeatOwners(factionIds: FactionId[], humanPlayerCount: number) {
  const owners: number[] = [];
  const baseSeatsPerOwner = Math.floor(factionIds.length / humanPlayerCount);
  const remainder = factionIds.length % humanPlayerCount;

  for (let ownerId = 0; ownerId < humanPlayerCount; ownerId += 1) {
    const seatsForOwner = baseSeatsPerOwner + (ownerId < remainder ? 1 : 0);
    for (let seat = 0; seat < seatsForOwner; seat += 1) {
      owners.push(ownerId);
    }
  }

  return owners.slice(0, factionIds.length);
}

export function rebuildStateFromLog(commandLog: EngineCommand[]) {
  return replayCommands(commandLog);
}

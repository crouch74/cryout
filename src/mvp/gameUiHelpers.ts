import {
  getSeatActions,
  getSeatDisabledReason,
  getPlayerBodyTotal,
  type ActionDefinition,
  type ActionId,
  type CardRevealEvent,
  type CompiledContent,
  type DeckId,
  type DomainEvent,
  type DomainId,
  type EngineState,
  type FactionId,
  type Phase,
  type PlayerState,
  type QueuedIntent,
  getVictoryModeSummary,
} from '../../engine/index.ts';
import {
  formatNumber,
  localizeDomainField,
  localizeFactionField,
  localizeRegionField,
  localizeRulesetField,
  t,
} from '../i18n/index.ts';
import type { IconType } from './icons/iconTypes.ts';

type NormalizedPhase = 'SYSTEM' | 'COALITION' | 'RESOLUTION';
type Severity = 'steady' | 'watch' | 'danger' | 'critical';
type PreviewTone = 'cost' | 'risk' | 'benefit' | 'detail';

interface PhasePresentation {
  icon: string;
  verb: string;
  urgency: string;
  copy: string;
}

interface TrackPresentation {
  id: 'globalGaze' | 'northernWarMachine';
  value: number;
  max: number;
  percent: number;
  severity: Severity;
  thresholds: number[];
  status: string;
}

interface DomainPresentation {
  icon: string;
  accentClass: string;
  percent: number;
  severity: Severity;
  summary: string;
}

interface SeatPresentation {
  crestLabel: string;
  crestSubline: string;
  ribbonClass: string;
  comrades: number;
  witness: number;
  moves: number;
  readiness: string;
  urgency: Severity;
}

interface IntentPreviewChip {
  id: string;
  tone: PreviewTone;
  label: string;
  value: string;
}

interface EventSourcePresentation {
  icon: string;
  label: string;
}

export type ContextPanelMode = 'region' | 'action' | 'ledger' | 'decks';

export interface DeckSummary {
  deckId: DeckId;
  label: string;
  drawCount: number;
  discardCount: number;
  activeCount?: number;
  latestRevealCardId: string | null;
}

export interface LatestPublicCardReveal {
  eventSeq: number;
  revealIndex: number;
  reveal: CardRevealEvent;
}

export interface StatusRibbonItem {
  id: 'mode' | 'objective' | 'globalGaze' | 'warMachine' | 'extractionPool' | 'round';
  label: string;
  value: string;
  icon: IconType;
  tone: string;
  tooltip: string;
}

export interface FrontTrackRow {
  id: DomainId;
  label: string;
  shortLabel: string;
  icon: IconType;
  color: string;
  value: number;
  max: 12;
  tooltip: string;
  severity: Severity;
}

export interface PlayerStripSummary {
  seat: number;
  factionName: string;
  shortName: string;
  homeRegion: string;
  bodies: number;
  evidence: number;
  moves: number;
  passivePrimary: string;
  passiveSecondary: string;
  mandateTitle: string;
  mandateLines: string[];
  ready: boolean;
}

export interface ActionDockItem {
  actionId: ActionId;
  label: string;
  icon: IconType;
  disabled: boolean;
  disabledReason?: string;
  quickQueue: boolean;
}

const DOMAIN_ICONS: Record<DomainId, string> = {
  WarMachine: 'Barracks',
  DyingPlanet: 'Climate',
  GildedCage: 'Carceral',
  SilencedTruth: 'Signal',
  EmptyStomach: 'Breadline',
  FossilGrip: 'Pipeline',
  StolenVoice: 'Memory',
};

const DOMAIN_TRACK_ICONS: Record<DomainId, IconType> = {
  WarMachine: 'frontWar',
  DyingPlanet: 'frontPlanet',
  GildedCage: 'frontCage',
  SilencedTruth: 'frontTruth',
  EmptyStomach: 'frontHunger',
  FossilGrip: 'frontFossil',
  StolenVoice: 'frontVoice',
};

const DOMAIN_SHORT_LABELS: Record<DomainId, string> = {
  WarMachine: 'War',
  DyingPlanet: 'Planet',
  GildedCage: 'Cage',
  SilencedTruth: 'Truth',
  EmptyStomach: 'Hunger',
  FossilGrip: 'Fossil',
  StolenVoice: 'Voice',
};

const DOMAIN_TRACK_COLORS: Record<DomainId, string> = {
  WarMachine: '#9E1B1B',
  DyingPlanet: '#3E6F4F',
  GildedCage: '#8B5E3C',
  SilencedTruth: '#2D3A64',
  EmptyStomach: '#C9A227',
  FossilGrip: '#1F1F1F',
  StolenVoice: '#6E4A7E',
};

const ACTION_ICONS: Record<ActionId, IconType> = {
  organize: 'organize',
  investigate: 'investigate',
  launch_campaign: 'launchCampaign',
  build_solidarity: 'buildSolidarity',
  smuggle_evidence: 'smuggleEvidence',
  international_outreach: 'internationalOutreach',
  defend: 'defend',
  play_card: 'playCard',
};

const DOMAIN_ACCENTS: Record<DomainId, string> = {
  WarMachine: 'domain-accent-war',
  DyingPlanet: 'domain-accent-climate',
  GildedCage: 'domain-accent-carceral',
  SilencedTruth: 'domain-accent-signal',
  EmptyStomach: 'domain-accent-bread',
  FossilGrip: 'domain-accent-fossil',
  StolenVoice: 'domain-accent-memory',
};

function clampPercent(value: number, max: number) {
  return Math.max(0, Math.min(100, (value / max) * 100));
}

function normalizePhase(phase: Phase): NormalizedPhase {
  if (phase === 'WIN' || phase === 'LOSS') {
    return 'RESOLUTION';
  }
  return phase;
}

function getSeverityByBands(value: number, bands: { watch: number; danger: number; critical: number }): Severity {
  if (value >= bands.critical) {
    return 'critical';
  }
  if (value >= bands.danger) {
    return 'danger';
  }
  if (value >= bands.watch) {
    return 'watch';
  }
  return 'steady';
}

export const GAME_A11Y_LABELS = {
  phaseProgress: 'Turn progress',
  sharedResources: 'Coalition resources',
  coalitionDesk: 'Coalition desk',
  liveUpdates: 'Live game updates',
} as const;

export function getPhasePresentation(phase: Phase) {
  switch (normalizePhase(phase)) {
    case 'SYSTEM':
      return {
        icon: 'I',
        verb: t('ui.phases.SYSTEM_VERB', 'Acts'),
        urgency: t('ui.game.immediate', 'Immediate'),
        copy: t('ui.phases.SYSTEM_COPY', 'The system presses first. Resolve escalation before the table can answer.'),
      } satisfies PhasePresentation;
    case 'COALITION':
      return {
        icon: 'II',
        verb: t('ui.phases.COALITION_VERB', 'Organizes'),
        urgency: t('ui.game.deliberate', 'Deliberate'),
        copy: t('ui.phases.COALITION_COPY', 'Lay out two prepared moves for each seat, then mark the whole coalition ready.'),
      } satisfies PhasePresentation;
    case 'RESOLUTION':
      return {
        icon: 'III',
        verb: t('ui.phases.RESOLUTION_VERB', 'Reckoning'),
        urgency: t('ui.game.consequences', 'Consequences'),
        copy: t('ui.phases.RESOLUTION_COPY', 'Prepared moves resolve in order. Check the board, then reckon with victory or loss.'),
      } satisfies PhasePresentation;
  }
}

export function getPhaseProgressSteps(phase: Phase) {
  const sequence: NormalizedPhase[] = ['SYSTEM', 'COALITION', 'RESOLUTION'];
  const normalized = normalizePhase(phase);
  const activeIndex = sequence.indexOf(normalized);

  return sequence.map((step, index) => {
    const presentation = getPhasePresentation(step);
    return {
      step,
      number: index + 1,
      state: index < activeIndex ? 'complete' : index === activeIndex ? 'active' : 'upcoming',
      current: (index === activeIndex ? 'step' : undefined) as 'step' | undefined,
      icon: presentation.icon,
      verb: presentation.verb,
      urgency: presentation.urgency,
      copy: presentation.copy,
    };
  });
}

export function getTrackPresentation(state: EngineState) {
  const globalGazeSeverity = getSeverityByBands(state.globalGaze, { watch: 7, danger: 11, critical: 15 });
  const warMachineSeverity = getSeverityByBands(state.northernWarMachine, { watch: 5, danger: 8, critical: 10 });

  return {
    globalGaze: {
      id: 'globalGaze',
      value: state.globalGaze,
      max: 20,
      percent: clampPercent(state.globalGaze, 20),
      severity: globalGazeSeverity,
      thresholds: [5, 10, 15],
      status: state.globalGaze >= 10
        ? 'Witness is breaking through the blockade.'
        : 'Global attention is fragile and easily reversed.',
    } satisfies TrackPresentation,
    northernWarMachine: {
      id: 'northernWarMachine',
      value: state.northernWarMachine,
      max: 12,
      percent: clampPercent(state.northernWarMachine, 12),
      severity: warMachineSeverity,
      thresholds: [4, 8, 10],
      status: state.northernWarMachine >= 8
        ? 'The war machine is near a breach posture.'
        : 'Military pressure is contained for now.',
    } satisfies TrackPresentation,
  };
}

export function getRegionDangerState(extractionTokens: number) {
  if (extractionTokens >= 6) {
    return {
      tone: 'breach',
      severity: 'critical' as const,
      color: '#8B1E1E',
      pulsing: false,
      label: t('ui.game.breachNear', 'Breach Near'),
    };
  }

  if (extractionTokens >= 5) {
    return {
      tone: 'critical',
      severity: 'critical' as const,
      color: '#8B1E1E',
      pulsing: true,
      label: t('ui.game.nearCollapse', 'Near Collapse'),
    };
  }

  if (extractionTokens >= 3) {
    return {
      tone: 'strained',
      severity: 'danger' as const,
      color: '#D8A400',
      pulsing: false,
      label: t('ui.game.strained', 'Strained'),
    };
  }

  return {
    tone: 'safe',
    severity: 'steady' as const,
    color: '#5F8D6D',
    pulsing: false,
    label: t('ui.game.holding', 'Holding'),
  };
}

export function getDomainPresentation(domainId: DomainId, state: EngineState, content: CompiledContent): DomainPresentation {
  const progress = state.domains[domainId].progress;
  const localizedDescription = localizeDomainField(domainId, 'description', content.domains[domainId].description);
  return {
    icon: DOMAIN_ICONS[domainId],
    accentClass: DOMAIN_ACCENTS[domainId],
    percent: clampPercent(progress, 12),
    severity: getSeverityByBands(progress, { watch: 4, danger: 7, critical: 10 }),
    summary: localizedDescription,
  };
}

function getPassiveShorthand(factionId: FactionId) {
  switch (factionId) {
    case 'congo_basin_collective':
      return {
        primary: t('ui.game.passiveCongoPrimary', 'Comrades +1 at home'),
        secondary: t('ui.game.passiveCongoSecondary', 'Campaign +1 at home'),
      };
    case 'levant_sumud':
      return {
        primary: t('ui.game.passiveLevantPrimary', 'Defense +1 at home'),
        secondary: t('ui.game.passiveLevantSecondary', 'War campaigns +1 at home'),
      };
    case 'mekong_echo_network':
      return {
        primary: t('ui.game.passiveMekongPrimary', 'Evidence +1 at home'),
        secondary: t('ui.game.passiveMekongSecondary', 'Truth support +1'),
      };
    case 'amazon_guardians':
      return {
        primary: t('ui.game.passiveAmazonPrimary', 'Campaign +1 in Amazon'),
        secondary: t('ui.game.passiveAmazonSecondary', 'Comrades +1 at home'),
      };
  }
}

function getMandateLines(factionId: FactionId) {
  switch (factionId) {
    case 'congo_basin_collective':
      return [t('ui.game.mandateCongoLine1', 'Congo extraction <= 2'), t('ui.game.mandateCongoLine2', 'Planet ahead of War')];
    case 'levant_sumud':
      return [t('ui.game.mandateLevantLine1', 'Levant extraction <= 1'), t('ui.game.mandateLevantLine2', 'War Machine <= 6')];
    case 'mekong_echo_network':
      return [t('ui.game.mandateMekongLine1', 'Mekong extraction <= 1'), t('ui.game.mandateMekongLine2', 'Truth >= 5')];
    case 'amazon_guardians':
      return [t('ui.game.mandateAmazonLine1', 'Amazon extraction <= 1'), t('ui.game.mandateAmazonLine2', 'Fossil Grip >= 5')];
  }
}

export function getSeatPresentation(player: PlayerState, content: CompiledContent, state: EngineState): SeatPresentation {
  const faction = content.factions[player.factionId];
  const comrades = getPlayerBodyTotal(state, player.seat);
  const urgency = player.ready
    ? 'steady'
    : player.actionsRemaining === 0
      ? 'watch'
      : player.actionsRemaining === 1
        ? 'danger'
        : 'steady';

  return {
    crestLabel: localizeFactionField(faction.id, 'shortName', faction.shortName),
    crestSubline: localizeRegionField(faction.homeRegion, 'name', content.regions[faction.homeRegion].name),
    ribbonClass: `seat-ribbon-${player.seat + 1}`,
    comrades,
    witness: player.evidence,
    moves: player.actionsRemaining,
    readiness: player.ready ? 'Ready for reckoning' : `${formatNumber(player.actionsRemaining)} moves left to prepare`,
    urgency,
  };
}

export function getPlayerStripSummary(player: PlayerState, content: CompiledContent, state: EngineState): PlayerStripSummary {
  const faction = content.factions[player.factionId];
  const passive = getPassiveShorthand(faction.id);
  return {
    seat: player.seat,
    factionName: localizeFactionField(faction.id, 'name', faction.name),
    shortName: localizeFactionField(faction.id, 'shortName', faction.shortName),
    homeRegion: localizeRegionField(faction.homeRegion, 'name', content.regions[faction.homeRegion].name),
    bodies: getPlayerBodyTotal(state, player.seat),
    evidence: player.evidence,
    moves: player.actionsRemaining,
    passivePrimary: passive.primary,
    passiveSecondary: passive.secondary,
    mandateTitle: localizeFactionField(faction.id, 'mandateTitle', faction.mandate.title),
    mandateLines: getMandateLines(faction.id),
    ready: player.ready,
  };
}

export function getStatusRibbonItems(state: EngineState, content: CompiledContent): StatusRibbonItem[] {
  return [
    {
      id: 'mode',
      label: t('ui.game.modeLabel', 'Mode'),
      value: state.mode === 'LIBERATION' ? t('ui.mode.liberation', 'Liberation') : t('ui.mode.symbolic', 'Symbolic'),
      icon: 'modeLiberation',
      tone: 'liberation',
      tooltip: state.mode === 'LIBERATION'
        ? t('ui.mode.liberationSummary', getVictoryModeSummary(state.mode))
        : t('ui.mode.symbolicSummary', getVictoryModeSummary(state.mode)),
    },
    {
      id: 'objective',
      label: t('ui.game.objectiveLabel', 'Objective'),
      value: state.mode === 'LIBERATION'
        ? t('ui.game.objectiveLiberationValue', '1 Extraction/region')
        : t('ui.game.objectiveBeaconValue', '{{complete}}/{{total}} Beacons', {
          complete: state.activeBeaconIds.filter((beaconId) => state.beacons[beaconId]?.complete).length,
          total: state.activeBeaconIds.length,
        }),
      icon: 'objective',
      tone: 'objective',
      tooltip: state.mode === 'LIBERATION'
        ? `${t('ui.mode.liberationSummary', getVictoryModeSummary(state.mode))} ${localizeRulesetField(content.ruleset.id, 'name', content.ruleset.name)}`
        : `${t('ui.mode.symbolicSummary', getVictoryModeSummary(state.mode))} ${localizeRulesetField(content.ruleset.id, 'name', content.ruleset.name)}`,
    },
    {
      id: 'globalGaze',
      label: t('ui.game.gazeLabel', 'Gaze'),
      value: `${formatNumber(state.globalGaze)}/${formatNumber(20)}`,
      icon: 'globalGaze',
      tone: 'gaze',
      tooltip: getTrackPresentation(state).globalGaze.status,
    },
    {
      id: 'warMachine',
      label: t('ui.game.warLabel', 'War'),
      value: `${formatNumber(state.northernWarMachine)}/${formatNumber(12)}`,
      icon: 'warMachine',
      tone: 'war',
      tooltip: getTrackPresentation(state).northernWarMachine.status,
    },
    {
      id: 'extractionPool',
      label: t('ui.game.poolLabel', 'Pool'),
      value: formatNumber(state.extractionPool),
      icon: 'pool',
      tone: 'pool',
      tooltip: t('ui.game.extractionPoolTooltip', 'Shared system pressure still in the extraction pool.'),
    },
    {
      id: 'round',
      label: t('ui.game.round', 'Round'),
      value: formatNumber(state.round),
      icon: 'round',
      tone: 'round',
      tooltip: t('ui.game.roundTooltip', 'Round {{round}} of the current struggle.', { round: state.round }),
    },
  ];
}

export function getFrontTrackRows(state: EngineState, content: CompiledContent): FrontTrackRow[] {
  return (Object.keys(content.domains) as DomainId[]).map((domainId) => ({
    id: domainId,
    label: localizeDomainField(domainId, 'name', content.domains[domainId].name),
    shortLabel: t(`ui.domains.short.${domainId}`, DOMAIN_SHORT_LABELS[domainId]),
    icon: DOMAIN_TRACK_ICONS[domainId],
    color: DOMAIN_TRACK_COLORS[domainId],
    value: state.domains[domainId].progress,
    max: 12,
    tooltip: localizeDomainField(domainId, 'description', content.domains[domainId].description),
    severity: getSeverityByBands(state.domains[domainId].progress, { watch: 4, danger: 7, critical: 10 }),
  }));
}

export function getActionQuickQueue(state: EngineState, content: CompiledContent, seat: number, actionId: ActionId) {
  const player = state.players[seat];
  const faction = content.factions[player.factionId];
  const homeRegion = faction.homeRegion;
  const firstOtherSeat = state.players.find((candidate) => candidate.seat !== seat)?.seat;
  const action = content.actions[actionId];
  const draft: Omit<QueuedIntent, 'slot'> = {
    actionId,
    regionId: action.needsRegion ? homeRegion : undefined,
    domainId: action.needsDomain ? (faction.campaignDomainBonus ?? 'WarMachine') : undefined,
    targetSeat: action.needsTargetSeat ? firstOtherSeat : undefined,
    bodiesCommitted: action.needsBodies ? 1 : undefined,
    evidenceCommitted: action.needsEvidence ? 1 : undefined,
    cardId: undefined,
  };

  if (actionId === 'build_solidarity') {
    draft.bodiesCommitted = 3;
  }

  if (actionId === 'international_outreach') {
    draft.evidenceCommitted = 0;
  }

  const disabled = getSeatDisabledReason(state, content, seat, draft);
  return {
    draft,
    quickQueue: !disabled.disabled && ['organize', 'investigate', 'international_outreach'].includes(actionId),
    disabled,
  };
}

export function getActionDockItems(state: EngineState, content: CompiledContent, seat: number): ActionDockItem[] {
  return getSeatActions(content).map((action) => {
    const quickQueue = getActionQuickQueue(state, content, seat, action.id);
    return {
      actionId: action.id,
      label: {
        organize: t('ui.game.moveOrganize', 'Organize'),
        investigate: t('ui.game.moveInvestigate', 'Investigate'),
        launch_campaign: t('ui.game.moveCampaign', 'Campaign'),
        build_solidarity: t('ui.game.moveSolidarity', 'Solidarity'),
        smuggle_evidence: t('ui.game.moveSmuggle', 'Smuggle'),
        international_outreach: t('ui.game.moveOutreach', 'Outreach'),
        defend: t('ui.game.moveDefend', 'Defend'),
        play_card: t('ui.game.moveCard', 'Card'),
      }[action.id],
      icon: ACTION_ICONS[action.id],
      disabled: quickQueue.disabled.disabled,
      disabledReason: quickQueue.disabled.reason,
      quickQueue: quickQueue.quickQueue,
    };
  });
}

function getActionBenefitLabel(actionId: ActionDefinition['id']) {
  switch (actionId) {
    case 'organize':
      return t('ui.game.comradesReinforce', 'Reinforce a region with fresh comrades.');
    case 'investigate':
      return t('ui.game.comradesGather', 'Gather witness and draw new resistance cards.');
    case 'launch_campaign':
      return t('ui.game.comradesCampaign', 'Press a vulnerable front with coordinated force.');
    case 'build_solidarity':
      return t('ui.game.comradesSolidarity', 'Advance a front without rolling.');
    case 'smuggle_evidence':
      return t('ui.game.comradesSmuggle', 'Move witness across seats through a corridor.');
    case 'international_outreach':
      return t('ui.game.comradesOutreach', 'Raise global gaze.');
    case 'defend':
      return t('ui.game.comradesShield', 'Set a shield against the next strike.');
    case 'play_card':
      return t('ui.game.comradesUnleash', 'Unleash a prepared card effect now.');
  }
}

export function buildIntentPreview(
  draft: Omit<QueuedIntent, 'slot'>,
  action: ActionDefinition,
  state: EngineState,
  content: CompiledContent,
  focusedSeat: number,
) {
  const chips: IntentPreviewChip[] = [];
  const region = draft.regionId ? state.regions[draft.regionId] : null;

  if (draft.regionId) {
    chips.push({
      id: 'region',
      tone: 'detail',
      label: t('ui.game.region', 'Region'),
      value: localizeRegionField(draft.regionId, 'name', content.regions[draft.regionId].name),
    });
  }

  if (draft.domainId) {
    chips.push({
      id: 'domain',
      tone: 'detail',
      label: t('ui.game.front', 'Front'),
      value: localizeDomainField(draft.domainId, 'name', content.domains[draft.domainId].name),
    });
  }

  if (action.needsBodies) {
    chips.push({
      id: 'cost-bodies',
      tone: 'cost',
      label: t('ui.game.cost', 'Cost'),
      value: t('ui.game.comradesCount', '{{count}} comrades', { count: formatNumber(draft.bodiesCommitted ?? 1) }),
    });
  } else if (draft.actionId === 'build_solidarity') {
    chips.push({
      id: 'cost-bodies-fixed',
      tone: 'cost',
      label: t('ui.game.cost', 'Cost'),
      value: t('ui.game.comradesCount', '{{count}} comrades', { count: formatNumber(3) }),
    });
  } else if (draft.actionId === 'smuggle_evidence') {
    chips.push({
      id: 'cost-smuggle',
      tone: 'cost',
      label: t('ui.game.cost', 'Cost'),
      value: t('ui.game.oneComradeInRegion', '1 comrade in-region'),
    });
  }

  if (action.needsEvidence) {
    chips.push({
      id: 'cost-evidence',
      tone: 'cost',
      label: t('ui.game.cost', 'Cost'),
      value: t('ui.game.witnessCount', '{{count}} witness', { count: formatNumber(draft.evidenceCommitted ?? 0) }),
    });
  } else if (draft.actionId === 'international_outreach') {
    const penalty = content.factions[state.players[focusedSeat].factionId].outreachPenalty;
    chips.push({
      id: 'cost-outreach',
      tone: 'cost',
      label: t('ui.game.cost', 'Cost'),
      value: t('ui.game.witnessCount', '{{count}} witness', { count: formatNumber(2 + penalty) }),
    });
  }

  if (region && region.extractionTokens >= 4) {
    chips.push({
      id: 'risk-breach',
      tone: 'risk',
      label: t('ui.game.risk', 'Risk'),
      value: t('ui.game.nearBreachRisk', 'This region is already near the breach line.'),
    });
  } else if (draft.actionId === 'launch_campaign') {
    chips.push({
      id: 'risk-campaign',
      tone: 'risk',
      label: t('ui.game.risk', 'Risk'),
      value: t('ui.game.campaignRisk', 'Campaigns can consume resources without clearing the front.'),
    });
  }

  chips.push({
    id: 'benefit',
    tone: 'benefit',
    label: t('ui.game.outcome', 'Outcome'),
    value: getActionBenefitLabel(draft.actionId),
  });

  if (action.needsCard && draft.cardId) {
    chips.push({
      id: 'card',
      tone: 'detail',
      label: t('ui.game.card', 'Card'),
      value: content.cards[draft.cardId]?.name ?? t('ui.game.noCard', 'No card'),
    });
  }

  return chips;
}

export function getEventSourcePresentation(sourceType: DomainEvent['sourceType']): EventSourcePresentation {
  switch (sourceType) {
    case 'system':
      return { icon: 'Seal', label: t('ui.game.sourceSystem', 'System record') };
    case 'command':
      return { icon: 'Clerk', label: t('ui.game.sourceCommand', 'Table order') };
    case 'action':
      return { icon: 'Move', label: t('ui.game.sourceAction', 'Prepared move') };
    case 'card':
      return { icon: 'Card', label: t('ui.game.sourceCard', 'Resistance card') };
    case 'mandate':
      return { icon: 'Charge', label: t('ui.game.sourceMandate', 'Solemn charge') };
    case 'beacon':
      return { icon: 'Beacon', label: t('ui.game.sourceBeacon', 'Beacon record') };
  }
}

export function getToastRole(tone: 'info' | 'success' | 'warning' | 'error') {
  return tone === 'error' ? 'alert' : 'status';
}

export function getActiveCoalitionSeat(players: PlayerState[]) {
  return players.find((player) => !player.ready && player.actionsRemaining > 0)?.seat ?? players.at(-1)?.seat ?? 0;
}

export function getDeckSummaries(state: EngineState, _content: CompiledContent): DeckSummary[] {
  const latestReveal = getLatestPublicCardReveal(state)?.reveal ?? null;
  return (['system', 'resistance', 'beacon'] as DeckId[]).map((deckId) => ({
    deckId,
    label: {
      system: t('ui.game.systemDeck', 'System Deck'),
      resistance: t('ui.game.resistanceDeck', 'Resistance Deck'),
      beacon: t('ui.game.beaconDeck', 'Beacon Deck'),
    }[deckId],
    drawCount: state.decks[deckId].drawPile.length,
    discardCount: state.decks[deckId].discardPile.length,
    activeCount: deckId === 'beacon' ? state.activeBeaconIds.length : undefined,
    latestRevealCardId: latestReveal?.deckId === deckId ? latestReveal.cardId : null,
  }));
}

export function getLatestPublicCardReveal(state: EngineState): LatestPublicCardReveal | null {
  for (let eventIndex = state.eventLog.length - 1; eventIndex >= 0; eventIndex -= 1) {
    const event = state.eventLog[eventIndex];
    const reveals = event.context?.cardReveals;
    if (!reveals?.length) {
      continue;
    }

    for (let revealIndex = reveals.length - 1; revealIndex >= 0; revealIndex -= 1) {
      const reveal = reveals[revealIndex];
      if (!reveal?.public) {
        continue;
      }
      return { eventSeq: event.seq, revealIndex, reveal };
    }
  }

  return null;
}

export function getNextUnfinishedCoalitionSeat(players: PlayerState[], currentSeat: number) {
  if (players.every((player) => player.ready)) {
    return currentSeat;
  }

  for (let offset = 1; offset <= players.length; offset += 1) {
    const candidateSeat = (currentSeat + offset) % players.length;
    const candidate = players[candidateSeat];
    if (!candidate) {
      continue;
    }
    if (!candidate.ready || candidate.actionsRemaining > 0) {
      return candidate.seat;
    }
  }

  return currentSeat;
}

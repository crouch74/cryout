import {
  getPlayerBodyTotal,
  type ActionDefinition,
  type CompiledContent,
  type DomainEvent,
  type DomainId,
  type EngineState,
  type Phase,
  type PlayerState,
  type QueuedIntent,
} from '../../engine/index.ts';
import {
  formatNumber,
  localizeDomainField,
  localizeFactionField,
  localizeRegionField,
  t,
} from '../i18n/index.ts';

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

const PHASE_PRESENTATIONS: Record<NormalizedPhase, PhasePresentation> = {
  SYSTEM: {
    icon: 'I',
    verb: 'Acts',
    urgency: 'Immediate',
    copy: 'The system presses first. Resolve escalation before the table can answer.',
  },
  COALITION: {
    icon: 'II',
    verb: 'Organizes',
    urgency: 'Deliberate',
    copy: 'Lay out two prepared moves for each seat, then mark the whole coalition ready.',
  },
  RESOLUTION: {
    icon: 'III',
    verb: 'Reckoning',
    urgency: 'Consequences',
    copy: 'Prepared moves resolve in order. Check the board, then reckon with victory or loss.',
  },
};

const DOMAIN_ICONS: Record<DomainId, string> = {
  WarMachine: 'Barracks',
  DyingPlanet: 'Climate',
  GildedCage: 'Carceral',
  SilencedTruth: 'Signal',
  EmptyStomach: 'Breadline',
  FossilGrip: 'Pipeline',
  StolenVoice: 'Memory',
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
  return PHASE_PRESENTATIONS[normalizePhase(phase)];
}

export function getPhaseProgressSteps(phase: Phase) {
  const sequence: NormalizedPhase[] = ['SYSTEM', 'COALITION', 'RESOLUTION'];
  const normalized = normalizePhase(phase);
  const activeIndex = sequence.indexOf(normalized);

  return sequence.map((step, index) => {
    const presentation = PHASE_PRESENTATIONS[step];
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

function getActionBenefitLabel(actionId: ActionDefinition['id']) {
  switch (actionId) {
    case 'organize':
      return 'Reinforce a region with fresh comrades.';
    case 'investigate':
      return 'Gather witness and draw new resistance cards.';
    case 'launch_campaign':
      return 'Press a vulnerable front with coordinated force.';
    case 'build_solidarity':
      return 'Advance a front without rolling.';
    case 'smuggle_evidence':
      return 'Move witness across seats through a corridor.';
    case 'international_outreach':
      return 'Raise global gaze.';
    case 'defend':
      return 'Set a shield against the next strike.';
    case 'play_card':
      return 'Unleash a prepared card effect now.';
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
      label: 'Region',
      value: localizeRegionField(draft.regionId, 'name', content.regions[draft.regionId].name),
    });
  }

  if (draft.domainId) {
    chips.push({
      id: 'domain',
      tone: 'detail',
      label: 'Front',
      value: localizeDomainField(draft.domainId, 'name', content.domains[draft.domainId].name),
    });
  }

  if (action.needsBodies) {
    chips.push({
      id: 'cost-bodies',
      tone: 'cost',
      label: 'Cost',
      value: `${formatNumber(draft.bodiesCommitted ?? 1)} comrades`,
    });
  } else if (draft.actionId === 'build_solidarity') {
    chips.push({
      id: 'cost-bodies-fixed',
      tone: 'cost',
      label: 'Cost',
      value: '3 comrades',
    });
  } else if (draft.actionId === 'smuggle_evidence') {
    chips.push({
      id: 'cost-smuggle',
      tone: 'cost',
      label: 'Cost',
      value: '1 comrade in-region',
    });
  }

  if (action.needsEvidence) {
    chips.push({
      id: 'cost-evidence',
      tone: 'cost',
      label: 'Cost',
      value: `${formatNumber(draft.evidenceCommitted ?? 0)} witness`,
    });
  } else if (draft.actionId === 'international_outreach') {
    const penalty = content.factions[state.players[focusedSeat].factionId].outreachPenalty;
    chips.push({
      id: 'cost-outreach',
      tone: 'cost',
      label: 'Cost',
      value: `${formatNumber(2 + penalty)} witness`,
    });
  }

  if (region && region.extractionTokens >= 4) {
    chips.push({
      id: 'risk-breach',
      tone: 'risk',
      label: 'Risk',
      value: 'This region is already near the breach line.',
    });
  } else if (draft.actionId === 'launch_campaign') {
    chips.push({
      id: 'risk-campaign',
      tone: 'risk',
      label: 'Risk',
      value: 'Campaigns can consume resources without clearing the front.',
    });
  }

  chips.push({
    id: 'benefit',
    tone: 'benefit',
    label: 'Outcome',
    value: getActionBenefitLabel(draft.actionId),
  });

  if (action.needsCard && draft.cardId) {
    chips.push({
      id: 'card',
      tone: 'detail',
      label: 'Card',
      value: content.cards[draft.cardId]?.name ?? t('ui.game.noCard', 'No card'),
    });
  }

  return chips;
}

export function getEventSourcePresentation(sourceType: DomainEvent['sourceType']): EventSourcePresentation {
  switch (sourceType) {
    case 'system':
      return { icon: 'Seal', label: 'System record' };
    case 'command':
      return { icon: 'Clerk', label: 'Table order' };
    case 'action':
      return { icon: 'Move', label: 'Prepared move' };
    case 'card':
      return { icon: 'Card', label: 'Resistance card' };
    case 'mandate':
      return { icon: 'Charge', label: 'Solemn charge' };
    case 'beacon':
      return { icon: 'Beacon', label: 'Beacon record' };
  }
}

export function getToastRole(tone: 'info' | 'success' | 'warning' | 'error') {
  return tone === 'error' ? 'alert' : 'status';
}

export function getActiveCoalitionSeat(players: PlayerState[]) {
  return players.find((player) => !player.ready && player.actionsRemaining > 0)?.seat ?? players.at(-1)?.seat ?? 0;
}

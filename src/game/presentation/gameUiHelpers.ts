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
  formatTrackFraction,
  localizeActionField,
  localizeDomainField,
  localizeFactionField,
  localizeRegionField,
  localizeRulesetField,
  t,
} from '../../i18n/index.ts';
import { getEventSourceLabel, localizeDisabledReason } from './historyPresentation.ts';
import type { IconType } from '../../ui/icon/iconTypes.ts';

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

export type ContextPanelMode = 'region' | 'action' | 'ledger' | 'decks' | 'mandate';

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
  id: string;
  label: string;
  shortLabel: string;
  icon: IconType;
  color: string;
  value: number;
  max: number;
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
  detailEyebrow: string;
  detailTitle: string;
  detailLines: string[];
  detailKind: 'mandate' | 'open_role';
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
  RevolutionaryWave: 'Wave',
  PatriarchalGrip: 'Patriarchal',
  UnfinishedJustice: 'Justice',
};

const DOMAIN_TRACK_ICONS: Record<DomainId, IconType> = {
  WarMachine: 'frontWar',
  DyingPlanet: 'frontPlanet',
  GildedCage: 'frontCage',
  SilencedTruth: 'frontTruth',
  EmptyStomach: 'frontHunger',
  FossilGrip: 'frontFossil',
  StolenVoice: 'frontVoice',
  RevolutionaryWave: 'frontWave',
  PatriarchalGrip: 'frontPatriarchy',
  UnfinishedJustice: 'frontJustice',
};

const DOMAIN_SHORT_LABELS: Record<DomainId, string> = {
  WarMachine: 'War',
  DyingPlanet: 'Planet',
  GildedCage: 'Cage',
  SilencedTruth: 'Truth',
  EmptyStomach: 'Hunger',
  FossilGrip: 'Fossil',
  StolenVoice: 'Voice',
  RevolutionaryWave: 'Wave',
  PatriarchalGrip: 'Patriarchy',
  UnfinishedJustice: 'Justice',
};

const DOMAIN_TRACK_COLORS: Record<DomainId, string> = {
  WarMachine: '#9E1B1B',
  DyingPlanet: '#3E6F4F',
  GildedCage: '#8B5E3C',
  SilencedTruth: '#2D3A64',
  EmptyStomach: '#C9A227',
  FossilGrip: '#1F1F1F',
  StolenVoice: '#6E4A7E',
  RevolutionaryWave: '#2A9D8F',
  PatriarchalGrip: '#6B1E1E',
  UnfinishedJustice: '#4A4E69',
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
  go_viral: 'goViral',
  expose_regime_lies: 'exposeLies',
  call_labor_strike: 'laborStrike',
  coordinate_digital: 'coordinateDigital',
  burn_veil: 'burnVeil',
  schoolgirl_network: 'schoolgirlNetwork',
  compose_chant: 'composeChant',
  diaspora_fundraise: 'fundraise',
  media_blitz: 'mediaBlitz',
  sanctions_push: 'sanctions',
};

const DOMAIN_ACCENTS: Record<DomainId, string> = {
  WarMachine: 'domain-accent-war',
  DyingPlanet: 'domain-accent-climate',
  GildedCage: 'domain-accent-carceral',
  SilencedTruth: 'domain-accent-signal',
  EmptyStomach: 'domain-accent-bread',
  FossilGrip: 'domain-accent-fossil',
  StolenVoice: 'domain-accent-memory',
  RevolutionaryWave: 'domain-accent-wave',
  PatriarchalGrip: 'domain-accent-patriarchy',
  UnfinishedJustice: 'domain-accent-justice',
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
        ? t('ui.game.trackGazeHigh', 'Global Gaze is breaking through the blockade.')
        : t('ui.game.trackGazeLow', 'Global Gaze is fragile and easily reversed.'),
    } satisfies TrackPresentation,
    northernWarMachine: {
      id: 'northernWarMachine',
      value: state.northernWarMachine,
      max: 12,
      percent: clampPercent(state.northernWarMachine, 12),
      severity: warMachineSeverity,
      thresholds: [4, 8, 10],
      status: state.northernWarMachine >= 8
        ? t('ui.game.trackWarHigh', 'War Machine is near a breach posture.')
        : t('ui.game.trackWarLow', 'War Machine pressure is contained for now.'),
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
    case 'april_6_youth':
      return {
        primary: t('ui.game.passiveApril6Primary', 'Comrades +1 in Cairo'),
        secondary: t('ui.game.passiveApril6Secondary', 'Campaign +1 in Cairo'),
      };
    case 'labor_movement':
      return {
        primary: t('ui.game.passiveLaborPrimary', 'Labor bonus +2'),
        secondary: t('ui.game.passiveLaborSecondary', 'Defense +1'),
      };
    case 'independent_journalists':
      return {
        primary: t('ui.game.passiveJournalistsPrimary', 'Investigate +1 Evidence'),
        secondary: t('ui.game.passiveJournalistsSecondary', 'Campaign +1 Truth'),
      };
    case 'rights_defenders':
      return {
        primary: t('ui.game.passiveDefendersPrimary', 'Campaign +1 Gilded Cage'),
        secondary: t('ui.game.passiveDefendersSecondary', 'Organize +1'),
      };
    case 'kurdish_women':
      return {
        primary: t('ui.game.passiveKurdsPrimary', 'Cost -1 in Kurdistan'),
        secondary: t('ui.game.passiveKurdsSecondary', 'Defense +1'),
      };
    case 'student_union':
      return {
        primary: t('ui.game.passiveStudentsPrimary', 'Digital +1'),
        secondary: t('ui.game.passiveStudentsSecondary', 'Investigate +1'),
      };
    case 'bazaar_strikers':
      return {
        primary: t('ui.game.passiveStrikersPrimary', 'Labor bonus +2'),
        secondary: t('ui.game.passiveStrikersSecondary', 'Defense +1'),
      };
    case 'male_allies':
      return {
        primary: t('ui.game.passiveAlliesPrimary', 'Action transfer free'),
        secondary: t('ui.game.passiveAlliesSecondary', 'Defense +1'),
      };
    default:
      return {
        primary: '',
        secondary: '',
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
    case 'april_6_youth':
      return [t('ui.game.mandateApril6Line1', 'Cairo extraction <= 1')];
    case 'labor_movement':
      return [t('ui.game.mandateLaborLine1', 'Alexandria extraction <= 1'), t('ui.game.mandateLaborLine2', 'Bread >= 5')];
    case 'independent_journalists':
      return [t('ui.game.mandateJournalistsLine1', 'Truth >= 6')];
    case 'rights_defenders':
      return [t('ui.game.mandateDefendersLine1', 'War Machine <= 4')];
    case 'kurdish_women':
      return [t('ui.game.mandateKurdsLine1', 'Patriarchy < 5'), t('ui.game.mandateKurdsLine2', 'Kurdistan extraction <= 1')];
    case 'student_union':
      return [t('ui.game.mandateStudentsLine1', 'Tehran extraction <= 1'), t('ui.game.mandateStudentsLine2', 'Truth >= 6')];
    case 'bazaar_strikers':
      return [t('ui.game.mandateStrikersLine1', 'Bread >= 5')];
    case 'male_allies':
      return [t('ui.game.mandateAlliesLine1', 'Patriarchy <= 3')];
    default:
      return [];
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
    readiness: player.ready
      ? t('ui.game.readyForReckoning', 'Ready for reckoning')
      : t('ui.game.movesLeftToPrepare', '{{count}} moves left to prepare', { count: player.actionsRemaining }),
    urgency,
  };
}

export function getPlayerStripSummary(player: PlayerState, content: CompiledContent, state: EngineState): PlayerStripSummary {
  const faction = content.factions[player.factionId];
  const passive = getPassiveShorthand(faction.id);
  const secretMandatesEnabled = state.secretMandatesEnabled;
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
    detailEyebrow: secretMandatesEnabled
      ? t('ui.game.secretMandate', 'Secret Mandate')
      : t('ui.game.openRole', 'Open Role'),
    detailTitle: secretMandatesEnabled
      ? localizeFactionField(faction.id, 'mandateTitle', faction.mandate.title)
      : t('ui.game.publicCoordination', 'Public Coordination'),
    detailLines: secretMandatesEnabled
      ? getMandateLines(faction.id)
      : [
          localizeFactionField(faction.id, 'passive', faction.passive),
          `${t('ui.game.weakness', 'Weakness')}: ${localizeFactionField(faction.id, 'weakness', faction.weakness)}`,
        ].filter(Boolean),
    detailKind: secretMandatesEnabled ? 'mandate' : 'open_role',
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
      value: formatTrackFraction(state.globalGaze, 20),
      icon: 'globalGaze',
      tone: 'gaze',
      tooltip: getTrackPresentation(state).globalGaze.status,
    },
    {
      id: 'warMachine',
      label: t('ui.game.warLabel', 'War'),
      value: formatTrackFraction(state.northernWarMachine, 12),
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
  const customTrackRows = (content.ruleset.customTracks ?? []).map((track) => ({
    id: track.id,
    label: track.name,
    shortLabel: track.name,
    icon: 'frontJustice' as const,
    color: '#7f4f24',
    value: state.customTracks[track.id]?.value ?? track.initialValue,
    max: track.max,
    tooltip: track.description,
    severity: getSeverityByBands(state.customTracks[track.id]?.value ?? track.initialValue, {
      watch: track.thresholds[0] ?? Math.ceil(track.max * 0.4),
      danger: track.thresholds[1] ?? Math.ceil(track.max * 0.7),
      critical: track.thresholds[2] ?? Math.ceil(track.max * 0.9),
    }),
  }));

  const domainRows = (Object.keys(content.domains) as DomainId[]).map((domainId) => ({
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

  return [...customTrackRows, ...domainRows];
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
      label: localizeActionField(action.id, 'name', action.name),
      icon: ACTION_ICONS[action.id],
      disabled: quickQueue.disabled.disabled,
      disabledReason: localizeDisabledReason(quickQueue.disabled),
      quickQueue: quickQueue.quickQueue,
    };
  });
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
    const regionDef = content.regions[draft.regionId];
    chips.push({
      id: 'region',
      tone: 'detail',
      label: t('ui.game.region', 'Region'),
      value: regionDef
        ? localizeRegionField(draft.regionId, 'name', regionDef.name)
        : t('ui.game.unknownRegion', 'Unknown Region'),
    });
  }

  if (draft.domainId) {
    const domainDef = content.domains[draft.domainId];
    chips.push({
      id: 'domain',
      tone: 'detail',
      label: t('ui.game.front', 'Front'),
      value: domainDef
        ? localizeDomainField(draft.domainId, 'name', domainDef.name)
        : t('ui.game.unknownDomain', 'Unknown Domain'),
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
    value: localizeActionField(draft.actionId, 'description', action.description),
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
      return { icon: 'Seal', label: getEventSourceLabel(sourceType) };
    case 'command':
      return { icon: 'Clerk', label: getEventSourceLabel(sourceType) };
    case 'action':
      return { icon: 'Move', label: getEventSourceLabel(sourceType) };
    case 'card':
      return { icon: 'Card', label: getEventSourceLabel(sourceType) };
    case 'mandate':
      return { icon: 'Charge', label: getEventSourceLabel(sourceType) };
    case 'beacon':
      return { icon: 'Beacon', label: getEventSourceLabel(sourceType) };
  }
}

export function getToastRole(tone: 'info' | 'success' | 'warning' | 'error') {
  return tone === 'error' ? 'alert' : 'status';
}

export function getActiveCoalitionSeat(players: PlayerState[]) {
  return players.find((player) => !player.ready && player.actionsRemaining > 0)?.seat ?? players.at(-1)?.seat ?? 0;
}

export function getDeckSummaries(state: EngineState, _content: CompiledContent): DeckSummary[] {
  void _content;
  const latestReveal = getLatestPublicCardReveal(state)?.reveal ?? null;
  return (['system', 'resistance', 'crisis'] as DeckId[]).map((deckId) => ({
    deckId,
    label: {
      system: t('ui.game.systemDeck', 'System Deck'),
      resistance: t('ui.game.resistanceDeck', 'Resistance Deck'),
      crisis: t('ui.game.crisisDeck', 'Crisis Deck'),
    }[deckId],
    drawCount: state.decks[deckId].drawPile.length,
    discardCount: state.decks[deckId].discardPile.length,
    activeCount: deckId === 'system' ? state.activeSystemCardIds.length : undefined,
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

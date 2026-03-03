import type {
  ActionDefinition,
  CompiledContent,
  DisabledActionReason,
  EngineState,
  FactionDefinition,
  Phase,
  PlayerState,
  DomainId,
  RegionId,
  VictoryMode,
} from './types.ts';
import { getDisabledActionReason } from './runtime.ts';
import { t } from '../../../i18n/index.ts';

export function getAvailableRegions(content?: CompiledContent): RegionId[] {
  if (content) {
    return Object.keys(content.regions) as RegionId[];
  }
  return [
    'Congo', 'Levant', 'Amazon', 'Sahel', 'Mekong', 'Andes',
    'Cairo', 'Alexandria', 'NileDelta', 'UpperEgypt', 'Suez', 'Sinai',
    'Tehran', 'Kurdistan', 'Isfahan', 'Mashhad', 'Khuzestan', 'Balochistan'
  ];
}

export function getAvailableDomains(content?: CompiledContent) {
  if (content) {
    return Object.keys(content.domains) as DomainId[];
  }
  return [
    'WarMachine',
    'DyingPlanet',
    'GildedCage',
    'SilencedTruth',
    'EmptyStomach',
    'FossilGrip',
    'StolenVoice',
    'RevolutionaryWave',
    'PatriarchalGrip',
    'UnfinishedJustice',
  ] as DomainId[];
}

export function getSeatActions(content: CompiledContent): ActionDefinition[] {
  return Object.values(content.actions).sort((left, right) => left.resolvePriority - right.resolvePriority);
}

export function getSeatFaction(state: EngineState, content: CompiledContent, seat: number): FactionDefinition {
  return content.factions[state.players[seat].factionId];
}

export function getSeatDisabledReason(
  state: EngineState,
  content: CompiledContent,
  seat: number,
  action: Parameters<typeof getDisabledActionReason>[3],
): DisabledActionReason {
  return getDisabledActionReason(state, content, seat, action);
}

export function getPlayerBodyTotal(state: EngineState, seat: number) {
  return Object.values(state.regions).reduce((sum, region) => sum + (region.bodiesPresent[seat] ?? 0), 0);
}

export function getMandateStatus(state: EngineState, content: CompiledContent, seat: number) {
  const player = state.players[seat];
  const faction = content.factions[player.factionId];
  return {
    id: faction.mandate.id,
    title: faction.mandate.title,
    description: faction.mandate.description,
    revealed: player.mandateRevealed,
  };
}

export function getVictoryModeSummary(mode: VictoryMode) {
  return mode === 'LIBERATION'
    ? t('ui.mode.liberationSummary', 'End Resolution with every region at 1 Extraction Token or less.')
    : t('ui.mode.symbolicSummary', 'Complete all three active Beacons.');
}

export function getPhaseSummary(phase: Phase) {
  switch (phase) {
    case 'SYSTEM':
      return t('ui.game.phaseSummarySystem', 'Resolve the system strike and absorb the backlash.');
    case 'COALITION':
      return t('ui.game.phaseSummaryCoalition', 'Prepare two moves for each seat, then mark the coalition ready.');
    case 'RESOLUTION':
      return t('ui.game.phaseSummaryResolution', 'Resolve the prepared moves, then reckon with victory or defeat.');
    case 'WIN':
      return t('ui.game.phaseSummaryWin', 'The coalition forced open its path to victory.');
    case 'LOSS':
      return t('ui.game.phaseSummaryLoss', 'The coalition lost this round of the struggle.');
  }
}

export function buildEffectPreview(action: ActionDefinition): string {
  return action.description;
}

export function getPlayerStatusSummary(player: PlayerState) {
  return `${player.evidence} ${t('ui.game.evidence', 'Evidence')} • ${player.actionsRemaining} ${t('ui.game.moves', 'Moves')}`;
}

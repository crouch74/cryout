import type {
  ActionDefinition,
  CompiledContent,
  DisabledActionReason,
  EngineState,
  FactionDefinition,
  Phase,
  PlayerState,
  RegionId,
  VictoryMode,
} from './types.ts';
import { getDisabledActionReason } from './runtime.ts';

export function getAvailableRegions(): RegionId[] {
  return ['Congo', 'Levant', 'Amazon', 'Sahel', 'Mekong', 'Andes'];
}

export function getAvailableDomains() {
  return [
    'WarMachine',
    'DyingPlanet',
    'GildedCage',
    'SilencedTruth',
    'EmptyStomach',
    'FossilGrip',
    'StolenVoice',
  ] as const;
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
    ? 'Win by holding every region at one Extraction Token or less.'
    : 'Win by completing all three active Beacon objectives.';
}

export function getPhaseSummary(phase: Phase) {
  switch (phase) {
    case 'SYSTEM':
      return 'Resolve the system strike and military backlash.';
    case 'COALITION':
      return 'Queue two actions per seat, then mark every seat ready.';
    case 'RESOLUTION':
      return 'Resolve the queued actions, then check victory and defeat.';
    case 'WIN':
      return 'The coalition achieved its win condition.';
    case 'LOSS':
      return 'The coalition failed the struggle.';
  }
}

export function buildEffectPreview(action: ActionDefinition): string {
  return action.description;
}

export function getPlayerStatusSummary(player: PlayerState) {
  return `${player.evidence} Evidence • ${player.actionsRemaining} actions left`;
}

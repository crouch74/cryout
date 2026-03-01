import type {
  ActionDefinition,
  CompiledContent,
  DisabledActionReason,
  EndingSummary,
  EngineState,
  FrontId,
  PlayerState,
  RegionId,
  RoleDefinition,
} from './types.ts';
import { getDisabledActionReason, getTemperatureBand } from './runtime.ts';

export function getRole(state: EngineState, content: CompiledContent, seat: number): RoleDefinition {
  return content.roles[state.players[seat].roleId];
}

export function getSeatActions(state: EngineState, content: CompiledContent, seat: number) {
  const role = getRole(state, content, seat);
  return {
    standard: role.actionIds.map((actionId) => content.actions[actionId]),
    breakthroughs: role.breakthroughActionIds.map((actionId) => content.actions[actionId]),
  };
}

export function buildEffectPreview(action: ActionDefinition): string {
  return action.effects
    .slice(0, 3)
    .map((effect) => {
      switch (effect.type) {
        case 'modify_front_stat':
          return `${effect.front}.${effect.stat} ${effect.delta > 0 ? '+' : ''}${effect.delta}`;
        case 'modify_track':
          return effect.target.type === 'temperature'
            ? `temperature ${effect.delta > 0 ? '+' : ''}${effect.delta}`
            : effect.target.type === 'player_burnout'
              ? `burnout ${effect.delta > 0 ? '+' : ''}${effect.delta}`
              : 'track change';
        case 'add_token':
          return `+${effect.count} ${effect.token}`;
        case 'remove_token':
          return `-${effect.count} ${effect.token}`;
        case 'add_lock':
          return `add ${effect.lock}`;
        case 'remove_lock':
          return `remove ${effect.lock}`;
        case 'gain_resource':
          return `+${effect.amount} ${effect.resource}`;
        case 'spend_resource':
          return `-${effect.amount} ${effect.resource}`;
        case 'draw_from_deck':
          return `draw ${effect.count} ${effect.deck}`;
        case 'ensure_institution':
          return `build ${effect.institution}`;
        case 'add_charter_progress':
          return `+${effect.amount} charter progress`;
        case 'ratify_first_available_charter':
          return 'ratify a clause';
        case 'choice':
          return 'offer compromise';
        case 'delayed_effect':
          return `delayed ${effect.afterRounds}r`;
        case 'set_flag':
          return effect.key.startsWith('truth_window') ? 'open truth window' : 'set flag';
        case 'conditional':
          return 'conditional effect';
        case 'log':
          return effect.message;
        case 'repair_institution':
          return `repair ${effect.institution}`;
        case 'damage_institution':
          return 'damage institution';
      }
    })
    .join(' • ');
}

export function getScenarioRuleStatus(state: EngineState, ruleId: string): { active: boolean; value: string } {
  if (ruleId === 'witness_window') {
    return {
      active: Boolean(state.roundFlags.witness_window_available),
      value: state.roundFlags.witness_window_available ? 'Ready' : 'Spent / inactive',
    };
  }

  if (ruleId === 'aid_corridor') {
    const active = state.regions.MENA.locks.includes('AidAccess');
    return {
      active,
      value: active ? 'Locked in MENA' : 'Open',
    };
  }

  return { active: false, value: 'Unknown' };
}

export function getEndingTierSummary(state: EngineState): EndingSummary {
  const ratifiedClauses = Object.values(state.charter).filter((clause) => clause.status === 'ratified').length;
  const activeInstitutions = Object.values(state.regions).reduce((sum, region) => {
    return sum + region.institutions.filter((institution) => institution.status === 'active').length;
  }, 0);

  if (ratifiedClauses >= 6 && activeInstitutions >= 3) {
    return { tier: 'Rising', ratifiedClauses, activeInstitutions };
  }

  if (ratifiedClauses >= 4) {
    return { tier: 'Dignified Resistance', ratifiedClauses, activeInstitutions };
  }

  if (ratifiedClauses >= 2) {
    return { tier: 'Endurance', ratifiedClauses, activeInstitutions };
  }

  return { tier: 'Survival', ratifiedClauses, activeInstitutions };
}

export function getAvailableRegions(): RegionId[] {
  return [
    'MENA',
    'SubSaharanAfrica',
    'SouthAsia',
    'SoutheastAsia',
    'LatinAmerica',
    'Europe',
    'NorthAmerica',
    'PacificIslands',
  ];
}

export function getAvailableFronts(): FrontId[] {
  return ['WAR', 'CLIMATE', 'RIGHTS', 'SPEECH_INFO', 'POVERTY', 'ENERGY', 'CULTURE'];
}

export function getSeatDisabledReason(
  state: EngineState,
  content: CompiledContent,
  seat: number,
  actionId: string,
  target?: DisabledActionReason['legalTargets'][number],
): DisabledActionReason {
  return getDisabledActionReason(state, content, seat, actionId, target);
}

export function getPlayerStatusSummary(player: PlayerState) {
  return `${player.burnoutState.toUpperCase()} • ${player.actionsRemaining} actions left`;
}

export { getTemperatureBand };

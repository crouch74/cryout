import type { CoreCommand, CoreGameState } from '../types.ts';
import { BUILT_IN_CORE_COMMANDS } from './types.ts';

export function applyBuiltInCommand(state: CoreGameState, command: CoreCommand): CoreGameState {
  switch (command.type) {
    case BUILT_IN_CORE_COMMANDS.queueAction: {
      const playerId = String(command.payload?.playerId);
      const player = state.players[playerId];
      if (!player || !command.action) {
        return state;
      }
      player.queuedActions.push(command.action);
      return state;
    }
    case BUILT_IN_CORE_COMMANDS.removeQueuedAction: {
      const playerId = String(command.payload?.playerId);
      const actionIndex = Number(command.payload?.actionIndex ?? -1);
      const player = state.players[playerId];
      if (!player) {
        return state;
      }
      player.queuedActions = player.queuedActions.filter((_, index) => index !== actionIndex);
      return state;
    }
    case BUILT_IN_CORE_COMMANDS.reorderQueuedAction: {
      const playerId = String(command.payload?.playerId);
      const fromIndex = Number(command.payload?.fromIndex ?? -1);
      const toIndex = Number(command.payload?.toIndex ?? -1);
      const player = state.players[playerId];
      if (!player || fromIndex < 0 || toIndex < 0 || fromIndex >= player.queuedActions.length || toIndex >= player.queuedActions.length) {
        return state;
      }
      const next = [...player.queuedActions];
      const [moved] = next.splice(fromIndex, 1);
      if (moved) {
        next.splice(toIndex, 0, moved);
      }
      player.queuedActions = next;
      return state;
    }
    case BUILT_IN_CORE_COMMANDS.setReady: {
      const playerId = String(command.payload?.playerId);
      const player = state.players[playerId];
      if (player) {
        player.ready = Boolean(command.payload?.ready);
      }
      return state;
    }
    case BUILT_IN_CORE_COMMANDS.advancePhase: {
      const phaseId = String(command.payload?.phaseId ?? state.phase.id);
      state.phase = {
        id: phaseId,
        index: Number(command.payload?.index ?? state.phase.index + 1),
      };
      return state;
    }
    default:
      return state;
  }
}

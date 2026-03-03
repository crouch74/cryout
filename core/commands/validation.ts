import type { CoreCommand, CoreGameState, ValidationError } from '../types.ts';
import { BUILT_IN_CORE_COMMANDS } from './types.ts';

export function validateBuiltInCommand(state: CoreGameState, command: CoreCommand): ValidationError[] {
  const errors: ValidationError[] = [];

  if (command.type === BUILT_IN_CORE_COMMANDS.queueAction && !command.payload?.playerId) {
    errors.push({
      code: 'command.queue_action_missing_player',
      message: 'QUEUE_ACTION requires payload.playerId.',
      path: 'payload.playerId',
    });
  }

  if (command.type === BUILT_IN_CORE_COMMANDS.setReady && !command.payload?.playerId) {
    errors.push({
      code: 'command.set_ready_missing_player',
      message: 'SET_READY requires payload.playerId.',
      path: 'payload.playerId',
    });
  }

  if (command.type === BUILT_IN_CORE_COMMANDS.action && !command.action) {
    errors.push({
      code: 'command.action_missing_payload',
      message: 'ACTION requires command.action.',
      path: 'action',
    });
  }

  if ((command.type === BUILT_IN_CORE_COMMANDS.queueAction || command.type === BUILT_IN_CORE_COMMANDS.setReady) && command.payload?.playerId) {
    const playerId = String(command.payload.playerId);
    if (!state.players[playerId]) {
      errors.push({
        code: 'command.unknown_player',
        message: `Unknown player ${playerId}.`,
        path: 'payload.playerId',
      });
    }
  }

  return errors;
}

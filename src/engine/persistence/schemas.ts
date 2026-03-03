import type { SerializedGameEnvelope } from '../types.ts';

export function isSerializedGameEnvelope(value: unknown): value is SerializedGameEnvelope {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SerializedGameEnvelope>;
  return typeof candidate.coreVersion === 'string'
    && typeof candidate.scenarioId === 'string'
    && typeof candidate.scenarioVersion === 'string'
    && Array.isArray(candidate.commandLog);
}

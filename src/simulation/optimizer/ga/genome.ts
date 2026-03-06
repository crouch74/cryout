/**
 * Genome ↔ ScenarioPatch conversion helpers.
 *
 * These functions are used by both the GA engine (to simulate individuals)
 * and the main optimizer engine (when promoting GA candidates to A/B).
 */

import type { ScenarioPatch } from '../../experiments/patchDsl.ts';
import type { PatchGenome } from './types.ts';

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    const arr = value.map((e) => normalizeValue(e)).filter((e) => e !== undefined);
    return arr.length > 0 ? arr : undefined;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, normalizeValue(v)] as const)
      .filter(([, v]) => v !== undefined);
    if (entries.length === 0) { return undefined; }
    return Object.fromEntries(entries);
  }
  if (typeof value === 'number' && value === 0) { return undefined; }
  if (value === null || value === undefined) { return undefined; }
  return value;
}

function normalizeScenarioPatch(patch: ScenarioPatch): ScenarioPatch {
  return ((normalizeValue(patch) ?? {}) as ScenarioPatch);
}

/**
 * Convert a PatchGenome into its corresponding ScenarioPatch.
 * Zero-delta fields are omitted from the patch (normalisation).
 */
export function genomeToCandidate(genome: PatchGenome): ScenarioPatch {
  const patch: ScenarioPatch = {
    note: '🧬 GA evolutionary candidate',
  };

  if (genome.globalGazeDelta !== 0 || genome.northernWarMachineDelta !== 0 || genome.seededExtractionTotalDelta !== 0) {
    patch.setup = {};
    if (genome.globalGazeDelta !== 0) {
      patch.setup.globalGazeDelta = genome.globalGazeDelta;
    }
    if (genome.northernWarMachineDelta !== 0) {
      patch.setup.northernWarMachineDelta = genome.northernWarMachineDelta;
    }
    if (genome.seededExtractionTotalDelta !== 0) {
      patch.setup.seededExtractionTotalDelta = genome.seededExtractionTotalDelta;
    }
  }

  if (genome.crisisSpikeExtractionDelta !== 0 || genome.maxExtractionAddedPerRound !== null) {
    patch.pressure = {};
    if (genome.crisisSpikeExtractionDelta !== 0) {
      patch.pressure.crisisSpikeExtractionDelta = genome.crisisSpikeExtractionDelta;
    }
    if (genome.maxExtractionAddedPerRound !== null) {
      patch.pressure.maxExtractionAddedPerRound = genome.maxExtractionAddedPerRound;
    }
  }

  if (genome.liberationThresholdDelta !== 0) {
    patch.victory = {
      liberationThresholdDelta: genome.liberationThresholdDelta,
    };
  }

  if (genome.relaxAllThresholdsBy !== 0) {
    patch.mandates = {
      relaxAllThresholdsBy: genome.relaxAllThresholdsBy,
    };
  }

  const isDefaultScoring = genome.scoreThreshold === 70
    && genome.publicVictoryWeight === 45
    && genome.mandatesWeight === 55
    && genome.catastrophicCapEnabled === true
    && genome.catastrophicCapValue === 69;

  if (!isDefaultScoring) {
    patch.victoryScoring = {
      mode: 'score',
      threshold: genome.scoreThreshold,
      publicVictoryWeight: genome.publicVictoryWeight,
      mandatesWeight: genome.mandatesWeight,
      mandateProgressMode: 'binary',
      catastrophicCapEnabled: genome.catastrophicCapEnabled,
      catastrophicCapValue: genome.catastrophicCapValue,
    };
  }

  return normalizeScenarioPatch(patch);
}

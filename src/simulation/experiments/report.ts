import type { SimulationRecord } from '../types.ts';
import type { MandateFailureDistribution } from '../metrics/types.ts';
import type {
  ActionBalanceSummary,
  CoreActionKey,
  Decision,
  ExperimentArm,
  ExperimentArmSummary,
  ExperimentDefinition,
  ExperimentMetricKey,
  ExperimentRecommendation,
  MetricComparison,
  MetricDelta,
  PlayerCountSummary,
  ProportionComparisonStats,
} from './types.ts';

const EPSILON = 1e-9;
const DEFAULT_CONFIDENCE: 0.9 | 0.95 | 0.99 = 0.95;
const DEFAULT_RESERVOIR_SIZE = 8192;
const CORE_ACTIONS: CoreActionKey[] = [
  'organize',
  'investigate',
  'launchCampaign',
  'buildSolidarity',
  'smuggleEvidence',
  'internationalOutreach',
  'defend',
];
const TARGETED_ACTIONS = new Set<CoreActionKey>([
  'buildSolidarity',
  'internationalOutreach',
  'smuggleEvidence',
  'defend',
]);

const METRIC_KEYS: ExperimentMetricKey[] = [
  'successRate',
  'publicVictoryRate',
  'successRateGivenPublicVictory',
  'victoryScoreMean',
  'victoryScoreMedian',
  'victoryScoreP90',
  'mandateFailRateGivenPublic',
  'avgTurns',
  'medianTurns',
  'p90Turns',
  'defeat_extraction_breach',
  'defeat_comrades_exhausted',
  'defeat_mandate_failure',
  'defeat_sudden_death',
  'campaignSuccessRate',
];

interface Reservoir {
  capacity: number;
  seen: number;
  values: number[];
  state: number;
}

interface CollapseVarianceState {
  runs: number;
  total: number;
  totalSquared: number;
  maxObserved: number;
}

type ActionTotals = Record<CoreActionKey, number>;

export interface ArmAccumulator {
  arm: ExperimentArm;
  n: number;
  successes: number;
  publicVictories: number;
  publicVictoriesByRoundOne: number;
  victoriesBeforeAllowedRound: number;
  earlyTerminations: number;
  earlyLosses: number;
  lateGames: number;
  mandateFailuresAmongPublic: number;
  totalTurns: number;
  totalVictoryScore: number;
  componentContributionTotals: Record<string, number>;
  defeatReasons: {
    extraction_breach: number;
    comrades_exhausted: number;
    mandate_failure: number;
    sudden_death: number;
  };
  campaignAttempts: number;
  campaignSuccess: number;
  mandateFailuresById: Record<string, number>;
  mandateSuccessesById: Record<string, number>;
  outcomeBuckets: Record<string, number>;
  collapseVariance: CollapseVarianceState;
  actionTotals: ActionTotals;
  actionTotalsByOutcome: {
    victory: ActionTotals;
    defeat: ActionTotals;
  };
  setupPreparedCampaigns: number;
  launchCampaigns: number;
  failurePathPenaltyTotal: number;
  regimeWeightedTargetedShareTotal: number;
  regimeWeightTotal: number;
  reservoir: Reservoir;
  scoreReservoir: Reservoir;
  mandateFailureAsCostlyWin: boolean;
  /** Per-player-count mini-accumulators, keyed by player count as string. */
  byPlayerCount: Record<string, PlayerCountAccumulator>;
}

function nextUint(state: number) {
  let next = state === 0 ? 0x6d2b79f5 : state >>> 0;
  next = Math.imul(next ^ (next >>> 15), next | 1) >>> 0;
  next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
  return (next ^ (next >>> 14)) >>> 0;
}

// -------------------------------------------------------------------------
// Per-player-count mini-accumulator
// -------------------------------------------------------------------------

interface PlayerCountAccumulator {
  playerCount: number;
  n: number;
  successes: number;
  publicVictories: number;
  earlyTerminations: number;
  totalTurns: number;
  turnsReservoir: Reservoir;
  actionTotals: ActionTotals;
  defeatReasons: {
    extraction_breach: number;
    comrades_exhausted: number;
    mandate_failure: number;
    sudden_death: number;
  };
}

function createPlayerCountAccumulator(playerCount: number, seed: number): PlayerCountAccumulator {
  return {
    playerCount,
    n: 0,
    successes: 0,
    publicVictories: 0,
    earlyTerminations: 0,
    totalTurns: 0,
    turnsReservoir: {
      capacity: 1024,
      seen: 0,
      values: [],
      state: (seed ^ (playerCount * 0x9e3779b9)) >>> 0,
    },
    actionTotals: createZeroActionTotals(),
    defeatReasons: {
      extraction_breach: 0,
      comrades_exhausted: 0,
      mandate_failure: 0,
      sudden_death: 0,
    },
  };
}

function finalizePlayerCountSummary(acc: PlayerCountAccumulator): PlayerCountSummary {
  return {
    playerCount: acc.playerCount,
    n: acc.n,
    successRate: ratio(acc.successes, acc.n),
    publicVictoryRate: ratio(acc.publicVictories, acc.n),
    earlyTerminationRate: ratio(acc.earlyTerminations, acc.n),
    turns: {
      average: ratio(acc.totalTurns, acc.n),
      median: roundTo(percentile(acc.turnsReservoir.values, 0.5)),
    },
    defeatRates: {
      extraction_breach: ratio(acc.defeatReasons.extraction_breach, acc.n),
      comrades_exhausted: ratio(acc.defeatReasons.comrades_exhausted, acc.n),
      mandate_failure: ratio(acc.defeatReasons.mandate_failure, acc.n),
      sudden_death: ratio(acc.defeatReasons.sudden_death, acc.n),
    },
  };
}

function roundTo(value: number, digits = 6) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function createZeroActionTotals(): ActionTotals {
  return {
    organize: 0,
    investigate: 0,
    launchCampaign: 0,
    buildSolidarity: 0,
    smuggleEvidence: 0,
    internationalOutreach: 0,
    defend: 0,
  };
}

function sumActionTotals(totals: ActionTotals) {
  return CORE_ACTIONS.reduce((sum, action) => sum + (totals[action] ?? 0), 0);
}

function actionShares(totals: ActionTotals): Record<CoreActionKey, number> {
  const total = sumActionTotals(totals);
  return Object.fromEntries(
    CORE_ACTIONS.map((action) => [action, total > 0 ? roundTo((totals[action] ?? 0) / total) : 0]),
  ) as Record<CoreActionKey, number>;
}

function actionAverageCounts(totals: ActionTotals, runs: number): Record<CoreActionKey, number> {
  return Object.fromEntries(
    CORE_ACTIONS.map((action) => [action, ratio(totals[action] ?? 0, runs)]),
  ) as Record<CoreActionKey, number>;
}

function actionEntropy(totals: ActionTotals) {
  return normalizedEntropy(Object.fromEntries(CORE_ACTIONS.map((action) => [action, totals[action] ?? 0])));
}

function actionConcentration(totals: ActionTotals) {
  const total = sumActionTotals(totals);
  if (total <= 0) {
    return 0;
  }
  return roundTo(
    CORE_ACTIONS.reduce((best, action) => Math.max(best, (totals[action] ?? 0) / total), 0),
  );
}

function dominantAction(totals: ActionTotals): CoreActionKey | null {
  const total = sumActionTotals(totals);
  if (total <= 0) {
    return null;
  }
  return CORE_ACTIONS.reduce<CoreActionKey | null>((best, action) => {
    if (!best) {
      return action;
    }
    return (totals[action] ?? 0) > (totals[best] ?? 0) ? action : best;
  }, null);
}

function targetedActionShare(totals: ActionTotals) {
  const shares = actionShares(totals);
  return roundTo(
    CORE_ACTIONS.reduce((sum, action) => sum + (TARGETED_ACTIONS.has(action) ? shares[action] : 0), 0),
  );
}

function buildActionBalanceSummary(
  overallTotals: ActionTotals,
  outcomeTotals: { victory: ActionTotals; defeat: ActionTotals },
  byPlayerCount: Record<string, PlayerCountAccumulator>,
  runs: number,
  pathSignals: {
    setupPreparedCampaigns: number;
    launchCampaigns: number;
    failurePathPenaltyTotal: number;
    regimeWeightedTargetedShareTotal: number;
    regimeWeightTotal: number;
  },
): ActionBalanceSummary {
  return {
    entropy: actionEntropy(overallTotals),
    concentration: actionConcentration(overallTotals),
    dominantAction: dominantAction(overallTotals),
    targetedShare: targetedActionShare(overallTotals),
    winningTargetedShare: targetedActionShare(outcomeTotals.victory),
    setupDependentCampaignRate: ratio(pathSignals.setupPreparedCampaigns, pathSignals.launchCampaigns),
    failurePathPenalty: ratio(pathSignals.failurePathPenaltyTotal, runs),
    regimeWeightedTargetedShare: ratio(
      pathSignals.regimeWeightedTargetedShareTotal,
      pathSignals.regimeWeightTotal,
    ),
    actionShare: actionShares(overallTotals),
    actionAverageCounts: actionAverageCounts(overallTotals, runs),
    actionShareByOutcome: {
      victory: actionShares(outcomeTotals.victory),
      defeat: actionShares(outcomeTotals.defeat),
    },
    actionShareByPlayerCount: Object.fromEntries(
      Object.entries(byPlayerCount)
        .filter(([, acc]) => acc.n > 0)
        .map(([key, acc]) => [key, actionShares(acc.actionTotals)]),
    ) as Record<string, Record<CoreActionKey, number>>,
  };
}

function mergeActionTotals(target: ActionTotals, source: Partial<Record<CoreActionKey, number>> | undefined) {
  if (!source) {
    return;
  }
  for (const action of CORE_ACTIONS) {
    target[action] += source[action] ?? 0;
  }
}

function buildActionDeltaTimeline(record: SimulationRecord): ActionTotals[] {
  const previous = createZeroActionTotals();
  return (record.roundSnapshots ?? []).map((snapshot) => {
    const current = snapshot.actions ?? {};
    const delta = createZeroActionTotals();
    for (const action of CORE_ACTIONS) {
      const next = current[action] ?? 0;
      delta[action] = Math.max(0, next - previous[action]);
      previous[action] = next;
    }
    return delta;
  });
}

function computeSetupPreparedCampaigns(deltas: ActionTotals[]) {
  const seenSetup = createZeroActionTotals();
  let preparedCampaigns = 0;
  let launchCampaigns = 0;

  for (const delta of deltas) {
    const launches = delta.launchCampaign;
    if (launches > 0) {
      launchCampaigns += launches;
      const setupAvailable = seenSetup.buildSolidarity > 0
        || seenSetup.internationalOutreach > 0
        || seenSetup.smuggleEvidence > 0;
      if (setupAvailable) {
        preparedCampaigns += launches;
      }
    }

    seenSetup.buildSolidarity += delta.buildSolidarity;
    seenSetup.internationalOutreach += delta.internationalOutreach;
    seenSetup.smuggleEvidence += delta.smuggleEvidence;
  }

  return { preparedCampaigns, launchCampaigns };
}

function computeFailurePathPenalty(record: SimulationRecord, deltas: ActionTotals[]) {
  if (record.result.type !== 'defeat') {
    return 0;
  }

  const terminalSnapshots = (record.roundSnapshots ?? []).slice(-2);
  const terminalDeltas = deltas.slice(-2);
  const highestExtraction = Math.max(
    0,
    ...terminalSnapshots.flatMap((snapshot) =>
      Object.values(snapshot.fronts ?? {}).map((front) => front.extraction ?? 0)),
  );
  const warMachine = Math.max(0, ...terminalSnapshots.map((snapshot) => snapshot.globalTracks.warMachine ?? 0));
  const comradesFloor = Math.min(
    ...terminalSnapshots.map((snapshot) => snapshot.resources.totalComrades ?? Infinity),
  );
  const highPressure = highestExtraction >= 4
    || warMachine >= 7
    || comradesFloor <= Math.max(3, record.playerCount * 2);

  const defensiveWindow = terminalDeltas.reduce(
    (sum, delta) => sum + delta.defend + delta.buildSolidarity + delta.internationalOutreach + delta.smuggleEvidence,
    0,
  );
  const dominantLoopWindow = terminalDeltas.reduce(
    (sum, delta) => sum + delta.launchCampaign + delta.investigate,
    0,
  );

  let penalty = 0;
  if (highPressure) {
    penalty += 0.5;
  }
  if (highPressure && defensiveWindow === 0) {
    penalty += 0.3;
  }
  if (dominantLoopWindow > defensiveWindow) {
    penalty += 0.2;
  }

  return roundTo(clamp(penalty, 0, 1));
}

function classifyRegimeWeight(record: SimulationRecord) {
  if (record.result.type === 'defeat' && record.turnsPlayed < 5) {
    return 1.4;
  }
  if (record.result.type === 'victory' && record.turnsPlayed <= 9) {
    return 1.2;
  }
  if (record.result.type === 'defeat' && record.turnsPlayed >= 10) {
    return 1.1;
  }
  return 1;
}

function computeRecordTargetedShare(record: SimulationRecord) {
  const totalActions = CORE_ACTIONS.reduce((sum, action) => sum + (record.actionCounts[action] ?? 0), 0);
  if (totalActions <= 0) {
    return 0;
  }
  const targetedActions = Array.from(TARGETED_ACTIONS)
    .reduce((sum, action) => sum + (record.actionCounts[action] ?? 0), 0);
  return roundTo(targetedActions / totalActions);
}

function ratio(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }
  return roundTo(numerator / denominator);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function mergeCountMaps(target: Record<string, number>, source: Record<string, number>) {
  for (const [key, value] of Object.entries(source)) {
    target[key] = (target[key] ?? 0) + value;
  }
}

function buildMandateFailureDistribution(
  failuresByMandate: Record<string, number>,
  successesByMandate: Record<string, number>,
): MandateFailureDistribution[] {
  const mandateIds = new Set([
    ...Object.keys(failuresByMandate),
    ...Object.keys(successesByMandate),
  ]);

  return Array.from(mandateIds)
    .map((mandateId) => {
      const failures = failuresByMandate[mandateId] ?? 0;
      const successes = successesByMandate[mandateId] ?? 0;
      const attempts = failures + successes;
      return {
        mandateId,
        failureRate: ratio(failures, attempts),
        successRate: ratio(successes, attempts),
        attempts,
      };
    })
    .filter((entry) => entry.attempts > 0)
    .sort((left, right) => {
      if (right.failureRate !== left.failureRate) {
        return right.failureRate - left.failureRate;
      }
      return left.mandateId.localeCompare(right.mandateId);
    });
}

function addToReservoir(reservoir: Reservoir, value: number) {
  reservoir.seen += 1;
  if (reservoir.values.length < reservoir.capacity) {
    reservoir.values.push(value);
    return;
  }

  reservoir.state = nextUint(reservoir.state);
  const index = reservoir.state % reservoir.seen;
  if (index < reservoir.capacity) {
    reservoir.values[index] = value;
  }
}

function percentile(values: number[], p: number) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = values.slice().sort((left, right) => left - right);
  if (sorted.length === 1) {
    return sorted[0];
  }

  const rank = (sorted.length - 1) * p;
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) {
    return sorted[lower];
  }

  const weight = rank - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
}

function recordOutcomeBucket(record: SimulationRecord) {
  const roundBucket = record.turnsPlayed < 5
    ? 'early'
    : (record.turnsPlayed <= 9 ? 'mid' : (record.turnsPlayed <= 14 ? 'late' : 'extended'));
  return `${record.result.type}:${record.result.reason}:${roundBucket}`;
}

function normalizedEntropy(buckets: Record<string, number>) {
  const counts = Object.values(buckets).filter((value) => value > 0);
  const total = counts.reduce((sum, value) => sum + value, 0);
  if (total <= 0 || counts.length <= 1) {
    return 0;
  }

  let entropy = 0;
  for (const count of counts) {
    const probability = count / total;
    entropy -= probability * Math.log2(probability);
  }

  const maxEntropy = Math.log2(counts.length);
  if (maxEntropy <= 0) {
    return 0;
  }
  return roundTo(clamp(entropy / maxEntropy, 0, 1));
}

function normalizedCollapseVariance(state: CollapseVarianceState) {
  if (state.runs <= 1 || state.maxObserved <= 0) {
    return 0;
  }

  const mean = state.total / state.runs;
  const variance = Math.max(0, (state.totalSquared / state.runs) - (mean * mean));
  const maxVariance = (state.maxObserved * state.maxObserved) / 4;
  if (maxVariance <= 0) {
    return 0;
  }
  return roundTo(clamp(variance / maxVariance, 0, 1));
}

function countCollapsedFronts(record: SimulationRecord) {
  return Object.values(record.finalState.fronts)
    .filter((extraction) => extraction >= 6)
    .length;
}

function metricValue(summary: ExperimentArmSummary, metric: ExperimentMetricKey): number {
  switch (metric) {
    case 'successRate':
      return summary.successRate;
    case 'publicVictoryRate':
      return summary.publicVictoryRate;
    case 'successRateGivenPublicVictory':
      return summary.successRateGivenPublicVictory;
    case 'victoryScoreMean':
      return summary.victoryScoreMean;
    case 'victoryScoreMedian':
      return summary.victoryScoreMedian;
    case 'victoryScoreP90':
      return summary.victoryScoreP90;
    case 'mandateFailRateGivenPublic':
      return summary.mandateFailRateGivenPublic;
    case 'avgTurns':
      return summary.turns.average;
    case 'medianTurns':
      return summary.turns.median;
    case 'p90Turns':
      return summary.turns.p90;
    case 'defeat_extraction_breach':
      return summary.defeatRates.extraction_breach;
    case 'defeat_comrades_exhausted':
      return summary.defeatRates.comrades_exhausted;
    case 'defeat_mandate_failure':
      return summary.defeatRates.mandate_failure;
    case 'defeat_sudden_death':
      return summary.defeatRates.sudden_death;
    case 'campaignSuccessRate':
      return summary.campaign.successRate;
  }
}

function getCriticalZ(confidence: 0.9 | 0.95 | 0.99) {
  if (confidence === 0.9) {
    return 1.6448536269514722;
  }
  if (confidence === 0.99) {
    return 2.5758293035489004;
  }
  return 1.959963984540054;
}

function normalCdf(z: number) {
  const absZ = Math.abs(z);
  const t = 1 / (1 + 0.2316419 * absZ);
  const d = 0.3989422804014327 * Math.exp((-absZ * absZ) / 2);
  const poly = ((((1.330274429 * t - 1.821255978) * t + 1.781477937) * t - 0.356563782) * t + 0.31938153) * t;
  const probability = 1 - d * poly;
  return z >= 0 ? probability : 1 - probability;
}

function compareProportions(
  successA: number,
  nA: number,
  successB: number,
  nB: number,
  confidence: 0.9 | 0.95 | 0.99,
): ProportionComparisonStats | undefined {
  if (nA <= 0 || nB <= 0) {
    return undefined;
  }

  const pA = successA / nA;
  const pB = successB / nB;
  const diff = pB - pA;

  const pooled = (successA + successB) / (nA + nB);
  const pooledVariance = pooled * (1 - pooled) * ((1 / nA) + (1 / nB));
  const pooledSe = pooledVariance <= 0 ? 0 : Math.sqrt(pooledVariance);
  const zScore = pooledSe === 0 ? 0 : diff / pooledSe;
  const pValue = Math.max(0, Math.min(1, 2 * (1 - normalCdf(Math.abs(zScore)))));

  const unpooledVariance = (pA * (1 - pA)) / nA + (pB * (1 - pB)) / nB;
  const unpooledSe = unpooledVariance <= 0 ? 0 : Math.sqrt(unpooledVariance);
  const criticalZ = getCriticalZ(confidence);
  const margin = unpooledSe === 0 ? 0 : criticalZ * unpooledSe;

  return {
    confidence,
    zScore: roundTo(zScore),
    pValue: roundTo(pValue),
    confidenceInterval: {
      lower: roundTo(diff - margin),
      upper: roundTo(diff + margin),
    },
  };
}

export function createArmAccumulator(
  arm: ExperimentArm,
  seed: number,
  options?: { reservoirSize?: number; mandateFailureAsCostlyWin?: boolean },
): ArmAccumulator {
  return {
    arm,
    n: 0,
    successes: 0,
    publicVictories: 0,
    publicVictoriesByRoundOne: 0,
    victoriesBeforeAllowedRound: 0,
    earlyTerminations: 0,
    earlyLosses: 0,
    lateGames: 0,
    mandateFailuresAmongPublic: 0,
    totalTurns: 0,
    totalVictoryScore: 0,
    componentContributionTotals: {},
    defeatReasons: {
      extraction_breach: 0,
      comrades_exhausted: 0,
      mandate_failure: 0,
      sudden_death: 0,
    },
    campaignAttempts: 0,
    campaignSuccess: 0,
    mandateFailuresById: {},
    mandateSuccessesById: {},
    outcomeBuckets: {},
    collapseVariance: {
      runs: 0,
      total: 0,
      totalSquared: 0,
      maxObserved: 0,
    },
    actionTotals: createZeroActionTotals(),
    actionTotalsByOutcome: {
      victory: createZeroActionTotals(),
      defeat: createZeroActionTotals(),
    },
    setupPreparedCampaigns: 0,
    launchCampaigns: 0,
    failurePathPenaltyTotal: 0,
    regimeWeightedTargetedShareTotal: 0,
    regimeWeightTotal: 0,
    reservoir: {
      capacity: Math.max(256, options?.reservoirSize ?? DEFAULT_RESERVOIR_SIZE),
      seen: 0,
      values: [],
      state: seed >>> 0,
    },
    scoreReservoir: {
      capacity: Math.max(256, options?.reservoirSize ?? DEFAULT_RESERVOIR_SIZE),
      seen: 0,
      values: [],
      state: (seed ^ 0xa5a5a5a5) >>> 0,
    },
    mandateFailureAsCostlyWin: Boolean(options?.mandateFailureAsCostlyWin),
    byPlayerCount: {
      '2': createPlayerCountAccumulator(2, seed),
      '3': createPlayerCountAccumulator(3, seed),
      '4': createPlayerCountAccumulator(4, seed),
    },
  };
}

export function ingestArmRecord(accumulator: ArmAccumulator, record: SimulationRecord) {
  accumulator.n += 1;
  accumulator.totalTurns += record.turnsPlayed;
  addToReservoir(accumulator.reservoir, record.turnsPlayed);
  if (record.turnsPlayed < 3) {
    accumulator.earlyTerminations += 1;
  }
  if (record.turnsPlayed < 5) {
    accumulator.earlyLosses += 1;
  }
  if (record.turnsPlayed > 14) {
    accumulator.lateGames += 1;
  }
  const outcomeBucket = recordOutcomeBucket(record);
  accumulator.outcomeBuckets[outcomeBucket] = (accumulator.outcomeBuckets[outcomeBucket] ?? 0) + 1;
  const collapsedFronts = countCollapsedFronts(record);
  accumulator.collapseVariance.runs += 1;
  accumulator.collapseVariance.total += collapsedFronts;
  accumulator.collapseVariance.totalSquared += collapsedFronts * collapsedFronts;
  accumulator.collapseVariance.maxObserved = Math.max(accumulator.collapseVariance.maxObserved, collapsedFronts);

  const isMandateFailure = record.result.reason === 'mandate_failure';
  const scoreSuccess = record.successByScore ?? false;
  const success = scoreSuccess
    || record.result.type === 'victory'
    || (accumulator.mandateFailureAsCostlyWin && isMandateFailure);

  if (success) {
    accumulator.successes += 1;
  }
  const victoryScore = record.victoryScore ?? 0;
  accumulator.totalVictoryScore += victoryScore;
  addToReservoir(accumulator.scoreReservoir, victoryScore);
  mergeCountMaps(accumulator.componentContributionTotals, record.scoreComponentContributions ?? {});

  if (record.publicVictoryAchieved) {
    accumulator.publicVictories += 1;
    if (record.turnsPlayed <= 1) {
      accumulator.publicVictoriesByRoundOne += 1;
    }
    if (record.mandateFailure) {
      accumulator.mandateFailuresAmongPublic += 1;
    }
  }
  if (record.victoryPredicateSatisfiedBeforeAllowedRound) {
    accumulator.victoriesBeforeAllowedRound += 1;
  }

  if (record.result.reason === 'extraction_breach') {
    accumulator.defeatReasons.extraction_breach += 1;
  }
  if (record.result.reason === 'comrades_exhausted') {
    accumulator.defeatReasons.comrades_exhausted += 1;
  }
  if (record.result.reason === 'mandate_failure') {
    accumulator.defeatReasons.mandate_failure += 1;
  }
  if (record.result.reason === 'sudden_death') {
    accumulator.defeatReasons.sudden_death += 1;
  }

  accumulator.campaignAttempts += record.campaignStats.campaignAttempts;
  accumulator.campaignSuccess += record.campaignStats.campaignSuccess;
  mergeCountMaps(accumulator.mandateFailuresById, record.mandateOutcomeById.failuresByMandate);
  mergeCountMaps(accumulator.mandateSuccessesById, record.mandateOutcomeById.successesByMandate);
  mergeActionTotals(accumulator.actionTotals, record.actionCounts);
  mergeActionTotals(accumulator.actionTotalsByOutcome[record.result.type], record.actionCounts);
  const actionDeltas = buildActionDeltaTimeline(record);
  const campaignPath = computeSetupPreparedCampaigns(actionDeltas);
  accumulator.setupPreparedCampaigns += campaignPath.preparedCampaigns;
  accumulator.launchCampaigns += campaignPath.launchCampaigns;
  accumulator.failurePathPenaltyTotal += computeFailurePathPenalty(record, actionDeltas);
  const regimeWeight = classifyRegimeWeight(record);
  accumulator.regimeWeightTotal += regimeWeight;
  accumulator.regimeWeightedTargetedShareTotal += computeRecordTargetedShare(record) * regimeWeight;

  // 🎲 Route into per-player-count sub-accumulator
  const pcKey = String(record.playerCount);
  if (!accumulator.byPlayerCount[pcKey]) {
    // Unexpected player count encountered at runtime — create on-demand
    accumulator.byPlayerCount[pcKey] = createPlayerCountAccumulator(record.playerCount, accumulator.reservoir.state);
  }
  const pc = accumulator.byPlayerCount[pcKey];
  pc.n += 1;
  pc.totalTurns += record.turnsPlayed;
  addToReservoir(pc.turnsReservoir, record.turnsPlayed);
  if (record.turnsPlayed < 3) {
    pc.earlyTerminations += 1;
  }
  mergeActionTotals(pc.actionTotals, record.actionCounts);
  if (success) {
    pc.successes += 1;
  }
  if (record.publicVictoryAchieved) {
    pc.publicVictories += 1;
  }
  if (record.result.reason === 'extraction_breach') {
    pc.defeatReasons.extraction_breach += 1;
  }
  if (record.result.reason === 'comrades_exhausted') {
    pc.defeatReasons.comrades_exhausted += 1;
  }
  if (record.result.reason === 'mandate_failure') {
    pc.defeatReasons.mandate_failure += 1;
  }
  if (record.result.reason === 'sudden_death') {
    pc.defeatReasons.sudden_death += 1;
  }
}

export function finalizeArmSummary(accumulator: ArmAccumulator): ExperimentArmSummary {
  const medianTurns = percentile(accumulator.reservoir.values, 0.5);
  const p90Turns = percentile(accumulator.reservoir.values, 0.9);
  const victoryScoreMedian = percentile(accumulator.scoreReservoir.values, 0.5);
  const victoryScoreP90 = percentile(accumulator.scoreReservoir.values, 0.9);
  const componentContributionAverages = Object.fromEntries(
    Object.entries(accumulator.componentContributionTotals)
      .map(([componentId, value]) => [componentId, ratio(value, accumulator.n)]),
  );

  const byPlayerCount = Object.fromEntries(
    Object.entries(accumulator.byPlayerCount)
      .filter(([, acc]) => acc.n > 0)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([key, acc]) => [key, finalizePlayerCountSummary(acc)]),
  );
  const actionBalance = buildActionBalanceSummary(
    accumulator.actionTotals,
    accumulator.actionTotalsByOutcome,
    accumulator.byPlayerCount,
    accumulator.n,
    {
      setupPreparedCampaigns: accumulator.setupPreparedCampaigns,
      launchCampaigns: accumulator.launchCampaigns,
      failurePathPenaltyTotal: accumulator.failurePathPenaltyTotal,
      regimeWeightedTargetedShareTotal: accumulator.regimeWeightedTargetedShareTotal,
      regimeWeightTotal: accumulator.regimeWeightTotal,
    },
  );

  return {
    arm: accumulator.arm,
    n: accumulator.n,
    successes: accumulator.successes,
    successRate: ratio(accumulator.successes, accumulator.n),
    earlyLossRate: ratio(accumulator.earlyLosses, accumulator.n),
    lateGameRate: ratio(accumulator.lateGames, accumulator.n),
    outcomeEntropy: normalizedEntropy(accumulator.outcomeBuckets),
    regionCollapseVariance: normalizedCollapseVariance(accumulator.collapseVariance),
    publicVictories: accumulator.publicVictories,
    publicVictoryRate: ratio(accumulator.publicVictories, accumulator.n),
    successRateGivenPublicVictory: ratio(accumulator.successes, accumulator.publicVictories),
    victoryScoreMean: ratio(accumulator.totalVictoryScore, accumulator.n),
    victoryScoreMedian: roundTo(victoryScoreMedian),
    victoryScoreP90: roundTo(victoryScoreP90),
    componentContributionAverages,
    publicVictoriesByRoundOne: accumulator.publicVictoriesByRoundOne,
    turnOnePublicVictoryRate: ratio(accumulator.publicVictoriesByRoundOne, accumulator.n),
    victoryBeforeAllowedRoundRate: ratio(accumulator.victoriesBeforeAllowedRound, accumulator.n),
    earlyTerminationRate: ratio(accumulator.earlyTerminations, accumulator.n),
    mandateFailuresAmongPublic: accumulator.mandateFailuresAmongPublic,
    mandateFailRateGivenPublic: ratio(accumulator.mandateFailuresAmongPublic, accumulator.publicVictories),
    mandateFailureDistribution: buildMandateFailureDistribution(
      accumulator.mandateFailuresById,
      accumulator.mandateSuccessesById,
    ),
    turns: {
      average: ratio(accumulator.totalTurns, accumulator.n),
      median: roundTo(medianTurns),
      p90: roundTo(p90Turns),
    },
    defeatReasons: {
      extraction_breach: accumulator.defeatReasons.extraction_breach,
      comrades_exhausted: accumulator.defeatReasons.comrades_exhausted,
      mandate_failure: accumulator.defeatReasons.mandate_failure,
      sudden_death: accumulator.defeatReasons.sudden_death,
    },
    defeatRates: {
      extraction_breach: ratio(accumulator.defeatReasons.extraction_breach, accumulator.n),
      comrades_exhausted: ratio(accumulator.defeatReasons.comrades_exhausted, accumulator.n),
      mandate_failure: ratio(accumulator.defeatReasons.mandate_failure, accumulator.n),
      sudden_death: ratio(accumulator.defeatReasons.sudden_death, accumulator.n),
    },
    campaign: {
      attempts: accumulator.campaignAttempts,
      success: accumulator.campaignSuccess,
      successRate: ratio(accumulator.campaignSuccess, accumulator.campaignAttempts),
    },
    actionBalance,
    reservoirSampleSize: accumulator.reservoir.values.length,
    byPlayerCount,
  };
}

function buildMetricDelta(
  metric: ExperimentMetricKey,
  armA: number,
  armB: number,
  proportionStats?: ProportionComparisonStats,
): MetricDelta {
  const absoluteLift = roundTo(armB - armA);
  const relativeLift = roundTo(absoluteLift / Math.max(armA, EPSILON));

  return {
    metric,
    armA: roundTo(armA),
    armB: roundTo(armB),
    absoluteLift,
    relativeLift,
    proportionStats,
  };
}

export function compareArms(
  armA: ExperimentArmSummary,
  armB: ExperimentArmSummary,
  confidence: 0.9 | 0.95 | 0.99 = DEFAULT_CONFIDENCE,
): MetricComparison {
  const comparisonEntries: Array<[ExperimentMetricKey, MetricDelta]> = [];

  for (const metric of METRIC_KEYS) {
    const valueA = metricValue(armA, metric);
    const valueB = metricValue(armB, metric);

    let proportionStats: ProportionComparisonStats | undefined;
    if (metric === 'successRate') {
      proportionStats = compareProportions(armA.successes, armA.n, armB.successes, armB.n, confidence);
    }
    if (metric === 'publicVictoryRate') {
      proportionStats = compareProportions(armA.publicVictories, armA.n, armB.publicVictories, armB.n, confidence);
    }

    comparisonEntries.push([metric, buildMetricDelta(metric, valueA, valueB, proportionStats)]);
  }

  return {
    confidence,
    nA: armA.n,
    nB: armB.n,
    metrics: Object.fromEntries(comparisonEntries) as Record<ExperimentMetricKey, MetricDelta>,
  };
}

function evaluateDecision(definition: ExperimentDefinition, comparison: MetricComparison): {
  decision: Decision;
  rationale: string[];
} {
  const confidence = definition.decisionRule.confidence ?? DEFAULT_CONFIDENCE;
  const alpha = 1 - confidence;
  const rationale: string[] = [];

  const primaryMetric = definition.decisionRule.primary;
  const primary = comparison.metrics[primaryMetric];
  const primaryStats = primary.proportionStats;
  const MIN_SAMPLE_SIZE = 0;
  const sampleSizeTooSmall = Math.min(comparison.nA, comparison.nB) < MIN_SAMPLE_SIZE;

  if (sampleSizeTooSmall) {
    rationale.push(`Sample size is below the minimum confidence floor (n<${MIN_SAMPLE_SIZE} per arm).`);
    return { decision: 'NEEDS_MORE_DATA', rationale };
  }

  if (primary.absoluteLift < definition.decisionRule.minLift) {
    const upper = primaryStats?.confidenceInterval.upper;
    if (upper !== undefined && upper < definition.decisionRule.minLift) {
      rationale.push(`Primary metric ${primaryMetric} lift ${primary.absoluteLift} is below required ${definition.decisionRule.minLift}.`);
      return { decision: 'REJECT', rationale };
    }

    rationale.push(`Primary metric ${primaryMetric} lift ${primary.absoluteLift} is below required ${definition.decisionRule.minLift}, but confidence is inconclusive.`);
    return { decision: 'NEEDS_MORE_DATA', rationale };
  }

  if (definition.decisionRule.guardrails) {
    for (const guardrail of definition.decisionRule.guardrails) {
      const metric = comparison.metrics[guardrail.metric];
      if (metric.absoluteLift < -guardrail.maxRegression) {
        rationale.push(`Guardrail failed for ${guardrail.metric}: regression ${metric.absoluteLift} exceeds ${guardrail.maxRegression}.`);
        return { decision: 'REJECT', rationale };
      }
    }
  }

  if (definition.decisionRule.requireImprovedMetricsCount !== undefined) {
    const improvedCount = METRIC_KEYS.filter((metric) => comparison.metrics[metric].absoluteLift > 0).length;
    if (improvedCount < definition.decisionRule.requireImprovedMetricsCount) {
      rationale.push(`Only ${improvedCount} metrics improved; required ${definition.decisionRule.requireImprovedMetricsCount}.`);
      return { decision: 'REJECT', rationale };
    }
  }

  if (!primaryStats) {
    rationale.push(`Primary metric ${primaryMetric} lacks proportion statistics.`);
    return { decision: 'NEEDS_MORE_DATA', rationale };
  }

  if (primaryStats.confidenceInterval.lower <= 0) {
    rationale.push(`Primary metric confidence interval overlaps zero (${primaryStats.confidenceInterval.lower} to ${primaryStats.confidenceInterval.upper}).`);
    return { decision: 'NEEDS_MORE_DATA', rationale };
  }

  if (primaryStats.pValue > alpha) {
    rationale.push(`Primary metric p-value ${primaryStats.pValue} is above alpha ${roundTo(alpha)}.`);
    return { decision: 'NEEDS_MORE_DATA', rationale };
  }

  rationale.push(`Primary metric ${primaryMetric} improved by ${primary.absoluteLift} and passed confidence target ${confidence}.`);
  rationale.push('Guardrails satisfied for all monitored regressions.');
  return { decision: 'KEEP', rationale };
}

export function decide(definition: ExperimentDefinition, comparison: MetricComparison): Decision {
  return evaluateDecision(definition, comparison).decision;
}

export function buildRecommendation(definition: ExperimentDefinition, comparison: MetricComparison): ExperimentRecommendation {
  const evaluation = evaluateDecision(definition, comparison);
  return {
    decision: evaluation.decision,
    rationale: evaluation.rationale,
    primaryMetric: definition.decisionRule.primary,
  };
}

function formatRate(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function formatLift(value: number) {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(6)}`;
}

function renderMandateRankingMarkdown(distribution: MandateFailureDistribution[]) {
  if (distribution.length === 0) {
    return '- n/a';
  }

  return distribution
    .map((entry, index) => `${index + 1}. ${entry.mandateId} - ${formatRate(entry.failureRate)} (${entry.attempts} attempts)`)
    .join('\n');
}

export function renderMarkdownReport(input: {
  definition: ExperimentDefinition;
  armA: ExperimentArmSummary;
  armB: ExperimentArmSummary;
  comparison: MetricComparison;
  recommendation: ExperimentRecommendation;
}) {
  const primary = input.comparison.metrics[input.definition.decisionRule.primary];
  const primaryStats = primary.proportionStats;

  const rows = METRIC_KEYS.map((metric) => {
    const delta = input.comparison.metrics[metric];
    const pValue = delta.proportionStats ? delta.proportionStats.pValue.toFixed(6) : '-';
    const ci = delta.proportionStats
      ? `[${delta.proportionStats.confidenceInterval.lower.toFixed(6)}, ${delta.proportionStats.confidenceInterval.upper.toFixed(6)}]`
      : '-';

    return `| ${metric} | ${delta.armA.toFixed(6)} | ${delta.armB.toFixed(6)} | ${formatLift(delta.absoluteLift)} | ${formatLift(delta.relativeLift)} | ${pValue} | ${ci} |`;
  }).join('\n');

  const rationale = input.recommendation.rationale.map((line) => `- ${line}`).join('\n');
  const mandateRankingA = renderMandateRankingMarkdown(input.armA.mandateFailureDistribution);
  const mandateRankingB = renderMandateRankingMarkdown(input.armB.mandateFailureDistribution);

  return `# Experiment Report: ${input.definition.id}

## Hypothesis
${input.definition.title}

## Summary
- Scenario: ${input.definition.scenarioId}
- Modes: ${input.definition.victoryModes.join(', ')}
- Players: ${input.definition.playerCounts.join(', ')}
- Runs per arm: ${input.definition.runsPerArm}
- Seed: ${input.definition.seed}
- Decision: **${input.recommendation.decision}**

## Structural Rates
| Metric | Arm A | Arm B |
| --- | ---: | ---: |
| turnOnePublicVictoryRate | ${input.armA.turnOnePublicVictoryRate.toFixed(6)} | ${input.armB.turnOnePublicVictoryRate.toFixed(6)} |
| victoryBeforeAllowedRoundRate | ${input.armA.victoryBeforeAllowedRoundRate.toFixed(6)} | ${input.armB.victoryBeforeAllowedRoundRate.toFixed(6)} |
| earlyTerminationRate | ${input.armA.earlyTerminationRate.toFixed(6)} | ${input.armB.earlyTerminationRate.toFixed(6)} |

## Primary Metric
- Metric: ${input.definition.decisionRule.primary}
- Arm A: ${primary.armA.toFixed(6)} (${formatRate(primary.armA)})
- Arm B: ${primary.armB.toFixed(6)} (${formatRate(primary.armB)})
- Absolute lift: ${formatLift(primary.absoluteLift)}
- Relative lift: ${formatLift(primary.relativeLift)}
- p-value: ${primaryStats ? primaryStats.pValue.toFixed(6) : 'n/a'}
- CI (${input.comparison.confidence * 100}%): ${primaryStats ? `[${primaryStats.confidenceInterval.lower.toFixed(6)}, ${primaryStats.confidenceInterval.upper.toFixed(6)}]` : 'n/a'}

## Metrics
| Metric | Arm A | Arm B | Absolute Lift | Relative Lift | p-value | CI |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
${rows}

## Defeat Reasons
| Reason | Arm A | Arm B |
| --- | ---: | ---: |
| extraction_breach | ${input.armA.defeatReasons.extraction_breach} | ${input.armB.defeatReasons.extraction_breach} |
| comrades_exhausted | ${input.armA.defeatReasons.comrades_exhausted} | ${input.armB.defeatReasons.comrades_exhausted} |
| mandate_failure | ${input.armA.defeatReasons.mandate_failure} | ${input.armB.defeatReasons.mandate_failure} |
| sudden_death | ${input.armA.defeatReasons.sudden_death} | ${input.armB.defeatReasons.sudden_death} |

## 📊 Mandate Failure Ranking (Arm A)
${mandateRankingA}

## 📊 Mandate Failure Ranking (Arm B)
${mandateRankingB}

## Recommendation Rationale
${rationale}
`;
}

export function renderHtmlReport(input: {
  definition: ExperimentDefinition;
  armA: ExperimentArmSummary;
  armB: ExperimentArmSummary;
  comparison: MetricComparison;
  recommendation: ExperimentRecommendation;
}) {
  const metricRows = METRIC_KEYS.map((metric) => {
    const delta = input.comparison.metrics[metric];
    const stats = delta.proportionStats;
    const pValue = stats ? stats.pValue.toFixed(6) : '-';
    const ci = stats
      ? `[${stats.confidenceInterval.lower.toFixed(6)}, ${stats.confidenceInterval.upper.toFixed(6)}]`
      : '-';

    return `<tr><td>${metric}</td><td>${delta.armA.toFixed(6)}</td><td>${delta.armB.toFixed(6)}</td><td>${formatLift(delta.absoluteLift)}</td><td>${formatLift(delta.relativeLift)}</td><td>${pValue}</td><td>${ci}</td></tr>`;
  }).join('');

  const rationale = input.recommendation.rationale.map((line) => `<li>${line}</li>`).join('');
  const mandateRows = (distribution: MandateFailureDistribution[]) => (
    distribution.length === 0
      ? '<tr><td colspan="4">n/a</td></tr>'
      : distribution.map((entry) => `<tr><td>${entry.mandateId}</td><td>${formatRate(entry.failureRate)}</td><td>${formatRate(entry.successRate)}</td><td>${entry.attempts}</td></tr>`).join('')
  );

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Experiment Report ${input.definition.id}</title>
  <style>
    :root {
      color-scheme: light;
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    body {
      margin: 24px;
      color: #1a1a1a;
      background: #f7f8fb;
    }
    h1, h2 {
      margin: 0 0 12px;
    }
    .card {
      background: #fff;
      border: 1px solid #d9dde6;
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    th, td {
      border: 1px solid #d9dde6;
      padding: 8px;
      text-align: right;
    }
    th:first-child, td:first-child {
      text-align: left;
    }
    .decision {
      font-weight: 700;
      font-size: 18px;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Experiment Report: ${input.definition.id}</h1>
    <p>${input.definition.title}</p>
    <p class="decision">Decision: ${input.recommendation.decision}</p>
    <p>Scenario: ${input.definition.scenarioId} | Modes: ${input.definition.victoryModes.join(', ')} | Players: ${input.definition.playerCounts.join(', ')} | Runs/Arm: ${input.definition.runsPerArm}</p>
  </div>
  <div class="card">
    <h2>Structural Rates</h2>
    <table>
      <thead>
        <tr>
          <th>Metric</th>
          <th>Arm A</th>
          <th>Arm B</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>turnOnePublicVictoryRate</td><td>${input.armA.turnOnePublicVictoryRate.toFixed(6)}</td><td>${input.armB.turnOnePublicVictoryRate.toFixed(6)}</td></tr>
        <tr><td>victoryBeforeAllowedRoundRate</td><td>${input.armA.victoryBeforeAllowedRoundRate.toFixed(6)}</td><td>${input.armB.victoryBeforeAllowedRoundRate.toFixed(6)}</td></tr>
        <tr><td>earlyTerminationRate</td><td>${input.armA.earlyTerminationRate.toFixed(6)}</td><td>${input.armB.earlyTerminationRate.toFixed(6)}</td></tr>
      </tbody>
    </table>
  </div>
  <div class="card">
    <h2>Metrics</h2>
    <table>
      <thead>
        <tr>
          <th>Metric</th>
          <th>Arm A</th>
          <th>Arm B</th>
          <th>Abs Lift</th>
          <th>Rel Lift</th>
          <th>p-value</th>
          <th>CI</th>
        </tr>
      </thead>
      <tbody>${metricRows}</tbody>
    </table>
  </div>
  <div class="card">
    <h2>Recommendation Rationale</h2>
    <ul>${rationale}</ul>
  </div>
  <div class="card">
    <h2>📊 Mandate Failure Ranking (Arm A)</h2>
    <table>
      <thead>
        <tr>
          <th>Mandate</th>
          <th>Failure Rate</th>
          <th>Success Rate</th>
          <th>Attempts</th>
        </tr>
      </thead>
      <tbody>${mandateRows(input.armA.mandateFailureDistribution)}</tbody>
    </table>
  </div>
  <div class="card">
    <h2>📊 Mandate Failure Ranking (Arm B)</h2>
    <table>
      <thead>
        <tr>
          <th>Mandate</th>
          <th>Failure Rate</th>
          <th>Success Rate</th>
          <th>Attempts</th>
        </tr>
      </thead>
      <tbody>${mandateRows(input.armB.mandateFailureDistribution)}</tbody>
    </table>
  </div>
</body>
</html>`;
}

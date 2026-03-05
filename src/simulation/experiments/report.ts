import type { SimulationRecord } from '../types.ts';
import type { MandateFailureDistribution } from '../metrics/types.ts';
import type {
  Decision,
  ExperimentArm,
  ExperimentArmSummary,
  ExperimentDefinition,
  ExperimentMetricKey,
  ExperimentRecommendation,
  MetricComparison,
  MetricDelta,
  ProportionComparisonStats,
} from './types.ts';

const EPSILON = 1e-9;
const DEFAULT_CONFIDENCE: 0.9 | 0.95 | 0.99 = 0.95;
const DEFAULT_RESERVOIR_SIZE = 8192;

const METRIC_KEYS: ExperimentMetricKey[] = [
  'winRate',
  'publicVictoryRate',
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

export interface ArmAccumulator {
  arm: ExperimentArm;
  n: number;
  wins: number;
  publicVictories: number;
  publicVictoriesByRoundOne: number;
  mandateFailuresAmongPublic: number;
  totalTurns: number;
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
  reservoir: Reservoir;
  mandateFailureAsCostlyWin: boolean;
}

function nextUint(state: number) {
  let next = state === 0 ? 0x6d2b79f5 : state >>> 0;
  next = Math.imul(next ^ (next >>> 15), next | 1) >>> 0;
  next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
  return (next ^ (next >>> 14)) >>> 0;
}

function roundTo(value: number, digits = 6) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function ratio(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }
  return roundTo(numerator / denominator);
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

function metricValue(summary: ExperimentArmSummary, metric: ExperimentMetricKey): number {
  switch (metric) {
    case 'winRate':
      return summary.winRate;
    case 'publicVictoryRate':
      return summary.publicVictoryRate;
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
    wins: 0,
    publicVictories: 0,
    publicVictoriesByRoundOne: 0,
    mandateFailuresAmongPublic: 0,
    totalTurns: 0,
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
    reservoir: {
      capacity: Math.max(256, options?.reservoirSize ?? DEFAULT_RESERVOIR_SIZE),
      seen: 0,
      values: [],
      state: seed >>> 0,
    },
    mandateFailureAsCostlyWin: Boolean(options?.mandateFailureAsCostlyWin),
  };
}

export function ingestArmRecord(accumulator: ArmAccumulator, record: SimulationRecord) {
  accumulator.n += 1;
  accumulator.totalTurns += record.turnsPlayed;
  addToReservoir(accumulator.reservoir, record.turnsPlayed);

  const isMandateFailure = record.result.reason === 'mandate_failure';
  const scoredWin = record.result.type === 'victory' || (accumulator.mandateFailureAsCostlyWin && isMandateFailure);

  if (scoredWin) {
    accumulator.wins += 1;
  }

  if (record.publicVictoryAchieved) {
    accumulator.publicVictories += 1;
    if (record.turnsPlayed <= 1) {
      accumulator.publicVictoriesByRoundOne += 1;
    }
    if (record.mandateFailure) {
      accumulator.mandateFailuresAmongPublic += 1;
    }
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
}

export function finalizeArmSummary(accumulator: ArmAccumulator): ExperimentArmSummary {
  const medianTurns = percentile(accumulator.reservoir.values, 0.5);
  const p90Turns = percentile(accumulator.reservoir.values, 0.9);

  return {
    arm: accumulator.arm,
    n: accumulator.n,
    wins: accumulator.wins,
    winRate: ratio(accumulator.wins, accumulator.n),
    publicVictories: accumulator.publicVictories,
    publicVictoryRate: ratio(accumulator.publicVictories, accumulator.n),
    publicVictoriesByRoundOne: accumulator.publicVictoriesByRoundOne,
    turnOnePublicVictoryRate: ratio(accumulator.publicVictoriesByRoundOne, accumulator.n),
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
    reservoirSampleSize: accumulator.reservoir.values.length,
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
    if (metric === 'winRate') {
      proportionStats = compareProportions(armA.wins, armA.n, armB.wins, armB.n, confidence);
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

  const sampleSizeTooSmall = Math.min(comparison.nA, comparison.nB) < 1000;

  if (sampleSizeTooSmall) {
    rationale.push(`Sample size is below the minimum confidence floor (n<1000 per arm).`);
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

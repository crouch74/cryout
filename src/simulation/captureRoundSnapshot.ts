import type { EngineState } from '../engine/index.ts';
import { totalComrades, totalEvidence } from './invariants.ts';
import type { RoundSnapshot, SimulationRecord } from './types.ts';

const FRONT_ACTION_KEY_MAP = {
  organize: 'organize',
  investigate: 'investigate',
  launch_campaign: 'launchCampaign',
  build_solidarity: 'buildSolidarity',
  smuggle_evidence: 'smuggleEvidence',
  international_outreach: 'internationalOutreach',
  defend: 'defend',
} as const;

const CANONICAL_DOMAIN_ORDER: Array<keyof RoundSnapshot['domains']> = [
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
];

function createZeroActions(): RoundSnapshot['actions'] {
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

function collectActionTotals(state: EngineState) {
  const totals = createZeroActions();

  for (const event of state.eventLog) {
    if (event.sourceType !== 'action') {
      continue;
    }

    const key = FRONT_ACTION_KEY_MAP[event.sourceId as keyof typeof FRONT_ACTION_KEY_MAP];
    if (!key) {
      continue;
    }

    totals[key] += 1;
  }

  return totals;
}

function collectCampaignTotals(state: EngineState): RoundSnapshot['campaign'] {
  const totals: RoundSnapshot['campaign'] = {
    attempts: 0,
    success: 0,
    attentionFailures: 0,
    backlashFailures: 0,
  };

  for (const event of state.eventLog) {
    if (event.sourceType !== 'action' || event.sourceId !== 'launch_campaign' || !event.context?.roll) {
      continue;
    }

    totals.attempts += 1;
    if (event.context.roll.success) {
      totals.success += 1;
    }
    if (event.context.roll.outcomeBand === 'attention') {
      totals.attentionFailures += 1;
    }
    if (event.context.roll.outcomeBand === 'backlash') {
      totals.backlashFailures += 1;
    }
  }

  return totals;
}

function collectFronts(state: EngineState): RoundSnapshot['fronts'] {
  const fronts: RoundSnapshot['fronts'] = {};

  for (const [frontId, frontState] of Object.entries(state.regions)) {
    const comradesTotal = Object.values(frontState.comradesPresent).reduce((sum, value) => sum + value, 0);
    fronts[frontId] = {
      extraction: frontState.extractionTokens,
      comradesTotal,
      ...(frontState.defenseRating > 0 ? { defense: frontState.defenseRating } : {}),
    };
  }

  return fronts;
}

function collectDomains(state: EngineState): RoundSnapshot['domains'] {
  const domains: RoundSnapshot['domains'] = {};

  for (const domainId of CANONICAL_DOMAIN_ORDER) {
    const progress = state.domains[domainId]?.progress;
    if (typeof progress === 'number') {
      domains[domainId] = progress;
    }
  }

  return domains;
}

function collectResources(state: EngineState): RoundSnapshot['resources'] {
  return {
    totalComrades: totalComrades(state),
    totalEvidence: totalEvidence(state),
  };
}

export function captureRoundSnapshot(state: EngineState): RoundSnapshot {
  return {
    round: state.round,
    globalTracks: {
      globalGaze: state.globalGaze,
      warMachine: state.northernWarMachine,
    },
    domains: collectDomains(state),
    fronts: collectFronts(state),
    resources: collectResources(state),
    actions: collectActionTotals(state),
    campaign: collectCampaignTotals(state),
    escalationFlags: {
      extractionThresholdTriggered: Boolean(state.usedSystemEscalationTriggers.extraction_threshold),
      warMachineThresholdTriggered: Boolean(state.usedSystemEscalationTriggers.war_machine_threshold),
      globalGazeCollapse: Boolean(state.usedSystemEscalationTriggers.gaze_threshold || state.globalGaze <= 5),
    },
  };
}

export function convertRoundSnapshotsToTimeline(roundSnapshots: RoundSnapshot[]): NonNullable<SimulationRecord['timeline']> {
  return roundSnapshots.map((snapshot) => {
    const frontValues = Object.values(snapshot.fronts);
    const extractionSum = frontValues.reduce((sum, front) => sum + front.extraction, 0);
    const avgExtraction = frontValues.length > 0 ? Number((extractionSum / frontValues.length).toFixed(3)) : 0;

    const domainValues = Object.values(snapshot.domains).filter((value): value is number => typeof value === 'number');
    const domainsAverage = domainValues.length > 0
      ? Number((domainValues.reduce((sum, value) => sum + value, 0) / domainValues.length).toFixed(3))
      : 0;

    return {
      round: snapshot.round,
      globalGaze: snapshot.globalTracks.globalGaze,
      warMachine: snapshot.globalTracks.warMachine,
      avgExtraction,
      domainsAverage,
    };
  });
}

import type { CampaignModifierEntry, CampaignResolvedEventPayload, CompiledContent, StructuredEvent } from '../../engine/index.ts';
import {
  formatNumber,
  getLocaleDirection,
  localizeActionField,
  localizeDomainField,
  localizeRegionField,
  t,
} from '../../i18n/index.ts';

export interface PresentedCampaignResultLine {
  key: string;
  label: string;
  value: string;
}

export interface PresentedCampaignResult {
  actionLabel: string;
  title: string;
  description: string;
  continueLabel: string;
  skipLabel: string;
  regionLabel: string;
  domainLabel: string;
  seatLabel: string;
  resultLabel: string;
  resultValue: string;
  diceLabel: string;
  equationLabel: string;
  equationHelpLabel: string;
  equationHelpGlyph: string;
  equationSummary: string;
  equationTokens: string[];
  equationGeneralExplanation: string;
  equationSpecificExplanation: string;
  thresholdLabel: string;
  thresholdValue: string;
  modifiersLabel: string;
  modifiers: PresentedCampaignResultLine[];
  effectsLabel: string;
  effects: PresentedCampaignResultLine[];
  a11yLabel: string;
}

function isCampaignResolvedPayload(payload: StructuredEvent['payload']) {
  return payload.actionId === 'launch_campaign'
    && payload.diceKind === '2d6'
    && Array.isArray(payload.dice)
    && typeof payload.regionId === 'string'
    && typeof payload.domainId === 'string'
    && typeof payload.total === 'number';
}

export function getCampaignResolvedPayload(event: StructuredEvent): CampaignResolvedEventPayload | null {
  if (event.type !== 'ui.action.CAMPAIGN_RESOLVED' || !isCampaignResolvedPayload(event.payload)) {
    return null;
  }

  return event.payload as unknown as CampaignResolvedEventPayload;
}

function formatSigned(value: number) {
  if (value === 0) {
    return formatNumber(0);
  }

  return `${value > 0 ? '+' : ''}${formatNumber(value)}`;
}

function formatEquation(dice: [number, number], modifier: number, total: number) {
  if (modifier === 0) {
    return t('ui.campaignResult.equationWithoutModifier', '{{dieOne}} + {{dieTwo}} = {{total}}', {
      dieOne: dice[0],
      dieTwo: dice[1],
      total,
    });
  }

  return t('ui.campaignResult.equationWithModifier', '{{dieOne}} + {{dieTwo}} {{modifierOperator}} {{modifierValue}} = {{total}}', {
    dieOne: dice[0],
    dieTwo: dice[1],
    modifierOperator: modifier > 0 ? t('ui.campaignResult.plus', '+') : t('ui.campaignResult.minus', '-'),
    modifierValue: Math.abs(modifier),
    total,
  });
}

function buildEquationTokens(dice: [number, number], modifier: number, total: number) {
  const isRtl = getLocaleDirection() === 'rtl';
  const dieOne = formatNumber(dice[0]);
  const dieTwo = formatNumber(dice[1]);
  const totalValue = formatNumber(total);

  if (modifier === 0) {
    return isRtl
      ? [totalValue, '=', dieTwo, '+', dieOne]
      : [dieOne, '+', dieTwo, '=', totalValue];
  }

  const operator = modifier > 0 ? t('ui.campaignResult.plus', '+') : t('ui.campaignResult.minus', '-');
  const modifierValue = formatNumber(Math.abs(modifier));
  return isRtl
    ? [totalValue, '=', modifierValue, operator, dieTwo, '+', dieOne]
    : [dieOne, '+', dieTwo, operator, modifierValue, '=', totalValue];
}

function getModifierLabel(modifier: CampaignModifierEntry) {
  switch (modifier.source) {
    case 'committed_comrades':
      return t('ui.campaignResult.modifierCommittedComrades', 'Committed Comrades');
    case 'committed_evidence':
      return t('ui.campaignResult.modifierCommittedEvidence', 'Committed Evidence');
    case 'global_gaze':
      return t('ui.campaignResult.modifierGlobalGaze', 'Global Gaze');
    case 'war_machine':
      return t('ui.campaignResult.modifierWarMachine', 'War Machine');
    case 'home_region':
      return t('ui.campaignResult.modifierHomeRegion', 'Home-region strength');
    case 'faction_domain':
      return t('ui.campaignResult.modifierDomainAffinity', 'Domain affinity');
    case 'support':
      return t('ui.campaignResult.modifierSupport', 'Resistance support');
    case 'system_pressure':
      return t('ui.campaignResult.modifierSystemPressure', 'System pressure');
  }
}

function getOutcomeLabel(outcomeBand: CampaignResolvedEventPayload['outcomeBand']) {
  switch (outcomeBand) {
    case 'backlash':
      return t('ui.campaignResult.outcomeBacklash', 'Backlash');
    case 'attention':
      return t('ui.campaignResult.outcomeAttention', 'Setback');
    case 'success':
      return t('ui.campaignResult.outcomeSuccess', 'Success');
    case 'surge':
      return t('ui.campaignResult.outcomeSurge', 'Surge');
  }
}

function getOutcomeTitle(outcomeBand: CampaignResolvedEventPayload['outcomeBand']) {
  switch (outcomeBand) {
    case 'backlash':
      return t('ui.campaignResult.titleBacklash', 'The campaign meets the System’s reprisal.');
    case 'attention':
      return t('ui.campaignResult.titleAttention', 'The campaign falters, but the struggle is seen.');
    case 'success':
      return t('ui.campaignResult.titleSuccess', 'The campaign breaks open a line of advance.');
    case 'surge':
      return t('ui.campaignResult.titleSurge', 'The campaign surges and forces the System backward.');
  }
}

function getOutcomeDescription(outcomeBand: CampaignResolvedEventPayload['outcomeBand']) {
  switch (outcomeBand) {
    case 'backlash':
      return t('ui.campaignResult.descriptionBacklash', 'The threshold was not reached. The movement pays a price, yet the struggle continues beyond this blow.');
    case 'attention':
      return t('ui.campaignResult.descriptionAttention', 'The threshold was missed. Public attention shifts, but extraction remains in place and the movement regathers.');
    case 'success':
      return t('ui.campaignResult.descriptionSuccess', 'The threshold was reached. The movement secures real ground, though never without cost.');
    case 'surge':
      return t('ui.campaignResult.descriptionSurge', 'The threshold was exceeded with force. Extraction gives way and the campaign leaves the System reeling, for now.');
  }
}

export function presentCampaignResult(payload: CampaignResolvedEventPayload, content: CompiledContent): PresentedCampaignResult {
  const actionLabel = localizeActionField(payload.actionId, 'name', content.actions[payload.actionId].name);
  const regionLabel = localizeRegionField(payload.regionId, 'name', content.regions[payload.regionId].name);
  const domainLabel = localizeDomainField(payload.domainId, 'name', content.domains[payload.domainId].name, content.id);
  const modifiers = payload.modifiers.map((modifier, index) => ({
    key: `${modifier.source}:${index}`,
    label: getModifierLabel(modifier),
    value: formatSigned(modifier.value),
  }));

  if (modifiers.length === 0) {
    modifiers.push({
      key: 'none',
      label: t('ui.campaignResult.modifierNoneLabel', 'Modifier'),
      value: t('ui.campaignResult.modifierNoneValue', 'No shift'),
    });
  }

  const effects: PresentedCampaignResultLine[] = [];
  if ((payload.committedComrades ?? 0) > 0) {
    effects.push({
      key: 'committed-comrades',
      label: t('ui.campaignResult.effectCommittedComrades', 'Comrades committed'),
      value: t('ui.campaignResult.effectCommittedComradesValue', '-{{count}}', { count: payload.committedComrades ?? 0 }),
    });
  }
  if ((payload.committedEvidence ?? 0) > 0) {
    effects.push({
      key: 'committed-evidence',
      label: t('ui.campaignResult.effectCommittedEvidence', 'Evidence committed'),
      value: t('ui.campaignResult.effectCommittedEvidenceValue', '-{{count}}', { count: payload.committedEvidence ?? 0 }),
    });
  }
  if (payload.extractionRemoved > 0) {
    effects.push({
      key: 'extraction',
      label: t('ui.campaignResult.effectExtractionRemoved', 'Extraction Tokens removed'),
      value: t('ui.campaignResult.effectExtractionRemovedValue', '-{{count}}', { count: payload.extractionRemoved }),
    });
  }
  if (payload.domainDelta !== 0) {
    effects.push({
      key: 'domain',
      label: t('ui.campaignResult.effectDomainShift', '{{domain}} advanced', { domain: domainLabel }),
      value: formatSigned(payload.domainDelta),
    });
  }
  if (payload.globalGazeDelta !== 0) {
    effects.push({
      key: 'gaze',
      label: t('ui.campaignResult.effectGlobalGaze', 'Global Gaze shifted'),
      value: formatSigned(payload.globalGazeDelta),
    });
  }
  if (payload.warMachineDelta !== 0) {
    effects.push({
      key: 'war-machine',
      label: t('ui.campaignResult.effectWarMachine', 'War Machine shifted'),
      value: formatSigned(payload.warMachineDelta),
    });
  }
  if (effects.length === 0) {
    effects.push({
      key: 'none',
      label: t('ui.campaignResult.effectNoneLabel', 'Board consequence'),
      value: t('ui.campaignResult.effectNoneValue', 'No further shift'),
    });
  }

  const equationSummary = formatEquation(payload.dice, payload.modifier, payload.total);
  const specificModifierSummary = payload.modifiers.length > 0
    ? payload.modifiers
      .map((modifier) => t('ui.campaignResult.specificModifierEntry', '{{label}} {{value}}', {
        label: getModifierLabel(modifier),
        value: formatSigned(modifier.value),
      }))
      .join(t('ui.campaignResult.listSeparator', ' • '))
    : t('ui.campaignResult.modifierNoneValue', 'No shift');

  return {
    actionLabel,
    title: getOutcomeTitle(payload.outcomeBand),
    description: getOutcomeDescription(payload.outcomeBand),
    continueLabel: t('ui.campaignResult.continue', 'Continue'),
    skipLabel: t('ui.campaignResult.skipAnimation', 'Skip roll animation'),
    regionLabel,
    domainLabel,
    seatLabel: t('ui.game.seat', 'Seat {{seat}}', { seat: payload.seat + 1 }),
    resultLabel: t('ui.campaignResult.resultLabel', 'Outcome'),
    resultValue: getOutcomeLabel(payload.outcomeBand),
    diceLabel: t('ui.campaignResult.diceLabel', 'Dice Result'),
    equationLabel: t('ui.campaignResult.equationLabel', 'Roll Equation'),
    equationHelpLabel: t('ui.campaignResult.equationHelpLabel', 'What does this equation mean?'),
    equationHelpGlyph: getLocaleDirection() === 'rtl' ? '؟' : '?',
    equationSummary,
    equationTokens: buildEquationTokens(payload.dice, payload.modifier, payload.total),
    equationGeneralExplanation: t(
      'ui.campaignResult.equationGeneralExplanation',
      'Launch Campaign adds the dice result to all campaign bonuses and penalties, then compares that final total to the threshold.',
    ),
    equationSpecificExplanation: t(
      'ui.campaignResult.equationSpecificExplanation',
      'Here the dice showed {{dieOne}} and {{dieTwo}}. The total modifier was {{modifier}}, coming from {{modifiers}}. That produced {{total}} against the threshold of {{target}}+.',
      {
        dieOne: payload.dice[0],
        dieTwo: payload.dice[1],
        modifier: formatSigned(payload.modifier),
        modifiers: specificModifierSummary,
        total: payload.total,
        target: payload.target,
      },
    ),
    thresholdLabel: t('ui.campaignResult.thresholdLabel', 'Threshold'),
    thresholdValue: t('ui.campaignResult.thresholdValue', '{{target}}+', { target: payload.target }),
    modifiersLabel: t('ui.campaignResult.modifiersLabel', 'Modifiers Applied'),
    modifiers,
    effectsLabel: t('ui.campaignResult.effectsLabel', 'Effects Applied'),
    effects,
    a11yLabel: t('ui.campaignResult.a11yLabel', '{{action}} resolved in {{region}}.', {
      action: actionLabel,
      region: regionLabel,
    }),
  };
}

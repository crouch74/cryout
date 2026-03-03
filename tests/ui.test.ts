import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildEffectPreview,
  compileContent,
  getPlayerBodyTotal,
  getSeatDisabledReason,
  getVictoryModeSummary,
  initializeGame,
  listRulesets,
  type EngineCommand,
} from '../engine/index.ts';
import {
  changeLocale,
  formatNumber,
  formatTrackFraction,
  getLocaleDirection,
  getLocaleOptions,
  t,
} from '../src/i18n/index.ts';
import { localizeDisabledReason, presentHistoryEvent, presentTerminalOutcome } from '../src/mvp/historyPresentation.ts';
import type { DomainEvent } from '../engine/index.ts';
import {
  getActionDockItems,
  buildIntentPreview,
  getFrontTrackRows,
  GAME_A11Y_LABELS,
  getActiveCoalitionSeat,
  getDeckSummaries,
  getNextUnfinishedCoalitionSeat,
  getPhasePresentation,
  getPhaseProgressSteps,
  getPlayerStripSummary,
  getRegionDangerState,
  getStatusRibbonItems,
  getToastRole,
  getTrackPresentation,
} from '../src/mvp/gameUiHelpers.ts';
import { DEFAULT_GAME_VIEW_STATE } from '../src/mvp/urlState.ts';

const startCommand: Extract<EngineCommand, { type: 'StartGame' }> = {
  type: 'StartGame',
  rulesetId: 'base_design',
  mode: 'LIBERATION',
  humanPlayerCount: 2,
  seatFactionIds: ['congo_basin_collective', 'levant_sumud', 'mekong_echo_network', 'amazon_guardians'],
  seatOwnerIds: [0, 0, 1, 1],
  seed: 8080,
};

test('disabled reason explains phase gating and body requirements', () => {
  const content = compileContent(startCommand.rulesetId);
  const state = initializeGame(startCommand);

  const systemReason = getSeatDisabledReason(state, content, 0, { actionId: 'organize', regionId: 'Congo' });
  assert.equal(systemReason.disabled, true);
  assert.equal(systemReason.reasonCode, 'phase_locked');
  assert.equal(systemReason.reason, 'Phase locked');

  state.phase = 'COALITION';
  state.regions.Congo.bodiesPresent[0] = 0;
  const solidarityReason = getSeatDisabledReason(state, content, 0, { actionId: 'build_solidarity', regionId: 'Congo', domainId: 'DyingPlanet' });
  assert.equal(solidarityReason.disabled, true);
  assert.equal(solidarityReason.reasonCode, 'need_three_bodies');
  assert.equal(solidarityReason.reason, 'Need 3 Comrades in region');
});

test('history presenter localizes reveal details and disabled reasons', async () => {
  const content = compileContent(startCommand.rulesetId);
  const revealEvent: DomainEvent = {
    seq: 1,
    round: 1,
    phase: 'SYSTEM',
    sourceType: 'action',
    sourceId: 'investigate',
    emoji: '🃏',
    message: '',
    causedBy: ['investigate'],
    deltas: [],
    trace: [],
    context: {
      actingSeat: 0,
      targetRegionId: 'Congo',
      cardReveals: [
        {
          deckId: 'resistance',
          cardId: 'res_archive_leak',
          destination: 'discard',
          seat: 0,
          public: true,
          origin: 'investigate',
        },
      ],
    },
  };

  await changeLocale('en');
  const english = presentHistoryEvent(revealEvent, content);
  assert.equal(english.title, '🃏 Seat 1 drew a resistance card.');
  assert.equal(english.cardReveals[0]?.title, 'Archive Leak');
  assert.match(english.cardReveals[0]?.body ?? '', /Global Gaze/);
  assert.equal(localizeDisabledReason({ reasonCode: 'need_three_bodies' }), 'Need 3 Comrades in region');

  await changeLocale('ar-EG');
  const arabic = presentHistoryEvent(revealEvent, content);
  assert.match(arabic.title, /المقعد/);
  assert.match(arabic.cardReveals[0]?.body ?? '', /النظرة العالمية/);
  assert.match(localizeDisabledReason({ reasonCode: 'need_three_bodies' }) ?? '', /الرفاق/);

  await changeLocale('en');
});

test('history presenter labels startup withdrawals distinctly from later draws', () => {
  const content = compileContent(startCommand.rulesetId);
  const startupEvent: DomainEvent = {
    seq: 1,
    round: 1,
    phase: 'SYSTEM',
    sourceType: 'card',
    sourceId: 'res_archive_leak',
    emoji: '🃏',
    message: 'Archive Leak: Raise Global Gaze by 1 and gain 1 Evidence.',
    causedBy: ['StartGame', 'startup_withdrawal', 'res_archive_leak'],
    deltas: [
      { kind: 'track', label: 'globalGaze', before: 5, after: 6 },
      { kind: 'evidence', label: 'seat:0:evidence', before: 1, after: 2 },
      { kind: 'card', label: 'resistance:discard', before: 0, after: 1 },
    ],
    trace: [],
    context: {
      actingSeat: 0,
      targetRegionId: 'Congo',
      sourceDeckId: 'resistance',
      cardReveals: [
        {
          deckId: 'resistance',
          cardId: 'res_archive_leak',
          destination: 'discard',
          seat: 0,
          public: true,
          origin: 'startup_withdrawal',
        },
      ],
    },
  };

  const presented = presentHistoryEvent(startupEvent, content);

  assert.equal(presented.title, '🃏 Seat 1 withdrew a startup resistance card.');
  assert.equal(presented.cardReveals[0]?.title, 'Archive Leak');
  assert.match(presented.cardReveals[0]?.body ?? '', /Global Gaze/);
  assert.equal(presented.deltas.some((delta) => /Global Gaze/.test(delta.label)), true);
});

test('selectors expose useful copy for the new ruleset', () => {
  const content = compileContent(startCommand.rulesetId);
  const state = initializeGame(startCommand);

  assert.match(getVictoryModeSummary('LIBERATION'), /Extraction Token|Extraction/i);
  assert.equal(getPlayerBodyTotal(state, 0) > 0, true);
  assert.match(buildEffectPreview(content.actions.launch_campaign), /2d6 campaign/i);
});

test('phase progress helper marks the active step for the cutover loop', () => {
  const steps = getPhaseProgressSteps('COALITION');

  assert.equal(steps.length, 3);
  assert.equal(steps[1]?.step, 'COALITION');
  assert.equal(steps[1]?.state, 'active');
  assert.equal(steps[0]?.state, 'complete');
  assert.equal(steps[1]?.verb, 'Organizes');
});

test('phase and preview helpers expose calibrated presentation copy', () => {
  const content = compileContent(startCommand.rulesetId);
  const state = initializeGame(startCommand);
  state.phase = 'COALITION';
  const phase = getPhasePresentation('COALITION');
  const tracks = getTrackPresentation(state);
  const ribbon = getStatusRibbonItems(state, content);
  const fronts = getFrontTrackRows(state, content);
  const dock = getActionDockItems(state, content, 0);
  const strip = getPlayerStripSummary(state.players[0], content, state);
  const preview = buildIntentPreview(
    { actionId: 'launch_campaign', regionId: 'Congo', domainId: 'WarMachine', bodiesCommitted: 2, evidenceCommitted: 1 },
    content.actions.launch_campaign,
    state,
    content,
    0,
  );

  assert.equal(phase.verb, 'Organizes');
  assert.equal(tracks.globalGaze.max, 20);
  assert.equal(tracks.northernWarMachine.max, 12);
  assert.equal(ribbon.some((item) => item.id === 'globalGaze'), true);
  assert.equal(fronts.length, 7);
  assert.equal(dock.some((item) => item.actionId === 'organize'), true);
  assert.match(strip.mandateTitle, /Forest|Siege|River|Sacrifice/i);
  assert.equal(preview.some((chip) => chip.tone === 'risk'), true);
  assert.equal(preview.some((chip) => chip.tone === 'benefit'), true);
});

test('region danger states escalate by extraction thresholds', () => {
  assert.equal(getRegionDangerState(2).tone, 'safe');
  assert.equal(getRegionDangerState(4).tone, 'strained');
  assert.equal(getRegionDangerState(5).pulsing, true);
  assert.equal(getRegionDangerState(6).tone, 'breach');
});

test('active coalition seat advances to the first seat that still has work', () => {
  const state = initializeGame(startCommand);
  state.phase = 'COALITION';

  assert.equal(getActiveCoalitionSeat(state.players), 0);
  state.players[0].ready = true;
  state.players[0].actionsRemaining = 0;
  assert.equal(getActiveCoalitionSeat(state.players), 1);
});

test('deck summaries and next unfinished seat helpers track the visible table state', () => {
  const content = compileContent(startCommand.rulesetId);
  const state = initializeGame(startCommand);
  const summaries = getDeckSummaries(state, content);

  assert.equal(summaries.length, 3);
  assert.equal(summaries.some((summary) => summary.deckId === 'system'), true);
  assert.equal(summaries.some((summary) => summary.deckId === 'crisis'), true);
  assert.equal(summaries.some((summary) => summary.deckId === 'resistance' && summary.discardCount >= state.players.length), true);

  state.phase = 'COALITION';
  state.players[0].actionsRemaining = 0;
  state.players[0].ready = true;
  assert.equal(getNextUnfinishedCoalitionSeat(state.players, 0), 1);
  state.players[1].ready = true;
  state.players[1].actionsRemaining = 0;
  assert.equal(getNextUnfinishedCoalitionSeat(state.players, 1), 2);
});

test('game screen source keeps the compressed board layout contract', () => {
  const source = readFileSync(new URL('../src/mvp/GameScreen.tsx', import.meta.url), 'utf8');

  assert.match(source, /<header/);
  assert.match(source, /<main/);
  assert.match(source, /<aside/);
  assert.match(source, /StatusRibbon/);
  assert.match(source, /PhaseProgress/);
  assert.match(source, /ActionDock/);
  assert.match(source, /ContextPanel/);
  assert.match(source, /DeckStack/);
  assert.match(source, /decksContent/);
  assert.match(source, /deck-reveal-overlay/);
  assert.match(source, /activeBeaconObjectives/);
  assert.match(source, /visual-delta-strip/);
  assert.match(source, /activeHelpContent/);
  assert.match(source, /externalHighlightKeys/);
  assert.match(source, /getNextUnfinishedCoalitionSeat/);
  assert.match(source, /FrontTrackBar/);
  assert.match(source, /Commit Prepared Moves/);
  assert.match(source, /QueueIntent/);
  assert.match(source, /debugLayout=\{devMode\}/);
  assert.match(source, /advancePhase/);
  assert.match(source, /aria-label=\{phaseActionLabel\}/);
  assert.match(source, /onPointerDownCapture=\{handleEmptySpacePointerDown\}/);
  assert.match(source, /suspendHighlights=\{highlightSuspended\}/);
  assert.match(source, /TerminalOutcomeModal/);
  assert.doesNotMatch(source, /phase-brief-grid/);
  assert.doesNotMatch(source, /whyBoardShifted/);
  assert.doesNotMatch(source, /<footer/);
});

test('terminal presenter builds contextual victory and defeat summaries', () => {
  const content = compileContent(startCommand.rulesetId);
  const victoryState = initializeGame(startCommand);
  victoryState.phase = 'WIN';
  victoryState.terminalOutcome = {
    kind: 'victory',
    cause: 'liberation',
    title: 'Victory',
    summary: 'Liberation achieved.',
    round: 4,
    triggeredByEventSeq: 99,
  };

  const victory = presentTerminalOutcome(victoryState, content);
  assert.equal(victory?.title, 'Victory');
  assert.match(victory?.reasonLabel ?? '', /liberation opening/i);
  assert.equal(victory?.feedbackLines.some((line) => /Global Gaze/.test(line)), true);
  assert.equal(victory?.feedbackLines.some((line) => /War Machine/.test(line)), true);
  assert.equal(victory?.feedbackLines.some((line) => /Extraction Tokens/.test(line)), true);
  assert.equal(victory?.feedbackLines.some((line) => /Secret Mandate/.test(line)), true);

  const defeatState = initializeGame(startCommand);
  defeatState.phase = 'LOSS';
  defeatState.regions.Levant.extractionTokens = 6;
  defeatState.terminalOutcome = {
    kind: 'defeat',
    cause: 'extraction_breach',
    title: 'Defeat',
    summary: 'Levant reached 6 Extraction Tokens.',
    round: 3,
    triggeredByEventSeq: 55,
    breachedRegionId: 'Levant',
  };

  const defeat = presentTerminalOutcome(defeatState, content);
  assert.equal(defeat?.title, 'Defeat');
  assert.match(defeat?.reasonLabel ?? '', /Levant/);
  assert.match(defeat?.reasonLabel ?? '', /6 Extraction Tokens/);
});

test('terminal presenter names mandate failure explicitly', () => {
  const content = compileContent(startCommand.rulesetId);
  const state = initializeGame(startCommand);
  state.phase = 'LOSS';
  state.terminalOutcome = {
    kind: 'defeat',
    cause: 'mandate_failure',
    title: 'Defeat',
    summary: 'Public victory was reached, but 2 Secret Mandates failed.',
    round: 5,
    triggeredByEventSeq: 77,
    failedMandateIds: ['mandate_a', 'mandate_b'],
    failedMandateSeatIds: [0, 1],
  };

  const presented = presentTerminalOutcome(state, content);

  assert.match(presented?.reasonLabel ?? '', /Secret Mandates/i);
  assert.equal(presented?.feedbackLines.some((line) => /Secret Mandate/.test(line)), true);
});

test('terminal modal source renders canonical final-state labels and actions', () => {
  const source = readFileSync(new URL('../src/mvp/TerminalOutcomeModal.tsx', import.meta.url), 'utf8');

  assert.match(source, /Global Gaze/);
  assert.match(source, /War Machine/);
  assert.match(source, /Extraction Tokens/);
  assert.match(source, /Secret Mandates/);
  assert.match(source, /Review Ledger/);
  assert.match(source, /Export Save/);
  assert.match(source, /Back Home/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
});

test('phase progress source keeps the active question-mark help affordance', () => {
  const source = readFileSync(new URL('../src/mvp/PhaseProgress.tsx', import.meta.url), 'utf8');

  assert.match(source, /activeHelpContent/);
  assert.match(source, /activeHint/);
  assert.match(source, /phase-help-trigger/);
  assert.match(source, /phase-progress-help-popover/);
  assert.match(source, /aria-expanded/);
});

test('world map source renders the launch campaign dice overlay on the active board', () => {
  const source = readFileSync(new URL('../src/mvp/WorldMapBoard.tsx', import.meta.url), 'utf8');

  assert.match(source, /campaign-roll-overlay/);
  assert.match(source, /campaign-roll-overlay-dice/);
  assert.match(source, /Launch Campaign/);
  assert.match(source, /campaignRoll/);
  assert.match(source, /board-region-clusters/);
  assert.match(source, /board-region-token-container/);
  assert.match(source, /data-region-changing/);
  assert.match(source, /data-token-changing/);
  assert.doesNotMatch(source, /createRandom/);
});

test('default game view state is simplified for the cutover shell', () => {
  assert.equal(DEFAULT_GAME_VIEW_STATE.focusedSeat, 0);
  assert.equal(DEFAULT_GAME_VIEW_STATE.regionId, null);
  assert.equal(DEFAULT_GAME_VIEW_STATE.eventSeq, null);
});

test('route screens point at the cutover guides and setup shell', () => {
  const home = readFileSync(new URL('../src/mvp/HomeScreen.tsx', import.meta.url), 'utf8');
  const guidelines = readFileSync(new URL('../src/mvp/GuidelinesScreen.tsx', import.meta.url), 'utf8');
  const playerGuide = readFileSync(new URL('../src/mvp/PlayerGuideScreen.tsx', import.meta.url), 'utf8');

  assert.match(home, /Campaign Briefing|Human Players/);
  assert.match(guidelines, /ui\.guide\.victoryModes|Victory Modes/);
  assert.match(playerGuide, /ui\.guide\.coalitionFieldNotes|Coalition Field Notes/);
});

test('toast helpers keep live-region metadata and role semantics', () => {
  assert.equal(GAME_A11Y_LABELS.liveUpdates, 'Live game updates');
  assert.equal(getToastRole('success'), 'status');
  assert.equal(getToastRole('error'), 'alert');
});

function flattenCatalogKeys(value: unknown, path = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return path ? [path] : [];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    const next = path ? `${path}.${key}` : key;
    return flattenCatalogKeys(child, next);
  });
}

test('Arabic catalog stays key-complete and localizes canonical mechanic names', () => {
  const enCatalog = JSON.parse(readFileSync(new URL('../src/i18n/en.json', import.meta.url), 'utf8')) as Record<string, unknown>;
  const arCatalog = JSON.parse(readFileSync(new URL('../src/i18n/ar-EG.json', import.meta.url), 'utf8')) as Record<string, unknown>;
  const englishKeys = new Set(flattenCatalogKeys(enCatalog));
  const arabicKeys = new Set(flattenCatalogKeys(arCatalog));
  const requiredUiHomeKeys = ['ui.home.humanPlayerCount', 'ui.home.factionSeatCount', 'ui.home.playerSeatGroup'];

  assert.equal(requiredUiHomeKeys.every((key) => englishKeys.has(key) && arabicKeys.has(key)), true);

  const arUi = arCatalog.ui as Record<string, Record<string, string>>;
  assert.equal(arUi.game.bodies, 'الرفاق');
  assert.equal(arUi.game.evidence, 'الأدلة');
  assert.equal(arUi.game.extractionTokens, 'رموز الاستخراج');
  assert.equal(arUi.game.globalGaze, 'النظرة العالمية');
  assert.equal(arUi.game.northernWarMachine, 'آلة الحرب');
  assert.equal(arUi.game.domains, 'المجالات');
  assert.equal(arUi.game.secretMandate, 'التكليف السري');
});

test('catalog parity holds and orphaned legacy sections are removed', () => {
  const enCatalog = JSON.parse(readFileSync(new URL('../src/i18n/en.json', import.meta.url), 'utf8')) as Record<string, any>;
  const arCatalog = JSON.parse(readFileSync(new URL('../src/i18n/ar-EG.json', import.meta.url), 'utf8')) as Record<string, any>;
  const englishKeys = new Set(flattenCatalogKeys(enCatalog));
  const arabicKeys = new Set(flattenCatalogKeys(arCatalog));

  assert.deepEqual([...englishKeys].filter((key) => !arabicKeys.has(key)), []);
  assert.deepEqual([...arabicKeys].filter((key) => !englishKeys.has(key)), []);
  assert.equal('legacyLanding' in enCatalog.ui, false);
  assert.equal('legacyDashboard' in enCatalog.ui, false);
  assert.equal('legacyLanding' in arCatalog.ui, false);
  assert.equal('legacyDashboard' in arCatalog.ui, false);
});

test('all shipped rulesets and cards have localization entries in both catalogs', () => {
  const enCatalog = JSON.parse(readFileSync(new URL('../src/i18n/en.json', import.meta.url), 'utf8')) as Record<string, any>;
  const arCatalog = JSON.parse(readFileSync(new URL('../src/i18n/ar-EG.json', import.meta.url), 'utf8')) as Record<string, any>;
  const enCards = enCatalog.content.cards as Record<string, unknown>;
  const arCards = arCatalog.content.cards as Record<string, unknown>;
  const enRulesets = enCatalog.content.rulesets as Record<string, unknown>;
  const arRulesets = arCatalog.content.rulesets as Record<string, unknown>;

  for (const ruleset of listRulesets()) {
    assert.equal(typeof enRulesets[ruleset.id], 'object', `Missing English ruleset localization for ${ruleset.id}`);
    assert.equal(typeof arRulesets[ruleset.id], 'object', `Missing Arabic ruleset localization for ${ruleset.id}`);

    const content = compileContent(ruleset.id);
    for (const cardId of Object.keys(content.cards)) {
      assert.equal(typeof enCards[cardId], 'object', `Missing English card localization for ${cardId}`);
      assert.equal(typeof arCards[cardId], 'object', `Missing Arabic card localization for ${cardId}`);
    }
  }
});

test('known hardcoded localization regressions stay out of UI and engine sources', () => {
  const files = [
    '../engine/selectors.ts',
    '../engine/runtime.ts',
    '../src/mvp/gameUiHelpers.ts',
    '../src/mvp/HomeScreen.tsx',
  ];
  const bannedLiterals = [
    'Resolve the system strike and military backlash.',
    'Queue two moves per seat, then mark every seat ready.',
    'Resolve the prepared moves, then check victory and defeat.',
    'The coalition achieved its win condition.',
    'The coalition failed the struggle.',
    'No domain selected.',
    'No region selected.',
    'Draw handled by helper trace.',
    'Schoolgirl Network',
    'Compose Chant',
    'Diaspora Fundraise',
    'Media Blitz',
    'Sanctions Push',
    'Raise Global Gaze by spreading truth.',
    'Reduce War Machine through international pressure.',
  ];

  for (const file of files) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    for (const literal of bannedLiterals) {
      assert.equal(source.includes(literal), false, `Unexpected hardcoded literal in ${file}: ${literal}`);
    }
  }
});

test('track fractions invert order in RTL while keeping Arabic-Indic numerals', async () => {
  await changeLocale('en');
  assert.equal(formatTrackFraction(5, 20), '5/20');

  await changeLocale('ar-EG');
  assert.equal(formatTrackFraction(5, 20), '٢٠/٥');
  assert.equal(formatTrackFraction(7, 12), '١٢/٧');

  await changeLocale('en');
});

test('locale direction stays aligned with the supported locales', () => {
  assert.equal(getLocaleDirection('en'), 'ltr');
  assert.equal(getLocaleDirection('ar-EG'), 'rtl');
});

test('locale options localize their labels under each active locale', async () => {
  await changeLocale('en');
  assert.deepEqual(getLocaleOptions(), [
    { value: 'en', label: 'English' },
    { value: 'ar-EG', label: 'Egyptian Arabic' },
  ]);

  await changeLocale('ar-EG');
  assert.deepEqual(getLocaleOptions(), [
    { value: 'en', label: 'الإنجليزية' },
    { value: 'ar-EG', label: 'العربية المصرية' },
  ]);

  await changeLocale('en');
});

test('changing locale updates translated text and number formatting in one flow', async () => {
  await changeLocale('en');
  assert.equal(t('ui.language.label', 'Language'), 'Language');
  assert.equal(formatNumber(12), '12');

  await changeLocale('ar-EG');
  assert.equal(t('ui.language.label', 'Language'), 'اللغة');
  assert.equal(formatNumber(12), '١٢');

  await changeLocale('en');
});

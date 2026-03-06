import { useMemo, useState, type CSSProperties } from 'react';
import { compileContent, initializeGame } from '../../../engine/index.ts';
import { GameSessionScreen } from '../../../game/screens/GameSessionScreen.tsx';
import type { SessionViewport } from '../../session-setup/model/sessionTypes.ts';
import { t, useAppLocale } from '../../../i18n/index.ts';
import { Icon } from '../../../ui/icon/Icon.tsx';
import { GameIcon } from '../../../ui/icon/GameIcon.tsx';
import { EngravedHeader, PaperSheet, TableSurface, ThemePlate } from '../../../ui/layout/tabletop.tsx';

interface BoardTourScreenProps {
  onBackHome: () => void;
  onOpenOffline: () => void;
}

interface BoardTourStep {
  id: string;
}

interface BoardTourAnchor {
  pointerX: number;
  pointerY: number;
  bubbleOffsetX: number;
  bubbleOffsetY: number;
}

const BOARD_TOUR_ANCHORS: Record<string, BoardTourAnchor> = {
  mapRegions: { pointerX: 45, pointerY: 48, bubbleOffsetX: -18, bubbleOffsetY: -22 },
  extractionTokens: { pointerX: 65, pointerY: 46, bubbleOffsetX: 6, bubbleOffsetY: -22 },
  globalGaze: { pointerX: 13, pointerY: 11, bubbleOffsetX: 8, bubbleOffsetY: 10 },
  warMachine: { pointerX: 25, pointerY: 11, bubbleOffsetX: 8, bubbleOffsetY: 10 },
  domains: { pointerX: 38, pointerY: 11, bubbleOffsetX: 8, bubbleOffsetY: 10 },
  playerStrip: { pointerX: 68, pointerY: 11, bubbleOffsetX: -16, bubbleOffsetY: 10 },
  actionDock: { pointerX: 27, pointerY: 85, bubbleOffsetX: 8, bubbleOffsetY: -18 },
  decks: { pointerX: 84, pointerY: 84, bubbleOffsetX: -20, bubbleOffsetY: -16 },
  beacons: { pointerX: 84, pointerY: 70, bubbleOffsetX: -20, bubbleOffsetY: -16 },
  secretMandates: { pointerX: 58, pointerY: 11, bubbleOffsetX: -18, bubbleOffsetY: 10 },
  terminalWarnings: { pointerX: 48, pointerY: 56, bubbleOffsetX: -12, bubbleOffsetY: -22 },
};

const BOARD_CONTENT = compileContent('stones_cry_out');
const BOARD_STATE = initializeGame({
  type: 'StartGame',
  rulesetId: BOARD_CONTENT.ruleset.id,
  mode: 'LIBERATION',
  secretMandates: 'enabled',
  humanPlayerCount: 4,
  seatFactionIds: BOARD_CONTENT.ruleset.factions.map((faction) => faction.id),
  seatOwnerIds: [0, 1, 2, 3],
  seed: 19790125,
});

const TOUR_PREVIEW_STATE: typeof BOARD_STATE = {
  ...BOARD_STATE,
  round: 2,
  commandLog: [],
};

const BOARD_TOUR_STEPS: BoardTourStep[] = [
  { id: 'mapRegions' },
  { id: 'extractionTokens' },
  { id: 'globalGaze' },
  { id: 'warMachine' },
  { id: 'domains' },
  { id: 'playerStrip' },
  { id: 'actionDock' },
  { id: 'decks' },
  { id: 'beacons' },
  { id: 'secretMandates' },
  { id: 'terminalWarnings' },
];

export function BoardTourScreen({ onBackHome, onOpenOffline }: BoardTourScreenProps) {
  const { dir } = useAppLocale();
  const [stepIndex, setStepIndex] = useState(0);
  const [viewState, setViewState] = useState<SessionViewport>({
    focusedSeat: 0,
    regionId: null,
    eventSeq: null,
  });
  const step = BOARD_TOUR_STEPS[stepIndex];

  const progress = useMemo(
    () => `${stepIndex + 1} / ${BOARD_TOUR_STEPS.length}`,
    [stepIndex],
  );

  const stepTitle = t(`ui.guide.boardTourSteps.${step.id}.title`, step.id);
  const stepWhat = t(`ui.guide.boardTourSteps.${step.id}.what`, '');
  const stepHow = t(`ui.guide.boardTourSteps.${step.id}.how`, '');
  const stepWatch = t(`ui.guide.boardTourSteps.${step.id}.watch`, '');
  const anchor = BOARD_TOUR_ANCHORS[step.id] ?? BOARD_TOUR_ANCHORS.mapRegions;
  const overlayStyle = {
    '--tour-pointer-x': `${anchor.pointerX}%`,
    '--tour-pointer-y': `${anchor.pointerY}%`,
    '--tour-bubble-offset-x': `${anchor.bubbleOffsetX}%`,
    '--tour-bubble-offset-y': `${anchor.bubbleOffsetY}%`,
  } as CSSProperties;
  const previousChevronClass = `shell-chevron ${dir === 'rtl' ? 'is-right' : 'is-left'}`;
  const nextChevronClass = `shell-chevron ${dir === 'rtl' ? 'is-left' : 'is-right'}`;

  return (
    <TableSurface className="guide-table board-tour-table shell-table shell-depth-surface">
      <PaperSheet tone="board" className="shell-board shell-surface shell-surface-focus">
        <EngravedHeader
          eyebrow={t('ui.guide.boardTour', 'Board Tour')}
          title={t('ui.guide.boardTourTitle', 'Read the table before it breaks')}
          detail={t('ui.guide.boardTourDetail', 'Each panel explains what a board component means, how to use it, and what danger signals to monitor.')}
          actions={
            <div className="header-action-plates shell-actions">
              <ThemePlate
                size="sm"
                variant="utility"
                label={(
                  <span className="plate-label-with-icon">
                    <GameIcon name="home" size="xs" ariaLabel={t('ui.guide.backHome', 'Back Home')} />
                    <span>{t('ui.guide.backHome', 'Back Home')}</span>
                  </span>
                )}
                onClick={onBackHome}
              />
              <ThemePlate
                size="sm"
                variant="primary"
                label={(
                  <span className="plate-label-with-icon">
                    <GameIcon name="launchCampaign" size="xs" ariaLabel={t('ui.guide.openTable', 'Open Table')} />
                    <span>{t('ui.guide.openTable', 'Open Table')}</span>
                  </span>
                )}
                onClick={onOpenOffline}
              />
            </div>
          }
        />

        <div className="board-tour-stage">
          <PaperSheet tone="tray" className="board-tour-sequence-card shell-card shell-surface-note">
            <div className="board-tour-sequence-head">
              <span className="engraved-eyebrow shell-title-row"><Icon type="objective" size="xs" ariaLabel={t('ui.guide.boardTourSequence', 'Guided Sequence')} />{t('ui.guide.boardTourSequence', 'Guided Sequence')}</span>
              <strong className="shell-progress-chip">{progress}</strong>
            </div>
            <h2>{stepTitle}</h2>
            <p>
              <strong className="shell-copy-label"><Icon type="scrollText" size="xs" ariaLabel={t('ui.guide.whatItIs', 'What it is')} />{t('ui.guide.whatItIs', 'What it is')}:</strong> {stepWhat}
            </p>
            <p>
              <strong className="shell-copy-label"><Icon type="settings" size="xs" ariaLabel={t('ui.guide.howToUseIt', 'How to use it')} />{t('ui.guide.howToUseIt', 'How to use it')}:</strong> {stepHow}
            </p>
            <p>
              <strong className="shell-copy-label"><Icon type="crisis" size="xs" ariaLabel={t('ui.guide.whatToWatchFor', 'What to watch for')} />{t('ui.guide.whatToWatchFor', 'What to watch for')}:</strong> {stepWatch}
            </p>

            <div className="board-tour-sequence-actions">
              <ThemePlate
                size="sm"
                label={(
                  <span className="plate-label-with-icon">
                    <GameIcon name="chevronDown" size="xs" className={previousChevronClass} ariaLabel={t('ui.guide.previousStep', 'Previous')} />
                    <span>{t('ui.guide.previousStep', 'Previous')}</span>
                  </span>
                )}
                variant="quiet"
                onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
              />
              <ThemePlate
                size="sm"
                label={(
                  <span className="plate-label-with-icon">
                    <span>{t('ui.guide.nextStep', 'Next')}</span>
                    <GameIcon name="chevronDown" size="xs" className={nextChevronClass} ariaLabel={t('ui.guide.nextStep', 'Next')} />
                  </span>
                )}
                variant="primary"
                onClick={() => setStepIndex((current) => Math.min(BOARD_TOUR_STEPS.length - 1, current + 1))}
              />
            </div>
          </PaperSheet>
          <PaperSheet tone="tray" className="board-tour-map-card shell-card shell-surface-note">
            <div className="board-tour-live-session">
              <GameSessionScreen
                state={TOUR_PREVIEW_STATE}
                content={BOARD_CONTENT}
                viewState={viewState}
                onViewStateChange={(patch) => setViewState((current) => ({ ...current, ...patch }))}
                onCommand={() => undefined}
                onToast={() => undefined}
                onBack={() => undefined}
                authorizedOwnerId={null}
                autoAdvanceTransientUi
              />

              <div className={`board-tour-overlay board-tour-overlay-step-${step.id}`.trim()} style={overlayStyle} aria-hidden="true">
                <div className="board-tour-pointer" />
                <div className="board-tour-bubble">
                  <span>{stepTitle}</span>
                </div>
              </div>
            </div>
          </PaperSheet>
        </div>
      </PaperSheet>
    </TableSurface>
  );
}

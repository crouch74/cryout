import { useMemo, useState } from 'react';
import { compileContent, initializeGame } from '../../../engine/index.ts';
import { GameSessionScreen } from '../../../game/screens/GameSessionScreen.tsx';
import type { SessionViewport } from '../../session-setup/model/sessionTypes.ts';
import { t } from '../../../i18n/index.ts';
import { EngravedHeader, LocaleSwitcher, PaperSheet, TableSurface, ThemePlate } from '../../../ui/layout/tabletop.tsx';

interface BoardTourScreenProps {
  onBackHome: () => void;
  onOpenOffline: () => void;
}

interface BoardTourStep {
  id: string;
  pointer: {
    x: number;
    y: number;
    bubbleX: number;
    bubbleY: number;
  };
}

const BOARD_CONTENT = compileContent('base_design');
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

const TOUR_PREVIEW_STATE = {
  ...BOARD_STATE,
  round: 2,
  commandLog: [],
} as const;

const BOARD_TOUR_STEPS: BoardTourStep[] = [
  {
    id: 'mapRegions',
    pointer: { x: 45, y: 48, bubbleX: 8, bubbleY: 8 },
  },
  {
    id: 'extractionTokens',
    pointer: { x: 65, y: 46, bubbleX: 70, bubbleY: 8 },
  },
  {
    id: 'globalGaze',
    pointer: { x: 13, y: 11, bubbleX: 4, bubbleY: 20 },
  },
  {
    id: 'warMachine',
    pointer: { x: 25, y: 11, bubbleX: 4, bubbleY: 20 },
  },
  {
    id: 'domains',
    pointer: { x: 38, y: 11, bubbleX: 4, bubbleY: 20 },
  },
  {
    id: 'playerStrip',
    pointer: { x: 68, y: 11, bubbleX: 55, bubbleY: 20 },
  },
  {
    id: 'actionDock',
    pointer: { x: 27, y: 85, bubbleX: 4, bubbleY: 63 },
  },
  {
    id: 'decks',
    pointer: { x: 84, y: 84, bubbleX: 63, bubbleY: 63 },
  },
  {
    id: 'beacons',
    pointer: { x: 84, y: 70, bubbleX: 63, bubbleY: 52 },
  },
  {
    id: 'secretMandates',
    pointer: { x: 58, y: 11, bubbleX: 55, bubbleY: 20 },
  },
  {
    id: 'terminalWarnings',
    pointer: { x: 48, y: 56, bubbleX: 34, bubbleY: 8 },
  },
];

export function BoardTourScreen({ onBackHome, onOpenOffline }: BoardTourScreenProps) {
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

  return (
    <TableSurface className="guide-table board-tour-table">
      <PaperSheet tone="board" className="guide-tab-rail">
        <EngravedHeader
          eyebrow={t('ui.guide.boardTour', 'Board Tour')}
          title={t('ui.guide.boardTourTitle', 'Read the table before it breaks')}
          detail={t('ui.guide.boardTourDetail', 'Each panel explains what a board component means, how to use it, and what danger signals to monitor.')}
          actions={
            <div className="header-action-plates">
              <LocaleSwitcher />
              <ThemePlate label={t('ui.guide.backHome', 'Back Home')} onClick={onBackHome} />
              <ThemePlate label={t('ui.guide.openTable', 'Open Table')} onClick={onOpenOffline} />
            </div>
          }
        />

        <div className="board-tour-stage">
          <PaperSheet tone="tray" className="board-tour-sequence-card">
            <div className="board-tour-sequence-head">
              <span className="engraved-eyebrow">{t('ui.guide.boardTourSequence', 'Guided Sequence')}</span>
              <strong>{progress}</strong>
            </div>
            <h3>{stepTitle}</h3>
            <p><strong>{t('ui.guide.whatItIs', 'What it is')}:</strong> {stepWhat}</p>
            <p><strong>{t('ui.guide.howToUseIt', 'How to use it')}:</strong> {stepHow}</p>
            <p><strong>{t('ui.guide.whatToWatchFor', 'What to watch for')}:</strong> {stepWatch}</p>

            <div className="board-tour-sequence-actions">
              <ThemePlate
                label={t('ui.guide.previousStep', 'Previous')}
                variant="quiet"
                onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
              />
              <ThemePlate
                label={t('ui.guide.nextStep', 'Next')}
                variant="primary"
                onClick={() => setStepIndex((current) => Math.min(BOARD_TOUR_STEPS.length - 1, current + 1))}
              />
            </div>
          </PaperSheet>
          <PaperSheet tone="tray" className="board-tour-map-card">
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

              <div className="board-tour-overlay" aria-hidden="true">
                <div
                  className="board-tour-pointer"
                  style={{
                    left: `${step.pointer.x}%`,
                    top: `${step.pointer.y}%`,
                  }}
                />
                <div
                  className="board-tour-bubble"
                  style={{
                    left: `${step.pointer.bubbleX}%`,
                    top: `${step.pointer.bubbleY}%`,
                  }}
                >
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

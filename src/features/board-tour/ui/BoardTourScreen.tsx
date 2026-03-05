import { useMemo, useState } from 'react';
import { compileContent, initializeGame } from '../../../engine/index.ts';
import { GameSessionScreen } from '../../../game/screens/GameSessionScreen.tsx';
import type { SessionViewport } from '../../session-setup/model/sessionTypes.ts';
import { t } from '../../../i18n/index.ts';
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
            <h3>{stepTitle}</h3>
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
                    <GameIcon name="chevronDown" size="xs" className="shell-chevron is-left" ariaLabel={t('ui.guide.previousStep', 'Previous')} />
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
                    <GameIcon name="chevronDown" size="xs" className="shell-chevron is-right" ariaLabel={t('ui.guide.nextStep', 'Next')} />
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

              <div className={`board-tour-overlay board-tour-overlay-step-${step.id}`.trim()} aria-hidden="true">
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

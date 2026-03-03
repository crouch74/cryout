import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { useThemeSettings } from '../../app/providers/ThemeProvider.tsx';
import { formatNumber, t, useAppLocale } from '../../i18n/index.ts';
import { Icon } from '../icon/Icon.tsx';

export function useTabletopTheme() {
  return useThemeSettings();
}

export function TableSurface({
  children,
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`table-surface ${className}`.trim()} {...props}>
      <div className="table-surface-paper">{children}</div>
    </div>
  );
}

export function PaperSheet({
  children,
  className = '',
  tone = 'plain',
  ...props
}: HTMLAttributes<HTMLElement> & { tone?: 'plain' | 'folio' | 'board' | 'note' | 'mat' | 'tray' | 'docket' | 'slip' | 'booklet' }) {
  return (
    <section className={`paper-sheet paper-sheet-${tone} ${className}`.trim()} {...props}>
      {children}
    </section>
  );
}

export function EngravedHeader({
  title,
  eyebrow,
  detail,
  actions,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  detail?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="engraved-header">
      <div className="engraved-header-copy">
        {eyebrow ? <span className="engraved-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {detail ? <p>{detail}</p> : null}
      </div>
      {actions ? <div className="engraved-header-actions">{actions}</div> : null}
    </header>
  );
}

export function ThemePlate({
  label,
  active,
  disabled,
  onClick,
}: {
  label: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`engraved-plate ${active ? 'is-active' : ''}`.trim()}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function TabletopControls() {
  const { contrastMode, motionMode, setContrastMode, setMotionMode } = useTabletopTheme();

  return (
    <div className="tabletop-controls" aria-label={t('ui.accessibility.controls', 'Tabletop accessibility controls')}>
      <ThemePlate
        label={contrastMode === 'high' ? t('ui.accessibility.standardContrast', 'Standard Contrast') : t('ui.accessibility.highContrast', 'High Contrast')}
        active={contrastMode === 'high'}
        onClick={() => setContrastMode(contrastMode === 'high' ? 'default' : 'high')}
      />
      <ThemePlate
        label={motionMode === 'reduced' ? t('ui.accessibility.fullMotion', 'Full Motion') : t('ui.accessibility.reducedMotion', 'Reduced Motion')}
        active={motionMode === 'reduced'}
        onClick={() => setMotionMode(motionMode === 'reduced' ? 'full' : 'reduced')}
      />
    </div>
  );
}

export function LocaleSwitcher({ showLabel = true }: { showLabel?: boolean }) {
  const { changeLocale, locale, localeOptions } = useAppLocale();

  return (
    <div className="locale-switcher">
      {showLabel ? <span className="engraved-eyebrow">{t('ui.language.label', 'Language')}</span> : null}
      <div className="locale-switcher-select-shell">
        <Icon type="language" size={16} />
        <select
          value={locale}
          onChange={(event) => {
            void changeLocale(event.target.value as typeof locale);
          }}
          aria-label={t('ui.language.label', 'Language')}
        >
          {localeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function DocumentFolio<T extends string>({
  title,
  activeId,
  sections,
  onSelect,
  children,
}: {
  title: string;
  activeId: T;
  sections: Array<{ id: T; label: string }>;
  onSelect: (id: T) => void;
  children: ReactNode;
}) {
  return (
    <PaperSheet tone="folio" className="document-folio">
      <div className="folio-tabs" role="tablist" aria-label={title}>
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            role="tab"
            aria-selected={activeId === section.id}
            className={`folio-tab ${activeId === section.id ? 'is-active' : ''}`}
            onClick={() => onSelect(section.id)}
          >
            {section.label}
          </button>
        ))}
      </div>
      <div className="folio-page">{children}</div>
    </PaperSheet>
  );
}

export function CivicBoard({ children, className = '' }: HTMLAttributes<HTMLElement>) {
  return (
    <PaperSheet tone="board" className={`civic-board ${className}`.trim()}>
      {children}
    </PaperSheet>
  );
}

export type TableDeckId = 'system' | 'resistance' | 'crisis';

function getDeckBackGlyph(deckId: TableDeckId) {
  switch (deckId) {
    case 'system':
      return '✣';
    case 'resistance':
      return '✶';
    case 'crisis':
      return '✦';
  }
}

export function DeckBackArt({
  deckId,
  deckName,
  className = '',
}: {
  deckId: TableDeckId;
  deckName: string;
  className?: string;
}) {
  const glyph = getDeckBackGlyph(deckId);

  return (
    <div className={`deck-back-art deck-back-art-${deckId} ${className}`.trim()} aria-hidden="true">
      <span className="deck-back-corner deck-back-corner-top">{glyph}</span>
      <span className="deck-back-corner deck-back-corner-bottom">{glyph}</span>
      <span className="deck-back-core">
        <span className="deck-back-emblem">
          <span className="deck-back-emblem-mark">{glyph}</span>
        </span>
        <span className="deck-back-title" dir="auto">{deckName}</span>
      </span>
    </div>
  );
}

export const DeckStack = forwardRef<HTMLButtonElement, {
  label: string;
  deckId: TableDeckId;
  deckName: string;
  drawCount: number;
  disabled?: boolean;
  locked?: boolean;
  lowCount?: boolean;
  urgent?: boolean;
  shakeEmpty?: boolean;
  onClick?: () => void;
  onPointerDown?: ButtonHTMLAttributes<HTMLButtonElement>['onPointerDown'];
}>(({
  label,
  deckId,
  deckName,
  drawCount,
  disabled,
  locked,
  lowCount,
  urgent,
  shakeEmpty,
  onClick,
  onPointerDown,
}, ref) => {
  const layers = Array.from({ length: 14 }, (_, index) => index);
  const tooltipId = `${deckId}-deck-tooltip`;

  return (
    <button
      ref={ref}
      type="button"
      className={`deck-stack deck-stack-${deckId} ${locked ? 'is-locked' : ''} ${lowCount ? 'is-low' : ''} ${urgent ? 'is-urgent' : ''} ${drawCount === 0 ? 'is-empty' : ''} ${shakeEmpty ? 'is-shaking' : ''}`.trim()}
      disabled={disabled}
      onClick={onClick}
      onPointerDown={onPointerDown}
      aria-label={label}
      aria-describedby={tooltipId}
      data-deck-id={deckId}
    >
      <div className="deck-stack-physical" aria-hidden="true">
        <div className="deck-stack-cards">
          {layers.map((layer) => (
            <span key={layer} className="deck-stack-layer" style={{ ['--deck-layer' as string]: String(layer) }} />
          ))}
          <DeckBackArt deckId={deckId} deckName={deckName} className="deck-stack-top-card" />
        </div>
        <span className="deck-stack-badge">{formatNumber(drawCount)}</span>
        <span id={tooltipId} role="tooltip" className={`deck-stack-tooltip ${lowCount ? 'is-alert' : ''}`.trim()}>
          {t('ui.decks.cardsRemain', '{{count}} cards remain', { count: drawCount })}
        </span>
      </div>
      {locked ? <WaxSealLock label={t('ui.game.sealed', 'Sealed')} /> : null}
    </button>
  );
});

DeckStack.displayName = 'DeckStack';

export function CrisisCard({
  title,
  body,
  tag,
  emoji,
  className = '',
}: {
  title: string;
  body: string;
  tag?: string;
  emoji?: string;
  className?: string;
}) {
  return (
    <article className={`crisis-card ${className}`.trim()}>
      <div className="crisis-card-header">
        <span className="engraved-eyebrow">{tag ?? 'Crisis Card'}</span>
        {emoji ? <span className="crisis-card-emoji">{emoji}</span> : null}
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}

export function WoodenToken({
  label,
  count,
  shape,
  icon,
}: {
  label: string;
  count?: number;
  shape: 'disc' | 'cube' | 'bar' | 'marker';
  icon: string;
}) {
  return (
    <div className={`wooden-token wooden-token-${shape}`} aria-label={count === undefined ? label : `${label}: ${formatNumber(count)}`}>
      <span className="wooden-token-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="wooden-token-label">{label}</span>
      {count !== undefined ? <strong>{formatNumber(count)}</strong> : null}
    </div>
  );
}

export function TokenStack({
  label,
  count,
  shape,
  icon,
}: {
  label: string;
  count: number;
  shape: 'disc' | 'cube' | 'bar' | 'marker';
  icon: string;
}) {
  const visibleCount = Math.min(count, 8);
  return (
    <div className="token-stack">
      <div className="token-stack-pieces" aria-hidden="true">
        {Array.from({ length: visibleCount }).map((_, index) => (
          <span key={`${label}-${index}`} className={`token-stack-piece token-stack-piece-${shape}`} style={{ '--token-layer': String(index) } as Record<string, string>} />
        ))}
      </div>
      <WoodenToken label={label} count={count} shape={shape} icon={icon} />
    </div>
  );
}

export function PrintedTrack({
  title,
  ariaLabel,
  steps,
  activeIndex,
  activeContent,
}: {
  title?: string;
  ariaLabel: string;
  steps: Array<{
    key: string;
    label: ReactNode;
    tooltipId?: string;
    tooltipContent?: ReactNode;
  }>;
  activeIndex: number;
  activeContent?: ReactNode;
}) {
  return (
    <div className="printed-track" aria-label={ariaLabel}>
      {title ? <span className="engraved-eyebrow">{title}</span> : null}
      <ol className="printed-track-list">
        {steps.map((step, index) => (
          <li
            key={step.key}
            className={`printed-track-step ${index === activeIndex ? 'is-active' : index < activeIndex ? 'is-complete' : ''} ${step.tooltipContent ? 'has-tooltip' : ''}`.trim()}
          >
            <div className="printed-track-step-main">
              <div
                className={`printed-track-step-title ${step.tooltipContent ? 'has-tooltip' : ''}`.trim()}
                tabIndex={step.tooltipContent ? 0 : undefined}
                aria-describedby={step.tooltipContent ? step.tooltipId : undefined}
              >
                <PhaseMarker active={index === activeIndex} label={formatNumber(index + 1)} />
                <div className="printed-track-step-label-row">
                  <span className="printed-track-step-label">{step.label}</span>
                </div>
                {step.tooltipContent ? (
                  <span id={step.tooltipId} role="tooltip" className="phase-progress-help-tooltip">
                    {step.tooltipContent}
                  </span>
                ) : null}
              </div>
              {index === activeIndex && activeContent ? <div className="printed-track-step-controls">{activeContent}</div> : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function PhaseMarker({ label, active }: { label: string; active?: boolean }) {
  return <span className={`phase-marker-token ${active ? 'is-active' : ''}`}>{label}</span>;
}

export function ActionCard({
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`action-card-plate ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}

export function CommitMarker({
  label,
  active,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button type="button" className={`commit-marker ${active ? 'is-active' : ''}`} {...props}>
      <span className="commit-marker-disc" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

export function NotesPad({
  title,
  children,
  overflowCount = 0,
}: {
  title: string;
  children: ReactNode;
  overflowCount?: number;
}) {
  return (
    <PaperSheet tone="note" className="notes-pad">
      <div className="notes-pad-header">
        <h3>{title}</h3>
        {overflowCount > 0 ? <span className="stacked-sheets">{t('ui.notes.archived', '{{count}} archived', { count: overflowCount })}</span> : null}
      </div>
      <div className="notes-pad-body">{children}</div>
    </PaperSheet>
  );
}

export function PaperTooltip({ label }: { label: string }) {
  return <span className="paper-tooltip">{label}</span>;
}

export function WaxSealLock({ label }: { label: string }) {
  return <span className="wax-seal-lock">{label}</span>;
}

export function RotateHint() {
  return (
    <div className="rotate-hint" aria-hidden="true">
      <span>{t('ui.accessibility.rotateLandscape', 'Rotate to landscape for the full table layout.')}</span>
    </div>
  );
}

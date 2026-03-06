import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { useThemeSettings } from '../../app/providers/ThemeProvider.tsx';
import { formatNumber, t, useAppLocale } from '../../i18n/index.ts';
import { UI_SKINS, type UiSkinId } from '../../theme/index.ts';
import { GameIcon } from '../icon/GameIcon.tsx';
import type { GameIconName } from '../icon/iconTypes.ts';
import { PrintedTrack, PhaseMarker } from '../components/data/PrintedTrack.tsx';
import { EngravedHeader } from './EngravedHeader.tsx';
import { PaperSheet } from './PaperSheet.tsx';
import { TableSurface } from './TableSurface.tsx';
import { ThemePlate } from './ThemePlate.tsx';
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  TabsContent,
  TabsList,
  TabsRoot,
  TabsTrigger,
} from '../primitives/index.ts';

export { PrintedTrack, PhaseMarker, EngravedHeader, PaperSheet, TableSurface, ThemePlate };

export function useTabletopTheme() {
  return useThemeSettings();
}

export function TabletopControls({ compact = false }: { compact?: boolean }) {
  const { contrastMode, motionMode, setContrastMode, setMotionMode } = useTabletopTheme();
  const contrastLabel = contrastMode === 'high'
    ? t('ui.accessibility.standardContrast', 'Standard Contrast')
    : t('ui.accessibility.highContrast', 'High Contrast');
  const motionLabel = motionMode === 'reduced'
    ? t('ui.accessibility.fullMotion', 'Full Motion')
    : t('ui.accessibility.reducedMotion', 'Reduced Motion');

  return (
    <div className={`tabletop-controls ${compact ? 'is-compact' : ''}`.trim()} aria-label={t('ui.accessibility.controls', 'Tabletop accessibility controls')}>
      <ThemePlate
        label={
          compact
            ? <GameIcon name="contrast" size="xs" ariaLabel={contrastLabel} />
            : (
              <span className="plate-label-with-icon">
                <GameIcon name="contrast" size="xs" ariaLabel={contrastLabel} />
                <span>{contrastLabel}</span>
              </span>
            )
        }
        active={contrastMode === 'high'}
        ariaLabel={contrastLabel}
        size={compact ? 'sm' : 'md'}
        variant="utility"
        onClick={() => setContrastMode(contrastMode === 'high' ? 'default' : 'high')}
      />
      <ThemePlate
        label={
          compact
            ? <GameIcon name="sparkles" size="xs" ariaLabel={motionLabel} />
            : (
              <span className="plate-label-with-icon">
                <GameIcon name="sparkles" size="xs" ariaLabel={motionLabel} />
                <span>{motionLabel}</span>
              </span>
            )
        }
        active={motionMode === 'reduced'}
        ariaLabel={motionLabel}
        size={compact ? 'sm' : 'md'}
        variant="utility"
        onClick={() => setMotionMode(motionMode === 'reduced' ? 'full' : 'reduced')}
      />
    </div>
  );
}

export function LocaleSwitcher({ showLabel = true, compact = false }: { showLabel?: boolean; compact?: boolean }) {
  const { changeLocale, locale, localeOptions } = useAppLocale();
  const activeOption = localeOptions.find((option) => option.value === locale) ?? { value: locale, label: locale };
  const localeFlagClass = (value: string) => {
    switch (value) {
      case 'fr':
        return 'locale-flag-fr';
      case 'ar':
        return 'locale-flag-ar';
      case 'ar-EG':
        return 'locale-flag-ar-eg';
      default:
        return 'locale-flag-en';
    }
  };

  const renderLocaleLabel = (value: string, label: string) => (
    <span className="locale-option-label">
      <span className={`locale-flag ${localeFlagClass(value)}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );

  const renderLocaleMenu = () => (
    <DropdownMenuPortal>
      <DropdownMenuContent
        className="locale-dropdown-menu"
        align="end"
        side="bottom"
        sideOffset={8}
      >
        {localeOptions.map((option) => (
          <DropdownMenuItem
            key={option.value}
            className="locale-dropdown-item"
            data-active={option.value === locale ? 'true' : 'false'}
            onSelect={() => {
              void changeLocale(option.value as typeof locale);
            }}
          >
            {renderLocaleLabel(option.value, option.label)}
            {option.value === locale ? <GameIcon name="check" size="xs" ariaLabel={t('ui.language.label', 'Language')} /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenuPortal>
  );

  if (compact) {
    return (
      <div className="locale-switcher is-compact is-icon-trigger">
        <DropdownMenuRoot>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="locale-icon-trigger"
              aria-label={t('ui.language.label', 'Language')}
              title={activeOption.label}
            >
              <GameIcon name="language" size="sm" ariaLabel={t('ui.language.label', 'Language')} />
              <span className={`locale-flag ${localeFlagClass(activeOption.value)}`} aria-hidden="true" />
              <GameIcon name="chevronDown" size="xs" ariaLabel={t('ui.language.label', 'Language')} />
            </button>
          </DropdownMenuTrigger>
          {renderLocaleMenu()}
        </DropdownMenuRoot>
      </div>
    );
  }

  return (
    <div className="locale-switcher">
      {showLabel ? <span className="engraved-eyebrow">{t('ui.language.label', 'Language')}</span> : null}
      <DropdownMenuRoot>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="locale-selector-trigger"
            aria-label={t('ui.language.label', 'Language')}
            title={activeOption.label}
          >
            {renderLocaleLabel(activeOption.value, activeOption.label)}
            <GameIcon name="chevronDown" size="xs" ariaLabel={t('ui.language.label', 'Language')} />
          </button>
        </DropdownMenuTrigger>
        {renderLocaleMenu()}
      </DropdownMenuRoot>
    </div>
  );
}

export function ThemeSwitcher({ showLabel = true, compact = false }: { showLabel?: boolean; compact?: boolean }) {
  const { activeSkinId, setActiveSkinId } = useTabletopTheme();
  const themeOptions = Object.values(UI_SKINS);
  const activeOption = themeOptions.find((option) => option.id === activeSkinId) ?? themeOptions[0];

  const themeLabel = t('ui.theme.label', 'Theme');
  const getOptionLabel = (skinId: UiSkinId, fallback: string) => t(`ui.theme.${skinId}`, fallback);

  const renderThemeLabel = (skinId: UiSkinId, label: string) => (
    <span className="theme-option-label">
      <span className="theme-option-swatches" aria-hidden="true">
        <span
          className="theme-option-swatch"
          style={{ ['--theme-swatch-color' as string]: UI_SKINS[skinId].action.primary } as Record<string, string>}
        />
        <span
          className="theme-option-swatch"
          style={{ ['--theme-swatch-color' as string]: UI_SKINS[skinId].action.secondary } as Record<string, string>}
        />
      </span>
      <span>{label}</span>
    </span>
  );

  const renderThemeMenu = () => (
    <DropdownMenuPortal>
      <DropdownMenuContent
        className="locale-dropdown-menu theme-dropdown-menu"
        align="end"
        side="bottom"
        sideOffset={8}
      >
        {themeOptions.map((option) => (
          <DropdownMenuItem
            key={option.id}
            className="locale-dropdown-item theme-dropdown-item"
            data-active={option.id === activeSkinId ? 'true' : 'false'}
            onSelect={() => {
              setActiveSkinId(option.id);
            }}
          >
            {renderThemeLabel(option.id, getOptionLabel(option.id, option.label))}
            {option.id === activeSkinId ? <GameIcon name="check" size="xs" ariaLabel={themeLabel} /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenuPortal>
  );

  if (compact) {
    return (
      <div className="theme-switcher locale-switcher is-compact is-icon-trigger">
        <DropdownMenuRoot>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="locale-icon-trigger theme-icon-trigger"
              aria-label={themeLabel}
              title={getOptionLabel(activeOption.id, activeOption.label)}
            >
              <GameIcon name="contrast" size="sm" ariaLabel={themeLabel} />
              <span
                className="theme-trigger-swatch"
                style={{ ['--theme-swatch-color' as string]: UI_SKINS[activeOption.id].action.secondary } as Record<string, string>}
                aria-hidden="true"
              />
              <GameIcon name="chevronDown" size="xs" ariaLabel={themeLabel} />
            </button>
          </DropdownMenuTrigger>
          {renderThemeMenu()}
        </DropdownMenuRoot>
      </div>
    );
  }

  return (
    <div className="theme-switcher locale-switcher">
      {showLabel ? <span className="engraved-eyebrow">{themeLabel}</span> : null}
      <DropdownMenuRoot>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="locale-selector-trigger theme-selector-trigger"
            aria-label={themeLabel}
            title={getOptionLabel(activeOption.id, activeOption.label)}
          >
            {renderThemeLabel(activeOption.id, getOptionLabel(activeOption.id, activeOption.label))}
            <GameIcon name="chevronDown" size="xs" ariaLabel={themeLabel} />
          </button>
        </DropdownMenuTrigger>
        {renderThemeMenu()}
      </DropdownMenuRoot>
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
      <TabsRoot value={activeId} onValueChange={(value) => onSelect(value as T)}>
        <TabsList className="folio-tabs" aria-label={title}>
          {sections.map((section) => (
            <TabsTrigger
              key={section.id}
              value={section.id}
              className={`folio-tab ${activeId === section.id ? 'is-active' : ''}`}
            >
              {section.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={activeId} className="folio-page">
          {children}
        </TabsContent>
      </TabsRoot>
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
  icon,
  className = '',
}: {
  title: string;
  body: string;
  tag?: string;
  icon?: GameIconName;
  className?: string;
}) {
  return (
    <article className={`crisis-card ${className}`.trim()}>
      <div className="crisis-card-header">
        <span className="engraved-eyebrow">{tag ?? 'Crisis Card'}</span>
        {icon ? <GameIcon name={icon} className="crisis-card-icon" size="lg" /> : null}
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
  icon: GameIconName;
}) {
  return (
    <div className={`wooden-token wooden-token-${shape}`} aria-label={count === undefined ? label : `${label}: ${formatNumber(count)}`}>
      <span className="wooden-token-icon" aria-hidden="true">
        <GameIcon name={icon} size="xs" />
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
  icon: GameIconName;
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

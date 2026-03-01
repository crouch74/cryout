import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

type ContrastMode = 'default' | 'high';
type MotionMode = 'full' | 'reduced';

interface TabletopThemeContextValue {
  contrastMode: ContrastMode;
  motionMode: MotionMode;
  setContrastMode: (mode: ContrastMode) => void;
  setMotionMode: (mode: MotionMode) => void;
}

const CONTRAST_KEY = 'dignity-rising-tabletop-contrast';
const MOTION_KEY = 'dignity-rising-tabletop-motion';

const TabletopThemeContext = createContext<TabletopThemeContextValue | null>(null);

function getInitialMotionMode(): MotionMode {
  if (typeof window === 'undefined') {
    return 'full';
  }

  const stored = window.localStorage.getItem(MOTION_KEY);
  if (stored === 'full' || stored === 'reduced') {
    return stored;
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full';
}

function getInitialContrastMode(): ContrastMode {
  if (typeof window === 'undefined') {
    return 'default';
  }

  const stored = window.localStorage.getItem(CONTRAST_KEY);
  return stored === 'high' ? 'high' : 'default';
}

export function TabletopThemeProvider({ children }: { children: ReactNode }) {
  const [contrastMode, setContrastMode] = useState<ContrastMode>(getInitialContrastMode);
  const [motionMode, setMotionMode] = useState<MotionMode>(getInitialMotionMode);

  useEffect(() => {
    document.documentElement.dataset.contrast = contrastMode;
    window.localStorage.setItem(CONTRAST_KEY, contrastMode);
  }, [contrastMode]);

  useEffect(() => {
    document.documentElement.dataset.motion = motionMode;
    window.localStorage.setItem(MOTION_KEY, motionMode);
  }, [motionMode]);

  const value = useMemo(
    () => ({ contrastMode, motionMode, setContrastMode, setMotionMode }),
    [contrastMode, motionMode],
  );

  return <TabletopThemeContext.Provider value={value}>{children}</TabletopThemeContext.Provider>;
}

export function useTabletopTheme() {
  const context = useContext(TabletopThemeContext);
  if (!context) {
    throw new Error('useTabletopTheme must be used within TabletopThemeProvider.');
  }

  return context;
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
}: HTMLAttributes<HTMLElement> & { tone?: 'plain' | 'folio' | 'board' | 'note' | 'mat' }) {
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
    <div className="tabletop-controls" aria-label="Tabletop accessibility controls">
      <ThemePlate
        label={contrastMode === 'high' ? 'Standard Contrast' : 'High Contrast'}
        active={contrastMode === 'high'}
        onClick={() => setContrastMode(contrastMode === 'high' ? 'default' : 'high')}
      />
      <ThemePlate
        label={motionMode === 'reduced' ? 'Full Motion' : 'Reduced Motion'}
        active={motionMode === 'reduced'}
        onClick={() => setMotionMode(motionMode === 'reduced' ? 'full' : 'reduced')}
      />
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

export function DeckStack({
  label,
  deckName,
  drawCount,
  activeCount,
  disabled,
  locked,
  onClick,
}: {
  label: string;
  deckName: string;
  drawCount: number;
  activeCount?: number;
  disabled?: boolean;
  locked?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`deck-stack ${locked ? 'is-locked' : ''}`}
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
    >
      <div className="deck-stack-cards" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="deck-stack-copy">
        <strong>{deckName}</strong>
        <span>{drawCount} cards remain</span>
        {activeCount !== undefined ? <span>{activeCount} staged</span> : null}
      </div>
      {locked ? <WaxSealLock label="Sealed" /> : null}
    </button>
  );
}

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
    <div className={`wooden-token wooden-token-${shape}`} aria-label={count === undefined ? label : `${label}: ${count}`}>
      <span className="wooden-token-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="wooden-token-label">{label}</span>
      {count !== undefined ? <strong>{count}</strong> : null}
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
  steps,
  activeIndex,
}: {
  title: string;
  steps: string[];
  activeIndex: number;
}) {
  return (
    <div className="printed-track" aria-label={title}>
      <span className="engraved-eyebrow">{title}</span>
      <ol className="printed-track-list">
        {steps.map((step, index) => (
          <li key={step} className={`printed-track-step ${index === activeIndex ? 'is-active' : index < activeIndex ? 'is-complete' : ''}`}>
            <PhaseMarker active={index === activeIndex} label={String(index + 1)} />
            <span>{step}</span>
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
        {overflowCount > 0 ? <span className="stacked-sheets">{overflowCount} archived</span> : null}
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
      <span>Rotate to landscape for the full table layout.</span>
    </div>
  );
}

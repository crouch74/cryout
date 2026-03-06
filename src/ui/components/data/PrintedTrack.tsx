import type { ReactNode } from 'react';
import { formatNumber } from '../../../i18n/index.ts';
import './printed-track.css';

export function PhaseMarker({ label, active }: { label: string; active?: boolean }) {
  return <span className={`phase-marker-token ${active ? 'is-active' : ''}`}>{label}</span>;
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
    tooltipClassName?: string;
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
                  <span
                    id={step.tooltipId}
                    role="tooltip"
                    className={['phase-progress-help-tooltip', step.tooltipClassName].filter(Boolean).join(' ')}
                  >
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

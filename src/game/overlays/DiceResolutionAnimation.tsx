import { useEffect, useMemo, useRef, useState } from 'react';
import { formatNumber, t } from '../../i18n/index.ts';

export interface DiceResolutionAnimationProps {
  kind: '2d6' | '1d10';
  values: number[];
  motionMode: 'full' | 'reduced';
  eventSeq?: number;
  autoStart?: boolean;
  onComplete: () => void;
  onSkip?: () => void;
}

function getDieSides(kind: DiceResolutionAnimationProps['kind']) {
  return kind === '1d10' ? 10 : 6;
}

function buildTransientFrames(kind: DiceResolutionAnimationProps['kind'], values: number[], seed: number) {
  const sides = getDieSides(kind);
  const frameCount = kind === '1d10' ? 10 : 12;

  return Array.from({ length: values.length }, (_, dieIndex) =>
    Array.from({ length: frameCount }, (_, frameIndex) => ((seed + (dieIndex * 7) + (frameIndex * 3)) % sides) + 1),
  );
}

function renderD6Pips(value: number) {
  const positions: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };

  return (
    <span className="campaign-die-pips" aria-hidden="true">
      {Array.from({ length: 9 }, (_, index) => (
        <span key={index} className={`campaign-die-pip ${positions[value]?.includes(index) ? 'is-visible' : ''}`.trim()} />
      ))}
    </span>
  );
}

export function DiceResolutionAnimation({
  kind,
  values,
  motionMode,
  eventSeq = 0,
  autoStart = true,
  onComplete,
  onSkip,
}: DiceResolutionAnimationProps) {
  const [frameIndex, setFrameIndex] = useState(-1);
  const [settled, setSettled] = useState(false);
  const completeRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const onSkipRef = useRef(onSkip);
  const frames = useMemo(() => buildTransientFrames(kind, values, Math.max(1, eventSeq)), [eventSeq, kind, values]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onSkipRef.current = onSkip;
  }, [onComplete, onSkip]);

  useEffect(() => {
    completeRef.current = false;
    setFrameIndex(motionMode === 'reduced' || !autoStart ? frames[0]?.length ?? 0 : 0);
    setSettled(motionMode === 'reduced' || !autoStart);
    if (motionMode === 'reduced' || !autoStart) {
      completeRef.current = true;
      onCompleteRef.current();
      return;
    }

    const duration = kind === '1d10' ? 640 : 720;
    const steps = frames[0]?.length ?? 0;
    if (steps === 0) {
      completeRef.current = true;
      onCompleteRef.current();
      setSettled(true);
      return;
    }

    const timers = Array.from({ length: steps }, (_, index) => window.setTimeout(() => {
      setFrameIndex(index);
    }, Math.round((duration / steps) * index)));
    const settleTimer = window.setTimeout(() => {
      setSettled(true);
      if (!completeRef.current) {
        completeRef.current = true;
        onCompleteRef.current();
      }
    }, duration + 120);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearTimeout(settleTimer);
    };
  }, [autoStart, frames, kind, motionMode]);

  const shownValues = settled
    ? values
    : values.map((value, dieIndex) => frames[dieIndex]?.[Math.max(0, frameIndex)] ?? value);

  return (
    <button
      type="button"
      className={`campaign-dice-stage ${settled ? 'is-settled' : 'is-rolling'} ${motionMode === 'reduced' ? 'is-reduced' : ''}`.trim()}
      onClick={() => {
        if (settled) {
          return;
        }
        setSettled(true);
        if (!completeRef.current) {
          completeRef.current = true;
          onSkipRef.current?.();
          onCompleteRef.current();
        }
      }}
      aria-label={settled
        ? t('ui.campaignResult.diceSettledLabel', 'Resolved dice value {{value}}', {
          value: values.map((value) => formatNumber(value)).join(', '),
        })
        : t('ui.campaignResult.skipAnimation', 'Skip roll animation')}
    >
      <span className="campaign-dice-stage-copy">
        {settled
          ? t('ui.campaignResult.diceSettled', 'Dice settled')
          : t('ui.campaignResult.diceRolling', 'Dice rolling')}
      </span>
      <span className="campaign-dice-row">
        {shownValues.map((value, index) => (
          <span
            key={`${index}:${value}`}
            className={`campaign-die campaign-die-${kind} ${settled ? 'is-settled' : ''}`.trim()}
            aria-hidden="true"
          >
            {kind === '2d6' ? renderD6Pips(value) : <span className="campaign-die-d10-mark">{formatNumber(value)}</span>}
            <span className="campaign-die-value">{formatNumber(value)}</span>
          </span>
        ))}
      </span>
      <span className="campaign-dice-stage-hint">
        {settled
          ? t('ui.campaignResult.diceLocked', 'Engine result locked')
          : t('ui.campaignResult.skipAnimation', 'Skip roll animation')}
      </span>
    </button>
  );
}

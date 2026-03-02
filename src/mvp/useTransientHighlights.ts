import { useEffect, useMemo, useRef, useState } from 'react';

type HighlightSignature = string | number | boolean | null | undefined;

export function useTransientHighlightKeys(
  signatures: Readonly<Record<string, HighlightSignature>>,
  durationMs = 1600,
  suspend = false,
) {
  const previousRef = useRef<Readonly<Record<string, HighlightSignature>> | null>(null);
  const [activeKeys, setActiveKeys] = useState<Record<string, number>>({});

  useEffect(() => {
    if (suspend) {
      return;
    }

    if (!previousRef.current) {
      previousRef.current = signatures;
      return;
    }

    const changedKeys = Object.keys(signatures).filter((key) => previousRef.current?.[key] !== signatures[key]);
    previousRef.current = signatures;

    if (changedKeys.length === 0) {
      return;
    }

    const stamp = Date.now();
    setActiveKeys((current) => {
      const next = { ...current };
      for (const key of changedKeys) {
        next[key] = stamp;
      }
      return next;
    });

    const timeoutId = window.setTimeout(() => {
      setActiveKeys((current) => {
        const next = { ...current };
        for (const key of changedKeys) {
          if (next[key] === stamp) {
            delete next[key];
          }
        }
        return next;
      });
    }, durationMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [durationMs, signatures, suspend]);

  useEffect(() => {
    if (!suspend) {
      return;
    }

    setActiveKeys({});
  }, [suspend]);

  return useMemo(() => new Set(Object.keys(activeKeys)), [activeKeys]);
}

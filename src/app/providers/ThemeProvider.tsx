import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ContrastMode = 'default' | 'high';
export type MotionMode = 'full' | 'reduced';

interface ThemeContextValue {
  contrastMode: ContrastMode;
  motionMode: MotionMode;
  setContrastMode: (mode: ContrastMode) => void;
  setMotionMode: (mode: MotionMode) => void;
}

const CONTRAST_KEY = 'stones-tabletop-contrast';
const MOTION_KEY = 'stones-tabletop-motion';

const ThemeContext = createContext<ThemeContextValue | null>(null);

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

export function ThemeProvider({ children }: { children: ReactNode }) {
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

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeSettings() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeSettings must be used within ThemeProvider.');
  }

  return context;
}

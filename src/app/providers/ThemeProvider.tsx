import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  applyThemeVariables,
  DEFAULT_UI_SKIN_ID,
  getScenarioOverlayForRuleset,
  resolveTheme,
  type ScenarioOverlayId,
  type UiSkinId,
  type ThemeDefinition,
  UI_SKINS,
} from '../../theme/index.ts';

export type ContrastMode = 'default' | 'high';
export type MotionMode = 'full' | 'reduced';

interface ThemeContextValue {
  contrastMode: ContrastMode;
  motionMode: MotionMode;
  activeSkinId: UiSkinId;
  setContrastMode: (mode: ContrastMode) => void;
  setMotionMode: (mode: MotionMode) => void;
  setActiveSkinId: (skinId: UiSkinId) => void;
  activeRulesetId: string;
  activeTheme: ThemeDefinition;
  activeOverlayId: ScenarioOverlayId | null;
  setActiveRulesetId: (rulesetId: string) => void;
}

const CONTRAST_KEY = 'stones-tabletop-contrast';
const MOTION_KEY = 'stones-tabletop-motion';
const SKIN_KEY = 'stones.ui.skin';
const DEFAULT_RULESET_ID = '';

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

function isUiSkinId(value: string | null): value is UiSkinId {
  if (!value) {
    return false;
  }

  return value in UI_SKINS;
}

function getSkinFromUrl(): UiSkinId | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const value = new URLSearchParams(window.location.search).get('skin');
  return isUiSkinId(value) ? value : null;
}

function getInitialSkinId(): UiSkinId {
  if (typeof window === 'undefined') {
    return DEFAULT_UI_SKIN_ID;
  }

  const urlSkin = getSkinFromUrl();
  if (urlSkin) {
    return urlSkin;
  }

  const stored = window.localStorage.getItem(SKIN_KEY);
  if (isUiSkinId(stored)) {
    return stored;
  }

  return DEFAULT_UI_SKIN_ID;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [contrastMode, setContrastMode] = useState<ContrastMode>(getInitialContrastMode);
  const [motionMode, setMotionMode] = useState<MotionMode>(getInitialMotionMode);
  const [activeSkinId, setActiveSkinId] = useState<UiSkinId>(getInitialSkinId);
  const [activeRulesetId, setActiveRulesetId] = useState(DEFAULT_RULESET_ID);
  const activeOverlayId = useMemo(
    () => getScenarioOverlayForRuleset(activeRulesetId),
    [activeRulesetId],
  );
  const activeTheme = useMemo(
    () => resolveTheme({
      skinId: activeSkinId,
      scenarioOverlayId: activeOverlayId,
      contrastMode,
    }),
    [activeOverlayId, activeSkinId, contrastMode],
  );

  useEffect(() => {
    document.documentElement.dataset.contrast = contrastMode;
    window.localStorage.setItem(CONTRAST_KEY, contrastMode);
  }, [contrastMode]);

  useEffect(() => {
    document.documentElement.dataset.motion = motionMode;
    window.localStorage.setItem(MOTION_KEY, motionMode);
  }, [motionMode]);

  useEffect(() => {
    document.documentElement.dataset.uiSkin = activeSkinId;
    window.localStorage.setItem(SKIN_KEY, activeSkinId);
  }, [activeSkinId]);

  useEffect(() => {
    applyThemeVariables(activeTheme, activeOverlayId);
  }, [activeOverlayId, activeTheme]);

  const value = useMemo(
    () => ({
      contrastMode,
      motionMode,
      activeSkinId,
      setContrastMode,
      setMotionMode,
      setActiveSkinId,
      activeRulesetId,
      activeTheme,
      activeOverlayId,
      setActiveRulesetId,
    }),
    [activeOverlayId, activeRulesetId, activeSkinId, activeTheme, contrastMode, motionMode],
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

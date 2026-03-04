import { colors } from './colors.ts';
import { typography } from './typography.ts';
import { spacing } from './spacing.ts';
import { radius } from './radius.ts';
import { shadows } from './shadows.ts';
import { motion } from './motion.ts';
import { zIndex } from './zIndex.ts';
import { layout } from './layout.ts';

export const uiTokens = {
  colors,
  typography,
  spacing,
  radius,
  shadows,
  motion,
  zIndex,
  layout,
} as const;

export type UiTokens = typeof uiTokens;

export {
  colors,
  typography,
  spacing,
  radius,
  shadows,
  motion,
  zIndex,
  layout,
};

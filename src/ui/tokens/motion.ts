export const motion = {
  fast: '120ms',
  normal: '220ms',
  slow: '400ms',
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

export type UiMotion = typeof motion;

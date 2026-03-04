export const shadows = {
  subtle: '0 1px 2px rgba(0, 0, 0, 0.05)',
  medium: '0 4px 12px rgba(0, 0, 0, 0.08)',
  strong: '0 8px 24px rgba(0, 0, 0, 0.12)',
} as const;

export type UiShadows = typeof shadows;

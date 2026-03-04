export const layout = {
  icon: {
    xs: 14,
    sm: 16,
    md: 18,
    lg: 20,
  },
  button: {
    paddingY: '16px',
    paddingX: '16px',
  },
  panel: {
    padding: '24px',
  },
} as const;

export type UiLayout = typeof layout;

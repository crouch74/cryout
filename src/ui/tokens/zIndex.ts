export const zIndex = {
  base: 0,
  panel: 10,
  dropdown: 20,
  modal: 30,
  overlay: 40,
  toast: 50,
} as const;

export type UiZIndex = typeof zIndex;

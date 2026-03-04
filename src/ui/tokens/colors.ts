export const colors = {
  background: {
    primary: '#E9E2D6',
    secondary: '#F3ECE1',
    panel: '#F6EFE6',
    elevated: '#FFFFFF',
  },
  text: {
    primary: '#2E251C',
    secondary: '#5C5042',
    muted: '#8A7C6B',
    inverted: '#F3ECE1',
  },
  border: {
    subtle: '#D8CFC3',
    strong: '#B9AA96',
    danger: '#A03B2E',
  },
  state: {
    movement: '#3E6B48',
    danger: '#A03B2E',
    warning: '#C07A2C',
    neutral: '#6A5D4F',
    info: '#2F5D73',
  },
  domain: {
    warMachine: '#6B3A3A',
    climate: '#3E6B48',
    fossil: '#4C3A2F',
    justice: '#6A5D4F',
    voice: '#2F5D73',
    hunger: '#7A5A2A',
    patriarchy: '#6B3F5A',
    revolution: '#A03B2E',
  },
} as const;

export type UiColors = typeof colors;

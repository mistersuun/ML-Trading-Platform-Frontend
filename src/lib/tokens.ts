// Design tokens as JS constants for SVG/Plotly, which cannot read CSS variables
// reliably. Keep in sync with the :root block in index.css.
export const T = {
  bg: '#0C0C10',
  panel: '#131318',
  raised: '#1A1A21',
  hover: '#1D1D24',
  border: '#2A2A31',
  borderStrong: '#3D3D42',
  text1: '#E6E6E9',
  text2: '#A9AAB0',
  text3: '#828385',
  accent: '#8DB3E2',
  up: '#4FA77A',
  down: '#E8766D',
  warn: '#D4A72C',
  grid: '#202027',
  driftOver: '#3987E5',
  driftUnder: '#E66767',
  driftMid: '#828385',
  driftBand: '#1F1F26',
} as const;

export const SERIES = ['#3987E5', '#D95926', '#199E70', '#C98500', '#9085E9'] as const;
export const RAMP = ['#86B6EF', '#6DA7EC', '#5598E7', '#3987E5', '#2A78D6', '#256ABF'] as const;
export const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif";

// Design tokens. DOM and SVG read CSS variables (T, SERIES, RAMP), so they follow the
// theme with no re-render. Plotly cannot read CSS variables, so it gets resolved hex
// values from PALETTES. Keep PALETTES in sync with the :root blocks in index.css
// (a test compares them).
export type ThemeName = 'dark' | 'light';

export interface Palette {
  bg: string; panel: string; raised: string; hover: string; border: string; borderStrong: string;
  text1: string; text2: string; text3: string; accent: string; up: string; down: string; warn: string;
  grid: string; sidebarHover: string;
  driftOver: string; driftUnder: string; driftMid: string; driftBand: string;
  series: readonly string[]; ramp: readonly string[];
}

export const PALETTES: Record<ThemeName, Palette> = {
  dark: {
    bg: '#0C0C10', panel: '#131318', raised: '#1A1A21', hover: '#1D1D24', border: '#2A2A31', borderStrong: '#3D3D42',
    text1: '#E6E6E9', text2: '#A9AAB0', text3: '#828385', accent: '#8DB3E2', up: '#4FA77A', down: '#E8766D', warn: '#D4A72C',
    grid: '#202027', sidebarHover: '#16161C',
    driftOver: '#3987E5', driftUnder: '#E66767', driftMid: '#828385', driftBand: '#1F1F26',
    series: ['#3987E5', '#D95926', '#199E70', '#C98500', '#9085E9', '#D45F9C'],
    ramp: ['#86B6EF', '#6DA7EC', '#5598E7', '#3987E5', '#2A78D6', '#256ABF'],
  },
  light: {
    bg: '#F7F7F8', panel: '#FFFFFF', raised: '#F1F1F3', hover: '#EBEBEE', border: '#DCDCE0', borderStrong: '#C2C3C8',
    text1: '#18181B', text2: '#4A4B52', text3: '#6B6C73', accent: '#2F6DB5', up: '#2E7D55', down: '#C2453B', warn: '#855F00',
    grid: '#ECECEF', sidebarHover: '#E7E7EB',
    driftOver: '#2F6FC4', driftUnder: '#C2453B', driftMid: '#6B6C73', driftBand: '#EDEDF0',
    series: ['#2F6FC4', '#C24F1C', '#13805A', '#9C6A00', '#6F63D1', '#B83F7F'],
    ramp: ['#5B93D6', '#4A86CE', '#3A79C6', '#2F6FC4', '#2A64B3', '#235799'],
  },
};

const v = (name: string) => `var(--${name})`;

/** CSS-variable references for DOM/SVG colour props. */
export const T = {
  bg: v('bg'), panel: v('panel'), raised: v('raised'), hover: v('hover'), border: v('border'), borderStrong: v('border-strong'),
  text1: v('text-1'), text2: v('text-2'), text3: v('text-3'), accent: v('accent'), up: v('up'), down: v('down'), warn: v('warn'),
  grid: v('grid'),
  driftOver: v('drift-over'), driftUnder: v('drift-under'), driftMid: v('drift-mid'), driftBand: v('drift-band'),
} as const;

export const SERIES = [1, 2, 3, 4, 5, 6].map((i) => v(`series-${i}`)) as readonly string[];
export const RAMP = [1, 2, 3, 4, 5, 6].map((i) => v(`ramp-${i}`)) as readonly string[];
export const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif";

// Theme preference: System / Dark / Light. Persisted in localStorage (best effort), applied as
// data-theme on <html>. index.html runs the same resolution before first paint.
import { useSyncExternalStore } from 'react';
import { PALETTES, type Palette, type ThemeName } from './tokens';

export type ThemePref = 'system' | 'dark' | 'light';
export const THEME_KEY = 'theme';
export const THEME_PREFS: readonly ThemePref[] = ['system', 'dark', 'light'];

const isPref = (x: unknown): x is ThemePref => x === 'system' || x === 'dark' || x === 'light';

export function readPref(): ThemePref {
  try {
    const raw = window.localStorage.getItem(THEME_KEY);
    return isPref(raw) ? raw : 'system';
  } catch {
    return 'system';
  }
}

function systemPrefersLight(): boolean {
  try {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: light)').matches;
  } catch {
    return false;
  }
}

export const resolveTheme = (pref: ThemePref): ThemeName =>
  pref === 'system' ? (systemPrefersLight() ? 'light' : 'dark') : pref;

/** The theme currently applied to the document (dark when unset). */
export const currentTheme = (): ThemeName =>
  document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';

/** Resolved hex palette for the active theme (for Plotly, which cannot read CSS variables). */
export const currentPalette = (): Palette => PALETTES[currentTheme()];

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
let pref: ThemePref = 'system';

function apply() {
  document.documentElement.setAttribute('data-theme', resolveTheme(pref));
  notify();
}

export function setThemePref(next: ThemePref) {
  pref = next;
  try { window.localStorage.setItem(THEME_KEY, next); } catch { /* storage blocked: preference lasts for this page only */ }
  apply();
}

/** Read the stored preference, apply it, and follow OS changes while it is System. Call once at startup. */
export function initTheme() {
  pref = readPref();
  apply();
  try {
    if (typeof window.matchMedia === 'function') {
      window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (pref === 'system') apply(); });
    }
  } catch { /* no media query support: stays on the initial resolution */ }
}

const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };

export function useThemePref(): [ThemePref, (p: ThemePref) => void] {
  return [useSyncExternalStore(subscribe, () => pref), setThemePref];
}

/** The applied theme; components that feed Plotly call this so they re-render on change. */
export function useResolvedTheme(): ThemeName {
  return useSyncExternalStore(subscribe, currentTheme);
}

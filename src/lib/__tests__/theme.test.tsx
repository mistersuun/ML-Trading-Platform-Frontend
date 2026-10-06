import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ThemeToggle from '../../components/ui/ThemeToggle'
import { THEME_KEY, currentTheme, initTheme, readPref, resolveTheme } from '../theme'
import { PALETTES } from '../tokens'

function mockMedia(light: boolean) {
  const listeners: Array<() => void> = []
  const mql = { matches: light, addEventListener: (_: string, l: () => void) => listeners.push(l) }
  vi.stubGlobal('matchMedia', () => mql)
  return { flip: () => { mql.matches = !mql.matches; listeners.forEach((l) => l()) } }
}

describe('theme', () => {
  beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute('data-theme') })
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('defaults to System, which resolves from prefers-color-scheme', () => {
    mockMedia(false)
    expect(readPref()).toBe('system')
    expect(resolveTheme('system')).toBe('dark')
    mockMedia(true)
    expect(resolveTheme('system')).toBe('light')
    expect(resolveTheme('dark')).toBe('dark')
  })

  it('ignores a corrupt stored value', () => {
    localStorage.setItem(THEME_KEY, 'neon')
    expect(readPref()).toBe('system')
  })

  it('toggle applies data-theme and persists the choice', async () => {
    mockMedia(false)
    initTheme()
    render(<ThemeToggle />)
    expect(currentTheme()).toBe('dark')
    expect(screen.getByRole('button', { name: 'System' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Light' }))
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem(THEME_KEY)).toBe('light')
    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Dark' }))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('restores the stored preference on startup', () => {
    mockMedia(false)
    localStorage.setItem(THEME_KEY, 'light')
    initTheme()
    expect(currentTheme()).toBe('light')
  })

  it('System follows OS changes live', () => {
    const media = mockMedia(false)
    initTheme()
    expect(currentTheme()).toBe('dark')
    media.flip()
    expect(currentTheme()).toBe('light')
  })

  it('still works when localStorage throws', async () => {
    mockMedia(false)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    initTheme()
    render(<ThemeToggle compact />)
    await userEvent.click(screen.getByRole('button', { name: 'Light' }))
    expect(currentTheme()).toBe('light')
  })
})

describe('tokens stay in sync with index.css', () => {
  const css = readFileSync('src/index.css', 'utf8')
  const block = (sel: string) => {
    const start = css.indexOf(sel)
    return css.slice(start, css.indexOf('\n}', start))
  }
  const get = (b: string, name: string) => b.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`))?.[1].toLowerCase()
  const keys: Array<[keyof typeof PALETTES.dark, string]> = [
    ['bg', 'bg'], ['panel', 'panel'], ['raised', 'raised'], ['hover', 'hover'], ['border', 'border'], ['borderStrong', 'border-strong'],
    ['text1', 'text-1'], ['text2', 'text-2'], ['text3', 'text-3'], ['accent', 'accent'], ['up', 'up'], ['down', 'down'], ['warn', 'warn'],
    ['grid', 'grid'], ['sidebarHover', 'sidebar-hover'], ['driftOver', 'drift-over'], ['driftUnder', 'drift-under'],
    ['driftMid', 'drift-mid'], ['driftBand', 'drift-band'],
  ]
  for (const [theme, sel] of [['dark', ':root {'], ['light', ':root[data-theme="light"] {']] as const) {
    it(`${theme} palette matches the CSS variables`, () => {
      const b = block(sel)
      const p = PALETTES[theme]
      for (const [k, name] of keys) expect(p[k], name).toBe(get(b, name)?.toUpperCase() ?? '')
      p.series.forEach((c, i) => expect(c.toLowerCase()).toBe(get(b, `series-${i + 1}`)))
      p.ramp.forEach((c, i) => expect(c.toLowerCase()).toBe(get(b, `ramp-${i + 1}`)))
    })
  }
  it('light CSS defines every token that dark does', () => {
    const names = (b: string) => [...b.matchAll(/^\s*--([\w-]+):/gm)].map((m) => m[1]).sort()
    expect(names(block(':root[data-theme="light"] {'))).toEqual(names(block(':root {')))
  })
})

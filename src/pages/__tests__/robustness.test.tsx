import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithClient as render } from '../../test/utils'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '../../test/server'
import ErrorBoundary from '../../components/ErrorBoundary'
import App from '../../App'
import Dashboard from '../Dashboard'
import Settings from '../Settings'
import PairsTrading from '../PairsTrading'

function Boom(): never {
  throw new Error('kaboom')
}

describe('ErrorBoundary', () => {
  it('renders a fallback when a child throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.getByRole('alert')).toHaveTextContent('kaboom')
  })

  it('keeps the sidebar working when a page throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    // malformed payload makes the Dashboard table throw while rendering
    server.use(http.post('*/api/patterns/scan', () =>
      HttpResponse.json({ signals: [null] })))
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /run scan now/i }))
    expect(await screen.findByText(/this page crashed/i)).toBeInTheDocument()
    // sidebar navigation still works
    await userEvent.click(screen.getByRole('link', { name: /settings/i }))
    expect(await screen.findByText('initial capital')).toBeInTheDocument()
  })
})

describe('retry', () => {
  it('Dashboard Retry refetches', async () => {
    let calls = 0
    server.use(http.post('*/api/patterns/scan', () => {
      calls++
      return calls === 1
        ? HttpResponse.json({ error: { code: 'upstream', message: 'feed down' } }, { status: 503 })
        : HttpResponse.json({ signals: [] })
    }))
    render(<Dashboard />)
    await userEvent.click(screen.getByRole('button', { name: /run scan now/i }))
    expect(await screen.findByText(/feed down/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText(/No signals detected/)).toBeInTheDocument()
    expect(calls).toBe(2)
  })

  it('Settings Retry refetches the config', async () => {
    let calls = 0
    server.use(http.get('*/api/config/', ({ request }) => {
      void request
      calls++
      return calls === 1
        ? HttpResponse.json({ detail: 'down' }, { status: 500 })
        : HttpResponse.json({ backtest: { initial_capital: 1 } })
    }))
    render(<Settings />)
    expect(await screen.findByRole('alert')).toHaveTextContent('down')
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('initial capital')).toBeInTheDocument()
  })
})

describe('null handling', () => {
  it('renders null profit_factor as n/a', async () => {
    server.use(http.post('*/api/patterns/scan', () => HttpResponse.json({
      signals: [{ symbol: 'ZZZ', pattern: 'p', signal: 'BUY', days_ago: 1, price: 10, win_rate: 0.5,
        profit_factor: null, sharpe: null, total_return: null, total_trades: 3, is_valid: false }],
    })))
    render(<Dashboard />)
    await userEvent.click(screen.getByRole('button', { name: /run scan now/i }))
    await screen.findByText('ZZZ')
    expect(screen.getAllByText('n/a').length).toBeGreaterThanOrEqual(3)
  })

  it('PairsTrading shows empty state with no pairs', async () => {
    server.use(http.get('*/api/pairs/configured', () => HttpResponse.json({ pairs: [] })))
    render(<MemoryRouter><PairsTrading /></MemoryRouter>)
    expect(await screen.findByText(/No pairs are configured/)).toBeInTheDocument()
  })
})

describe('error handling hygiene', () => {
  it('no catch block in src/pages only calls console.error', () => {
    const files = import.meta.glob('../*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    const names = Object.keys(files)
    expect(names.length).toBeGreaterThanOrEqual(6)
    const offenders: string[] = []
    const re = /catch\s*(\([^)]*\))?\s*\{([^}]*)\}/g
    for (const [name, src] of Object.entries(files)) {
      for (const m of src.matchAll(re)) {
        const body = m[2].replace(/\/\/.*$/gm, '').trim()
        if (/^(console\.error\([^;]*\);?\s*)+$/.test(body) || body === '') offenders.push(name)
      }
      expect(/\|\|\s*0\b/.test(src), `${name} has a '|| 0' fallback`).toBe(false)
    }
    expect(offenders).toEqual([])
  })
})

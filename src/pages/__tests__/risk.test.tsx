import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen, within, fireEvent } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { renderWithClient } from '../../test/utils'
import { server } from '../../test/server'
import { riskPageFixture as fx } from '../../test/handlers'
import Risk from '../Risk'
import { accountStatus, decisionsTitle, equityTitle, etTime, limitsTitle, worstDrawdown } from '../riskModel'

const render = () => renderWithClient(<Risk />)
const use = (body: object) => server.use(http.get('*/api/risk/status', () => HttpResponse.json(body)))
const err = (status: number, code: string, message: string) =>
  server.use(http.get('*/api/risk/status', () => HttpResponse.json({ error: { code, message } }, { status })))

describe('Risk page data', () => {
  beforeEach(() => { vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-30T12:00:00Z')) })
  afterEach(() => { vi.restoreAllMocks() })
  it('renders the hero value formatted, deltas and room', async () => {
    use(fx)
    render()
    expect(await screen.findByText('$9,860.00')).toBeInTheDocument()
    expect(screen.getByText(/−\$220 \(−2\.2%\)|-\$220 \(-2\.2%\)/)).toBeInTheDocument()
    expect(screen.getByText(/from peak \$10,080/)).toBeInTheDocument()
    expect(screen.getByText('Room before risk is halved').nextSibling).toHaveTextContent('$360')
    expect(screen.getByText('Room before halt').nextSibling).toHaveTextContent('$860')
    expect(screen.getByText('Open positions').nextSibling).toHaveTextContent('2 of 8')
    expect(screen.getByText(/Paper trading allowed/)).toBeInTheDocument()
    expect(screen.getByText('Paper only')).toBeInTheDocument()
  })

  it('titles are computed from the data', async () => {
    use(fx)
    render()
    expect(await screen.findByRole('heading', { name: 'The sleeve has never come close to its first risk cut' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Every limit has plenty of headroom' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Last 30 days: 214 order decisions, all blocked before the broker' })).toBeInTheDocument()
  })

  it('renders limits, reasons and the decisions table', async () => {
    use(fx)
    render()
    const meter = await screen.findByRole('meter', { name: 'Open risk to stops: used versus maximum' })
    expect(meter.parentElement).toHaveTextContent('1.2% / 4.0%')
    const reasons = screen.getByRole('list', { name: 'Order decisions by reason' })
    expect(within(reasons).getByText('not_validated')).toBeInTheDocument()
    expect(within(reasons).getByText('168')).toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'Latest order decisions' })
    expect(within(table).getByText('QQQ')).toBeInTheDocument()
    expect(within(table).getAllByText('Mon 17:42')).toHaveLength(2)
    expect(within(table).getByText('Dry run')).toBeInTheDocument()
    expect(within(table).getByText('TRADING_MODE=off')).toBeInTheDocument()
  })

  it('titles flip when halted and when a cut is crossed', async () => {
    use({ ...fx, halted: true, drawdown: -0.105 })
    render()
    expect(await screen.findByRole('heading', { name: 'Trading is halted; the sleeve is 10.5% below its peak' })).toBeInTheDocument()
    expect(screen.getByText('Trading halted').closest('[data-status]')).toHaveAttribute('data-status', 'fail')
  })

  it('halt button is disabled, explains itself and calls nothing', async () => {
    let writes = 0
    server.use(http.post('*/api/*', () => { writes++; return HttpResponse.json({}) }))
    use(fx)
    render()
    const btn = await screen.findByRole('button', { name: /Halt trading/ })
    expect(btn).toBeDisabled()
    expect(btn.parentElement).toHaveAttribute('title', 'Use main.py risk halt')
    fireEvent.click(btn)
    expect(writes).toBe(0)
  })

  it('hover on the chart shows a tooltip with the sleeve value', async () => {
    use(fx)
    render()
    const surface = await screen.findByTestId('hover-surface')
    surface.getBoundingClientRect = () => ({ left: 0, width: 1000, top: 0, height: 220, right: 1000, bottom: 220, x: 0, y: 0, toJSON() {} })
    fireEvent.pointerMove(surface, { clientX: 1000 })
    const tip = screen.getByRole('tooltip')
    expect(tip).toHaveTextContent('2026-09-07')
    expect(tip).toHaveTextContent('Sleeve value $9,860')
  })
})

describe('Risk page states', () => {
  it('shows a loading state first', () => {
    use(fx)
    render()
    expect(screen.getByText('Loading sleeve value…')).toBeInTheDocument()
    expect(screen.getByText('Loading limits…')).toBeInTheDocument()
  })

  it('503 state_not_initialized shows the init command', async () => {
    err(503, 'state_not_initialized', 'Risk state database is missing.')
    render()
    expect(await screen.findByRole('heading', { name: 'Risk state is not set up yet' })).toBeInTheDocument()
    expect(screen.getByText('uv run python main.py risk init')).toBeInTheDocument()
    expect(screen.queryByText('Risk state database is missing.')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('other errors show an ErrorPanel with Retry', async () => {
    err(500, 'internal_error', 'boom')
    render()
    expect(await screen.findByRole('alert')).toHaveTextContent('boom')
    use(fx)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('$9,860.00')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('empty history, reasons and decisions render empty states', async () => {
    use({ ...fx, equity_history: [], decision_total: 0, decision_reasons: [], decisions: [], sleeve_value: null, peak: null, drawdown: null, open_positions: null })
    render()
    expect(await screen.findByRole('heading', { name: 'No sleeve readings recorded yet' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'No order decisions in the last 30 days' })).toBeInTheDocument()
    expect(screen.getAllByText('No order decisions recorded yet.').length).toBe(2)
    expect(screen.getByText('Open positions').nextSibling).toHaveTextContent('n/a of 8')
    expect(screen.getByText('n/a', { selector: 'div' })).toBeInTheDocument()
  })
})

describe('riskModel', () => {
  it('worstDrawdown follows the running peak', () => {
    expect(worstDrawdown([])).toBeNull()
    expect(worstDrawdown(fx.equity_history)).toBeCloseTo(9860 / 10080 - 1, 6)
  })
  it('equity title covers never-close, crossed cut and crossed halt', () => {
    expect(equityTitle({ ...fx, equity_history: [{ ts: 'a', sleeve_equity: 10000, peak: 10000 }, { ts: 'b', sleeve_equity: 9950, peak: 10000 }] } as never)).toBe('The sleeve has never come close to its first risk cut')
    expect(equityTitle({ ...fx, equity_history: [{ ts: 'a', sleeve_equity: 10000, peak: 10000 }, { ts: 'b', sleeve_equity: 9400, peak: 10000 }] } as never)).toBe('The sleeve has hit 1 of its 2 risk cuts; its worst drawdown is 6.0%')
    expect(equityTitle({ ...fx, equity_history: [{ ts: 'a', sleeve_equity: 10000, peak: 10000 }, { ts: 'b', sleeve_equity: 8900, peak: 10000 }] } as never)).toBe('The sleeve has fallen past its 10% halt level (worst 11.0%)')
    expect(equityTitle({ ...fx, equity_history: [] } as never)).toBe('No sleeve readings recorded yet')
  })
  it('limits title covers full, close and unavailable', () => {
    const l = (used: number | null) => [{ key: 'k', label: 'Positions', used, maximum: 8, unit: 'count' }] as never
    expect(limitsTitle(l(8))).toBe('Positions is at its maximum')
    expect(limitsTitle(l(7))).toBe('Positions is close to its limit, at 88% of the maximum')
    expect(limitsTitle(l(5))).toBe('Every limit has headroom; the busiest, positions, is at 63% of its maximum')
    expect(limitsTitle(l(null))).toBe('Limit usage is not available yet')
  })
  it('decisions title covers none blocked and mixed', () => {
    const d = (reasons: { reason: string; count: number }[], total: number) => ({ ...fx, decision_total: total, decision_reasons: reasons }) as never
    expect(decisionsTitle(d([{ reason: 'dry_run', count: 3 }], 3))).toBe('Last 30 days: 3 order decisions, none blocked')
    expect(decisionsTitle(d([{ reason: 'dry_run', count: 2 }, { reason: 'duplicate', count: 1 }], 3))).toBe('Last 30 days: 3 order decisions, 1 blocked before the broker')
  })
  it('formats ET time', () => {
    const now = Date.parse('2026-09-30T12:00:00Z')
    expect(etTime('2026-09-28T21:42:00+00:00', now)).toBe('Mon 17:42')
    expect(etTime('2026-09-28T21:42:00', now)).toBe('Mon 17:42')
    expect(etTime('2026-09-28T21:42:00', Date.parse('2026-10-05T12:00:00Z'))).toBe('Mon 28 Sep 17:42')
    expect(etTime('garbage')).toBe('garbage')
  })
})

describe('Risk account (IBKR) panel', () => {
  it('shows net liquidation, margin loan, leverage, excess liquidity, maintenance margin and a status glyph + word', async () => {
    use(fx)
    render()
    const panel = await screen.findByRole('region', { name: 'Account (IBKR)' })
    const w = within(panel)
    expect(w.getByText('Net liquidation').nextSibling).toHaveTextContent('CA$100,000')
    expect(w.getByText('Margin loan').nextSibling).toHaveTextContent('−CA$57,000')
    expect(w.getByText('Leverage').nextSibling).toHaveTextContent('1.57x')
    expect(w.getByText('Excess liquidity').nextSibling).toHaveTextContent('CA$31,000')
    expect(w.getByText('Maintenance margin').nextSibling).toHaveTextContent('CA$52,000')
    const status = w.getByText('Status').nextSibling as HTMLElement
    expect(status).toHaveTextContent('! Leveraged above 1.00x')
    expect(status.querySelector('[data-status="warn"]')).not.toBeNull()
  })
  it('status logic', () => {
    expect(accountStatus({ leverage: 0.9, margin_headroom: 5000 }).kind).toBe('pass')
    expect(accountStatus({ leverage: 1.0 }).kind).toBe('pass')
    expect(accountStatus({ leverage: 1.57 }).kind).toBe('warn')
    expect(accountStatus({ leverage: 1.57, margin_headroom: 0 }).kind).toBe('fail')
    expect(accountStatus({ available: false }).kind).toBe('recorded')
  })
})

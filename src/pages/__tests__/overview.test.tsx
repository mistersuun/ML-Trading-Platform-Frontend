import { describe, it, expect } from 'vitest'
import { screen, within, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { renderWithClient } from '../../test/utils'
import { server } from '../../test/server'
import { overviewFixture, riskFixture, funnelFixture, proposalFixture, nightly } from '../../test/handlers'
import Overview from '../Overview'
import { allocationTitle, funnelTitle, performanceTitle, rangeLabel, riskTitle } from '../overviewModel'

const render = () => renderWithClient(<MemoryRouter><Overview /></MemoryRouter>)
const err = (status: number, code: string, message: string) =>
  HttpResponse.json({ error: { code, message } }, { status })
const useScan = (funnel: unknown = funnelFixture, extra: object = {}) =>
  server.use(http.get('*/api/results/technical/latest', () => HttpResponse.json({ ...nightly, funnel, ...extra })))

describe('Overview data', () => {
  it('renders the hero value formatted and the day change', async () => {
    useScan()
    render()
    expect(await screen.findByText('$124,380.52')).toBeInTheDocument()
    expect(screen.getByText(/\+\$612\.40 \(\+0\.49%\)/)).toBeInTheDocument()
    expect(screen.getByText('Cash available').nextSibling).toHaveTextContent('$4,560')
    expect(screen.getByText('Core portfolio · IBKR')).toBeInTheDocument()
    expect(screen.getByText(/\$9,860 \(not real money\)/)).toBeInTheDocument()
  })

  it('titles are computed from the data (ahead)', async () => {
    useScan()
    render()
    expect(await screen.findByRole('heading', { name: 'Portfolio is ahead of a plain 60/40 by 2.7 points over the last year' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Allocation is close to target; international equity is 3 points under' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: '780 ideas tested tonight, none survived every check' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Signal sleeve is 1.4% below its peak; trading halts at 10%' })).toBeInTheDocument()
  })

  it('titles flip when the portfolio is behind', async () => {
    server.use(http.get('*/api/portfolio/overview', () =>
      HttpResponse.json({ ...overviewFixture, period_return: 0.05, benchmark_return: 0.0812 })))
    render()
    expect(await screen.findByRole('heading', { name: 'Portfolio is behind a plain 60/40 by 3.1 points over the last year' })).toBeInTheDocument()
  })

  it('shows the funnel stages and the signal-to-order flow with the allocation lane', async () => {
    useScan({ tested: 780, min_trades: 312, oos_positive: 41, psr: 3, bh: 2, orders: 1 })
    render()
    const funnel = await screen.findByRole('list', { name: 'Scan funnel' })
    expect(within(funnel).getByText('Candidates tested').parentElement).toHaveTextContent('780')
    expect(within(funnel).getByText('Eligible for an order').parentElement).toHaveTextContent('1')
    expect(await screen.findByRole('heading', { name: '780 ideas tested tonight, 2 survived every check' })).toBeInTheDocument()
    const flow = screen.getByRole('list', { name: 'Signal to order' })
    expect(within(flow).getByText('780 candidates')).toBeInTheDocument()
    expect(within(flow).getByText('✓ clear')).toBeInTheDocument()
    expect(within(flow).getByText('paper only')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('lane-text')).toHaveTextContent('3 buys'))
    expect(screen.getByRole('link', { name: /buy 41 VEA, buy 108 PDBC, buy 11 TLT/ })).toHaveAttribute('href', '/allocation')
  })

  it('a halted account shows in the flow and the risk title', async () => {
    server.use(http.get('*/api/risk/status', () => HttpResponse.json({ ...riskFixture, halted: true, drawdown: -0.105 })))
    render()
    expect(await screen.findByText('✕ halted')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Trading is halted; the signal sleeve is 10\.5% below its peak/ })).toBeInTheDocument()
  })
})

describe('Overview states', () => {
  it('shows how to create holdings.csv on no_holdings but still renders scan and risk panels', async () => {
    useScan()
    server.use(http.get('*/api/portfolio/overview', () =>
      err(404, 'no_holdings', 'No holdings file. Create state/holdings.csv with symbol,quantity and CASH rows.')))
    render()
    expect(await screen.findByRole('heading', { name: 'No holdings file found' })).toBeInTheDocument()
    expect(screen.getAllByText(/state\/holdings\.csv/).length).toBeGreaterThan(0)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(await screen.findByRole('heading', { name: '780 ideas tested tonight, none survived every check' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: /Signal sleeve is 1\.4% below its peak/ })).toBeInTheDocument()
  })

  it('shows loading placeholders first', () => {
    render()
    expect(screen.getByText('Loading portfolio…')).toBeInTheDocument()
    expect(screen.getByText('Loading the nightly scan…')).toBeInTheDocument()
    expect(screen.getByText('Loading risk status…')).toBeInTheDocument()
  })

  it('shows an ErrorPanel with Retry that recovers', async () => {
    let fail = true
    server.use(http.get('*/api/portfolio/overview', () =>
      fail ? err(500, 'internal', 'boom') : HttpResponse.json(overviewFixture)))
    render()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('boom')
    fail = false
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('$124,380.52')).toBeInTheDocument()
  })

  it('errors in the risk and scan panels stay in those panels', async () => {
    server.use(
      http.get('*/api/risk/status', () => err(500, 'internal', 'risk down')),
      http.get('*/api/results/technical/latest', () => err(500, 'internal', 'scan down')),
    )
    render()
    expect(await screen.findByText('$124,380.52')).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2))
    expect(screen.getByText('risk down')).toBeInTheDocument()
    expect(screen.getByText('scan down')).toBeInTheDocument()
  })

  it('handles no stored scan, a pre-funnel scan and an unset risk database', async () => {
    server.use(http.get('*/api/risk/status', () => err(503, 'state_not_initialized', 'Run main.py risk init')))
    render()
    expect(await screen.findByText('No nightly scan stored yet')).toBeInTheDocument()
    expect(await screen.findByText('Risk state is not set up yet')).toBeInTheDocument()
    expect(screen.getByText('Run main.py risk init')).toBeInTheDocument()
  })

  it('a scan stored before funnels existed says so', async () => {
    useScan(null)
    render()
    expect(await screen.findByText('Scan funnel is not available')).toBeInTheDocument()
  })

  it('an empty series gives chart empty states, not NaN', async () => {
    server.use(http.get('*/api/portfolio/overview', () =>
      HttpResponse.json({ ...overviewFixture, series: [], period_return: null, benchmark_return: null, max_drawdown: null, allocation: [], day_change: null, day_change_pct: null })))
    const { container } = render()
    expect(await screen.findByText('No price history in this range.')).toBeInTheDocument()
    expect(screen.getByText('No priced holdings to group.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Not enough price history to compare with a plain 60/40' })).toBeInTheDocument()
    expect(container.innerHTML).not.toMatch(/NaN|undefined/)
  })
})

describe('Overview interactions', () => {
  it('range buttons refetch with the mapped range and update pressed state', async () => {
    const seen: string[] = []
    server.use(http.get('*/api/portfolio/overview', ({ request }) => {
      const r = new URL(request.url).searchParams.get('range')!
      seen.push(r)
      return HttpResponse.json({ ...overviewFixture, range: r })
    }))
    render()
    await screen.findByText('$124,380.52')
    const group = screen.getByRole('group', { name: 'Range' })
    expect(within(group).getByRole('button', { name: '1Y' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(within(group).getByRole('button', { name: 'All' }))
    await waitFor(() => expect(seen).toContain('ALL'))
    expect(within(group).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(group).getByRole('button', { name: '1Y' })).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(within(group).getByRole('button', { name: '3M' }))
    await waitFor(() => expect(seen).toContain('3M'))
    expect(await screen.findByRole('heading', { name: /over the last 3 months/ })).toBeInTheDocument()
  })

  it('contribution field re-requests the proposal', async () => {
    const seen: string[] = []
    server.use(http.get('*/api/allocation/proposal', ({ request }) => {
      seen.push(new URL(request.url).searchParams.get('contribution')!)
      return HttpResponse.json(proposalFixture)
    }))
    render()
    await waitFor(() => expect(seen).toEqual(['0']))
    const field = await screen.findByLabelText(/new cash to invest/i)
    await userEvent.clear(field)
    await userEvent.type(field, '2500')
    await userEvent.click(screen.getByRole('button', { name: 'Update proposal' }))
    await waitFor(() => expect(seen).toContain('2500'))
    await userEvent.clear(field)
    await userEvent.type(field, '-5')
    expect(screen.getByRole('button', { name: 'Update proposal' })).toBeDisabled()
  })

  it('hovering the growth chart shows both values in a tooltip', async () => {
    render()
    await screen.findByText('$124,380.52')
    const chart = screen.getByRole('figure', { name: /Growth of \$100/ })
    const surface = within(chart).getByTestId('hover-surface')
    surface.getBoundingClientRect = () => ({ left: 0, width: 300, top: 0, height: 240, right: 300, bottom: 240, x: 0, y: 0, toJSON: () => ({}) })
    fireEvent.pointerMove(surface, { clientX: 150 })
    const tip = await within(chart).findByRole('tooltip')
    expect(tip).toHaveTextContent(/Portfolio/)
    expect(tip).toHaveTextContent(/60\/40 benchmark/)
    expect(tip).toHaveTextContent(/\$\d+/)
  })
})

describe('title helpers', () => {
  it('performanceTitle covers ahead, behind, level and missing data', () => {
    expect(performanceTitle(0.1, 0.05, 'the last year')).toBe('Portfolio is ahead of a plain 60/40 by 5.0 points over the last year')
    expect(performanceTitle(0.05, 0.1, 'this year')).toBe('Portfolio is behind a plain 60/40 by 5.0 points over this year')
    expect(performanceTitle(0.1, 0.1, 'this year')).toBe('Portfolio is level with a plain 60/40 over this year')
    expect(performanceTitle(0.1, null, 'this year')).toMatch(/no 60\/40 comparison/)
    expect(performanceTitle(null, null, 'this year')).toMatch(/Not enough price history/)
  })
  it('rangeLabel derives the All span from the data', () => {
    expect(rangeLabel('YTD')).toBe('this year')
    expect(rangeLabel('All', ['2024-10-05', '2026-10-05'])).toBe('the last 2 years')
    expect(rangeLabel('All', ['2026-04-05', '2026-10-05'])).toBe('the last 6 months')
    expect(rangeLabel('All')).toBe('the full history')
  })
  it('allocationTitle covers on target, close, and drifted', () => {
    const g = (label: string, drift: number) => ({ key: label, label, target: 0.3, now: 0.3 + drift, drift })
    expect(allocationTitle([g('US equity', 0.002)])).toBe('Allocation is on target')
    expect(allocationTitle([g('US equity', 0.01), g('Treasuries', -0.012)])).toBe('Allocation is close to target; treasuries is 1 point under')
    expect(allocationTitle([g('US equity', 0.07)])).toBe('Allocation has drifted: US equity is 7 points over target')
    expect(allocationTitle([])).toBe('No allocation to compare with target')
  })
  it('funnelTitle and riskTitle handle edge cases', () => {
    expect(funnelTitle({ ...funnelFixture, tested: 0, min_trades: 0, oos_positive: 0, psr: 0 }, 2)).toBe('No ideas were tested tonight')
    expect(funnelTitle(funnelFixture, 50)).toBe('780 ideas tested in the latest scan, none survived every check')
    expect(riskTitle({ ...riskFixture, drawdown: 0 } as never)).toBe('Signal sleeve is at its peak; trading halts at 10%')
    expect(riskTitle({ ...riskFixture, drawdown: null } as never)).toBe('The signal sleeve has no equity reading yet')
    expect(riskTitle({ ...riskFixture, kill_switch: true } as never)).toMatch(/kill switch/)
  })
})

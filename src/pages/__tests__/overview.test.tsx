import { describe, it, expect } from 'vitest'
import { screen, within, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { renderWithClient } from '../../test/utils'
import { server } from '../../test/server'
import { overviewFixture, unleveredOverviewFixture, riskFixture, funnelFixture, proposalFixture, nightly } from '../../test/handlers'
import Overview from '../Overview'
import { groupValues, groupValueRows, otherLine, cashAvailable, isOverLeveraged, leverageWarningText, profileLabel, sourceLabel, wipeoutFall, allocationTitle, funnelTitle, funnelItems, funnelFootnote, performanceTitle, rangeLabel, riskTitle } from '../overviewModel'

const render = () => renderWithClient(<MemoryRouter><Overview /></MemoryRouter>)
const err = (status: number, code: string, message: string) =>
  HttpResponse.json({ error: { code, message } }, { status })
const useScan = (funnel: unknown = funnelFixture, extra: object = {}) =>
  server.use(http.get('*/api/results/technical/latest', () => HttpResponse.json({ ...nightly, funnel, ...extra })))

describe('Overview data', () => {
  it('renders the hero value formatted and the day change', async () => {
    useScan()
    render()
    expect(await screen.findByText('CA$100,000.00')).toBeInTheDocument()
    expect(screen.getByText(/\+CA\$612\.40 \(\+0\.49%\)/)).toBeInTheDocument()
    expect(screen.getByText('Net worth')).toBeInTheDocument()
    // a negative cash balance is the margin loan (breakdown row), not 'available' cash
    expect(screen.getByText('Cash available').nextSibling).toHaveTextContent('CA$0')
    expect(screen.getByText('Cash available').nextSibling).not.toHaveTextContent('−')
    expect(screen.getAllByText('US equity').length).toBeGreaterThan(0)
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
    useScan({ tested: 780, min_trades: 312, oos_positive: 41, psr: 3, bh: 2, dsr: 1, orders: 1, n_trials: 780, pbo: 0.55 })
    render()
    const funnel = await screen.findByRole('list', { name: 'Scan funnel' })
    expect(within(funnel).getByText('Candidates tested').parentElement).toHaveTextContent('780')
    expect(within(funnel).getByText('Beats random entry (BH)').parentElement).toHaveTextContent('2')
    expect(within(funnel).getByText('Survives deflated Sharpe').parentElement).toHaveTextContent('1')
    expect(within(funnel).getByText('Eligible for an order').parentElement).toHaveTextContent('1')
    expect(screen.getByText(/Deflated against 780 trials · overfitting probability 0\.55 \(advisory, not a gate\)/)).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: '780 ideas tested tonight, 1 survived every check' })).toBeInTheDocument()
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
    expect(await screen.findByText('CA$100,000.00')).toBeInTheDocument()
  })

  it('errors in the risk and scan panels stay in those panels', async () => {
    server.use(
      http.get('*/api/risk/status', () => err(500, 'internal', 'risk down')),
      http.get('*/api/results/technical/latest', () => err(500, 'internal', 'scan down')),
    )
    render()
    expect(await screen.findByText('CA$100,000.00')).toBeInTheDocument()
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
    await screen.findByText('CA$100,000.00')
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
    await screen.findByText('CA$100,000.00')
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
  it('a funnel stored before the deflated-Sharpe gate shows no invented stage and counts BH survivors', () => {
    const old = { tested: 780, min_trades: 312, oos_positive: 41, psr: 3, bh: 2, orders: 0 }
    expect(funnelItems(old).map((i) => i.label)).not.toContain('Survives deflated Sharpe')
    expect(funnelTitle(old, 2)).toBe('780 ideas tested tonight, 2 survived every check')
    expect(funnelFootnote(old)).toBe('')
    const now = { ...old, dsr: 0, n_trials: 780 }
    expect(funnelItems(now).map((i) => i.label)).toEqual([
      'Candidates tested', 'Enough out-of-sample trades', 'Positive out of sample', 'Passes the PSR check',
      'Beats random entry (BH)', 'Survives deflated Sharpe', 'Eligible for an order'])
    expect(funnelTitle(now, 2)).toBe('780 ideas tested tonight, none survived every check')
  })
  it('funnelTitle and riskTitle handle edge cases', () => {
    expect(funnelTitle({ ...funnelFixture, tested: 0, min_trades: 0, oos_positive: 0, psr: 0 }, 2)).toBe('No ideas were tested tonight')
    expect(funnelTitle(funnelFixture, 50)).toBe('780 ideas tested in the latest scan, none survived every check')
    expect(riskTitle({ ...riskFixture, drawdown: 0 } as never)).toBe('Signal sleeve is at its peak; trading halts at 10%')
    expect(riskTitle({ ...riskFixture, drawdown: null } as never)).toBe('The signal sleeve has no equity reading yet')
    expect(riskTitle({ ...riskFixture, kill_switch: true } as never)).toMatch(/kill switch/)
  })
})

describe('Overview account (net worth, margin, leverage)', () => {
  it('hero is net worth in CA$ with the breakdown row, leverage meter and factual warning', async () => {
    useScan()
    render()
    await screen.findByText('CA$100,000.00')
    expect(screen.getByTestId('net-breakdown')).toHaveTextContent('Positions CA$157,000 · Margin loan −CA$57,000 · Net CA$100,000')
    const meter = screen.getByRole('meter', { name: 'Leverage' })
    expect(meter).toHaveAttribute('aria-valuenow', '1.57')
    expect(meter.parentElement).toHaveTextContent('1.57x')
    expect(screen.getByTestId('leverage-warning')).toHaveTextContent(
      'You are borrowing CA$57,000 on margin (1.57x). A 64% fall in your holdings would wipe out your equity.')
    // the backend's own leverage sentence is not repeated in the generic banner
    expect(screen.queryByText(/Leverage 1\.57x is above/)).not.toBeInTheDocument()
    expect(screen.getByText(/not converted to CAD/)).toBeInTheDocument()
  })

  it('"Where the money is" lists groups with values and the snapshot source label', async () => {
    useScan()
    render()
    await screen.findByText('CA$100,000.00')
    expect(screen.getByText('Where the money is')).toBeInTheDocument()
    // 0.379 * 157,000 = 59,503
    const where = screen.getByRole('region', { name: 'Where the money is' })
    expect(within(where).getByText('US equity').parentElement).toHaveTextContent('CA$59,503')
    expect(screen.getByTestId('source-label')).toHaveTextContent('IBKR snapshot as of 2026-09-30 20:05 UTC')
  })

  it('group values come from the backend, with an Unclassified row so they add up to positions', async () => {
    useScan()
    const groups = [
      { key: 'us_equity', label: 'US equity', target: 0.3, now: 0.6, drift: 0.3, value: 40000 },
      { key: 'canadian_equity', label: 'Canadian equity', target: 0.1, now: 0.4, drift: 0.3, value: 27000 },
    ]
    server.use(http.get('*/api/portfolio/overview', () => HttpResponse.json({
      ...overviewFixture, allocation: groups, unclassified_value: 25000, positions_value: 92000, other_value: 1234.4 })))
    render()
    await screen.findByText('CA$100,000.00')
    const where = screen.getByRole('region', { name: 'Where the money is' })
    expect(within(where).getByText('US equity').parentElement).toHaveTextContent('CA$40,000')       // not 0.6 x 92,000
    expect(within(where).getByText('Unclassified').parentElement).toHaveTextContent('CA$25,000')
    expect(within(where).getByText('Unclassified').parentElement).toHaveTextContent('27%')
    expect(screen.getByTestId('net-breakdown')).toHaveTextContent('Margin loan −CA$57,000 · Other +CA$1,234 · Net CA$100,000')
  })

  it('no warning, holdings.csv label and USD when there is no borrowing', async () => {
    useScan()
    server.use(http.get('*/api/portfolio/overview', () => HttpResponse.json(unleveredOverviewFixture)))
    render()
    expect(await screen.findByText('$124,380.52')).toBeInTheDocument()
    expect(screen.queryByTestId('leverage-warning')).not.toBeInTheDocument()
    expect(screen.getByTestId('source-label')).toHaveTextContent('holdings.csv')
    expect(screen.getByTestId('net-breakdown')).toHaveTextContent('Margin loan $0')
  })

  it('no warning at exactly the threshold, warning just above it', async () => {
    useScan()
    server.use(http.get('*/api/portfolio/overview', () => HttpResponse.json({ ...overviewFixture, leverage: 1.0, margin_loan: 0 })))
    const first = render()
    await screen.findByText('CA$100,000.00')
    expect(screen.queryByTestId('leverage-warning')).not.toBeInTheDocument()
    first.unmount()
    server.use(http.get('*/api/portfolio/overview', () => HttpResponse.json({ ...overviewFixture, leverage: 1.01, margin_loan: 1000 })))
    render()
    expect(await screen.findByTestId('leverage-warning')).toHaveTextContent('A 99% fall')
  })
})

describe('account model', () => {
  it('wipeout fall is 1 / leverage (equity = G(1-f) - L = 0)', () => {
    expect(wipeoutFall(1.57)).toBeCloseTo(0.6369, 3)
    expect(wipeoutFall(2)).toBe(0.5)
    expect(wipeoutFall(1)).toBe(1)
    expect(wipeoutFall(0)).toBeNull()
    expect(wipeoutFall(null)).toBeNull()
    // cross-check with gross/loan: G = 157,000, L = 57,000 -> f = 1 - L/G
    expect(wipeoutFall(157000 / 100000)).toBeCloseTo(1 - 57000 / 157000, 10)
  })
  it('warning only strictly above the threshold, text computed from the data', () => {
    expect(isOverLeveraged(1.0)).toBe(false)
    expect(isOverLeveraged(1.0001)).toBe(true)
    expect(isOverLeveraged(null)).toBe(false)
    expect(isOverLeveraged(1.4, 1.5)).toBe(false)
    expect(leverageWarningText(0.9, 0, 'CAD')).toBeNull()
    expect(leverageWarningText(1.0, 0, 'CAD')).toBeNull()
    expect(leverageWarningText(1.57, 57000, 'CAD')).toBe(
      'You are borrowing CA$57,000 on margin (1.57x). A 64% fall in your holdings would wipe out your equity.')
    expect(leverageWarningText(2, 50000, 'CAD')).toContain('A 50% fall')
  })
  it('source label', () => {
    expect(sourceLabel('ibkr', '2026-09-30T20:05:00+00:00')).toBe('IBKR snapshot as of 2026-09-30 20:05 UTC')
    expect(sourceLabel('holdings_csv', null)).toBe('holdings.csv')
    expect(sourceLabel(undefined, undefined)).toBe('holdings.csv')
  })
  it('value rows, other line and cash available', () => {
    const g = [{ key: 'a', label: 'A', target: 0.5, now: 0.9, drift: 0, value: 30 }, { key: 'b', label: 'B', target: 0.5, now: 0.1, drift: 0, value: 10 }]
    const rows = groupValueRows(g, 60, 100)!
    expect(rows.map((r) => [r.label, r.value, r.share])).toEqual([['A', 30, 0.3], ['B', 10, 0.1], ['Unclassified', 60, 0.6]])
    expect(groupValueRows(g, 0, 100)!.map((r) => r.label)).toEqual(['A', 'B'])
    expect(groupValueRows(g, null, 100)!.length).toBe(2)
    expect(groupValueRows([], 5, 100)).toBeNull()
    expect(groupValueRows([{ key: 'a', label: 'A', target: 0, now: 0.5, drift: 0 }], 0, null)).toBeNull()
    expect(groupValues(g, 1000)[0].value).toBe(30)                      // the backend value wins over share x positions
    expect(otherLine(0.2)).toBeNull(); expect(otherLine(-300)).toBe(-300); expect(otherLine(null)).toBeNull()
    expect(cashAvailable(-57000)).toBe(0); expect(cashAvailable(4560)).toBe(4560); expect(cashAvailable(null)).toBeNull()
  })

  it('group values and profile label', () => {
    expect(groupValues([{ key: 'a', label: 'A', target: 0.5, now: 0.25, drift: 0 }], 1000)[0].value).toBe(250)
    expect(groupValues([{ key: 'a', label: 'A', target: 0.5, now: 0.25, drift: 0 }], null)[0].value).toBeNull()
    expect(profileLabel('cad')).toBe('CAD profile (D14, approved)')
    expect(profileLabel('us')).toBe('US profile')
  })
})

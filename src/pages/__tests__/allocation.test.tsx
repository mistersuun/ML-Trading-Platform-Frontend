import { describe, it, expect } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { renderWithClient } from '../../test/utils'
import { server } from '../../test/server'
import { allocationFixture } from '../../test/handlers'
import Allocation from '../Allocation'
import { parseContribution, driftTitle, mixTitle, trendTitle, tradesTitle } from '../allocationModel'

const serve = (data: object = allocationFixture, onReq?: (url: URL) => void) =>
  server.use(http.get('*/api/allocation/proposal', ({ request }) => {
    onReq?.(new URL(request.url))
    return HttpResponse.json(data)
  }))
const err = (status: number, code: string, message: string) =>
  HttpResponse.json({ error: { code, message } }, { status })
const render = () => renderWithClient(<Allocation />)
const h = (name: string | RegExp) => screen.findByRole('heading', { name })

describe('Allocation data', () => {
  it('renders the hero value, cash line, furthest sleeve and trade summary', async () => {
    serve()
    render()
    expect(await screen.findByText('$119,820')).toBeInTheDocument()
    expect(screen.getByText('$4,560 + $0')).toBeInTheDocument()
    expect(screen.getByText('VEA −5.5 pts')).toBeInTheDocument()
    expect(screen.getByText('3 buys · $4,608')).toBeInTheDocument()
    expect(screen.getByText(/Proposals only — you place the orders in IBKR/)).toBeInTheDocument()
    expect(screen.getByText(/prices at close Wed 30 Sep/)).toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'Proposed trades' })
    expect(within(table).getByText('VEA').closest('tr')).toHaveTextContent('Buy41$2,112')
    expect(screen.getByText('Cash left after trades: $150')).toBeInTheDocument()
  })

  it('panel titles are computed from the data', async () => {
    serve()
    render()
    expect(await h('After these 3 buys, every sleeve is inside its band')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Developed ex-US (VEA) is the one sleeve outside its band' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'International equity is 5.2 points under target, 1.0 after the proposed trades' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Trend sleeve: 2 of 6 markets are above their trend, 2 only partly' })).toBeInTheDocument()
  })

  it('titles flip when no sleeve is outside / sleeves stay outside', () => {
    const rows = allocationFixture.rows
    const inBand = rows.map((r) => ({ ...r, outside: false }))
    expect(driftTitle(inBand)).toBe('Every sleeve is inside its band')
    const two = rows.map((r) => (['VEA', 'VTI'].includes(r.symbol) ? { ...r, outside: true } : { ...r, outside: false }))
    expect(driftTitle(two)).toBe('2 sleeves are outside their band; VEA is furthest')
    const noTrades = { ...allocationFixture, trades: [] }
    expect(tradesTitle({ ...noTrades, rows: inBand })).toBe('No trades needed: every sleeve is inside its band')
    // VEA stays outside after one small trade
    const small = { ...allocationFixture, trades: [allocationFixture.trades[0]],
      rows: rows.map((r) => (r.symbol === 'VEA' ? { ...r, trade_shares: 1, trade_value: 51.5 } : { ...r, trade_value: 0 })) }
    expect(tradesTitle(small)).toBe('After this buy, 1 sleeve is still outside the band')
    expect(mixTitle(allocationFixture.groups.map((g) => ({ ...g, drift: 0 })))).toBe('Every asset group is on target')
    expect(mixTitle([{ key: 'a', label: 'US equity', target: 0.3, now: 0.36, drift: 0.06, after: null }]))
      .toBe('US equity is 6.0 points over target')
    expect(trendTitle(allocationFixture.trend.map((t) => ({ ...t, state: 'tbills' }))))
      .toBe('Trend sleeve: no market is above its trend, so it sits in T-bills')
    expect(trendTitle([])).toBe('No trend data to judge the trend sleeve')
  })

  it('shows the drift rows with the flag and the three mix bars', async () => {
    serve()
    render()
    const drift = await screen.findByRole('group', { name: 'Drift from target by ETF' })
    const vea = drift.querySelector('[data-row="VEA"]') as HTMLElement
    expect(vea).toHaveTextContent('−5.5')
    expect(vea).toHaveTextContent('! outside')
    expect(drift.querySelector('[data-row="VTI"]')).toHaveTextContent('in band')
    for (const n of ['Mix target', 'Mix now', 'Mix after proposed trades']) {
      expect(screen.getByRole('img', { name: new RegExp(`^${n}:`) })).toBeInTheDocument()
    }
    expect(within(screen.getByRole('list', { name: 'Trend markets' })).getAllByRole('listitem')).toHaveLength(6)
    expect(document.querySelector('[data-trend="SPY"]')).toHaveTextContent('Held')
    expect(document.querySelector('[data-trend="VEA"]')).toHaveTextContent('2 of 3')
    expect(document.querySelector('[data-trend="VEA"]')).toHaveTextContent('8/10/12m votes ✓✓✕ · weight 1.11%')
  })
})

describe('Allocation states', () => {
  it('shows loading placeholders first', () => {
    serve()
    render()
    expect(screen.getAllByText(/^Loading/).length).toBeGreaterThan(3)
  })

  it('shows an error with Retry that recovers', async () => {
    server.use(http.get('*/api/allocation/proposal', () => err(502, 'missing_prices', 'No usable prices for VEA')))
    render()
    expect(await screen.findByText('No usable prices for VEA')).toBeInTheDocument()
    serve()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('$119,820')).toBeInTheDocument()
  })

  it('explains the missing holdings file', async () => {
    server.use(http.get('*/api/allocation/proposal', () => err(404, 'no_holdings', 'No holdings file')))
    render()
    expect(await h('No holdings file found')).toBeInTheDocument()
    expect(screen.getByText(/symbol,quantity/)).toBeInTheDocument()
  })

  it('empty data gives empty states in every panel', async () => {
    serve({ ...allocationFixture, rows: [], trades: [], groups: [], trend: [] })
    render()
    expect(await h('No sleeves to propose trades for')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'No sleeves to compare with target' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'No asset groups to compare with target' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'No trend data to judge the trend sleeve' })).toBeInTheDocument()
    expect(screen.getByText('No trades proposed.')).toBeInTheDocument()
    expect(screen.getByText('No sleeves to show.')).toBeInTheDocument()
    expect(screen.getByText('No asset groups to show.')).toBeInTheDocument()
    expect(screen.getByText('No trend markets to show.')).toBeInTheDocument()
  })
})

describe('Allocation interactions', () => {
  it('re-queries with the contribution and shows it', async () => {
    const seen: string[] = []
    serve(allocationFixture, (url) => seen.push(url.searchParams.get('contribution') ?? ''))
    render()
    await screen.findByText('$119,820')
    server.use(http.get('*/api/allocation/proposal', ({ request }) => {
      seen.push(new URL(request.url).searchParams.get('contribution') ?? '')
      return HttpResponse.json({ ...allocationFixture, contribution: 2000 })
    }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Contribution' }), '2000')
    await waitFor(() => expect(seen).toContain('2000'))
    expect(await screen.findByText('$4,560 + $2,000')).toBeInTheDocument()
  })

  it('rejects a negative contribution without querying', async () => {
    const seen: string[] = []
    serve(allocationFixture, (url) => seen.push(url.searchParams.get('contribution') ?? ''))
    render()
    await screen.findByText('$119,820')
    await userEvent.type(screen.getByRole('textbox', { name: 'Contribution' }), '-5')
    expect(await screen.findByText('Enter 0 or more')).toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 450))
    expect(seen).toEqual(['0'])
  })

  it('parses contribution text', () => {
    expect(parseContribution('')).toBe(0)
    expect(parseContribution('$2,000')).toBe(2000)
    expect(parseContribution('-1')).toBeNull()
    expect(parseContribution('abc')).toBeNull()
  })

  it('hover title on a mix segment shows its share', async () => {
    serve()
    render()
    const now = await screen.findByRole('img', { name: /^Mix now:/ })
    expect(now.querySelector('[data-segment="International equity"]')).toHaveAttribute('title', 'International equity 17.8%')
  })
})

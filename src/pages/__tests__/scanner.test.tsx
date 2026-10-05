import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse, delay } from 'msw'
import { renderWithClient as render } from '../../test/utils'
import { server } from '../../test/server'
import { candidate, candidateWith } from '../../test/fixtures/candidate'
import TechnicalScanner from '../TechnicalScanner'
import {
  gateResult, gateTrack, gatesTitle, lastTradesTitle, longDate, mergeCurves, oosTitle, winLossTitle,
} from '../scannerLogic'

// capture what the page hands to Plotly (the global mock only renders a div)
const plots: Array<{ data: Array<Record<string, unknown>>; layout: Record<string, unknown> }> = []
vi.mock('react-plotly.js', () => ({
  default: (props: { data: Array<Record<string, unknown>>; layout: Record<string, unknown> }) => {
    plots.push(props)
    return createElement('div', { 'data-testid': 'plot' })
  },
}))

const GET = '*/api/scanner/candidate'

async function analyze() {
  await screen.findByRole('option', { name: 'golden_cross' })
  await userEvent.click(screen.getByRole('button', { name: 'Analyze' }))
}

describe('Scanner page', () => {
  it('starts empty and does not call the heavy endpoint until Analyze', async () => {
    let calls = 0
    server.use(http.get(GET, () => { calls++; return HttpResponse.json(candidate) }))
    render(<TechnicalScanner />)
    expect(screen.getByRole('heading', { name: 'Scanner' })).toBeInTheDocument()
    expect(await screen.findByText(/Nothing has been analysed yet/)).toBeInTheDocument()
    expect(calls).toBe(0)
  })

  it('renders the hero with formatted values, verdict and the reason text', async () => {
    render(<TechnicalScanner />)
    await analyze()
    expect(await screen.findByText('$487.21')).toBeInTheDocument()
    expect(screen.getByText(/\+\$3\.84 \(\+0\.79%\)/)).toBeInTheDocument()
    expect(screen.getByTestId('oos-return')).toHaveTextContent('+11.4%')
    expect(screen.getByTestId('is-return')).toHaveTextContent('+38.9%')
    expect(screen.getByText(/If traded since 2025/)).toBeInTheDocument()
    expect(screen.getByText('Alert only').closest('[data-status]')).toHaveAttribute('data-status', 'warn')
    expect(screen.getByText(/3 of 6 checks fail\. It may still be luck: of 780 ideas tested in the latest scan/)).toBeInTheDocument()
  })

  it('sends symbol and pattern as query parameters', async () => {
    let url: URL | null = null
    server.use(http.get(GET, ({ request }) => { url = new URL(request.url); return HttpResponse.json(candidate) }))
    render(<TechnicalScanner />)
    await screen.findByRole('option', { name: 'rsi_reversal' })
    const sym = screen.getByLabelText('Symbol')
    await userEvent.clear(sym)
    await userEvent.type(sym, 'spy')
    await userEvent.selectOptions(screen.getByLabelText('Pattern'), 'rsi_reversal')
    await userEvent.click(screen.getByRole('button', { name: 'Analyze' }))
    await screen.findByText('$487.21')
    expect(url!.searchParams.get('symbol')).toBe('SPY')
    expect(url!.searchParams.get('pattern')).toBe('rsi_reversal')
  })

  it('computes panel titles from the data', async () => {
    render(<TechnicalScanner />)
    await analyze()
    expect(await screen.findByRole('heading', { name: 'Last 3 trades: two wins, one stopped out' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Out of sample, the rule earns a third of what the fitted version promised' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Wins are larger than losses' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '3 of 6 checks miss their bar' })).toBeInTheDocument()
    expect(screen.getByText('47 out-of-sample trades, return per trade')).toBeInTheDocument()
    expect(screen.getByText('51%')).toBeInTheDocument()
    expect(screen.getByText('(37–65)')).toBeInTheDocument()
  })

  it('titles flip when the sign flips (negative out-of-sample, validated)', async () => {
    server.use(http.get(GET, () => HttpResponse.json(candidateWith({
      oos_return: -0.05, avg_win: 0.01, avg_loss: -0.03, verdict: 'validated', gates_failed: 0,
      gates: candidate.gates.map((g) => ({ ...g, status: g.gating ? 'pass' : g.status })),
    }))))
    render(<TechnicalScanner />)
    await analyze()
    expect(await screen.findByRole('heading', { name: 'Out of sample, the rule loses 5.0% where the fitted version promised +38.9%' })).toBeInTheDocument()
    expect(screen.getByTestId('oos-return')).toHaveTextContent('−5.0%')
    expect(screen.getByRole('heading', { name: 'Losses are larger than wins' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'All 6 checks clear their bar' })).toBeInTheDocument()
    expect(screen.getByText('Validated').closest('[data-status]')).toHaveAttribute('data-status', 'pass')
    expect(screen.getByText(/eligible for paper orders/)).toBeInTheDocument()
  })

  it('shows each gate as glyph + word with its measured value', async () => {
    render(<TechnicalScanner />)
    await analyze()
    const row = async (key: string) => within(await screen.findByTestId(`gate-${key}`))
    expect((await row('oos_trades')).getByText(/Pass · 47/)).toBeInTheDocument()
    expect((await row('psr')).getByText(/Fail · 0\.91 < 0\.95/)).toBeInTheDocument()
    expect((await row('bh')).getByText(/Fail · q 0\.31/)).toBeInTheDocument()
    expect((await row('dsr')).getByText(/Fail · p 0\.42 >= 0\.05/)).toBeInTheDocument()
    expect((await row('dsr')).getByText(/N = 780 trials/)).toBeInTheDocument()
    expect((await row('pbo')).getByText(/Advisory · PBO 0\.55/)).toBeInTheDocument()
    expect((await row('pbo')).getByText(/advisory: CSCV/)).toBeInTheDocument()
    expect((await row('holdout')).getByText(/Pass · \+3\.2%/)).toBeInTheDocument()
    expect((await row('delay')).getByText(/Recorded · \+4\.0%/)).toBeInTheDocument()
    expect((await row('delay')).getByText('recorded, not gated (D11)')).toBeInTheDocument()
    expect((await row('psr')).getByRole('img')).toHaveAccessibleName(/PSR above 0\.95: Fail/)
  })

  it('marks an unavailable nightly gate as unavailable, with no invented number', async () => {
    server.use(http.get(GET, () => HttpResponse.json(candidateWith({
      gates: candidate.gates.map((g) => g.key === 'bh' ? { ...g, value: null, status: 'unavailable', note: 'not in last scan' } : g),
    }))))
    render(<TechnicalScanner />)
    await analyze()
    const bh = within(await screen.findByTestId('gate-bh'))
    expect(bh.getByText('Unavailable')).toBeInTheDocument()
    expect(bh.getByText('not in last scan')).toBeInTheDocument()
  })

  it('passes candles, buy/exit markers and the shaded hold-out to Plotly', async () => {
    plots.length = 0
    render(<TechnicalScanner />)
    await analyze()
    await screen.findByText('$487.21')
    const p = plots[plots.length - 1]
    expect(p.data.map((t) => t.type)).toEqual(['candlestick', 'scatter', 'scatter'])
    expect((p.data[0].x as string[]).length).toBe(12)
    expect(p.data[1].name).toBe('Buy at next open')
    expect(p.data[1].y).toEqual([101, 106, 107])
    expect(p.data[2].y).toEqual([104, 104, 110])
    const shape = (p.layout.shapes as Array<Record<string, unknown>>)[0]
    expect(shape.x0).toBe('2025-06-08')
    expect(shape.x1).toBe(candidate.bars[11].date)
    const ann = (p.layout.annotations as Array<Record<string, unknown>>)[0]
    expect(ann.text).toBe('Hold-out from 8 Jun 2025')
  })

  it('omits the hold-out shading when the hold-out starts after the last bar', async () => {
    plots.length = 0
    server.use(http.get(GET, () => HttpResponse.json(candidateWith({ holdout_start: '2030-01-01' }))))
    render(<TechnicalScanner />)
    await analyze()
    await screen.findByText('$487.21')
    expect(plots[plots.length - 1].layout.shapes).toBeUndefined()
  })

  it('shows a tooltip with both curves when hovering the out-of-sample chart', async () => {
    render(<TechnicalScanner />)
    await analyze()
    const fig = await screen.findByRole('figure', { name: /Cumulative return, out of sample/ })
    const surface = within(fig).getByTestId('hover-surface')
    surface.getBoundingClientRect = () => ({ left: 0, width: 1000, top: 0, height: 200, right: 1000, bottom: 200, x: 0, y: 0, toJSON: () => ({}) })
    fireEvent.pointerMove(surface, { clientX: 1000 })
    const tip = within(fig).getByRole('tooltip')
    expect(tip).toHaveTextContent(candidate.oos_curve[9].date)
    expect(tip).toHaveTextContent('Out of sample (real test) +10%')
    expect(tip).toHaveTextContent('Fitted on the past (ignored) +35%')
    fireEvent.pointerLeave(surface)
    expect(within(fig).queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('renders the trade histogram and a keyboard-reachable data table', async () => {
    render(<TechnicalScanner />)
    await analyze()
    const fig = await screen.findByRole('figure', { name: 'Distribution of return per out-of-sample trade' })
    expect(fig).toHaveAttribute('tabindex', '0')
    expect(within(fig).getAllByRole('row', { hidden: true }).length).toBeGreaterThan(2)
  })

  it('empty states: no trades, no bars, no curve, no gates', async () => {
    server.use(http.get(GET, () => HttpResponse.json(candidateWith({
      trades: [], bars: [], oos_curve: [], in_sample_curve: [], oos_trade_returns: [], n_oos_trades: 0,
      oos_return: null, in_sample_return: null, avg_win: null, avg_loss: null, win_rate: null,
      win_rate_ci_low: null, win_rate_ci_high: null, gates: [],
    }))))
    render(<TechnicalScanner />)
    await analyze()
    expect(await screen.findByRole('heading', { name: 'No completed trades in this window' })).toBeInTheDocument()
    expect(screen.getByText('No price bars to chart.')).toBeInTheDocument()
    expect(screen.getByText('Not enough out-of-sample history to draw the curve.')).toBeInTheDocument()
    expect(screen.getByText('No trades to show.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Not enough winning and losing trades to compare their size' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'No checks to measure' })).toBeInTheDocument()
    expect(screen.getByText('No checks were returned.')).toBeInTheDocument()
    expect(screen.getByTestId('oos-return')).toHaveTextContent('n/a')
    expect(document.body.textContent).not.toMatch(/NaN|undefined|Infinity/)
  })

  it('shows loading placeholders in every panel while the request runs', async () => {
    server.use(http.get(GET, async () => { await delay(150); return HttpResponse.json(candidate) }))
    render(<TechnicalScanner />)
    await analyze()
    expect(screen.getAllByText('Loading…').length).toBe(5)
    expect(screen.getByRole('button', { name: 'Analyzing…' })).toBeDisabled()
    expect(await screen.findByText('$487.21')).toBeInTheDocument()
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
  })

  it('shows an error with Retry, and Retry recovers', async () => {
    let n = 0
    server.use(http.get(GET, () => {
      n++
      return n === 1
        ? HttpResponse.json({ error: { code: 'insufficient_data', message: 'QQQ has 90 bars; the walk-forward needs 400' } }, { status: 422 })
        : HttpResponse.json(candidate)
    }))
    render(<TechnicalScanner />)
    await analyze()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('QQQ has 90 bars')
    expect(alert).toHaveTextContent('insufficient_data')
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('$487.21')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(n).toBe(2)
  })

  it('reports a busy server for 429', async () => {
    server.use(http.get(GET, () => HttpResponse.json({ error: { code: 'busy', message: 'busy' } }, { status: 429 })))
    render(<TechnicalScanner />)
    await analyze()
    expect(await screen.findByRole('alert')).toHaveTextContent('Server busy')
  })

  it('shows an error when the pattern list fails', async () => {
    server.use(http.get('*/api/patterns/list', () => HttpResponse.json({ error: { code: 'internal_error', message: 'nope' } }, { status: 500 })))
    render(<TechnicalScanner />)
    expect(await screen.findByRole('alert')).toHaveTextContent('nope')
  })

  it('double-clicking Analyze sends one request', async () => {
    let n = 0
    server.use(http.get(GET, async () => { n++; await delay(50); return HttpResponse.json(candidate) }))
    render(<TechnicalScanner />)
    await screen.findByRole('option', { name: 'golden_cross' })
    await userEvent.dblClick(screen.getByRole('button', { name: 'Analyze' }))
    await screen.findByText('$487.21')
    await waitFor(() => expect(n).toBe(1))
  })
})

describe('Scanner helpers', () => {
  const t = (pnl: number | null, reason: string | null, closed = true) => ({
    entry_date: '2026-01-01', entry_price: 1, exit_date: closed ? '2026-01-02' : null, exit_price: closed ? 1 : null, pnl_pct: pnl, exit_reason: reason,
  })
  it('lastTradesTitle', () => {
    expect(lastTradesTitle([t(0.02, 'target'), t(-0.01, 'stop'), t(0.03, 'target')])).toBe('Last 3 trades: two wins, one stopped out')
    expect(lastTradesTitle([t(0.02, 'target')])).toBe('Last 1 trade: one win')
    expect(lastTradesTitle([t(-0.02, 'signal'), t(-0.01, 'signal')])).toBe('Last 2 trades: two losses')
    expect(lastTradesTitle([t(null, null, false)])).toMatch(/One trade is open/)
    expect(lastTradesTitle([{ ...t(null, null, false), in_holdout: true }, { ...t(null, null, false), in_holdout: true }])).toMatch(/^Two trades in the hold-out/)
    expect(lastTradesTitle([])).toBe('No completed trades in this window')
  })
  it('oosTitle covers ratios and sign flips', () => {
    expect(oosTitle(0.2, 0.2)).toMatch(/about what/)
    expect(oosTitle(0.3, 0.2)).toMatch(/more than/)
    expect(oosTitle(0.1, 0.2)).toMatch(/half/)
    expect(oosTitle(0.05, 0.2)).toMatch(/a quarter/)
    expect(oosTitle(0.02, 0.2)).toBe('Out of sample, the rule earns 10% of what the fitted version promised')
    expect(oosTitle(-0.02, 0.2)).toMatch(/loses 2\.0%/)
    expect(oosTitle(0.05, -0.1)).toMatch(/better than/)
    expect(oosTitle(0.05, null)).toBe('Out of sample, the rule returned +5.0%')
    expect(oosTitle(null, 0.2)).toMatch(/not enough history/)
  })
  it('winLossTitle / gatesTitle', () => {
    expect(winLossTitle(0.02, -0.02)).toBe('Wins and losses are about the same size')
    expect(winLossTitle(0.04, -0.02)).toBe('Wins are larger than losses')
    expect(winLossTitle(0.01, -0.02)).toBe('Losses are larger than wins')
    expect(winLossTitle(null, -0.02)).toMatch(/Not enough/)
    expect(gatesTitle(candidate.gates)).toBe('3 of 6 checks miss their bar')
  })
  it('gate track puts bar and threshold on one scale', () => {
    const g = (k: string) => candidate.gates.find((x) => x.key === k)!
    expect(gateTrack(g('oos_trades'), 0.1)).toEqual({ value: 47, max: 60, mark: 30 })
    expect(gateTrack(g('psr'), 0.1)).toEqual({ value: 0.91, max: 1, mark: 0.95 })
    const bh = gateTrack(g('bh'), 0.1)
    expect(bh.value).toBeCloseTo(0.69)
    expect(bh.mark).toBeCloseTo(0.95)
    const dsr = gateTrack(g('dsr'), 0.1)
    expect(dsr.value).toBeCloseTo(0.58)
    expect(dsr.mark).toBeCloseTo(0.95)
    const ho = gateTrack(g('holdout'), 0.1)
    expect(ho).toEqual({ value: 0.132, max: 0.2, mark: 0.1 })
    expect(gateTrack({ ...g('holdout'), value: null }, 0.1).value).toBeNull()
    expect(gateResult({ ...g('holdout'), status: 'unavailable', value: null })).toBe('Unavailable')
  })
  it('mergeCurves holds values inside each span and leaves the rest empty', () => {
    const m = mergeCurves([{ date: '2026-01-02', value: 1 }, { date: '2026-01-04', value: 2 }], [{ date: '2026-01-03', value: 5 }])
    expect(m.x).toEqual(['2026-01-02', '2026-01-03', '2026-01-04'])
    expect(m.a).toEqual([1, 1, 2])
    expect(m.b).toEqual([null, 5, null])
    expect(mergeCurves([], []).x).toEqual([])
  })
  it('longDate', () => {
    expect(longDate('2025-07-01')).toBe('1 Jul 2025')
    expect(longDate('garbage')).toBe('garbage')
  })
})

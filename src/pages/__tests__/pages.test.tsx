import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { renderWithClient as render } from '../../test/utils'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '../../test/server'
import Dashboard from '../Dashboard'
import TechnicalScanner from '../TechnicalScanner'
import PairsTrading from '../PairsTrading'
import MLSignals from '../MLSignals'
import StressTestLab from '../StressTestLab'
import Settings from '../Settings'
import real from '../../test/fixtures/backend-real.json'

describe('smoke', () => {
  it('Dashboard renders and shows scan results', async () => {
    render(<Dashboard />)
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /run scan now/i }))
    expect(await screen.findByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('Total Signals')).toBeInTheDocument()
  })

  it('TechnicalScanner renders and analyzes', async () => {
    render(<TechnicalScanner />)
    expect(screen.getByRole('heading', { name: 'Scanner' })).toBeInTheDocument()
    await screen.findByRole('option', { name: 'golden_cross' })
    await userEvent.click(screen.getByRole('button', { name: 'Analyze' }))
    await waitFor(() => expect(screen.getAllByTestId('plot').length).toBeGreaterThan(0))
  })

  it('PairsTrading renders and analyzes a pair', async () => {
    render(<PairsTrading />)
    await screen.findByRole('option', { name: 'KO / PEP' })
    await userEvent.click(screen.getByRole('button', { name: /analyze pair/i }))
    expect(await screen.findByText('Pairs Backtest Results')).toBeInTheDocument()
  })

  it('MLSignals renders and predicts', async () => {
    render(<MLSignals />)
    expect(screen.getByRole('heading', { name: 'ML Signals' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /predict|run|train|generate/i }))
    await waitFor(() => expect(screen.getAllByTestId('plot').length).toBeGreaterThan(0))
  })

  it('StressTestLab renders and runs', async () => {
    render(<StressTestLab />)
    expect(screen.getByRole('heading', { name: 'Stress Test Lab' })).toBeInTheDocument()
    await screen.findByRole('option', { name: 'golden_cross' })
    await userEvent.click(screen.getByRole('button', { name: /run/i }))
    expect(await screen.findByText('Regime Performance')).toBeInTheDocument()
  })

  it('Settings renders config', async () => {
    render(<Settings />)
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByText('initial capital')).toBeInTheDocument()
  })
})

describe('bug pinning', () => {
  // FE-1: backend sends total_return_pct as a fraction (0.153); Dashboard prints it without *100
  it('FE-1 Dashboard shows 15.3% for total_return_pct 0.153', async () => {
    render(<Dashboard />)
    await userEvent.click(screen.getByRole('button', { name: /run scan now/i }))
    await screen.findByText('AAPL')
    expect(screen.getByText(/15\.3/)).toBeInTheDocument()
  })

  // FE-2: backtest sends total_return / max_drawdown; frontend reads *_pct keys
  it('FE-2 PairsTrading backtest cards show 8.0% and -12.0%', async () => {
    render(<PairsTrading />)
    await screen.findByRole('option', { name: 'KO / PEP' })
    await userEvent.click(screen.getByRole('button', { name: /analyze pair/i }))
    await screen.findByText('Pairs Backtest Results')
    expect(screen.getByText(/\b8\.0/)).toBeInTheDocument()
    expect(screen.getByText(/-12\.0/)).toBeInTheDocument()
  })

  // FE-3: failures are only console.error'd; no visible message
  it('FE-3a Dashboard shows a visible error on HTTP 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    server.use(http.post('*/api/patterns/scan', () => HttpResponse.json({ detail: 'boom' }, { status: 500 })))
    render(<Dashboard />)
    await userEvent.click(screen.getByRole('button', { name: /run scan now/i }))
    expect(await screen.findByRole('alert', {}, { timeout: 500 })).toBeInTheDocument()
  })

  it('FE-3b Dashboard shows a visible error on 200 {error}', async () => {
    server.use(http.post('*/api/patterns/scan', () => HttpResponse.json({ error: 'No data for AAPL' })))
    render(<Dashboard />)
    await userEvent.click(screen.getByRole('button', { name: /run scan now/i }))
    expect(await screen.findByText(/No data for AAPL/, {}, { timeout: 500 })).toBeInTheDocument()
  })
})

describe('real backend payloads', () => {
  // The /stress/full fixture comes from the backend itself: regime cells must show numbers, never "n/a"
  it('StressTestLab regime table shows real percentages from the backend payload', async () => {
    render(<StressTestLab />)
    await screen.findByRole('option', { name: 'golden_cross' })
    await userEvent.click(screen.getByRole('button', { name: /run/i }))
    const table = (await screen.findByText('Regime Performance')).closest('div') as HTMLElement
    const full = real.stress_regimes.full_period
    expect(typeof full.win_rate).toBe('number')
    expect(table.textContent).not.toMatch(/n\/a/)
    expect(table.textContent).toContain(`${(full.win_rate * 100).toFixed(1)}%`)
  })
})

describe('Phase 4 pages (D15)', () => {
  it('PairsTrading shows the out-of-sample walk-forward blocks and exit reasons', async () => {
    render(<PairsTrading />)
    await screen.findByRole('option', { name: 'KO / PEP' })
    await userEvent.click(screen.getByRole('button', { name: /analyze pair/i }))
    expect(await screen.findByTestId('pairs-oos-title')).toHaveTextContent('2 of 3 out-of-sample blocks were tradable')
    const exits = screen.getByRole('list', { name: 'Exit reasons' })
    expect(within(exits).getByText('Spread reverted (z exit)').parentElement).toHaveTextContent('3')
    expect(within(exits).getByText('Cointegration broke').parentElement).toHaveTextContent('1')
    expect(within(exits).getByText('Time stop (held too long)')).toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'Out-of-sample blocks' })
    expect(within(table).getByText('Skipped (not cointegrated)')).toBeInTheDocument()
    expect(within(table).getAllByText('Tradable')).toHaveLength(2)
    expect(screen.getByText(/alert-only/)).toBeInTheDocument()
  })

  it('MLSignals shows calibrated probability and the abstain reasons', async () => {
    render(<MLSignals />)
    await userEvent.click(screen.getByRole('button', { name: /predict|run|train|generate/i }))
    const panel = await screen.findByTestId('ml-calibration')
    expect(within(panel).getByText('Calibrated')).toBeInTheDocument()
    expect(within(panel).getByText('Inputs drifted from the training data', { selector: 'dd' })).toBeInTheDocument()
    const reasons = within(panel).getByRole('list', { name: 'Abstain reasons' })
    expect(within(reasons).getByText('Probability inside the no-trade band').parentElement).toHaveTextContent('41')
    expect(within(panel).getByRole('heading', { name: 'The model abstained on 48 of 300 out-of-sample bars' })).toBeInTheDocument()
    expect(await screen.findByRole('columnheader', { name: 'Calibrated P(up)' })).toBeInTheDocument()
  })
})

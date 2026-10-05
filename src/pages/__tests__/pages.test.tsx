import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '../../test/server'
import Dashboard from '../Dashboard'
import TechnicalScanner from '../TechnicalScanner'
import PairsTrading from '../PairsTrading'
import MLSignals from '../MLSignals'
import StressTestLab from '../StressTestLab'
import Settings from '../Settings'

describe('smoke', () => {
  it('Dashboard renders and shows scan results', async () => {
    render(<Dashboard />)
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /run full scan/i }))
    expect(await screen.findByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('Total Signals')).toBeInTheDocument()
  })

  it('TechnicalScanner renders and analyzes', async () => {
    render(<TechnicalScanner />)
    expect(screen.getByRole('heading', { name: 'Technical Scanner' })).toBeInTheDocument()
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
  it.fails('FE-1 Dashboard shows 15.3% for total_return_pct 0.153', async () => {
    render(<Dashboard />)
    await userEvent.click(screen.getByRole('button', { name: /run full scan/i }))
    await screen.findByText('AAPL')
    expect(screen.getByText(/15\.3/)).toBeInTheDocument()
  })

  // FE-2: backtest sends total_return / max_drawdown; frontend reads *_pct keys
  it.fails('FE-2 PairsTrading backtest cards show 8.0% and -12.0%', async () => {
    render(<PairsTrading />)
    await screen.findByRole('option', { name: 'KO / PEP' })
    await userEvent.click(screen.getByRole('button', { name: /analyze pair/i }))
    await screen.findByText('Pairs Backtest Results')
    expect(screen.getByText(/\b8\.0/)).toBeInTheDocument()
    expect(screen.getByText(/-12\.0/)).toBeInTheDocument()
  })

  // FE-3: failures are only console.error'd; no visible message
  it.fails('FE-3a Dashboard shows a visible error on HTTP 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    server.use(http.post('*/api/patterns/scan', () => HttpResponse.json({ detail: 'boom' }, { status: 500 })))
    render(<Dashboard />)
    await userEvent.click(screen.getByRole('button', { name: /run full scan/i }))
    expect(await screen.findByRole('alert', {}, { timeout: 500 })).toBeInTheDocument()
  })

  it.fails('FE-3b Dashboard shows a visible error on 200 {error}', async () => {
    server.use(http.post('*/api/patterns/scan', () => HttpResponse.json({ error: 'No data for AAPL' })))
    render(<Dashboard />)
    await userEvent.click(screen.getByRole('button', { name: /run full scan/i }))
    expect(await screen.findByText(/No data for AAPL/, {}, { timeout: 500 })).toBeInTheDocument()
  })
})

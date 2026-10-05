import { http, HttpResponse } from 'msw'

// axios baseURL is '/api'; in jsdom it resolves against http://localhost:3000
const u = (path: string) => `*/api${path}`

export const scanSignal = {
  symbol: 'AAPL',
  pattern: 'golden_cross',
  signal: 'BUY',
  signal_date: '2026-01-02T00:00:00',
  days_ago: 2,
  price: 190.5,
  win_rate: 0.6,
  profit_factor: 1.8,
  sharpe: 1.2,
  total_return_pct: 0.153, // backend sends a fraction
  total_trades: 12,
  is_valid: true,
}

const dates = ['2026-01-01T00:00:00', '2026-01-02T00:00:00', '2026-01-05T00:00:00']

export const pairAnalysis = {
  symbol_a: 'KO',
  symbol_b: 'PEP',
  is_cointegrated: true,
  is_valid: true,
  coint_pvalue: 0.012,
  hedge_ratio: 0.9,
  half_life: 12.3,
  correlation: 0.88,
  current_zscore: 1.1,
  spread_data: dates.map((date, i) => ({ date, spread: i, zscore: i - 1 })),
  prices_a: dates.map((date, i) => ({ date, price: 60 + i })),
  prices_b: dates.map((date, i) => ({ date, price: 170 + i })),
  backtest: { total_return: 0.08, max_drawdown: -0.12, total_trades: 5, win_rate: 0.6 },
}

const metrics = {
  symbol: 'AAPL',
  pattern: 'golden_cross',
  total_trades: 12,
  win_rate: '60.0%',
  avg_win: '3.00%',
  avg_loss: '-1.00%',
  profit_factor: '1.80',
  total_return: '15.30%',
  max_drawdown: '-8.00%',
  sharpe: '1.20',
  sortino: '1.50',
  calmar: '1.10',
  expectancy: '0.0100',
  avg_duration_days: '8.0',
  valid: true,
}

const equity = dates.map((date, i) => ({ date, value: 100000 + i * 100 }))

export const handlers = [
  http.get(u('/data/watchlist/symbols'), () =>
    HttpResponse.json({ us_stocks: ['AAPL', 'MSFT'], crypto: ['BTC-USD'] })),
  http.get(u('/data/:symbol'), ({ params }) =>
    HttpResponse.json({
      symbol: params.symbol,
      count: 3,
      data: dates.map((date, i) => ({
        date, open: 100 + i, high: 102 + i, low: 99 + i, close: 101 + i, volume: 1000000,
      })),
    })),
  http.get(u('/patterns/list'), () =>
    HttpResponse.json({ patterns: ['golden_cross', 'rsi_reversal'], count: 2 })),
  http.post(u('/patterns/detect'), async ({ request }) => {
    const body = (await request.json()) as { symbol: string; pattern_name: string }
    return HttpResponse.json({
      symbol: body.symbol,
      pattern: body.pattern_name,
      total_signals: 2,
      buys: [{ date: dates[0], price: 101 }],
      sells: [{ date: dates[2], price: 103 }],
      latest_signal: { date: dates[2], signal: 'SELL', price: 103 },
    })
  }),
  http.post(u('/patterns/scan'), () =>
    HttpResponse.json({ count: 1, signals: [scanSignal] })),
  http.post(u('/backtest/run'), () =>
    HttpResponse.json({
      symbol: 'AAPL',
      pattern: 'golden_cross',
      metrics,
      equity_curve: equity,
      trades: [{
        entry_date: dates[0], exit_date: dates[2], direction: 'LONG',
        entry_price: 101, exit_price: 103, pnl_pct: 0.0198, exit_reason: 'signal', bars_held: 2,
      }],
      is_valid: true,
    })),
  http.post(u('/backtest/walk-forward'), () =>
    HttpResponse.json({
      symbol: 'AAPL', pattern: 'golden_cross', n_folds: 1,
      folds: [{ fold: 1, metrics }],
    })),
  http.get(u('/pairs/configured'), () =>
    HttpResponse.json({ pairs: [{ a: 'KO', b: 'PEP' }] })),
  http.post(u('/pairs/analyze'), () => HttpResponse.json(pairAnalysis)),
  http.post(u('/pairs/scan'), () =>
    HttpResponse.json({ count: 1, pairs: [{ symbol_a: 'KO', symbol_b: 'PEP', is_valid: true }] })),
  http.post(u('/ml/predict'), () =>
    HttpResponse.json({
      symbol: 'AAPL',
      model_type: 'ensemble_rf_xgb_lgbm',
      feature_importance: [{ feature: 'rsi_14', importance: 0.12 }],
      signals: [{ date: dates[1], signal: 'BUY', price: 102, confidence: 0.7 }],
      total_signals: 1,
      metrics,
      equity_curve: equity,
      is_valid: true,
    })),
  http.post(u('/stress/full'), () =>
    HttpResponse.json({
      symbol: 'AAPL',
      pattern: 'golden_cross',
      monte_carlo: {
        n_simulations: 1000, return_mean: 0.1, return_5th_pct: -0.05, return_95th_pct: 0.3,
        prob_positive: 0.7, drawdown_mean: -0.1, sharpe_mean: 1.0, sharpe_ci_low: 0.2, sharpe_ci_high: 1.8,
      },
      regimes: { bull_market: { total_trades: 5, win_rate: '60.0%', sharpe: '1.20', total_return: '10.00%' } },
      sensitivity: [],
      assessment: {
        regimes_consistent: true, mc_prob_positive: 0.7, mc_worst_case_5pct: -0.05, param_robust: true,
      },
    })),
  http.get(u('/config/'), () =>
    HttpResponse.json({
      watchlist: { us_stocks: ['AAPL'] },
      pairs: [{ a: 'KO', b: 'PEP' }],
      backtest: { lookback_days: 730, initial_capital: 100000, commission_pct: 0.001 },
      validation: { min_win_rate: 0.5, min_trades: 10 },
      risk: { max_position_pct: 0.1 },
      ml: { n_estimators: 100 },
    })),
]

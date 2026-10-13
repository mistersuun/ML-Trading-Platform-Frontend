// Fixture for GET /api/scanner/candidate (shape of CandidateResponse; fractions, nulls for non-finite).
import type { components } from '../../api/schema'

export type CandidateFixture = components['schemas']['CandidateResponse']

const day = (i: number) => new Date(Date.UTC(2025, 5, 1 + i)).toISOString().slice(0, 10)

const bars = Array.from({ length: 12 }, (_, i) => {
  const o = 100 + i, c = o + (i % 2 ? -0.5 : 1)
  return { date: day(i), open: o, high: Math.max(o, c) + 1, low: Math.min(o, c) - 1, close: c }
})

const curve = (n: number, step: number) =>
  Array.from({ length: n }, (_, i) => ({ date: day(i), value: Number((i * step).toFixed(4)) }))

export const candidate: CandidateFixture = {
  symbol: 'QQQ',
  pattern: 'donchian_breakout',
  variant: 'long-only, stop 2x ATR, target 3x ATR',
  last_price: 487.21,
  day_change: 3.84,
  day_change_pct: 0.0079,
  as_of: '2026-10-02',
  holdout_start: '2025-06-08',
  holdout_frozen: false,
  oos_curve: curve(10, 0.0114),
  in_sample_curve: curve(10, 0.0389),
  in_sample_method: 'in-sample = percentage-exit backtest on pre-hold-out bars',
  oos_return: 0.114,
  in_sample_return: 0.389,
  holdout_return: 0.032,
  oos_trade_returns: [-0.03, -0.02, -0.01, 0.01, 0.02, 0.02, 0.03, 0.05],
  n_oos_trades: 47,
  win_rate: 0.51,
  win_rate_ci_low: 0.37,
  win_rate_ci_high: 0.65,
  avg_win: 0.021,
  avg_loss: -0.016,
  gates: [
    { key: 'oos_trades', name: 'Out-of-sample trades >= 30', value: 47, threshold: 30, comparator: '>=', unit: 'count', status: 'pass', gating: true },
    { key: 'psr', name: 'PSR above 0.95', value: 0.91, threshold: 0.95, comparator: '>', unit: 'probability', status: 'fail', gating: true },
    { key: 'bh', name: 'Beats random entry (q <= 0.05)', value: 0.31, threshold: 0.05, comparator: '<=', unit: 'probability', status: 'fail', gating: true },
    { key: 'dsr', name: 'Deflated Sharpe (p < 0.05)', value: 0.42, threshold: 0.05, comparator: '<', unit: 'probability', status: 'fail', gating: true, note: 'N = 780 trials; from the latest nightly scan' },
    { key: 'pbo', name: 'Probability of backtest overfitting (advisory)', value: 0.55, threshold: null, comparator: '<=', unit: 'probability', status: 'recorded', gating: false, note: 'advisory: CSCV over the whole run\'s trials, reported and never gated' },
    { key: 'holdout', name: 'Hold-out return >= 0', value: 0.032, threshold: 0, comparator: '>=', unit: 'fraction', status: 'pass', gating: true },
    { key: 'cost', name: 'Positive at 2x costs', value: 0.061, threshold: 0, comparator: '>', unit: 'fraction', status: 'pass', gating: true },
    { key: 'delay', name: '+1 bar delay', value: 0.04, threshold: null, comparator: '>', unit: 'fraction', status: 'recorded', gating: false, note: 'recorded, not gated (D11)' },
  ],
  gates_failed: 3,
  verdict: 'alert_only',
  nightly: { in_last_scan: true, bh_adjusted_p: 0.31, tested: 780, dsr_p: 0.42, n_trials: 780, pbo: 0.55, validation_status: 'alert_only', label: 'from the latest nightly scan', generated_at: '2026-10-02T22:30:00+00:00' },
  bars,
  trades: [
    { entry_date: day(1), entry_price: 101, exit_date: day(3), exit_price: 104, pnl_pct: 0.03, exit_reason: 'target', in_holdout: false },
    { entry_date: day(5), entry_price: 106, exit_date: day(7), exit_price: 104, pnl_pct: -0.02, exit_reason: 'stop', in_holdout: false },
    { entry_date: day(8), entry_price: 107, exit_date: day(10), exit_price: 110, pnl_pct: 0.028, exit_reason: 'target', in_holdout: true },
  ],
  rejected_reasons: ['psr_below_min'],
  note: 'Out-of-sample = walk-forward test windows before the hold-out.',
}

export const candidateWith = (over: Partial<CandidateFixture>): CandidateFixture => ({ ...candidate, ...over })

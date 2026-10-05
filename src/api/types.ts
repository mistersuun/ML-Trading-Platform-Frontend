import type { components } from './schema';

type S = components['schemas'];
export type ScanSignal = S['ScanSignal'];
export type OhlcvBar = S['OhlcvBar'];
export type PatternDetect = S['PatternDetectResponse'];
export type BacktestResult = S['BacktestResponse'];
export type PairAnalysis = S['PairAnalysisResponse'];
export type MLPrediction = S['MLPredictResponse'];
export type AppConfig = S['ConfigResponse'];
export type PairRef = S['PairRef'];

/** The backend models `metrics` as a free-form dict; these are the keys the UI reads. */
export interface Metrics {
  win_rate?: number | null;
  profit_factor?: number | null;
  sharpe?: number | null;
  total_return?: number | null;
  max_drawdown?: number | null;
  total_trades?: number | null;
}

/** Pairs backtest summary (free-form dict in the schema; legacy *_pct names kept). */
export interface PairsBacktest {
  total_return?: number | null;
  total_return_pct?: number | null;
  max_drawdown?: number | null;
  max_drawdown_pct?: number | null;
  total_trades?: number | null;
  win_rate?: number | null;
}

export interface SpreadPoint {
  date: string;
  zscore?: number | null;
}

/** /stress/full is an untyped pass-through dict on the backend; this is the shape the lab renders. */
export interface RegimeStats {
  total_trades?: number | null;
  win_rate?: number | null;
  sharpe?: number | null;
  total_return?: number | null;
  profit_factor?: number | null;
}
export interface MonteCarlo {
  error?: string;
  n_simulations?: number;
  return_mean?: number | null;
  return_5th_pct?: number | null;
  return_95th_pct?: number | null;
  prob_positive?: number | null;
  drawdown_mean?: number | null;
  sharpe_mean?: number | null;
  sharpe_ci_low?: number | null;
  sharpe_ci_high?: number | null;
}
export interface ParamResult {
  stop_loss?: number | null;
  take_profit?: number | null;
  sharpe?: number | null;
  win_rate?: number | null;
}
export interface Sensitivity {
  best_params?: ParamResult[];
  worst_params?: ParamResult[];
  is_robust?: boolean;
  sharpe_std_across_params?: number | null;
}
export interface StressReport {
  symbol?: string;
  pattern?: string;
  monte_carlo?: MonteCarlo;
  regimes?: Record<string, RegimeStats>;
  sensitivity?: Sensitivity | unknown[];
  assessment?: {
    regimes_consistent?: boolean;
    mc_prob_positive?: number | null;
    mc_worst_case_5pct?: number | null;
    param_robust?: boolean;
  };
}

/** GET /api/results/technical/latest */
export type LatestScan = S['LatestTechnicalResult'];

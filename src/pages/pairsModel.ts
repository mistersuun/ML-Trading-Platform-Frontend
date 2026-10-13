// Pure helpers for the Pairs page: the out-of-sample walk-forward summary the backend returns in `backtest`.
import { int, isNum, NA, num } from '../lib/format';

export interface PairsBlock {
  block: number;
  trade_start: string;
  trade_end: string;
  tradable: boolean;
  untradable_reason?: string | null;
  coint_pvalue?: number | null;
  half_life?: number | null;
  n_trades?: number | null;
  pnl_abs?: number | null;
  n_breaks?: number | null;
}

export interface PairsWalkForward {
  oos?: boolean;
  oos_status?: string | null;
  oos_blocks?: number | null;
  oos_blocks_tradable?: number | null;
  oos_start?: string | null;
  oos_end?: string | null;
  latest_block_tradable?: boolean | null;
  oos_significant?: boolean | null;
  psr?: number | null;
  sharpe_ratio?: number | null;
  exit_reasons?: Record<string, number> | null;
  blocks?: PairsBlock[] | null;
  formation?: number | null;
  trade_bars?: number | null;
}

const EXIT_LABELS: Record<string, string> = {
  exit: 'Spread reverted (z exit)',
  z_exit: 'Spread reverted (z exit)',
  stop: 'Stop (z too far)',
  z_stop: 'Stop (z too far)',
  time_stop: 'Time stop (held too long)',
  coint_break: 'Cointegration broke',
  block_end: 'Block ended while open',
  end: 'Data ended while open',
};

export function exitReasonLabel(reason: string): string {
  return EXIT_LABELS[reason] ?? reason.replace(/_/g, ' ');
}

/** Exit reasons as [label, count] rows, most frequent first. */
export function exitReasonRows(counts: Record<string, number> | null | undefined): [string, number][] {
  return Object.entries(counts ?? {})
    .filter(([, n]) => isNum(n) && n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([k, n]) => [exitReasonLabel(k), n]);
}

export function oosTitle(bt: PairsWalkForward | null | undefined): string {
  if (!bt || bt.oos_status === 'insufficient_history' || !isNum(bt.oos_blocks) || bt.oos_blocks === 0) {
    return 'Not enough history for one out-of-sample block';
  }
  const t = isNum(bt.oos_blocks_tradable) ? bt.oos_blocks_tradable : 0;
  return `${int(t)} of ${int(bt.oos_blocks)} out-of-sample blocks were tradable`;
}

export function blockWindow(b: PairsBlock): string {
  return `${b.trade_start.slice(0, 10)} to ${b.trade_end.slice(0, 10)}`;
}

export function blockStatus(b: PairsBlock): string {
  return b.tradable ? 'Tradable' : `Skipped${b.untradable_reason ? ` (${b.untradable_reason.replace(/_/g, ' ').replace(/;/g, ', ')})` : ''}`;
}

export function blockHalfLife(b: PairsBlock): string {
  return isNum(b.half_life) ? `${num(b.half_life, 1)} d` : NA;
}

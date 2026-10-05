import type { components } from '../api/schema';
import { int, isNum, money, multiple, signedPct } from '../lib/format';

type S = components['schemas'];
type Risk = S['RiskStatusResponse'];
type Funnel = S['Funnel'];

export const RANGES = ['1M', '3M', 'YTD', '1Y', 'All'] as const;
export type Range = (typeof RANGES)[number];

/* ---------- finding titles: one sentence computed from the data ---------- */

export function rangeLabel(range: Range, dates: string[] = []): string {
  switch (range) {
    case '1M': return 'the last month';
    case '3M': return 'the last 3 months';
    case 'YTD': return 'this year';
    case '1Y': return 'the last year';
    default: {
      if (dates.length < 2) return 'the full history';
      const days = (Date.parse(dates[dates.length - 1]) - Date.parse(dates[0])) / 86_400_000;
      if (!Number.isFinite(days) || days <= 0) return 'the full history';
      return days >= 540 ? `the last ${(days / 365).toFixed(1).replace(/\.0$/, '')} years` : `the last ${Math.max(1, Math.round(days / 30.4))} months`;
    }
  }
}

export function performanceTitle(periodReturn: number | null | undefined, benchReturn: number | null | undefined, label: string): string {
  if (!isNum(periodReturn)) return 'Not enough price history to compare with a plain 60/40';
  if (!isNum(benchReturn)) return `Portfolio returned ${signedPct(periodReturn)} over ${label}; no 60/40 comparison is available`;
  const edge = (periodReturn - benchReturn) * 100;
  const pts = Math.abs(edge).toFixed(1);
  if (Number(pts) === 0) return `Portfolio is level with a plain 60/40 over ${label}`;
  return `Portfolio is ${edge > 0 ? 'ahead of' : 'behind'} a plain 60/40 by ${pts} points over ${label}`;
}

const lowerFirst = (s: string) => (s.length > 1 && s[1] === s[1].toLowerCase() ? s[0].toLowerCase() + s.slice(1) : s);

export function allocationTitle(groups: S['GroupWeight'][]): string {
  const valid = groups.filter((g) => isNum(g.drift));
  if (valid.length === 0) return 'No allocation to compare with target';
  const worst = valid.reduce((a, g) => (Math.abs(g.drift) > Math.abs(a.drift) ? g : a));
  const pts = Math.abs(worst.drift) * 100;
  const rounded = pts.toFixed(0);
  const dir = worst.drift < 0 ? 'under' : 'over';
  if (pts < 1) return 'Allocation is on target';
  const unit = rounded === '1' ? 'point' : 'points';
  if (pts < 5) return `Allocation is close to target; ${lowerFirst(worst.label)} is ${rounded} ${unit} ${dir}`;
  return `Allocation has drifted: ${lowerFirst(worst.label)} is ${rounded} points ${dir} target`;
}

export function funnelTitle(f: Funnel, ageHours: number | undefined): string {
  const when = isNum(ageHours) && ageHours < 24 ? 'tonight' : 'in the latest scan';
  const n = int(f.tested);
  const noun = f.tested === 1 ? 'idea' : 'ideas';
  if (f.tested === 0) return `No ideas were tested ${when}`;
  return f.bh === 0
    ? `${n} ${noun} tested ${when}, none survived every check`
    : `${n} ${noun} tested ${when}, ${int(f.bh)} survived every check`;
}

export function riskTitle(r: Risk): string {
  const halt = r.ladder.find((l) => l.kind === 'halt');
  const haltPct = halt ? `${(halt.drawdown * 100).toFixed(0)}%` : null;
  if (r.halted) return `Trading is halted${isNum(r.drawdown) ? `; the signal sleeve is ${(Math.abs(r.drawdown) * 100).toFixed(1)}% below its peak` : ''}`;
  if (r.kill_switch) return 'The kill switch is on; no orders will be placed';
  if (!isNum(r.drawdown)) return 'The signal sleeve has no equity reading yet';
  const dd = Math.abs(r.drawdown) * 100;
  const tail = haltPct ? `; trading halts at ${haltPct}` : '';
  return dd < 0.05 ? `Signal sleeve is at its peak${tail}` : `Signal sleeve is ${dd.toFixed(1)}% below its peak${tail}`;
}

export function tradesSummary(trades: S['ProposalTrade'][]): string {
  return trades.map((t) => `${t.action} ${int(t.shares)} ${t.symbol}`).join(', ');
}

export function funnelItems(f: Funnel) {
  const rows: [string, number][] = [
    ['Candidates tested', f.tested], ['Enough out-of-sample trades', f.min_trades], ['Positive out of sample', f.oos_positive],
    ['Passes the PSR check', f.psr], ['Beats random entry (BH)', f.bh], ['Eligible for an order', f.orders],
  ];
  return rows.map(([label, value]) => ({ label, value, display: int(value) }));
}


/* ---------- account (D14): net worth, margin, leverage ---------- */

export type AccountBlock = S['AccountBlock'];

export const DEFAULT_LEVERAGE_WARN = 1.0;

/** The warn threshold the backend reports, or 1.0x. */
export function leverageThreshold(a: { max_leverage_warn?: number | null } | null | undefined): number {
  return isNum(a?.max_leverage_warn) ? (a!.max_leverage_warn as number) : DEFAULT_LEVERAGE_WARN;
}

/** Fraction positions can fall before equity is zero. equity = G(1-f) - L = 0, f = 1 - L/G = N/G = 1/leverage. */
export function wipeoutFall(leverage: number | null | undefined): number | null {
  return isNum(leverage) && leverage > 0 ? 1 / leverage : null;
}

/** Warn only strictly above the threshold. */
export function isOverLeveraged(leverage: number | null | undefined, threshold = DEFAULT_LEVERAGE_WARN): boolean {
  return isNum(leverage) && leverage > threshold;
}

/** Factual margin warning computed from the data, or null when leverage is within the threshold. */
export function leverageWarningText(
  leverage: number | null | undefined, marginLoan: number | null | undefined, currency: string | null | undefined,
  threshold = DEFAULT_LEVERAGE_WARN,
): string | null {
  if (!isOverLeveraged(leverage, threshold)) return null;
  const fall = wipeoutFall(leverage);
  const borrow = isNum(marginLoan) && marginLoan > 0 ? `You are borrowing ${money(marginLoan, currency, 0)} on margin (${multiple(leverage)}).` : `Your leverage is ${multiple(leverage)}.`;
  return `${borrow}${fall === null ? '' : ` A ${(fall * 100).toFixed(0)}% fall in your holdings would wipe out your equity.`}`;
}

/** 'IBKR snapshot as of 2026-09-30 14:05 UTC' or 'holdings.csv'. */
export function sourceLabel(source: string | null | undefined, asOf: string | null | undefined): string {
  if (source === 'ibkr') {
    const m = asOf ? /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/.exec(asOf) : null;
    return `IBKR snapshot as of ${m ? `${m[1]}${m[2] ? ` ${m[2]} UTC` : ''}` : 'an unknown time'}`;
  }
  return 'holdings.csv';
}

/** Value of each asset group in the base currency. The backend's own group value is used when it sends one; the
 * share of a group is over CLASSIFIED symbols only, so share x positions value is only the fallback for an old
 * response and overstates every group when something is unclassified. */
export function groupValues(groups: S['GroupWeight'][], positionsValue: number | null | undefined) {
  return groups.map((g) => ({
    key: g.key, label: g.label, share: g.now,
    value: isNum(g.value) ? g.value : isNum(positionsValue) ? g.now * positionsValue : null,
  }));
}

export type ValueRow = { key: string; label: string; value: number; share: number | null };

/** Rows of 'Where the money is': one per asset group plus an 'Unclassified' row for priced holdings that are in no
 * group, so the values add up to the priced positions. Shares are of that total. null when a group has no value. */
export function groupValueRows(
  groups: S['GroupWeight'][], unclassified: number | null | undefined, positionsValue: number | null | undefined,
): ValueRow[] | null {
  const g = groupValues(groups, positionsValue);
  if (g.length === 0 || !g.every((x) => isNum(x.value))) return null;
  const rows: { key: string; label: string; value: number }[] = g.map((x) => ({ key: x.key, label: x.label, value: x.value as number }));
  if (isNum(unclassified) && unclassified > 0.5) rows.push({ key: 'unclassified', label: 'Unclassified', value: unclassified });
  const total = rows.reduce((a, r) => a + r.value, 0);
  return rows.map((r) => ({ ...r, share: total > 0 ? r.value / total : null }));
}

/** 'Positions X · Margin loan −Y · Other ±Z · Net N' parts: Other is the reconciling difference (stale closes,
 * accruals, unvalued items) and is shown only when it would change a displayed figure. */
export function otherLine(other: number | null | undefined): number | null {
  return isNum(other) && Math.abs(other) >= 0.5 ? other : null;
}

/** Hero 'cash' stat: a negative cash balance is the margin loan (shown in the breakdown), so nothing is available. */
export function cashAvailable(cash: number | null | undefined): number | null {
  return isNum(cash) ? Math.max(cash, 0) : null;
}

export function profileLabel(profile: string | null | undefined): string {
  return (profile ?? 'us').toLowerCase() === 'cad'
    ? 'CAD profile (D14, approved)'
    : 'US profile';
}

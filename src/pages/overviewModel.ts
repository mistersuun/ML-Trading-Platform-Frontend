import type { components } from '../api/schema';
import { int, isNum, signedPct } from '../lib/format';

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


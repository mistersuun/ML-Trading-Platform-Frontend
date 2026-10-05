// Pure helpers for the Scanner page: finding-style titles and gate geometry, all computed from the response.
import type { components } from '../api/schema';
import { int, isNum, NA, num, pct, signedPct } from '../lib/format';

type Candidate = components['schemas']['CandidateResponse'];
type Gate = components['schemas']['Gate'];
type Curve = Candidate['oos_curve'];

// ---------- finding-style titles, computed from the data ----------

const WORDS = ['no', 'one', 'two', 'three'];
const word = (n: number) => (n >= 0 && n < WORDS.length ? WORDS[n] : String(n));

type ClosedTrade = Candidate['trades'][number] & { pnl_pct: number };

export function lastTradesTitle(trades: Candidate['trades']): string {
  const closed = trades.filter((t): t is ClosedTrade => t.exit_date != null && isNum(t.pnl_pct)).slice(-3);
  const hiddenN = trades.filter((t) => t.in_holdout && !isNum(t.pnl_pct)).length;
  const open = trades.filter((t) => t.exit_date == null && !t.in_holdout).length;
  if (closed.length === 0 && hiddenN > 0) {
    const w = word(hiddenN);
    return `${w.charAt(0).toUpperCase()}${w.slice(1)} ${hiddenN === 1 ? 'trade' : 'trades'} in the hold-out; results stay hidden until the nightly scan reads it`;
  }
  if (closed.length === 0) {
    return open > 0 ? 'One trade is open and none has closed in this window' : 'No completed trades in this window';
  }
  const wins = closed.filter((t) => t.pnl_pct > 0).length;
  const stopped = closed.filter((t) => t.pnl_pct <= 0 && /stop/i.test(t.exit_reason ?? '')).length;
  const lostOther = closed.length - wins - stopped;
  const parts: string[] = [];
  if (wins > 0) parts.push(`${word(wins)} ${wins === 1 ? 'win' : 'wins'}`);
  if (stopped > 0) parts.push(`${word(stopped)} stopped out`);
  if (lostOther > 0) parts.push(`${word(lostOther)} ${lostOther === 1 ? 'loss' : 'losses'}`);
  const n = closed.length;
  return `Last ${n} ${n === 1 ? 'trade' : 'trades'}: ${parts.join(', ')}`;
}

export function oosTitle(oos: number | null | undefined, is: number | null | undefined): string {
  if (!isNum(oos)) return 'Out of sample, there is not enough history to measure the rule';
  if (!isNum(is)) return `Out of sample, the rule returned ${signedPct(oos)}`;
  if (is <= 0) {
    return oos > is
      ? `Out of sample, the rule returned ${signedPct(oos)}, better than the fitted version's ${signedPct(is)}`
      : `Out of sample, the rule returned ${signedPct(oos)}, no better than the fitted version`;
  }
  if (oos < 0) return `Out of sample, the rule loses ${pct(Math.abs(oos))} where the fitted version promised ${signedPct(is)}`;
  const r = oos / is;
  if (r >= 1.1) return 'Out of sample, the rule earns more than the fitted version promised';
  if (r >= 0.9) return 'Out of sample, the rule earns about what the fitted version promised';
  if (r >= 0.42 && r < 0.58) return 'Out of sample, the rule earns half of what the fitted version promised';
  if (r >= 0.28 && r < 0.4) return 'Out of sample, the rule earns a third of what the fitted version promised';
  if (r >= 0.2 && r < 0.28) return 'Out of sample, the rule earns a quarter of what the fitted version promised';
  return `Out of sample, the rule earns ${Math.round(r * 100)}% of what the fitted version promised`;
}

export function winLossTitle(avgWin: number | null | undefined, avgLoss: number | null | undefined): string {
  if (!isNum(avgWin) || !isNum(avgLoss) || avgLoss === 0) return 'Not enough winning and losing trades to compare their size';
  const ratio = avgWin / Math.abs(avgLoss);
  if (ratio >= 1.25) return 'Wins are larger than losses';
  if (ratio <= 0.8) return 'Losses are larger than wins';
  return 'Wins and losses are about the same size';
}

export function gatingStats(gates: Gate[]) {
  const gating = gates.filter((g) => g.gating);
  const failed = gating.filter((g) => g.status !== 'pass').length;
  return { total: gating.length, failed };
}

export function gatesTitle(gates: Gate[]): string {
  const { total, failed } = gatingStats(gates);
  if (total === 0) return 'No checks to measure';
  if (failed === 0) return `All ${total} checks clear their bar`;
  return `${failed} of ${total} checks miss their bar`;
}

// ---------- gate display ----------

export function gateKind(g: Gate): 'pass' | 'fail' | 'recorded' {
  if (g.status === 'pass') return 'pass';
  if (g.status === 'fail') return 'fail';
  return 'recorded';
}

function fmtGateValue(g: Gate, v: number | null | undefined): string {
  if (!isNum(v)) return NA;
  if (g.unit === 'count') return int(v);
  if (g.unit === 'fraction') return signedPct(v);
  return num(v);
}

export function gateResult(g: Gate): string {
  if (g.status === 'unavailable') return 'Unavailable';
  // PBO is shown for context only: it never gates an order, so it reads 'Advisory', not Pass / Fail
  const word = g.key === 'pbo' ? 'Advisory' : g.status === 'pass' ? 'Pass' : g.status === 'fail' ? 'Fail' : 'Recorded';
  const v = g.value;
  if (!isNum(v)) return word;
  let detail: string;
  if (g.key === 'bh') detail = `q ${num(v)}`;
  else if (g.key === 'dsr') detail = `p ${num(v)}${isNum(g.threshold) ? ` ${g.status === 'pass' ? '<' : '>='} ${num(g.threshold)}` : ''}`;
  else if (g.key === 'pbo') detail = `PBO ${num(v)}`;
  else if (g.unit === 'probability' && isNum(g.threshold) && g.status === 'fail') detail = `${num(v)} ${g.comparator.startsWith('<') ? '>' : '<'} ${num(g.threshold)}`;
  else detail = fmtGateValue(g, v);
  return `${word} · ${detail}`;
}

/** Map a gate onto a 0..max track so the threshold mark and the bar share one scale. */
export function gateTrack(g: Gate, fractionScale: number): { value: number | null; max: number; mark: number } {
  const v = isNum(g.value) ? g.value : null;
  if (g.unit === 'count') {
    const thr = isNum(g.threshold) && g.threshold > 0 ? g.threshold : 1;
    return { value: v, max: thr * 2, mark: thr };
  }
  if (g.unit === 'probability') {
    const thr = isNum(g.threshold) ? g.threshold : 0.5;
    // "<=" gates (a p-value): the bar shows how far from chance, 1 - q, against 1 - alpha
    if (g.comparator.startsWith('<')) return { value: v === null ? null : 1 - v, max: 1, mark: 1 - thr };
    return { value: v, max: 1, mark: thr };
  }
  // fractions: centred on the threshold (zero), same scale for every gate on the page
  const thr = isNum(g.threshold) ? g.threshold : 0;
  return { value: v === null ? null : v - thr + fractionScale, max: fractionScale * 2, mark: fractionScale };
}

// ---------- chart data ----------

/** Merge two dated curves onto one x axis, holding each curve's last value inside its own span. */
export function mergeCurves(a: Curve, b: Curve): { x: string[]; a: (number | null)[]; b: (number | null)[] } {
  const x = Array.from(new Set([...a.map((p) => p.date), ...b.map((p) => p.date)])).sort();
  const fill = (c: Curve) => {
    const m = new Map(c.map((p) => [p.date, p.value]));
    const lo = c.length ? c[0].date : '', hi = c.length ? c[c.length - 1].date : '';
    let last: number | null = null;
    return x.map((d) => {
      if (m.has(d)) last = m.get(d) as number;
      return c.length && d >= lo && d <= hi ? last : null;
    });
  };
  return { x, a: fill(a), b: fill(b) };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function longDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : iso;
}


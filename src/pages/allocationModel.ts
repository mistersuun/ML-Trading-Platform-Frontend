import type { components } from '../api/schema';
import { isNum, money } from '../lib/format';

type S = components['schemas'];
export type Row = S['ProposalRow'];
export type Group = S['GroupWeight'];
export type Trend = S['TrendAsset'];
export type Proposal = S['ProposalResponse'];

/** Currency of every amount in a proposal: the backend's base_currency (it converts all prices to it, whatever the
 * profile). Only a response without that field falls back to the profile's usual currency. */
export const proposalCurrency = (p: { base_currency?: string | null; profile?: string | null }) =>
  p.base_currency || ((p.profile ?? 'us').toLowerCase() === 'cad' ? 'CAD' : 'USD');

/** Value of the managed positions (what the 'Invested in core + trend' figure shows). total_value is the net value
 * including unmanaged holdings, so use the managed sleeve when the backend sends it. */
export function investedManaged(p: Proposal): number {
  const own = ownCash(p.cash);
  return isNum(p.managed_value) ? p.managed_value - own : p.total_value - p.cash;
}

/** Own cash only: a negative balance is the margin loan, which is never allocated to the managed sleeve. */
export const ownCash = (cash: number | null | undefined): number => (isNum(cash) ? Math.max(cash, 0) : 0);

/** The 'Cash + this contribution' figures and the loan lines: own cash (never negative), the contribution, the margin
 * loan (shown separately, as a positive amount) and the part of the contribution applied to it. */
export function cashLines(p: Proposal): { cash: number; contribution: number; loan: number; toLoan: number } {
  return {
    cash: ownCash(p.cash),
    contribution: p.contribution,
    loan: isNum(p.margin_loan) ? Math.max(p.margin_loan, 0) : Math.max(-(p.cash ?? 0), 0),
    toLoan: isNum(p.contribution_to_loan) ? Math.max(p.contribution_to_loan, 0) : 0,
  };
}

const MINUS = '−';
export const pts = (fraction: number, digits = 1) => (fraction * 100).toFixed(digits);
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Weight of a sleeve after its proposed trade, as a fraction of the managed sleeve after the spare contribution
 * (the part left once the margin loan is repaid). */
export function weightAfter(r: Row, p: Proposal): number | null {
  const spare = p.contribution - (isNum(p.contribution_to_loan) ? p.contribution_to_loan : 0);
  const post = (isNum(p.managed_value) ? p.managed_value : p.total_value) + spare;
  return isNum(post) && post > 0 ? (r.value + r.trade_value) / post : null;
}

export const outsideNow = (rows: Row[]) => rows.filter((r) => r.outside);

export function outsideAfter(p: Proposal): Row[] {
  return p.rows.filter((r) => {
    const w = weightAfter(r, p);
    return w !== null && Math.abs(w - r.target) > r.band;
  });
}

export function furthestRow(rows: Row[]): Row | null {
  const ok = rows.filter((r) => isNum(r.drift));
  return ok.length ? ok.reduce((a, r) => (Math.abs(r.drift) > Math.abs(a.drift) ? r : a)) : null;
}

export function signedPts(fraction: number, digits = 1): string {
  const s = pts(Math.abs(fraction), digits);
  return `${Number(s) === 0 ? '' : fraction < 0 ? MINUS : '+'}${s}`;
}

/* ---------- finding titles ---------- */

export function tradesTitle(p: Proposal): string {
  if (p.rows.length === 0) return 'No sleeves to propose trades for';
  const n = p.trades.length;
  const still = outsideAfter(p);
  if (n === 0) {
    const now = outsideNow(p.rows);
    return now.length === 0
      ? 'No trades needed: every sleeve is inside its band'
      : `No whole-share trade fits; ${now.length} ${plural(now.length, 'sleeve is', 'sleeves are')} outside the band`;
  }
  const kinds = new Set(p.trades.map((t) => t.action));
  const noun = kinds.size === 1 ? `${[...kinds][0]}${n === 1 ? '' : 's'}` : plural(n, 'trade', 'trades');
  const head = n === 1 ? `After this ${kinds.size === 1 ? [...kinds][0] : 'trade'}` : `After these ${n} ${noun}`;
  if (still.length === 0) return `${head}, every sleeve is inside its band`;
  return `${head}, ${still.length} ${plural(still.length, 'sleeve is', 'sleeves are')} still outside the band`;
}

export function driftTitle(rows: Row[]): string {
  if (rows.length === 0) return 'No sleeves to compare with target';
  const out = outsideNow(rows);
  if (out.length === 0) return 'Every sleeve is inside its band';
  if (out.length === 1) return `${out[0].name} (${out[0].symbol}) is the one sleeve outside its band`;
  const far = furthestRow(out)!;
  return `${out.length} sleeves are outside their band; ${far.symbol} is furthest`;
}

export function mixTitle(groups: Group[]): string {
  const ok = groups.filter((g) => isNum(g.drift));
  if (ok.length === 0) return 'No asset groups to compare with target';
  const w = ok.reduce((a, g) => (Math.abs(g.drift) > Math.abs(a.drift) ? g : a));
  const now = pts(Math.abs(w.drift));
  if (Number(now) < 0.1) return 'Every asset group is on target';
  const dir = w.drift < 0 ? 'under' : 'over';
  const tail = isNum(w.after) ? `, ${pts(Math.abs(w.after - w.target))} after the proposed trades` : '';
  return `${w.label} is ${now} points ${dir} target${tail}`;
}

export function trendTitle(trend: Trend[]): string {
  const known = trend.filter((t) => t.data_available !== false && t.state !== 'unknown');
  if (known.length === 0) return 'No trend data to judge the trend sleeve';
  const held = known.filter((t) => t.state === 'held').length;
  const partial = known.filter((t) => t.state === 'partial').length;
  const missing = trend.length - known.length;
  const tail = missing > 0 ? `; ${missing} without data` : '';
  if (held === 0 && partial === 0) return `Trend sleeve: no market is above its trend, so it sits in T-bills${tail}`;
  const base = `Trend sleeve: ${held} of ${known.length} markets are above their trend`;
  return `${base}${partial ? `, ${partial} only partly` : ''}${tail}`;
}

export function tradeSummary(p: Proposal): string {
  const buys = p.trades.filter((t) => t.action === 'buy');
  const sells = p.trades.filter((t) => t.action === 'sell');
  if (p.trades.length === 0) return 'None';
  const part = (list: typeof buys, w: string) =>
    list.length ? `${list.length} ${w}${list.length === 1 ? '' : 's'} · ${money(list.reduce((a, t) => a + t.amount, 0), proposalCurrency(p), 0)}` : '';
  return [part(buys, 'buy'), part(sells, 'sell')].filter(Boolean).join(', ');
}

export const voteGlyphs = (t: Trend) => t.votes.map((v) => (v.above ? '✓' : '✕')).join('');
export const votesLabel = (t: Trend) => `${t.votes.map((v) => v.lookback).join('/')}m`;

export function stateLabel(t: Trend): string {
  if (t.data_available === false || t.state === 'unknown') return 'No data';
  if (t.state === 'held') return 'Held';
  if (t.state === 'tbills') return 'T-bills';
  return `${t.votes.filter((v) => v.above).length} of ${t.votes.length}`;
}

export function longDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  const f = (o: Intl.DateTimeFormatOptions) => d.toLocaleString('en-US', { ...o, timeZone: 'UTC' });
  return `${f({ weekday: 'short' })} ${d.getUTCDate()} ${f({ month: 'short' })}`;
}

/** Parse the contribution field: '' is 0; anything not a non-negative number is invalid (null). */
export function parseContribution(text: string): number | null {
  const t = text.trim().replace(/[$,\s]/g, '');
  if (t === '') return 0;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}


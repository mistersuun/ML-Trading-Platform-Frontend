import type { components } from '../api/schema';
import { isNum, pct } from '../lib/format';

type S = components['schemas'];
export type RiskStatus = S['RiskStatusResponse'];

const NON_BLOCKING = new Set(['dry_run', 'submitted', 'accepted', 'filled', 'pending', 'ok']);

/** Worst peak-to-trough drawdown (a fraction <= 0) over the recorded readings, or null. */
export function worstDrawdown(h: RiskStatus['equity_history']): number | null {
  let peak = -Infinity;
  let worst: number | null = null;
  for (const p of h) {
    if (!isNum(p.sleeve_equity)) continue;
    peak = Math.max(peak, isNum(p.peak) ? p.peak : p.sleeve_equity, p.sleeve_equity);
    const dd = p.sleeve_equity / peak - 1;
    worst = worst === null ? dd : Math.min(worst, dd);
  }
  return worst;
}

const pts = (f: number) => `${(Math.abs(f) * 100).toFixed(1)}%`;

/** Title for the equity-vs-ladder panel. */
export function equityTitle(r: RiskStatus): string {
  if (r.equity_history.length === 0) return 'No sleeve readings recorded yet';
  const cuts = r.ladder.filter((l) => l.kind === 'cut').sort((a, b) => a.drawdown - b.drawdown);
  const halt = r.ladder.find((l) => l.kind === 'halt');
  const worst = worstDrawdown(r.equity_history);
  if (worst === null) return 'No sleeve readings recorded yet';
  const depth = Math.abs(worst);
  if (r.halted) return `Trading is halted; the sleeve is ${pts(isNum(r.drawdown) ? r.drawdown : worst)} below its peak`;
  if (halt && depth >= halt.drawdown) return `The sleeve has fallen past its ${pct(halt.drawdown, 0)} halt level (worst ${pts(worst)})`;
  const first = cuts[0];
  if (!first) return `The sleeve's worst drawdown so far is ${pts(worst)}`;
  if (depth >= first.drawdown) {
    const hit = cuts.filter((c) => depth >= c.drawdown).length;
    return `The sleeve has hit ${hit} of its ${cuts.length} risk cuts; its worst drawdown is ${pts(worst)}`;
  }
  if (depth < first.drawdown / 2) return 'The sleeve has never come close to its first risk cut';
  return `The sleeve has stayed above its first risk cut; worst drawdown ${pts(worst)} against ${pct(first.drawdown, 0)}`;
}

function used(l: RiskStatus['limits'][number]): number | null {
  return isNum(l.used) && isNum(l.maximum) && l.maximum > 0 ? l.used / l.maximum : null;
}

/** Title for the limits panel. */
export function limitsTitle(limits: RiskStatus['limits']): string {
  const fr = limits.map((l) => ({ l, f: used(l) })).filter((x): x is { l: typeof x.l; f: number } => x.f !== null);
  if (fr.length === 0) return 'Limit usage is not available yet';
  const full = fr.filter((x) => x.f >= 1);
  if (full.length === 1) return `${full[0].l.label} is at its maximum`;
  if (full.length > 1) return `${full.length} limits are at their maximum`;
  const top = fr.reduce((a, b) => (b.f > a.f ? b : a));
  if (top.f >= 0.8) return `${top.l.label} is close to its limit, at ${Math.round(top.f * 100)}% of the maximum`;
  if (top.f < 0.5) return 'Every limit has plenty of headroom';
  return `Every limit has headroom; the busiest, ${top.l.label.toLowerCase()}, is at ${Math.round(top.f * 100)}% of its maximum`;
}

export const isBlocked = (reason: string) => !NON_BLOCKING.has(reason);

/** Title for the decision-reasons panel. */
export function decisionsTitle(r: RiskStatus): string {
  const n = r.decision_total;
  const days = r.decision_window_days;
  if (n === 0) return `No order decisions in the last ${days} days`;
  const noun = n === 1 ? 'order decision' : 'order decisions';
  const blocked = r.decision_reasons.filter((x) => isBlocked(x.reason)).reduce((s, x) => s + x.count, 0);
  if (blocked >= n) return `Last ${days} days: ${n} ${noun}, ${n === 1 ? 'it was' : 'all'} blocked before the broker`;
  if (blocked === 0) return `Last ${days} days: ${n} ${noun}, none blocked`;
  return `Last ${days} days: ${n} ${noun}, ${blocked} blocked before the broker`;
}

/** "Mon 17:42" in New York time; falls back to the raw string. */
export function etTime(ts: string, now: number = Date.now()): string {
  const iso = /(Z|[+-]\d\d:?\d\d)$/.test(ts) ? ts : `${ts}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return ts;
  const parts = new Intl.DateTimeFormat('en-US', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/New_York',
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const old = now - d.getTime() >= 6 * 864e5;
  return `${g('weekday')}${old ? ` ${g('day')} ${g('month')}` : ''} ${g('hour')}:${g('minute')}`;
}

export const label = (s: string | null | undefined) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : '–';

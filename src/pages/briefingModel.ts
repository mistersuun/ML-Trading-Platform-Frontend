import type { components } from '../api/schema';
import { isNum } from '../lib/format';

type Briefing = components['schemas']['BriefingResponse'];

export const NO_BRIEFING_TITLE = 'No briefing yet — the nightly run writes one';

/** Why the nightly run wrote no text, in plain words. */
export function skipReason(reason: string | null | undefined): string {
  switch (reason) {
    case 'budget': return 'the spending cap has been reached';
    case 'no_api_key': return 'no Anthropic API key is configured';
    case 'disabled': return 'the briefing is switched off';
    case 'ledger': return 'the spend ledger could not be written, so no call was made';
    default: return reason ? `the run was skipped (${reason})` : 'the run was skipped';
  }
}

/** Panel title: the briefing headline, else a one-sentence finding about why there is none. */
export function briefingTitle(b: Briefing | undefined): string {
  if (!b) return 'Loading the latest briefing…';
  if (b.status === 'ok' && b.briefing?.headline) return b.briefing.headline;
  if (b.status === 'skipped') return `No briefing tonight — ${skipReason(b.reason)}`;
  if (b.status === 'error') return 'The last briefing attempt failed';
  return NO_BRIEFING_TITLE;
}

/** "US$0.012": three decimals below a cent-sized amount of interest, two for budgets. */
export const costLabel = (v: number | null | undefined, digits = 3): string => (isNum(v) ? `US$${v.toFixed(digits)}` : '');

export function relativeTime(iso: string, now: number = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const s = Math.round((now - t) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

export const absoluteTime = (iso: string): string => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? `${new Date(t).toISOString().slice(0, 16).replace('T', ' ')} UTC` : iso;
};

/** "US$0.41 of US$5.00 this month"; flags a reached cap. */
export function monthSpend(b: Briefing['budget']): { text: string; atCap: boolean } {
  const atCap = b.monthly_limit_usd > 0 && b.spent_month_usd >= b.monthly_limit_usd;
  return { text: `${costLabel(b.spent_month_usd, 2)} of ${costLabel(b.monthly_limit_usd, 2)} this month`, atCap };
}

/** "US$0.45 of US$0.50 today": the daily cap, which a budget skip may be about instead of the monthly one. */
export const todaySpend = (b: Briefing['budget']): string =>
  `${costLabel(b.spent_today_usd, 2)} of ${costLabel(b.daily_limit_usd, 2)} today`;

/** True when the shown run (or the newer attempt behind a good briefing) was skipped by a spending cap. */
export const isBudgetSkip = (b: Briefing): boolean =>
  (b.status === 'skipped' && b.reason === 'budget') || (b.last_attempt?.status === 'skipped' && b.last_attempt.reason === 'budget');

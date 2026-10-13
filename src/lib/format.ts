// Display helpers. Backend convention: every ratio is a FRACTION (0.153 = 15.3%),
// non-finite numbers arrive as null. Anything non-finite renders as 'n/a'.
export const NA = 'n/a';

export function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Fraction -> percent string. pct(0.153) === '15.3%'. */
export function pct(fraction: number | null | undefined, digits = 1): string {
  return isNum(fraction) ? `${(fraction * 100).toFixed(digits)}%` : NA;
}

/** Plain number. num(1.234) === '1.23'. */
export function num(value: number | null | undefined, digits = 2): string {
  return isNum(value) ? value.toFixed(digits) : NA;
}

/** Dollar amount. usd(1234.5) === '$1,234.50'. */
export function usd(value: number | null | undefined, digits = 2): string {
  if (!isNum(value)) return NA;
  const abs = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${value < 0 ? '-' : ''}$${abs}`;
}

/** Colour helper: up for >= 0, down for negative, neutral for n/a. */
export function signColor(v: number | null | undefined): string {
  if (!isNum(v)) return 'var(--text-1)';
  return v >= 0 ? 'var(--up)' : 'var(--down)';
}

const MINUS = '−';

/** Signed fraction -> percent with a true minus. signedPct(0.0049, 2) === '+0.49%'. */
export function signedPct(fraction: number | null | undefined, digits = 1): string {
  if (!isNum(fraction)) return NA;
  const s = (Math.abs(fraction) * 100).toFixed(digits);
  const zero = Number(s) === 0;
  return `${zero ? '' : fraction < 0 ? MINUS : '+'}${s}%`;
}

/** Signed dollar amount with a true minus. signedUsd(612.4) === '+$612.40'. */
export function signedUsd(value: number | null | undefined, digits = 2): string {
  if (!isNum(value)) return NA;
  const abs = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  });
  const zero = Number(abs.replace(/,/g, '')) === 0;
  return `${zero ? '' : value < 0 ? MINUS : '+'}$${abs}`;
}

/** Signed plain number with a true minus; for percentage-point drifts. */
export function signedNum(value: number | null | undefined, digits = 1): string {
  if (!isNum(value)) return NA;
  const s = Math.abs(value).toFixed(digits);
  return `${Number(s) === 0 ? '' : value < 0 ? MINUS : '+'}${s}`;
}

/** Whole-number grouping. int(12345) === '12,345'. */
export function int(value: number | null | undefined): string {
  return isNum(value) ? Math.round(value).toLocaleString('en-US') : NA;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** ISO date -> "7 Jun" (or "Jun 25" when monthYear). Unparseable input is returned as is. */
export function shortDate(iso: string, monthYear = false): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const mon = MONTHS[Number(m[2]) - 1];
  if (!mon) return iso;
  return monthYear ? `${mon} ${m[1].slice(2)}` : `${Number(m[3])} ${mon}`;
}

/** About one x tick per 80px: fewer on a phone. */
export function xTickCount(): number {
  const w = typeof window === 'undefined' ? 1024 : window.innerWidth;
  return w < 560 ? 3 : 5;
}

/** Currency prefix. USD (or unknown) is '$'; CAD is always 'CA$'; any other code is 'XXX '. */
export function currencyPrefix(currency?: string | null): string {
  const c = (currency ?? 'USD').toUpperCase();
  if (c === 'USD') return '$';
  if (c === 'CAD') return 'CA$';
  return `${c} `;
}

const group = (abs: number, digits: number) =>
  abs.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Amount in a currency. money(1234.5, 'CAD') === 'CA$1,234.50'; negatives use a true minus. */
export function money(value: number | null | undefined, currency?: string | null, digits = 2): string {
  if (!isNum(value)) return NA;
  const s = group(Math.abs(value), digits);
  const zero = Number(s.replace(/,/g, '')) === 0;
  return `${value < 0 && !zero ? MINUS : ''}${currencyPrefix(currency)}${s}`;
}

/** Signed amount in a currency with a true minus. signedMoney(612.4, 'CAD') === '+CA$612.40'. */
export function signedMoney(value: number | null | undefined, currency?: string | null, digits = 2): string {
  if (!isNum(value)) return NA;
  const s = group(Math.abs(value), digits);
  const zero = Number(s.replace(/,/g, '')) === 0;
  return `${zero ? '' : value < 0 ? MINUS : '+'}${currencyPrefix(currency)}${s}`;
}

/** Leverage multiple. multiple(1.568) === '1.57x'. */
export function multiple(value: number | null | undefined, digits = 2): string {
  return isNum(value) ? `${value.toFixed(digits)}x` : NA;
}

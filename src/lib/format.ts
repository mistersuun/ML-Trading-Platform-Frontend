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

/** Colour helper: green for >= 0, red for negative, neutral for n/a. */
export function signColor(v: number | null | undefined): string {
  if (!isNum(v)) return 'var(--text-primary)';
  return v >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
}

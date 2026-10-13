import { isNum } from '../../lib/format';

interface Props {
  value: number | null | undefined;
  /** Upper bound of the track (e.g. a limit). */
  max: number;
  label: string;
  /** Text shown beside the bar; defaults to "value / max". */
  text?: string;
  warnAt?: number;
  failAt?: number;
}

/** Thin value-vs-limit bar. Fill turns warn/down past warnAt/failAt; text always carries the number. */
export default function Meter({ value, max, label, text, warnAt, failAt }: Props) {
  const ok = isNum(value) && isNum(max) && max > 0;
  const frac = ok ? Math.min(Math.max((value as number) / max, 0), 1) : 0;
  const v = ok ? (value as number) : 0;
  const color = failAt != null && v >= failAt ? 'var(--down)'
    : warnAt != null && v >= warnAt ? 'var(--warn)' : 'var(--series-1)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div
        role="meter" aria-label={label}
        aria-valuemin={0} aria-valuemax={ok ? max : 0} aria-valuenow={v}
        style={{ position: 'relative', flex: 1, height: 10, background: 'var(--raised)', borderRadius: 3, overflow: 'hidden' }}
      >
        <div data-testid="meter-fill" style={{ width: `${frac * 100}%`, height: '100%', background: color }} />
      </div>
      <span style={{ minWidth: 64, textAlign: 'right' }}>{text ?? (ok ? `${value} / ${max}` : 'n/a')}</span>
    </div>
  );
}

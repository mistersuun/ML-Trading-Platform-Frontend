import { finite } from './scale';
import EmptyState from '../ui/EmptyState';

export interface StackSegment {
  name: string;
  /** Any non-negative unit; widths are value / total. */
  value: number;
  color: string;
}

interface Props {
  segments: StackSegment[];
  ariaLabel: string;
  /** Denominator; default is the sum of segments. */
  total?: number;
  height?: number;
  /** Text for each segment's hover title and the aria summary. */
  format?: (v: number) => string;
}

/** One horizontal composition bar: 2px gaps, rounded outer ends only. */
export default function StackedBar({ segments, ariaLabel, total, height = 22, format = (v) => String(v) }: Props) {
  const segs = segments.filter((s) => finite(s.value) && s.value > 0);
  const sum = total ?? segs.reduce((a, s) => a + s.value, 0);
  if (segs.length === 0 || !finite(sum) || sum <= 0) return <EmptyState height={height}>No composition to show.</EmptyState>;
  return (
    <div role="img" aria-label={`${ariaLabel}: ${segs.map((s) => `${s.name} ${format(s.value)}`).join(', ')}`}
      style={{ display: 'flex', gap: 2, height }}>
      {segs.map((s, k) => (
        <div key={s.name} title={`${s.name} ${format(s.value)}`} data-segment={s.name} style={{
          height: '100%', flex: `0 0 calc(${(s.value / sum) * 100}% - 2px)`, background: s.color,
          borderRadius: `${k === 0 ? 4 : 0}px ${k === segs.length - 1 ? 4 : 0}px ${k === segs.length - 1 ? 4 : 0}px ${k === 0 ? 4 : 0}px`,
        }} />
      ))}
    </div>
  );
}


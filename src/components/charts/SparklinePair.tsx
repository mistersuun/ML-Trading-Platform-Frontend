import { T } from '../../lib/tokens';
import { finite, linePath } from './scale';
import EmptyState from '../ui/EmptyState';

interface Props {
  /** Month-end closes (blue) and their moving average (grey dashed), same length or ma may carry nulls. */
  price: ReadonlyArray<number | null | undefined>;
  ma: ReadonlyArray<number | null | undefined>;
  ariaLabel: string;
  height?: number;
}

/** Tiny price vs moving-average pair on a shared y scale. */
export default function SparklinePair({ price, ma, ariaLabel, height = 56 }: Props) {
  const all = [...price, ...ma].filter(finite);
  if (price.filter(finite).length < 2) return <EmptyState height={height}>Not enough history.</EmptyState>;
  const lo = Math.min(...all), hi = Math.max(...all);
  const n = Math.max(price.length, ma.length);
  const X = (i: number) => (i / (n - 1)) * 200;
  const Y = (v: number) => 56 - ((v - lo) / (hi - lo || 1)) * 52;
  return (
    <svg role="img" aria-label={ariaLabel} viewBox="0 0 200 60" preserveAspectRatio="none" style={{ width: '100%', height, marginTop: 4 }}>
      <path data-role="ma" d={linePath(ma, X, Y)} fill="none" stroke={T.text3} strokeWidth={1.5} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
      <path data-role="price" d={linePath(price, X, Y)} fill="none" stroke={T.driftOver} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

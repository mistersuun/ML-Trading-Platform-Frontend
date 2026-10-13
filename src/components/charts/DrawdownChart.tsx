import { useMemo } from 'react';
import { T } from '../../lib/tokens';
import { signedPct } from '../../lib/format';
import LineChart from './LineChart';
import { finite } from './scale';

interface Props {
  x: ReadonlyArray<string>;
  /** Drawdown as fractions <= 0 (-0.047 = -4.7%). */
  values: ReadonlyArray<number | null | undefined>;
  ariaLabel?: string;
  height?: number;
  /** Floor of the axis in fractions; default: worst value rounded out to a whole percent, at least -2%. */
  floor?: number;
}

/** Underwater chart: 0% at the top, worst drawdown at the bottom, filled in the down colour. */
export default function DrawdownChart({ x, values, ariaLabel = 'Drawdown from peak', height = 70, floor }: Props) {
  const fl = useMemo(() => {
    if (floor !== undefined) return floor;
    const worst = Math.min(0, ...values.filter(finite));
    return Math.min(-0.02, Math.floor(worst * 100) / 100);
  }, [values, floor]);
  return (
    <LineChart
      x={x} ariaLabel={ariaLabel} height={height}
      series={[{ name: 'Drawdown', values, color: T.down, area: true }]}
      domain={[fl, 0]} yTicks={[0, fl]} baseline={0}
      yFormat={(v) => signedPct(v, 0)} gridlines={false} topRule endLabel={false}
      xTicks={[]} emptyText="No drawdown history."
    />
  );
}

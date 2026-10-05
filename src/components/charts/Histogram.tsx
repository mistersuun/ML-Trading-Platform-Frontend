import { useMemo } from 'react';
import { T } from '../../lib/tokens';
import { type HistBin, makeBins } from './scale';
import HiddenTable from './HiddenTable';
import EmptyState from '../ui/EmptyState';

interface Props {
  /** Raw observations (fractions); binned here. Or pass `bins`. */
  values?: ReadonlyArray<number | null | undefined>;
  bins?: HistBin[];
  binCount?: number;
  ariaLabel: string;
  /** Formats bin edges / axis labels. */
  format?: (v: number) => string;
  /** What is being counted, for titles: "trades". */
  noun?: string;
  height?: number;
}

/** Distribution of per-trade results; bars are coloured by sign (up right of zero, down left). */
export default function Histogram({ values, bins, binCount = 12, ariaLabel, format = (v) => v.toFixed(1), noun = 'items', height = 150 }: Props) {
  const b = useMemo(() => bins ?? makeBins(values ?? [], binCount), [bins, values, binCount]);
  const maxC = Math.max(0, ...b.map((x) => x.count));
  if (b.length === 0 || maxC === 0) return <EmptyState height={height}>No {noun} to show.</EmptyState>;
  const lo = b[0].from, hi = b[b.length - 1].to;
  return (
    <figure tabIndex={0} aria-label={ariaLabel} style={{ margin: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height, borderBottom: `1px solid ${T.borderStrong}` }}>
        {b.map((x, i) => (
          <div key={i} data-role="bin" title={`${x.count} ${noun} from ${format(x.from)} to ${format(x.to)}`} style={{
            flex: '1 1 0', borderRadius: '2px 2px 0 0', height: `${(x.count / maxC) * 100}%`,
            background: (x.from + x.to) / 2 < 0 ? T.down : T.up,
          }} />
        ))}
      </div>
      <div aria-hidden="true" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, color: T.text2, fontSize: 12 }}>
        <span>{format(lo)}</span>{lo < 0 && hi > 0 && <span>0</span>}<span>{format(hi)}</span>
      </div>
      <HiddenTable caption={ariaLabel} headers={['From', 'To', 'Count']} rows={b.map((x) => [format(x.from), format(x.to), x.count])} />
    </figure>
  );
}

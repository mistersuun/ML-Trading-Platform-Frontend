import type { ReactNode } from 'react';
import { T } from '../../lib/tokens';
import { finite } from './scale';
import { signedNum } from '../../lib/format';
import EmptyState from '../ui/EmptyState';

export interface DivergingRow {
  key: string;
  label: ReactNode;
  sub?: ReactNode;
  /** Signed drift in the chart's unit (percentage points). */
  value: number | null;
  /** Allowed half-width of the grey zone, same unit. Outside = flagged. */
  band?: number | null;
}

interface Props {
  rows: DivergingRow[];
  /** Value that maps to the full half-width. */
  scale: number;
  ariaLabel: string;
  format?: (v: number) => string;
  /** Axis captions under the bars: [left, centre, right]. */
  axisLabels?: [string, string, string];
}

/** Drift bars around a centre line, with the allowed band as a grey zone behind each. */
export default function DivergingBars({ rows, scale, ariaLabel, format = (v) => signedNum(v, 1), axisLabels }: Props) {
  if (rows.length === 0 || !(scale > 0)) return <EmptyState>No drift to show.</EmptyState>;
  return (
    <div role="group" aria-label={ariaLabel}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((r) => {
          const v = finite(r.value) ? r.value : null;
          const band = finite(r.band) ? r.band : null;
          const out = v !== null && band !== null && Math.abs(v) > band;
          const bw = band !== null ? Math.min((band / scale) * 50, 50) : 0;
          const w = v !== null ? Math.min((Math.abs(v) / scale) * 50, 50) : 0;
          return (
            <div key={r.key} data-row={r.key} className="dbar-row">
              <span className="dbar-label"><span style={{ fontWeight: 600 }}>{r.label}</span>{r.sub != null && <> <span style={{ color: T.text2 }}>{r.sub}</span></>}</span>
              <div className="dbar-track" style={{ position: 'relative', height: 16 }}>
                {band !== null && (
                  <div data-role="band" style={{ position: 'absolute', top: 0, bottom: 0, background: T.driftBand, left: `${50 - bw}%`, width: `${2 * bw}%` }} />
                )}
                <div aria-hidden="true" style={{ position: 'absolute', left: '50%', top: -3, bottom: -3, width: 1, background: T.driftMid }} />
                {v !== null && (
                  <div data-role="bar" style={{
                    position: 'absolute', top: 3, bottom: 3, width: `${w}%`,
                    background: v >= 0 ? T.driftOver : T.driftUnder,
                    ...(v >= 0 ? { left: '50%', borderRadius: '0 4px 4px 0' } : { right: '50%', borderRadius: '4px 0 0 4px' }),
                  }} />
                )}
              </div>
              <span style={{ textAlign: 'right', color: out ? T.warn : T.text1 }}>{v !== null ? format(v) : 'n/a'}</span>
              <span style={{ textAlign: 'right', color: out ? T.warn : T.text2, fontSize: 12, whiteSpace: 'nowrap' }}>
                {band === null || v === null ? '' : out ? '! outside' : 'in band'}
              </span>
            </div>
          );
        })}
      </div>
      {axisLabels && (
        <div aria-hidden="true" className="dbar-row dbar-axis" style={{ marginTop: 6, color: T.text2, fontSize: 12 }}>
          <span className="dbar-label" />
          <div className="dbar-track" style={{ display: 'flex', justifyContent: 'space-between', whiteSpace: 'nowrap', gap: 6 }}>{axisLabels.map((l) => <span key={l}>{l}</span>)}</div>
          <span /><span />
        </div>
      )}
    </div>
  );
}

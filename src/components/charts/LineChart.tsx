import { useMemo, type CSSProperties } from 'react';
import { SERIES, T } from '../../lib/tokens';
import { areaPath, evenIndices, finite, linePath, niceDomain, type Domain } from './scale';
import { useHover } from './useHover';
import HiddenTable from './HiddenTable';
import EmptyState from '../ui/EmptyState';

export interface LineSeries {
  name: string;
  values: ReadonlyArray<number | null | undefined>;
  color?: string;
  dashed?: boolean;
  /** Fill under the line (from the baseline). */
  area?: boolean;
  /** Skip this series in the legend/end label (e.g. a threshold line). */
  quiet?: boolean;
}

export interface LineChartProps {
  /** One label per point (dates); used for x ticks, tooltip and the data table. */
  x: ReadonlyArray<string>;
  series: LineSeries[];
  ariaLabel: string;
  height?: number;
  yFormat?: (v: number) => string;
  /** Explicit y ticks (also sets the domain to their extent). */
  yTicks?: number[];
  /** Fixed y domain; otherwise nice bounds around the data. */
  domain?: [number, number];
  /** Area fill baseline in data units (default: bottom of the domain). */
  baseline?: number;
  /** Which x labels to print under the plot. Default: ~5 evenly spaced. */
  xTicks?: { index: number; label: string }[];
  /** Direct label at the end of the first series. Default true. */
  endLabel?: boolean;
  /** Formatter for the end label (defaults to yFormat); lets it carry more precision than the axis. */
  endFormat?: (v: number) => string;
  gridlines?: boolean;
  /** Draw a strong rule at the top edge (underwater charts). */
  topRule?: boolean;
  emptyText?: string;
  /** Column width for right-side y labels. */
  axisWidth?: number;
}

const W = 1000;

export default function LineChart({
  x, series, ariaLabel, height = 240, yFormat = (v) => String(v), yTicks, domain, baseline,
  xTicks, endLabel = true, endFormat, gridlines = true, topRule = false, emptyText = 'No data to chart.', axisWidth = 48,
}: LineChartProps) {
  const n = x.length;
  const hover = useHover(n);

  const model = useMemo(() => {
    const vals = series.flatMap((s) => s.values.slice(0, n).filter(finite));
    if (n === 0 || vals.length === 0) return null;
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (baseline !== undefined) { lo = Math.min(lo, baseline); hi = Math.max(hi, baseline); }
    let d: Domain;
    if (domain) d = { lo: domain[0], hi: domain[1], ticks: yTicks ?? [domain[0], domain[1]] };
    else if (yTicks && yTicks.length > 0) d = { lo: Math.min(...yTicks), hi: Math.max(...yTicks), ticks: yTicks };
    else d = niceDomain(lo, hi);
    if (!(d.hi > d.lo)) d = { ...d, hi: d.lo + 1 };
    const X = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
    const Y = (v: number) => height - ((v - d.lo) / (d.hi - d.lo)) * height;
    const paths = series.map((s) => {
      const vs = s.values.slice(0, n);
      return {
        line: linePath(vs, X, Y),
        area: s.area ? areaPath(vs, X, Y, Y(Math.min(Math.max(baseline ?? d.lo, d.lo), d.hi))) : '',
      };
    });
    return { d, X, Y, paths };
  }, [series, n, height, domain, yTicks, baseline]);

  if (!model) return <EmptyState height={height}>{emptyText}</EmptyState>;
  const { d, Y, paths } = model;
  const colorOf = (s: LineSeries, i: number) => s.color ?? SERIES[i % SERIES.length];
  const pctLeft = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const pctTop = (v: number) => (Y(v) / height) * 100;
  const ticks = xTicks ?? evenIndices(n, 5).map((index) => ({ index, label: x[index] }));
  const showLegend = series.filter((s) => !s.quiet).length >= 2;
  const end = endLabel ? series.findIndex((s) => !s.quiet) : -1;
  const endVal = end >= 0 ? lastFinite(series[end].values.slice(0, n)) : null;

  const h = hover.idx;
  const tipStyle: CSSProperties = {
    position: 'absolute', top: 8, padding: '6px 8px', background: T.raised, border: `1px solid ${T.borderStrong}`,
    borderRadius: 4, fontSize: 12, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 2,
    ...(h !== null && pctLeft(h) > 70 ? { right: `${100 - pctLeft(h) + 1}%` } : { left: `${(h !== null ? pctLeft(h) : 0) + 1}%` }),
  };

  return (
    <figure
      tabIndex={0} aria-label={ariaLabel} style={{ margin: 0 }}
      onKeyDown={hover.onKeyDown} onBlur={hover.onBlur}
    >
      {showLegend && (
        <div style={{ display: 'flex', gap: 14, justifyContent: 'flex-end', color: 'var(--text-2)', fontSize: 12, marginBottom: 6 }}>
          {series.map((s, i) => !s.quiet && (
            <span key={s.name}>
              <span aria-hidden="true" style={{
                display: 'inline-block', width: 16, height: 0, verticalAlign: 'middle', marginRight: 4,
                borderTop: `2px ${s.dashed ? 'dashed' : 'solid'} ${colorOf(s, i)}`,
              }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ position: 'relative', flex: '1 1 auto', height, borderTop: topRule ? `1px solid ${T.borderStrong}` : undefined }}>
          {gridlines && d.ticks.map((t) => (
            <div key={t} aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, height: 1, background: T.grid, top: `${pctTop(t)}%` }} />
          ))}
          <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" aria-hidden="true"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
            {series.map((s, i) => paths[i].area && (
              <path key={`a${i}`} data-role="area" d={paths[i].area} fill={colorOf(s, i)} fillOpacity={0.12} stroke="none" />
            ))}
            {series.map((s, i) => paths[i].line && (
              <path key={`l${i}`} data-role="line" d={paths[i].line} fill="none" stroke={colorOf(s, i)} strokeWidth={s.quiet ? 1 : 2}
                strokeDasharray={s.dashed ? '6 5' : undefined} vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
          {endVal && end >= 0 && (
            <div data-testid="end-label" style={{
              position: 'absolute', right: 4, transform: 'translateY(-130%)', fontSize: 12, color: T.text1,
              top: `${pctTop(endVal.value)}%`, pointerEvents: 'none',
            }}>{(endFormat ?? yFormat)(endVal.value)}</div>
          )}
          {h !== null && (
            <>
              <div aria-hidden="true" style={{ position: 'absolute', top: 0, bottom: 0, width: 1, background: T.text3, left: `${pctLeft(h)}%` }} />
              {series.map((s, i) => {
                const v = s.values[h];
                return finite(v) && !s.quiet ? (
                  <div key={s.name} aria-hidden="true" style={{
                    position: 'absolute', width: 8, height: 8, borderRadius: '50%', background: colorOf(s, i),
                    boxShadow: `0 0 0 2px ${T.panel}`, transform: 'translate(-50%,-50%)',
                    left: `${pctLeft(h)}%`, top: `${pctTop(v)}%`, pointerEvents: 'none',
                  }} />
                ) : null;
              })}
              <div role="tooltip" style={tipStyle}>
                <div style={{ color: T.text2 }}>{x[h]}</div>
                {series.map((s, i) => !s.quiet && (
                  <div key={s.name} style={i === 0 ? undefined : { color: T.text2 }}>
                    {s.name} <strong>{finite(s.values[h]) ? yFormat(s.values[h] as number) : 'n/a'}</strong>
                  </div>
                ))}
              </div>
            </>
          )}
          <div data-testid="hover-surface" onPointerMove={hover.onPointerMove} onPointerLeave={hover.onPointerLeave}
            style={{ position: 'absolute', inset: 0, cursor: 'crosshair' }} />
        </div>
        <div aria-hidden="true" style={{ position: 'relative', width: axisWidth, height, color: T.text2, fontSize: 12 }}>
          {d.ticks.filter((t) => !(endVal && end >= 0 && Math.abs(Y(t) - Y(endVal.value)) < 10)).map((t) => (
            <div key={t} style={{ position: 'absolute', left: 0, transform: 'translateY(-50%)', top: `${pctTop(t)}%` }}>{yFormat(t)}</div>
          ))}
        </div>
      </div>
      {ticks.length > 0 && (
        <div aria-hidden="true" style={{ position: 'relative', height: 16, margin: `4px ${axisWidth + 8}px 0 0`, color: T.text2, fontSize: 12 }}>
          {ticks.map((t, k) => (
            <span key={`${t.index}-${k}`} style={{
              position: 'absolute', whiteSpace: 'nowrap', left: `${pctLeft(t.index)}%`,
              transform: k === 0 ? 'none' : k === ticks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
            }}>{t.label}</span>
          ))}
        </div>
      )}
      <HiddenTable
        caption={ariaLabel}
        headers={['Date', ...series.map((s) => s.name)]}
        rows={x.map((label, i) => [label, ...series.map((s) => (finite(s.values[i]) ? yFormat(s.values[i] as number) : 'n/a'))])}
      />
    </figure>
  );
}

function lastFinite(vs: ReadonlyArray<number | null | undefined>): { value: number } | null {
  for (let i = vs.length - 1; i >= 0; i--) { const v = vs[i]; if (finite(v)) return { value: v }; }
  return null;
}

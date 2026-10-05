import type { ReactNode } from 'react';
import { RAMP, T } from '../../lib/tokens';
import { finite } from './scale';
import EmptyState from '../ui/EmptyState';

export interface HBarItem {
  label: ReactNode;
  value: number;
  /** Per-item maximum (limits); otherwise the list max is shared. */
  max?: number;
  /** Right-hand text; default is the value. */
  display?: ReactNode;
  color?: string;
}

interface Props {
  items: HBarItem[];
  ariaLabel: string;
  /** Shared maximum; default = largest item value. Funnels pass the first stage. */
  max?: number;
  /** 'ramp' colours items by position on the ordinal blue ramp (funnels). */
  colors?: 'ramp' | 'single';
  labelWidth?: number;
  valueWidth?: number;
  barHeight?: number;
  /** Draw a track behind each bar. */
  track?: boolean;
  monoLabels?: boolean;
}

/** Horizontal bar list: funnel stages, reason counts, limits used. */
export default function HBarList({
  items, ariaLabel, max, colors = 'single', labelWidth = 170, valueWidth = 44, barHeight = 16, track = true, monoLabels = false,
}: Props) {
  if (items.length === 0) return <EmptyState>Nothing to show.</EmptyState>;
  const shared = max ?? Math.max(0, ...items.map((i) => (finite(i.value) ? i.value : 0)));
  return (
    <ul aria-label={ariaLabel} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((it, k) => {
        const v = finite(it.value) ? it.value : 0;
        const m = it.max ?? shared;
        const w = m > 0 ? Math.min(v / m, 1) * 100 : 0;
        const color = it.color ?? (colors === 'ramp' ? RAMP[Math.min(k, RAMP.length - 1)] : RAMP[3]);
        return (
          <li key={k} style={{ display: 'grid', gridTemplateColumns: `${labelWidth}px minmax(0, 1fr) ${valueWidth}px`, alignItems: 'center', gap: 10 }}>
            <span style={{ color: T.text2, fontSize: 12, ...(monoLabels ? { fontFamily: 'ui-monospace, Menlo, Consolas, monospace' } : {}) }}>{it.label}</span>
            <div style={{ height: barHeight, background: track ? T.raised : 'transparent', borderRadius: '0 4px 4px 0' }}>
              <div data-role="bar" style={{ height: '100%', borderRadius: '0 4px 4px 0', background: color, width: `${v > 0 ? Math.max(w, 0.6) : 0}%` }} />
            </div>
            <span style={{ textAlign: 'right' }}>{it.display ?? v}</span>
          </li>
        );
      })}
    </ul>
  );
}

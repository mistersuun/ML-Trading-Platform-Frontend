import type { ReactNode } from 'react';
import { toneColor, type Tone } from './tone';

export interface KeyValueItem {
  label: ReactNode;
  value: ReactNode;
  tone?: Tone;
  /** Raw CSS colour for the value; wins over tone. */
  color?: string;
}

interface Props {
  items: KeyValueItem[];
  /** 'list' = label left / value right rows; 'grid' = stacked label over value in N columns. */
  layout?: 'list' | 'grid';
  columns?: number;
}

export default function KeyValueList({ items, layout = 'list', columns = 3 }: Props) {
  if (layout === 'grid') {
    return (
      <dl style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 8, margin: 0 }}>
        {items.map((it, i) => (
          <div key={i}>
            <dt style={{ color: 'var(--text-2)', fontSize: 12 }}>{it.label}</dt>
            <dd style={{ margin: 0, color: it.color ?? toneColor(it.tone) }}>{it.value}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <dl style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
      {items.map((it, i) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0',
          borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
        }}>
          <dt style={{ color: it.tone === 'muted' ? 'var(--text-2)' : undefined }}>{it.label}</dt>
          <dd style={{ margin: 0, textAlign: 'right', color: it.color ?? toneColor(it.tone) }}>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

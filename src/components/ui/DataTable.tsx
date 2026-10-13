import type { ReactNode } from 'react';
import EmptyState from './EmptyState';

export interface Column<T> {
  key: string;
  header: ReactNode;
  /** Numbers and money: right-aligned tabular. */
  align?: 'left' | 'right' | 'center';
  render: (row: T, index: number) => ReactNode;
  width?: number | string;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string | number;
  /** Row height in px. */
  density?: 32 | 28 | 24;
  /** Scroll container height; header stays sticky inside it. */
  maxHeight?: number | string;
  caption?: string;
  empty?: ReactNode;
}

export default function DataTable<T>({
  columns, rows, rowKey, density = 32, maxHeight, caption, empty = 'No rows.',
}: Props<T>) {
  if (rows.length === 0) return <EmptyState>{empty}</EmptyState>;
  return (
    <div style={{ overflow: 'auto', maxHeight }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" style={{
                position: 'sticky', top: 0, background: 'var(--panel)', zIndex: 1,
                textAlign: c.align ?? 'left', fontWeight: 500, fontSize: 12, color: 'var(--text-2)',
                padding: '0 8px', height: density, borderBottom: '1px solid var(--border-strong)',
                whiteSpace: 'nowrap', width: c.width,
              }}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey(row, i)}>
              {columns.map((c) => (
                <td key={c.key} style={{
                  textAlign: c.align ?? 'left', padding: '0 8px', height: density,
                  borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                  fontVariantNumeric: 'tabular-nums',
                }}>{c.render(row, i)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

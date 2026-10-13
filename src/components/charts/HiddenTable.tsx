import type { ReactNode } from 'react';

interface Props {
  caption: string;
  headers: string[];
  rows: ReactNode[][];
  /** Keep the hidden table bounded; rows are strided down to this many. */
  maxRows?: number;
}

/** Visually hidden data table: the screen-reader / keyboard fallback for a chart. */
export default function HiddenTable({ caption, headers, rows, maxRows = 120 }: Props) {
  const stride = rows.length > maxRows ? Math.ceil(rows.length / maxRows) : 1;
  const shown = rows.filter((_, i) => i % stride === 0 || i === rows.length - 1);
  return (
    <div className="sr-only">
    <table>
      <caption>{caption}</caption>
      <thead><tr>{headers.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr></thead>
      <tbody>
        {shown.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}
      </tbody>
    </table>
    </div>
  );
}

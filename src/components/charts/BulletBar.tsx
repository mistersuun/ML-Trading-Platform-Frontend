import type { ReactNode } from 'react';
import { RAMP, T } from '../../lib/tokens';
import { finite } from './scale';

export interface BulletMark {
  /** Position in the same units as value/max. */
  at: number;
  label?: ReactNode;
  /** Second caption line. */
  sub?: ReactNode;
  color?: string;
  /** Marks at the very end get right-aligned captions. */
  align?: 'center' | 'right';
}

interface Props {
  value: number | null | undefined;
  /** Track spans 0..max. */
  max: number;
  marks?: BulletMark[];
  ariaLabel: string;
  /** Fill colour; default blue ramp 3. Use status to flip to the down colour. */
  fill?: string;
  status?: 'pass' | 'fail' | 'recorded';
  height?: number;
  /** Caption under the left end (e.g. "Now −1.4%"). */
  valueLabel?: ReactNode;
}

/** Value against one or more threshold marks on a 0..max track. */
export default function BulletBar({ value, max, marks = [], ariaLabel, fill, status, height = 16, valueLabel }: Props) {
  const ok = finite(value) && finite(max) && max > 0;
  const frac = ok ? Math.min(Math.max((value as number) / max, 0), 1) : 0;
  const color = fill ?? (status === 'fail' ? T.down : status === 'recorded' ? RAMP[2] : RAMP[3]);
  const captioned = marks.some((m) => m.label != null) || valueLabel != null;
  const pos = (at: number) => `${Math.min(Math.max(at / max, 0), 1) * 100}%`;
  return (
    <div role="img" aria-label={ariaLabel}>
      <div style={{ position: 'relative', height, background: T.raised, borderRadius: 4 }}>
        <div data-role="fill" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${frac * 100}%`, background: color, borderRadius: frac >= 1 ? 4 : '4px 0 0 4px' }} />
        {max > 0 && marks.filter((m) => finite(m.at)).map((m, i) => (
          <div key={i} data-role="mark" style={{
            position: 'absolute', top: -4, bottom: -4, width: m.align === 'right' ? 3 : 2, background: m.color ?? T.text3,
            ...(m.align === 'right' ? { right: 0 } : { left: pos(m.at) }),
          }} />
        ))}
      </div>
      {captioned && (
        <div aria-hidden="true" style={{ position: 'relative', height: 36, fontSize: 12, marginTop: 6 }}>
          {valueLabel != null && <span style={{ position: 'absolute', left: 0 }}>{valueLabel}</span>}
          {marks.map((m, i) => m.label != null && (
            <span key={i} style={{
              position: 'absolute', color: m.color && m.color !== T.text3 ? m.color : T.text2, textAlign: m.align === 'right' ? 'right' : 'center',
              ...(m.align === 'right' ? { right: 0 } : { left: pos(m.at), transform: 'translateX(-50%)' }),
            }}>{m.label}{m.sub != null && <><br />{m.sub}</>}</span>
          ))}
        </div>
      )}
    </div>
  );
}

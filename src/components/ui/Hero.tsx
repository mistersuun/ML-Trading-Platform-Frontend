import type { ReactNode } from 'react';
import { toneColor, type Tone } from './tone';

export interface HeroStat {
  label: ReactNode;
  value: ReactNode;
  tone?: Tone;
}

interface Props {
  label: ReactNode;
  /** Pre-formatted big value, e.g. usd(total). */
  value: ReactNode;
  /** Delta line, e.g. "+$612.40 (+0.49%)" with its direction glyph added here. */
  delta?: { text: ReactNode; tone: Tone; note?: ReactNode } | null;
  stats?: HeroStat[];
}

/** Big headline number + delta + a 2-column grid of secondary stats. */
export default function Hero({ label, value, delta, stats }: Props) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 40px', alignItems: 'flex-end' }}>
      <div>
        <div style={{ color: 'var(--text-2)', fontSize: 12 }}>{label}</div>
        <div style={{ fontSize: 'clamp(30px, 9vw, 44px)', overflowWrap: 'anywhere', fontWeight: 600, letterSpacing: -0.5, lineHeight: 1.1 }}>{value}</div>
        {delta && (
          <div style={{ marginTop: 4 }}>
            <span style={{ color: toneColor(delta.tone) }}>
              <span aria-hidden="true">{delta.tone === 'up' ? '▲ ' : delta.tone === 'down' ? '▼ ' : ''}</span>
              {delta.text}
            </span>
            {delta.note != null && <span style={{ color: 'var(--text-2)', fontSize: 12 }}> {delta.note}</span>}
          </div>
        )}
      </div>
      {stats && stats.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px 28px' }}>
          {stats.map((s, i) => (
            <div key={i}>
              <div style={{ color: 'var(--text-2)', fontSize: 12 }}>{s.label}</div>
              <div style={{ fontSize: 18, color: toneColor(s.tone) }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

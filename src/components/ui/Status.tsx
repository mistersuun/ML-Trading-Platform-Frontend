import type { ReactNode } from 'react';

export type StatusKind = 'pass' | 'fail' | 'warn' | 'recorded';

const META: Record<StatusKind, { glyph: string; word: string; color: string }> = {
  pass: { glyph: '✓', word: 'Pass', color: 'var(--up)' },
  fail: { glyph: '✕', word: 'Fail', color: 'var(--down)' },
  warn: { glyph: '!', word: 'Warn', color: 'var(--warn)' },
  recorded: { glyph: '–', word: 'Recorded', color: 'var(--text-2)' },
};

interface Props {
  kind: StatusKind;
  /** Replaces the default word, e.g. "2 of 3". The glyph always stays. */
  children?: ReactNode;
}

/** Glyph + word, never colour alone. */
export default function Status({ kind, children }: Props) {
  const m = META[kind];
  return (
    <span data-status={kind} style={{ color: m.color, whiteSpace: 'nowrap' }}>
      <span aria-hidden="true">{m.glyph} </span>
      {children ?? m.word}
    </span>
  );
}

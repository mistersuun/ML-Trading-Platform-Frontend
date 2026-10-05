export type Tone = 'up' | 'down' | 'warn' | 'muted' | 'neutral';
export function toneColor(tone: Tone | undefined): string {
  switch (tone) {
    case 'up': return 'var(--up)';
    case 'down': return 'var(--down)';
    case 'warn': return 'var(--warn)';
    case 'muted': return 'var(--text-2)';
    default: return 'var(--text-1)';
  }
}

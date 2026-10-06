import { THEME_PREFS, useThemePref, type ThemePref } from '../../lib/theme';

const LABEL: Record<ThemePref, string> = { system: 'System', dark: 'Dark', light: 'Light' };

/** System / Dark / Light button group. `compact` is the sidebar-footer variant. */
export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [pref, setPref] = useThemePref();
  return (
    <div role="group" aria-label="Theme" style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 3, overflow: 'hidden' }}>
      {THEME_PREFS.map((p) => {
        const on = p === pref;
        return (
          <button
            key={p} type="button" aria-pressed={on} onClick={() => setPref(p)}
            style={{
              font: 'inherit', fontSize: compact ? 12 : 13, padding: compact ? '3px 8px' : '4px 12px', minHeight: compact ? 24 : 28,
              cursor: 'pointer', border: 0, borderRight: p === 'light' ? 0 : '1px solid var(--border)',
              background: on ? 'var(--toggle-on)' : 'transparent', color: on ? 'var(--text-1)' : 'var(--text-2)', fontWeight: on ? 600 : 400,
            }}
          >
            {LABEL[p]}
          </button>
        );
      })}
    </div>
  );
}

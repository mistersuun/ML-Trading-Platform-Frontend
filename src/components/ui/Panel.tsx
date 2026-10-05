import { useId, type CSSProperties, type ReactNode } from 'react';

interface Props {
  /** One-sentence finding computed from the data, e.g. "Portfolio is ahead of 60/40 by 2.1 points". */
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned header content (legend, toggle). */
  aside?: ReactNode;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
  /** Flex-basis hint for page layouts, e.g. '2 1 420px'. */
  flex?: string;
}

export default function Panel({ title, subtitle, aside, children, style, className, flex }: Props) {
  const id = useId();
  const hasHead = title != null || subtitle != null || aside != null;
  return (
    <section
      aria-labelledby={title != null ? id : undefined}
      className={className}
      style={{
        background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 4,
        padding: '14px 16px', minWidth: 0, ...(flex ? { flex } : {}), ...style,
      }}
    >
      {hasHead && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6, marginBottom: children != null ? 10 : 0 }}>
          <div>
            {title != null && <h2 id={id} style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 600 }}>{title}</h2>}
            {subtitle != null && <div style={{ color: 'var(--text-2)', fontSize: 12 }}>{subtitle}</div>}
          </div>
          {aside != null && <div style={{ color: 'var(--text-2)', fontSize: 12 }}>{aside}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

import { useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { HeaderSlotContext } from './headerSlot';

interface Props {
  title: string;
  /** Muted context line, e.g. "Prices at close Mon 5 Oct". */
  meta?: ReactNode;
  /** Right-aligned controls (range toggle, buttons). */
  actions?: ReactNode;
}

/**
 * Page title bar. Inside the app shell it portals into the 40px header slot;
 * rendered alone (tests, storybook-style use) it falls back to inline.
 */
export default function PageHeader({ title, meta, actions }: Props) {
  const slot = useContext(HeaderSlotContext);
  const content = (
    <>
      <h1 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{title}</h1>
      {meta != null && <span style={{ color: 'var(--text-2)', fontSize: 13 }}>{meta}</span>}
      {actions != null && <span style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>{actions}</span>}
    </>
  );
  if (slot) return createPortal(content, slot);
  return (
    <header style={headerStyle}>{content}</header>
  );
}

const headerStyle = {
  display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 16px', minHeight: 40,
  padding: '0 16px', borderBottom: '1px solid var(--border)', background: 'var(--panel)',
} as const;

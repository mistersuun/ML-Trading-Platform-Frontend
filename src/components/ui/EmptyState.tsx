import type { ReactNode } from 'react';

export default function EmptyState({ children, height }: { children: ReactNode; height?: number }) {
  return (
    <div role="status" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: height ?? 80,
      color: 'var(--text-2)', border: '1px dashed var(--border)', borderRadius: 4, padding: 12, textAlign: 'center',
    }}>
      {children}
    </div>
  );
}

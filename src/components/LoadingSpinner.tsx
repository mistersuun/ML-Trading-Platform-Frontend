export default function LoadingSpinner({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex items-center gap-3 py-8">
      <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: 'var(--accent-blue)', borderTopColor: 'transparent' }} />
      <span style={{ color: 'var(--text-secondary)' }}>{text}</span>
    </div>
  );
}

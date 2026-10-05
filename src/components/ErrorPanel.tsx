import { ApiError } from '../api/client';

interface Props {
  error: Error | ApiError | string;
  onRetry?: () => void;
}

export default function ErrorPanel({ error, onRetry }: Props) {
  const message = typeof error === 'string' ? error : error.message;
  const code = error instanceof ApiError ? error.code : null;
  return (
    <div role="alert" className="rounded-lg p-4 mb-6 flex items-start justify-between gap-4"
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent-red)' }}>
      <div>
        <div className="font-semibold mb-1" style={{ color: 'var(--accent-red)' }}>
          Something went wrong{code ? ` (${code})` : ''}
        </div>
        <div className="text-sm">{message}</div>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="px-4 py-1 rounded font-semibold text-black text-sm"
          style={{ background: 'var(--accent-blue)' }}>
          Retry
        </button>
      )}
    </div>
  );
}
